import type { Repository } from 'typeorm';
import type { User } from '../../schemas/user.schema';
import type { Doctor } from '../../schemas/doctor.schema';
import type { Profile } from '../../schemas/profile.schema';
import type { Consultation } from '../../schemas/consultation.schema';
import type { Payment } from '../../schemas/payment.schema';
import type { Prescription } from '../../schemas/prescription.schema';
import type { AvailabilitySlot } from '../../schemas/availability_slot.schema';
import type { AuditLog } from '../../schemas/audit_log.schema';
import type { AnalyticsFilterInput } from './dto/analytics-filter.input';
import { TimeGranularity } from './dto/time-granularity.enum';
import type { AnalyticsService as AnalyticsServiceType } from './analytics.service';

const bunTest = require('bun:test') as {
  beforeAll: (callback: () => void | Promise<void>) => void;
  beforeEach: (callback: () => void | Promise<void>) => void;
  describe: (name: string, callback: () => void) => void;
  expect: jest.Expect;
  it: (name: string, callback: () => void | Promise<void>) => void;
  mock: {
    (): jest.Mock;
    module: (specifier: string, factory: () => unknown) => void;
  };
};
const { beforeAll, beforeEach, describe, expect, it } = bunTest;

bunTest.mock.module('../../schemas/user.schema', () => ({
  User: class User { },
}));
bunTest.mock.module('../../schemas/doctor.schema', () => ({
  Doctor: class Doctor { },
}));
bunTest.mock.module('../../schemas/profile.schema', () => ({
  Profile: class Profile { },
}));
bunTest.mock.module('../../schemas/consultation.schema', () => ({
  Consultation: class Consultation { },
}));
bunTest.mock.module('../../schemas/payment.schema', () => ({
  Payment: class Payment { },
}));
bunTest.mock.module('../../schemas/prescription.schema', () => ({
  Prescription: class Prescription { },
}));
bunTest.mock.module('../../schemas/availability_slot.schema', () => ({
  AvailabilitySlot: class AvailabilitySlot { },
}));
bunTest.mock.module('../../schemas/audit_log.schema', () => ({
  AuditLog: class AuditLog { },
}));

function createMockQueryBuilder(
  rawOneResult: any = {},
  rawManyResult: any[] = [],
  rawCountResult: number = 0,
) {
  const qb: any = {
    select: bunTest.mock().mockReturnThis(),
    addSelect: bunTest.mock().mockReturnThis(),
    where: bunTest.mock().mockReturnThis(),
    andWhere: bunTest.mock().mockReturnThis(),
    setParameters: bunTest.mock().mockReturnThis(),
    groupBy: bunTest.mock().mockReturnThis(),
    addGroupBy: bunTest.mock().mockReturnThis(),
    orderBy: bunTest.mock().mockReturnThis(),
    addOrderBy: bunTest.mock().mockReturnThis(),
    innerJoin: bunTest.mock().mockReturnThis(),
    leftJoin: bunTest.mock().mockReturnThis(),
    limit: bunTest.mock().mockReturnThis(),
    getRawOne: bunTest.mock().mockResolvedValue(rawOneResult),
    getRawMany: bunTest.mock().mockResolvedValue(rawManyResult),
    getCount: bunTest.mock().mockResolvedValue(rawCountResult),
  };
  return qb;
}

type ServiceDependencies = [
  Repository<User>,
  Repository<Doctor>,
  Repository<Profile>,
  Repository<Consultation>,
  Repository<Payment>,
  Repository<Prescription>,
  Repository<AvailabilitySlot>,
  Repository<AuditLog>,
];
let createService: (...dependencies: ServiceDependencies) => AnalyticsServiceType;

