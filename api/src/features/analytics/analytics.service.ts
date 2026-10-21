import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../../schemas/user.schema';
import { Doctor } from '../../schemas/doctor.schema';
import { Profile } from '../../schemas/profile.schema';
import { Consultation } from '../../schemas/consultation.schema';
import { Payment } from '../../schemas/payment.schema';
import { Prescription } from '../../schemas/prescription.schema';
import { AvailabilitySlot } from '../../schemas/availability_slot.schema';
import { AuditLog } from '../../schemas/audit_log.schema';
import { UserRole } from '../../common/enum/user-role.enum';
import { handleServiceError } from '../../utils/error/error.util';

import { AnalyticsFilterInput } from './dto/analytics-filter.input';
import { TimeGranularity } from './dto/time-granularity.enum';
import { AdminDashboardSummaryEntity } from './entities/admin-dashboard-summary.entity';
import { RevenueAnalyticsEntity } from './entities/revenue-analytics.entity';
import { ConsultationAnalyticsEntity } from './entities/consultation-analytics.entity';
import { DoctorAnalyticsEntity } from './entities/doctor-analytics.entity';
import { PatientAnalyticsEntity } from './entities/patient-analytics.entity';
import { ClinicalAndSystemAnalyticsEntity } from './entities/clinical-and-system-analytics.entity';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Doctor)
    private readonly doctorRepository: Repository<Doctor>,
    @InjectRepository(Profile)
    private readonly profileRepository: Repository<Profile>,
    @InjectRepository(Consultation)
    private readonly consultationRepository: Repository<Consultation>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Prescription)
    private readonly prescriptionRepository: Repository<Prescription>,
    @InjectRepository(AvailabilitySlot)
    private readonly slotRepository: Repository<AvailabilitySlot>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  /**
   * Helper to normalize filter bounds and SQL date_trunc bucket.
   */
  private parseFilter(filter?: AnalyticsFilterInput) {
    const endDate = filter?.endDate ? new Date(filter.endDate) : new Date();
    const startDate = filter?.startDate
      ? new Date(filter.startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const granularity = (filter?.granularity || TimeGranularity.DAY).toLowerCase();
    const dateTrunc = granularity === 'month' ? 'month' : granularity === 'week' ? 'week' : 'day';

    return { startDate, endDate, dateTrunc };
  }

  /**
   * 1. Top-Level Executive Dashboard Summary
   */
  async getDashboardSummary(
    filter?: AnalyticsFilterInput,
  ): Promise<AdminDashboardSummaryEntity> {
    try {
      const { startDate, endDate } = this.parseFilter(filter);
      const windowDurationMs = endDate.getTime() - startDate.getTime();
      const prevStartDate = new Date(startDate.getTime() - windowDurationMs);
      const prevEndDate = new Date(startDate.getTime());

      // Current Revenue
      const currentRevRaw = await this.paymentRepository
        .createQueryBuilder('p')
        .select('COALESCE(SUM(CAST(p.amount AS numeric)), 0)', 'total')
        .where("p.payment_status IN ('PAID', 'COMPLETED')")
        .andWhere(
          '(p.paid_at BETWEEN :start AND :end OR (p.paid_at IS NULL AND p.created_at BETWEEN :start AND :end))',
          { start: startDate, end: endDate },
        )
        .getRawOne();
      const totalRevenue = Number.parseFloat(currentRevRaw?.total || '0');

      // Preceding Period Revenue for growth comparison
      const prevRevRaw = await this.paymentRepository
        .createQueryBuilder('p')
        .select('COALESCE(SUM(CAST(p.amount AS numeric)), 0)', 'total')
        .where("p.payment_status IN ('PAID', 'COMPLETED')")
        .andWhere(
          '(p.paid_at BETWEEN :prevStart AND :prevEnd OR (p.paid_at IS NULL AND p.created_at BETWEEN :prevStart AND :prevEnd))',
          { prevStart: prevStartDate, prevEnd: prevEndDate },
        )
        .getRawOne();
      const prevRevenue = Number.parseFloat(prevRevRaw?.total || '0');

      const revenueGrowth =
        prevRevenue > 0
          ? ((totalRevenue - prevRevenue) / prevRevenue) * 100
          : totalRevenue > 0
          ? 100
          : 0;

      // Consultations summary in window
      const consultsRaw = await this.consultationRepository
        .createQueryBuilder('c')
        .select('COUNT(*)', 'total')
        .addSelect("COUNT(*) FILTER (WHERE c.status = 'COMPLETED')", 'completed')
        .addSelect("COUNT(*) FILTER (WHERE c.status = 'CANCELLED')", 'cancelled')
        .where('c.created_at BETWEEN :start AND :end', { start: startDate, end: endDate })
        .getRawOne();

      const totalConsultations = Number.parseInt(consultsRaw?.total || '0', 10);
      const completedConsultations = Number.parseInt(consultsRaw?.completed || '0', 10);
      const cancelledConsultations = Number.parseInt(consultsRaw?.cancelled || '0', 10);
      const cancellationRate =
        totalConsultations > 0 ? (cancelledConsultations / totalConsultations) * 100 : 0;

      // Patient accounts
      const patientsRaw = await this.userRepository
        .createQueryBuilder('u')
        .select('COUNT(*)', 'total')
        .addSelect('COUNT(*) FILTER (WHERE u.created_at BETWEEN :start AND :end)', 'new_in_period')
        .where('u.role = :role', { role: UserRole.PATIENT })
        .setParameters({ start: startDate, end: endDate })
        .getRawOne();
      const totalPatients = Number.parseInt(patientsRaw?.total || '0', 10);
      const newPatientsInPeriod = Number.parseInt(patientsRaw?.new_in_period || '0', 10);

      // Doctor accounts & verification pipeline
      const doctorsRaw = await this.doctorRepository
        .createQueryBuilder('d')
        .select('COUNT(*)', 'total')
        .addSelect("COUNT(*) FILTER (WHERE d.verification_status = 'PENDING')", 'pending')
        .getRawOne();
      const totalDoctors = Number.parseInt(doctorsRaw?.total || '0', 10);
      const pendingDoctorVerifications = Number.parseInt(doctorsRaw?.pending || '0', 10);

      // Slot utilization rate in window
      const slotsRaw = await this.slotRepository
        .createQueryBuilder('s')
        .select('COUNT(*)', 'total')
        .addSelect("COUNT(*) FILTER (WHERE s.status = 'BOOKED')", 'booked')
        .where('s.created_at BETWEEN :start AND :end', { start: startDate, end: endDate })
        .getRawOne();
      const totalSlots = Number.parseInt(slotsRaw?.total || '0', 10);
      const bookedSlots = Number.parseInt(slotsRaw?.booked || '0', 10);
      const slotUtilizationRate = totalSlots > 0 ? (bookedSlots / totalSlots) * 100 : 0;

      // Active users who logged in within last 30 days
      const activeUsersRaw = await this.userRepository
        .createQueryBuilder('u')
        .select('COUNT(*)', 'active')
        .where("u.last_login_at >= NOW() - INTERVAL '30 days'")
        .getRawOne();
      const activeUsersLast30Days = Number.parseInt(activeUsersRaw?.active || '0', 10);

      return {
        total_revenue: Math.round(totalRevenue * 100) / 100,
        revenue_growth_percentage: Math.round(revenueGrowth * 10) / 10,
        total_consultations: totalConsultations,
        completed_consultations: completedConsultations,
        cancellation_rate: Math.round(cancellationRate * 10) / 10,
        total_patients: totalPatients,
        new_patients_in_period: newPatientsInPeriod,
        total_doctors: totalDoctors,
        pending_doctor_verifications: pendingDoctorVerifications,
        slot_utilization_rate: Math.round(slotUtilizationRate * 10) / 10,
        active_users_last_30_days: activeUsersLast30Days,
      };
    } catch (error) {
      handleServiceError(error, this.logger, 'AnalyticsService.getDashboardSummary');
    }
  }

  /**
   * 2. Financial & Revenue In-Depth Analytics
   */
  async getRevenueAnalytics(
    filter?: AnalyticsFilterInput,
  ): Promise<RevenueAnalyticsEntity> {
    try {
      const { startDate, endDate, dateTrunc } = this.parseFilter(filter);

      // Aggregates for paid transactions
      const revSummary = await this.paymentRepository
        .createQueryBuilder('p')
        .select('COALESCE(SUM(CAST(p.amount AS numeric)), 0)', 'total_revenue')
        .addSelect('COUNT(*)', 'total_transactions')
        .addSelect('COALESCE(AVG(CAST(p.amount AS numeric)), 0)', 'avg_value')
        .where("p.payment_status IN ('PAID', 'COMPLETED')")
        .andWhere(
          '(p.paid_at BETWEEN :start AND :end OR (p.paid_at IS NULL AND p.created_at BETWEEN :start AND :end))',
          { start: startDate, end: endDate },
        )
        .getRawOne();

      const totalRevenue = Number.parseFloat(revSummary?.total_revenue || '0');
      const totalTransactions = Number.parseInt(revSummary?.total_transactions || '0', 10);
      const avgValue = Number.parseFloat(revSummary?.avg_value || '0');

      // Breakdown by payment status
      const statusRaw = await this.paymentRepository
        .createQueryBuilder('p')
        .select('p.payment_status', 'status')
        .addSelect('COALESCE(SUM(CAST(p.amount AS numeric)), 0)', 'amount')
        .addSelect('COUNT(*)', 'count')
        .where('p.created_at BETWEEN :start AND :end', { start: startDate, end: endDate })
        .groupBy('p.payment_status')
        .getRawMany();

      const revenueByStatus = statusRaw.map((row) => ({
        status: row.status || 'UNKNOWN',
        amount: Math.round(Number.parseFloat(row.amount || '0') * 100) / 100,
        count: Number.parseInt(row.count || '0', 10),
      }));

      // Breakdown by payment method
      const methodRaw = await this.paymentRepository
        .createQueryBuilder('p')
        .select("COALESCE(NULLIF(p.payment_method, ''), 'OTHER')", 'payment_method')
        .addSelect('COALESCE(SUM(CAST(p.amount AS numeric)), 0)', 'amount')
        .addSelect('COUNT(*)', 'count')
        .where("p.payment_status IN ('PAID', 'COMPLETED')")
        .andWhere(
          '(p.paid_at BETWEEN :start AND :end OR (p.paid_at IS NULL AND p.created_at BETWEEN :start AND :end))',
          { start: startDate, end: endDate },
        )
        .groupBy("COALESCE(NULLIF(p.payment_method, ''), 'OTHER')")
        .getRawMany();

      const revenueByMethod = methodRaw.map((row) => ({
        payment_method: row.payment_method,
        amount: Math.round(Number.parseFloat(row.amount || '0') * 100) / 100,
        count: Number.parseInt(row.count || '0', 10),
      }));

      // Timeline series points
      const timelineRaw = await this.paymentRepository
        .createQueryBuilder('p')
        .select(`TO_CHAR(DATE_TRUNC('${dateTrunc}', COALESCE(p.paid_at, p.created_at)), 'YYYY-MM-DD')`, 'date')
        .addSelect('COALESCE(SUM(CAST(p.amount AS numeric)), 0)', 'revenue')
        .addSelect('COUNT(*)', 'transaction_count')
        .where("p.payment_status IN ('PAID', 'COMPLETED')")
        .andWhere(
          '(p.paid_at BETWEEN :start AND :end OR (p.paid_at IS NULL AND p.created_at BETWEEN :start AND :end))',
          { start: startDate, end: endDate },
        )
        .groupBy(`DATE_TRUNC('${dateTrunc}', COALESCE(p.paid_at, p.created_at))`)
        .orderBy('date', 'ASC')
        .getRawMany();

      const timeline = timelineRaw.map((row) => ({
        date: row.date,
        revenue: Math.round(Number.parseFloat(row.revenue || '0') * 100) / 100,
        transaction_count: Number.parseInt(row.transaction_count || '0', 10),
      }));

      return {
        total_revenue: Math.round(totalRevenue * 100) / 100,
        total_transactions: totalTransactions,
        average_transaction_value: Math.round(avgValue * 100) / 100,
        revenue_by_status: revenueByStatus,
        revenue_by_payment_method: revenueByMethod,
        timeline,
      };
    } catch (error) {
      handleServiceError(error, this.logger, 'AnalyticsService.getRevenueAnalytics');
    }
  }

  /**
   * 3. Consultation Volume, Modality & Operational Analytics
   */
  async getConsultationAnalytics(
    filter?: AnalyticsFilterInput,
  ): Promise<ConsultationAnalyticsEntity> {
    try {
      const { startDate, endDate, dateTrunc } = this.parseFilter(filter);

      const consultsRaw = await this.consultationRepository
        .createQueryBuilder('c')
        .select('COUNT(*)', 'total')
        .addSelect("COUNT(*) FILTER (WHERE c.status = 'COMPLETED')", 'completed')
        .addSelect("COUNT(*) FILTER (WHERE c.status = 'CANCELLED')", 'cancelled')
        .where('c.created_at BETWEEN :start AND :end', { start: startDate, end: endDate })
        .getRawOne();

      const totalConsultations = Number.parseInt(consultsRaw?.total || '0', 10);
      const completedConsultations = Number.parseInt(consultsRaw?.completed || '0', 10);
      const cancelledConsultations = Number.parseInt(consultsRaw?.cancelled || '0', 10);

      const completionRate =
        totalConsultations > 0 ? (completedConsultations / totalConsultations) * 100 : 0;
      const cancellationRate =
        totalConsultations > 0 ? (cancelledConsultations / totalConsultations) * 100 : 0;

      // Status breakdown
      const statusRaw = await this.consultationRepository
        .createQueryBuilder('c')
        .select('c.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where('c.created_at BETWEEN :start AND :end', { start: startDate, end: endDate })
        .groupBy('c.status')
        .getRawMany();

      const consultationsByStatus = statusRaw.map((row) => ({
        status: row.status || 'UNKNOWN',
        count: Number.parseInt(row.count || '0', 10),
      }));

      // Type breakdown (ONLINE vs IN_PERSON)
      const typeRaw = await this.consultationRepository
        .createQueryBuilder('c')
        .select('c.consultation_type', 'type')
        .addSelect('COUNT(*)', 'count')
        .where('c.created_at BETWEEN :start AND :end', { start: startDate, end: endDate })
        .groupBy('c.consultation_type')
        .getRawMany();

      const consultationsByType = typeRaw.map((row) => ({
        type: row.type || 'ONLINE',
        count: Number.parseInt(row.count || '0', 10),
      }));

      // Timeline
      const timelineRaw = await this.consultationRepository
        .createQueryBuilder('c')
        .select(`TO_CHAR(DATE_TRUNC('${dateTrunc}', c.created_at), 'YYYY-MM-DD')`, 'date')
        .addSelect('COUNT(*)', 'total')
        .addSelect("COUNT(*) FILTER (WHERE c.status = 'COMPLETED')", 'completed')
        .addSelect("COUNT(*) FILTER (WHERE c.status = 'CANCELLED')", 'cancelled')
        .where('c.created_at BETWEEN :start AND :end', { start: startDate, end: endDate })
        .groupBy(`DATE_TRUNC('${dateTrunc}', c.created_at)`)
        .orderBy('date', 'ASC')
        .getRawMany();

      const timeline = timelineRaw.map((row) => ({
        date: row.date,
        total: Number.parseInt(row.total || '0', 10),
        completed: Number.parseInt(row.completed || '0', 10),
        cancelled: Number.parseInt(row.cancelled || '0', 10),
      }));

      // Peak booking hours (from scheduled_at)
      const peakHoursRaw = await this.consultationRepository
        .createQueryBuilder('c')
        .select('EXTRACT(HOUR FROM c.scheduled_at)::int', 'hour')
        .addSelect('COUNT(*)', 'count')
        .where('c.scheduled_at BETWEEN :start AND :end', { start: startDate, end: endDate })
        .groupBy('EXTRACT(HOUR FROM c.scheduled_at)')
        .orderBy('hour', 'ASC')
        .getRawMany();

      const peakHours = peakHoursRaw.map((row) => ({
        hour: Number.parseInt(row.hour || '0', 10),
        count: Number.parseInt(row.count || '0', 10),
      }));

      return {
        total_consultations: totalConsultations,
        completion_rate: Math.round(completionRate * 10) / 10,
        cancellation_rate: Math.round(cancellationRate * 10) / 10,
        consultations_by_status: consultationsByStatus,
        consultations_by_type: consultationsByType,
        timeline,
        peak_hours: peakHours,
      };
    } catch (error) {
      handleServiceError(error, this.logger, 'AnalyticsService.getConsultationAnalytics');
    }
  }

  /**
   * 4. Doctor Network, Capacity & Top Performers
   */
  async getDoctorAnalytics(
    filter?: AnalyticsFilterInput,
  ): Promise<DoctorAnalyticsEntity> {
    try {
      const { startDate, endDate } = this.parseFilter(filter);

      // Total doctors
      const totalDoctors = await this.doctorRepository.count();

      // Verification status breakdown
      const verificationRaw = await this.doctorRepository
        .createQueryBuilder('d')
        .select('d.verification_status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('d.verification_status')
        .getRawMany();

      const verificationBreakdown = verificationRaw.map((row) => ({
        status: row.status || 'PENDING',
        count: Number.parseInt(row.count || '0', 10),
      }));

      // Specialization breakdown
      const specRaw = await this.doctorRepository
        .createQueryBuilder('d')
        .select('d.specialization', 'specialization')
        .addSelect('COUNT(*)', 'count')
        .groupBy('d.specialization')
        .orderBy('count', 'DESC')
        .getRawMany();

      const specializationBreakdown = specRaw.map((row) => {
        const count = Number.parseInt(row.count || '0', 10);
        return {
          specialization: row.specialization || 'General',
          count,
          percentage: totalDoctors > 0 ? Math.round((count / totalDoctors) * 1000) / 10 : 0,
        };
      });

      // Capacity metrics
      const slotsRaw = await this.slotRepository
        .createQueryBuilder('s')
        .select('COUNT(*)', 'total')
        .addSelect("COUNT(*) FILTER (WHERE s.status = 'BOOKED')", 'booked')
        .addSelect("COUNT(*) FILTER (WHERE s.status = 'AVAILABLE')", 'available')
        .where('s.created_at BETWEEN :start AND :end', { start: startDate, end: endDate })
        .getRawOne();

      const totalSlots = Number.parseInt(slotsRaw?.total || '0', 10);
      const bookedSlots = Number.parseInt(slotsRaw?.booked || '0', 10);
      const availableSlots = Number.parseInt(slotsRaw?.available || '0', 10);
      const utilizationRate = totalSlots > 0 ? (bookedSlots / totalSlots) * 100 : 0;

      // Top 10 Doctor Performers
      const topDoctorsRaw = await this.doctorRepository
        .createQueryBuilder('d')
        .innerJoin('users', 'u', 'u.user_id = d.user_id')
        .leftJoin('profiles', 'p', 'p.user_id = u.user_id')
        .leftJoin(
          'consultations',
          'c',
          'c.doctor_id = d.doctor_id AND c.created_at BETWEEN :start AND :end',
          { start: startDate, end: endDate },
        )
        .leftJoin(
          'payments',
          'pay',
          "pay.consultation_id = c.consultation_id AND pay.payment_status IN ('PAID', 'COMPLETED')",
        )
        .select('d.doctor_id', 'doctor_id')
        .addSelect("COALESCE(p.full_name, 'Dr. Practitioner')", 'full_name')
        .addSelect('d.specialization', 'specialization')
        .addSelect('CAST(d.consultation_fee AS numeric)', 'consultation_fee')
        .addSelect("COUNT(DISTINCT c.consultation_id) FILTER (WHERE c.status = 'COMPLETED')", 'completed')
        .addSelect('COALESCE(SUM(CAST(pay.amount AS numeric)), 0)', 'total_revenue')
        .groupBy('d.doctor_id')
        .addGroupBy('p.full_name')
        .addGroupBy('d.specialization')
        .addGroupBy('d.consultation_fee')
        .orderBy('total_revenue', 'DESC')
        .addOrderBy('completed', 'DESC')
        .limit(10)
        .getRawMany();

      const topDoctors = topDoctorsRaw.map((row) => ({
        doctor_id: row.doctor_id,
        full_name: row.full_name,
        specialization: row.specialization,
        consultation_fee: Number.parseFloat(row.consultation_fee || '0'),
        completed_consultations: Number.parseInt(row.completed || '0', 10),
        total_revenue: Math.round(Number.parseFloat(row.total_revenue || '0') * 100) / 100,
      }));

      return {
        total_doctors: totalDoctors,
        verification_breakdown: verificationBreakdown,
        specialization_breakdown: specializationBreakdown,
        capacity: {
          total_slots: totalSlots,
          booked_slots: bookedSlots,
          available_slots: availableSlots,
          utilization_rate: Math.round(utilizationRate * 10) / 10,
        },
        top_doctors: topDoctors,
      };
    } catch (error) {
      handleServiceError(error, this.logger, 'AnalyticsService.getDoctorAnalytics');
    }
  }

  /**
   * 5. Patient Demographics, Retention & Growth
   */
  async getPatientAnalytics(
    filter?: AnalyticsFilterInput,
  ): Promise<PatientAnalyticsEntity> {
    try {
      const { startDate, endDate, dateTrunc } = this.parseFilter(filter);

      // Total and new patients
      const patientCounts = await this.userRepository
        .createQueryBuilder('u')
        .select('COUNT(*)', 'total')
        .addSelect('COUNT(*) FILTER (WHERE u.created_at BETWEEN :start AND :end)', 'new_signups')
        .where('u.role = :role', { role: UserRole.PATIENT })
        .setParameters({ start: startDate, end: endDate })
        .getRawOne();

      const totalPatients = Number.parseInt(patientCounts?.total || '0', 10);
      const newSignups = Number.parseInt(patientCounts?.new_signups || '0', 10);

      // Retention frequency cohorts using CTE
      const cohortRaw = await this.consultationRepository.query(`
        WITH patient_consults AS (
          SELECT patient_id, COUNT(*) as consult_count
          FROM consultations
          GROUP BY patient_id
        )
        SELECT 
          COUNT(*) FILTER (WHERE consult_count = 1)::int as single_count,
          COUNT(*) FILTER (WHERE consult_count BETWEEN 2 AND 3)::int as mid_count,
          COUNT(*) FILTER (WHERE consult_count >= 4)::int as high_count,
          COUNT(*)::int as active_patient_count,
          COUNT(*) FILTER (WHERE consult_count > 1)::int as repeat_patient_count
        FROM patient_consults;
      `);

      const singleCount = Number.parseInt(cohortRaw[0]?.single_count || '0', 10);
      const midCount = Number.parseInt(cohortRaw[0]?.mid_count || '0', 10);
      const highCount = Number.parseInt(cohortRaw[0]?.high_count || '0', 10);
      const activePatientCount = Number.parseInt(cohortRaw[0]?.active_patient_count || '0', 10);
      const repeatPatientCount = Number.parseInt(cohortRaw[0]?.repeat_patient_count || '0', 10);

      const repeatRate =
        activePatientCount > 0 ? (repeatPatientCount / activePatientCount) * 100 : 0;

      const retentionCohorts = [
        { cohort: '1 Consultation', patient_count: singleCount },
        { cohort: '2-3 Consultations', patient_count: midCount },
        { cohort: '4+ Consultations', patient_count: highCount },
      ];

      // Gender distribution
      const genderRaw = await this.userRepository
        .createQueryBuilder('u')
        .leftJoin('profiles', 'p', 'p.user_id = u.user_id')
        .select("COALESCE(CAST(p.gender AS text), 'NOT_SPECIFIED')", 'gender')
        .addSelect('COUNT(*)', 'count')
        .where('u.role = :role', { role: UserRole.PATIENT })
        .groupBy('p.gender')
        .getRawMany();

      const genderDistribution = genderRaw.map((row) => ({
        gender: row.gender,
        count: Number.parseInt(row.count || '0', 10),
      }));

      // Signups timeline
      const timelineRaw = await this.userRepository
        .createQueryBuilder('u')
        .select(`TO_CHAR(DATE_TRUNC('${dateTrunc}', u.created_at), 'YYYY-MM-DD')`, 'date')
        .addSelect('COUNT(*)', 'count')
        .where('u.role = :role', { role: UserRole.PATIENT })
        .andWhere('u.created_at BETWEEN :start AND :end', { start: startDate, end: endDate })
        .groupBy(`DATE_TRUNC('${dateTrunc}', u.created_at)`)
        .orderBy('date', 'ASC')
        .getRawMany();

      const signupsTimeline = timelineRaw.map((row) => ({
        date: row.date,
        count: Number.parseInt(row.count || '0', 10),
      }));

      return {
        total_patients: totalPatients,
        new_signups_in_period: newSignups,
        repeat_consultation_rate: Math.round(repeatRate * 10) / 10,
        retention_cohorts: retentionCohorts,
        gender_distribution: genderDistribution,
        signups_timeline: signupsTimeline,
      };
    } catch (error) {
      handleServiceError(error, this.logger, 'AnalyticsService.getPatientAnalytics');
    }
  }

  /**
   * 6. Clinical Prescriptions & System Reliability / Errors
   */
  async getClinicalAndSystemAnalytics(
    filter?: AnalyticsFilterInput,
  ): Promise<ClinicalAndSystemAnalyticsEntity> {
    try {
      const { startDate, endDate, dateTrunc } = this.parseFilter(filter);

      // Prescriptions count in window
      const presCountRaw = await this.prescriptionRepository
        .createQueryBuilder('pr')
        .select('COUNT(*)', 'total')
        .where('pr.issued_at BETWEEN :start AND :end', { start: startDate, end: endDate })
        .getRawOne();
      const totalPrescriptions = Number.parseInt(presCountRaw?.total || '0', 10);

      // Completed consultations in same window
      const completedConsults = await this.consultationRepository
        .createQueryBuilder('c')
        .where("c.status = 'COMPLETED'")
        .andWhere('c.created_at BETWEEN :start AND :end', { start: startDate, end: endDate })
        .getCount();

      const prescriptionIssuanceRate =
        completedConsults > 0 ? (totalPrescriptions / completedConsults) * 100 : 0;

      // Top diagnoses
      const topDiagRaw = await this.prescriptionRepository
        .createQueryBuilder('pr')
        .select('pr.diagnosis', 'diagnosis')
        .addSelect('COUNT(*)', 'count')
        .where('pr.issued_at BETWEEN :start AND :end', { start: startDate, end: endDate })
        .andWhere("pr.diagnosis IS NOT NULL AND pr.diagnosis != ''")
        .groupBy('pr.diagnosis')
        .orderBy('count', 'DESC')
        .limit(10)
        .getRawMany();

      const topDiagnoses = topDiagRaw.map((row) => ({
        diagnosis: row.diagnosis,
        count: Number.parseInt(row.count || '0', 10),
      }));

      // Total errors in audit_logs
      const errorStatsRaw = await this.auditLogRepository
        .createQueryBuilder('a')
        .select('COUNT(*)', 'total')
        .where('a.created_at BETWEEN :start AND :end', { start: startDate, end: endDate })
        .getRawOne();
      const totalSystemErrors = Number.parseInt(errorStatsRaw?.total || '0', 10);

      // Error breakdown by resolution action
      const errorActionsRaw = await this.auditLogRepository
        .createQueryBuilder('a')
        .select('a.action', 'action')
        .addSelect('COUNT(*)', 'count')
        .where('a.created_at BETWEEN :start AND :end', { start: startDate, end: endDate })
        .groupBy('a.action')
        .getRawMany();

      const errorsByAction = errorActionsRaw.map((row) => ({
        action: row.action || 'PENDING',
        count: Number.parseInt(row.count || '0', 10),
      }));

      // Top 5 failing APIs
      const topApisRaw = await this.auditLogRepository
        .createQueryBuilder('a')
        .select('a.api_name', 'api_name')
        .addSelect('COUNT(*)', 'error_count')
        .where('a.created_at BETWEEN :start AND :end', { start: startDate, end: endDate })
        .andWhere("a.api_name IS NOT NULL AND a.api_name != ''")
        .groupBy('a.api_name')
        .orderBy('error_count', 'DESC')
        .limit(5)
        .getRawMany();

      const topFailingApis = topApisRaw.map((row) => ({
        api_name: row.api_name,
        error_count: Number.parseInt(row.error_count || '0', 10),
      }));

      // Error incidents timeline
      const errTimelineRaw = await this.auditLogRepository
        .createQueryBuilder('a')
        .select(`TO_CHAR(DATE_TRUNC('${dateTrunc}', a.created_at), 'YYYY-MM-DD')`, 'date')
        .addSelect('COUNT(*)', 'count')
        .where('a.created_at BETWEEN :start AND :end', { start: startDate, end: endDate })
        .groupBy(`DATE_TRUNC('${dateTrunc}', a.created_at)`)
        .orderBy('date', 'ASC')
        .getRawMany();

      const errorsTimeline = errTimelineRaw.map((row) => ({
        date: row.date,
        count: Number.parseInt(row.count || '0', 10),
      }));

      return {
        total_prescriptions: totalPrescriptions,
        prescription_issuance_rate: Math.round(prescriptionIssuanceRate * 10) / 10,
        top_diagnoses: topDiagnoses,
        total_system_errors: totalSystemErrors,
        errors_by_action: errorsByAction,
        top_failing_apis: topFailingApis,
        errors_timeline: errorsTimeline,
      };
    } catch (error) {
      handleServiceError(
        error,
        this.logger,
        'AnalyticsService.getClinicalAndSystemAnalytics',
      );
    }
  }
}