describe('AnalyticsService', () => {
  let service: AnalyticsServiceType;
  let userRepository: { createQueryBuilder: jest.Mock };
  let doctorRepository: { createQueryBuilder: jest.Mock; count: jest.Mock };
  let profileRepository: { createQueryBuilder: jest.Mock };
  let consultationRepository: { createQueryBuilder: jest.Mock; query: jest.Mock };
  let paymentRepository: { createQueryBuilder: jest.Mock };
  let prescriptionRepository: { createQueryBuilder: jest.Mock };
  let slotRepository: { createQueryBuilder: jest.Mock };
  let auditLogRepository: { createQueryBuilder: jest.Mock };

  const filter: AnalyticsFilterInput = {
    startDate: new Date('2026-01-01T00:00:00Z'),
    endDate: new Date('2026-01-31T23:59:59Z'),
    granularity: TimeGranularity.DAY,
  };

  beforeAll(async () => {
    const { AnalyticsService } = await import('./analytics.service.js');
    createService = (...dependencies) => new AnalyticsService(...dependencies);
  });

  beforeEach(() => {
    userRepository = { createQueryBuilder: bunTest.mock() };
    doctorRepository = { createQueryBuilder: bunTest.mock(), count: bunTest.mock() };
    profileRepository = { createQueryBuilder: bunTest.mock() };
    consultationRepository = { createQueryBuilder: bunTest.mock(), query: bunTest.mock() };
    paymentRepository = { createQueryBuilder: bunTest.mock() };
    prescriptionRepository = { createQueryBuilder: bunTest.mock() };
    slotRepository = { createQueryBuilder: bunTest.mock() };
    auditLogRepository = { createQueryBuilder: bunTest.mock() };

    service = createService(
      userRepository as unknown as Repository<User>,
      doctorRepository as unknown as Repository<Doctor>,
      profileRepository as unknown as Repository<Profile>,
      consultationRepository as unknown as Repository<Consultation>,
      paymentRepository as unknown as Repository<Payment>,
      prescriptionRepository as unknown as Repository<Prescription>,
      slotRepository as unknown as Repository<AvailabilitySlot>,
      auditLogRepository as unknown as Repository<AuditLog>,
    );
  });

  describe('getDashboardSummary', () => {
    it('calculates executive KPI metrics and growth percentage correctly', async () => {
      // 1. Current revenue
      const currentRevQb = createMockQueryBuilder({ total: '150000' });
      // 2. Previous revenue
      const prevRevQb = createMockQueryBuilder({ total: '100000' });
      paymentRepository.createQueryBuilder
        .mockReturnValueOnce(currentRevQb)
        .mockReturnValueOnce(prevRevQb);

      // 3. Consultations summary
      const consultsQb = createMockQueryBuilder({
        total: '100',
        completed: '80',
        cancelled: '10',
      });
      consultationRepository.createQueryBuilder.mockReturnValue(consultsQb);

      // 4. Patients summary
      const patientsQb = createMockQueryBuilder({
        total: '500',
        new_in_period: '50',
      });
      userRepository.createQueryBuilder
        .mockReturnValueOnce(patientsQb)
        .mockReturnValueOnce(createMockQueryBuilder({ active_users: '120' })); // 30-day active users

      // 5. Doctor accounts
      const doctorsQb = createMockQueryBuilder({
        total: '30',
        pending: '5',
      });
      doctorRepository.createQueryBuilder.mockReturnValue(doctorsQb);

      // 6. Slots utilization
      const slotsQb = createMockQueryBuilder({
        total: '200',
        booked: '150',
      });
      slotRepository.createQueryBuilder.mockReturnValue(slotsQb);

      const summary = await service.getDashboardSummary(filter);

      expect(summary.total_revenue).toBe(150000);
      expect(summary.revenue_growth_percentage).toBe(50); // (150k - 100k) / 100k * 100
      expect(summary.total_consultations).toBe(100);
      expect(summary.completed_consultations).toBe(80);
      expect(summary.cancellation_rate).toBe(10); // 10 / 100 * 100
      expect(summary.total_patients).toBe(500);
      expect(summary.new_patients_in_period).toBe(50);
      expect(summary.total_doctors).toBe(30);
      expect(summary.pending_doctor_verifications).toBe(5);
      expect(summary.slot_utilization_rate).toBe(75); // 150 / 200 * 100
      expect(summary.active_users_last_30_days).toBe(120);
    });
  });

  describe('getRevenueAnalytics', () => {
    it('aggregates total settled revenue, average transaction value, and payment breakdowns', async () => {
      // 1. Summary (total_revenue, total_transactions, avg_value)
      // 2. Status breakdown (status, amount, count)
      // 3. Method breakdown (payment_method, amount, count)
      // 4. Timeline (date, revenue, transaction_count)
      paymentRepository.createQueryBuilder
        .mockReturnValueOnce(createMockQueryBuilder({ total_revenue: '24000', total_transactions: '48', avg_value: '500' }))
        .mockReturnValueOnce(createMockQueryBuilder({}, [{ status: 'PAID', amount: '24000', count: '48' }]))
        .mockReturnValueOnce(createMockQueryBuilder({}, [{ payment_method: 'UPI', amount: '18000', count: '36' }]))
        .mockReturnValueOnce(createMockQueryBuilder({}, [{ date: '2026-01-01', revenue: '5000', transaction_count: '10' }]));

      const result = await service.getRevenueAnalytics(filter);

      expect(result.total_revenue).toBe(24000);
      expect(result.total_transactions).toBe(48);
      expect(result.average_transaction_value).toBe(500); // 24000 / 48
      expect(result.timeline).toHaveLength(1);
      expect(result.revenue_by_payment_method).toHaveLength(1);
      expect(result.revenue_by_status).toHaveLength(1);
    });
  });

  describe('getConsultationAnalytics', () => {
    it('returns appointment volume timeline, status distributions, and peak hours', async () => {
      consultationRepository.createQueryBuilder
        .mockReturnValueOnce(createMockQueryBuilder({ total: '60', completed: '50', cancelled: '6' }))
        .mockReturnValueOnce(createMockQueryBuilder({}, [{ status: 'COMPLETED', count: '50' }]))
        .mockReturnValueOnce(createMockQueryBuilder({}, [{ type: 'ONLINE', count: '60' }]))
        .mockReturnValueOnce(createMockQueryBuilder({}, [{ date: '2026-01-01', total: '10', completed: '8', cancelled: '1' }]))
        .mockReturnValueOnce(createMockQueryBuilder({}, [{ hour: 10, count: '25' }, { hour: 11, count: '35' }]));

      const result = await service.getConsultationAnalytics(filter);

      expect(result.total_consultations).toBe(60);
      expect(result.completion_rate).toBe(83.3);
      expect(result.cancellation_rate).toBe(10);
      expect(result.consultations_by_status).toHaveLength(1);
      expect(result.consultations_by_type).toHaveLength(1);
      expect(result.timeline).toHaveLength(1);
      expect(result.peak_hours).toHaveLength(2);
    });
  });

  describe('getDoctorAnalytics', () => {
    it('returns doctor verification breakdown, specializations, slot capacity, and top doctors', async () => {
      doctorRepository.count.mockResolvedValue(40);
      doctorRepository.createQueryBuilder
        .mockReturnValueOnce(createMockQueryBuilder({}, [
          { status: 'APPROVED', count: '30' },
          { status: 'PENDING', count: '8' },
          { status: 'REJECTED', count: '2' },
        ])) // verification
        .mockReturnValueOnce(createMockQueryBuilder({}, [{ specialization: 'Ayurveda', count: '25' }])) // specialization
        .mockReturnValueOnce(createMockQueryBuilder({}, [{
          doctor_id: 'doc-1',
          full_name: 'Dr. Aarav',
          specialization: 'Ayurveda',
          consultation_fee: '500',
          completed: '40',
          total_revenue: '21000',
        }])); // top doctors

      slotRepository.createQueryBuilder.mockReturnValueOnce(
        createMockQueryBuilder({ total: '500', booked: '400', available: '100' }),
      );

      const result = await service.getDoctorAnalytics(filter);

      expect(result.total_doctors).toBe(40);
      expect(result.verification_breakdown).toHaveLength(3);
      expect(result.specialization_breakdown).toHaveLength(1);
      expect(result.capacity.utilization_rate).toBe(80); // 400 / 500 * 100
      expect(result.top_doctors).toHaveLength(1);
      expect(result.top_doctors[0].total_revenue).toBe(21000);
    });
  });

  describe('getPatientAnalytics', () => {
    it('returns patient cohorts, retention rate, and gender demographic breakdown', async () => {
      userRepository.createQueryBuilder
        .mockReturnValueOnce(createMockQueryBuilder({ total: '1000', new_signups: '120' })) // totals & new signups
        .mockReturnValueOnce(createMockQueryBuilder({}, [
          { gender: 'MALE', count: '550' },
          { gender: 'FEMALE', count: '450' },
        ])) // gender distribution
        .mockReturnValueOnce(createMockQueryBuilder({}, [{ date: '2026-01-01', count: '15' }])); // signups timeline

      consultationRepository.query.mockResolvedValueOnce([
        {
          single_count: '240',
          mid_count: '100',
          high_count: '60',
          active_patient_count: '400',
          repeat_patient_count: '160',
        },
      ]); // retention frequency cohorts

      const result = await service.getPatientAnalytics(filter);

      expect(result.total_patients).toBe(1000);
      expect(result.new_signups_in_period).toBe(120);
      expect(result.repeat_consultation_rate).toBe(40); // 160 / 400 * 100
      expect(result.retention_cohorts).toHaveLength(3);
      expect(result.gender_distribution).toHaveLength(2);
      expect(result.signups_timeline).toHaveLength(1);
    });
  });

  describe('getClinicalAndSystemAnalytics', () => {
    it('returns prescription rate, top diagnoses, error rate, and failing API endpoints', async () => {
      // 1. Prescriptions count & diagnoses
      prescriptionRepository.createQueryBuilder
        .mockReturnValueOnce(createMockQueryBuilder({ total: '90' }))
        .mockReturnValueOnce(createMockQueryBuilder({}, [
          { diagnosis: 'Chronic Gastritis', count: '28' },
        ])); // top diagnoses

      // 2. Completed consultations count
      consultationRepository.createQueryBuilder.mockReturnValueOnce(
        createMockQueryBuilder({}, [], 100),
      );

      // 3. System audit error stats, actions, failing APIs, timeline
      auditLogRepository.createQueryBuilder
        .mockReturnValueOnce(createMockQueryBuilder({ total: '25' })) // total errors
        .mockReturnValueOnce(createMockQueryBuilder({}, [{ action: 'RESOLVED', count: '20' }])) // error actions
        .mockReturnValueOnce(createMockQueryBuilder({}, [
          { api_name: 'PaymentService.processPayment', error_count: '15' },
        ])) // top failing APIs
        .mockReturnValueOnce(createMockQueryBuilder({}, [{ date: '2026-01-01', count: '5' }])); // errors timeline

      const result = await service.getClinicalAndSystemAnalytics(filter);

      expect(result.total_prescriptions).toBe(90);
      expect(result.prescription_issuance_rate).toBe(90); // 90 / 100 * 100
      expect(result.top_diagnoses).toHaveLength(1);
      expect(result.total_system_errors).toBe(25);
      expect(result.errors_by_action).toHaveLength(1);
      expect(result.top_failing_apis).toHaveLength(1);
      expect(result.errors_timeline).toHaveLength(1);
    });
  });
});
