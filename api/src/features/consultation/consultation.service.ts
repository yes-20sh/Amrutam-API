import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Consultation } from '../../schemas/consultation.schema';
import { Doctor } from '../../schemas/doctor.schema';
import { User } from '../../schemas/user.schema';
import { AvailabilitySlot } from '../../schemas/availability_slot.schema';
import { handleServiceError } from '../../utils/error/error.util';
import { CreateConsultationDto } from './dto/create-consultation.dto';
import { RescheduleConsultationDto } from './dto/reschedule-consultation.dto';
import { ConsultationEntity } from './entities/consultation.entity';

@Injectable()
export class ConsultationService {
  private readonly logger = new Logger(ConsultationService.name);

  constructor(
    @InjectRepository(Consultation)
    private readonly consultationRepository: Repository<Consultation>,
    @InjectRepository(Doctor)
    private readonly doctorRepository: Repository<Doctor>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(AvailabilitySlot)
    private readonly slotRepository: Repository<AvailabilitySlot>,
  ) { }

  /**
   * Insert: Book a new consultation with a doctor.
   */
  async bookConsultation(
    patientUserId: string,
    createDto: CreateConsultationDto,
  ): Promise<string> {
    try {
      // 1. Fetch doctor and check validity
      const doctor = await this.doctorRepository.findOne({
        where: { doctor_id: createDto.doctor_id },
        relations: { user: { profile: true } },
      });

      if (!doctor) {
        throw new NotFoundException('Doctor not found');
      }

      // Prevent doctor booking appointment with themselves
      if (doctor.user_id === patientUserId) {
        throw new BadRequestException(
          'Doctors cannot book consultations with themselves',
        );
      }

      // 2. Fetch patient user
      const patient = await this.userRepository.findOne({
        where: { user_id: patientUserId },
        relations: { profile: true },
      });

      if (!patient) {
        throw new NotFoundException('Patient account not found');
      }

      // 3. Handle availability slot if selected
      let slot: AvailabilitySlot | null = null;
      if (createDto.slot_id) {
        slot = await this.slotRepository.findOne({
          where: { slot_id: createDto.slot_id },
        });

        if (!slot) {
          throw new NotFoundException('Selected availability slot not found');
        }

        if (slot.doctor_id !== createDto.doctor_id) {
          throw new BadRequestException(
            'Selected slot does not belong to this doctor',
          );
        }

        if (slot.status !== 'AVAILABLE') {
          throw new ConflictException(
            'Selected availability slot is already booked',
          );
        }

        slot.status = 'BOOKED';
        await this.slotRepository.save(slot);
      }

      // 4. Create consultation
      const consultation = this.consultationRepository.create({
        patient_id: patientUserId,
        doctor_id: createDto.doctor_id,
        slot_id: createDto.slot_id || null,
        scheduled_at: createDto.scheduled_at,
        consultation_type: createDto.consultation_type,
        reason: createDto.reason?.trim() || null,
        status: 'BOOKED',
      });

      await this.consultationRepository.save(consultation);

      return 'Consultation booked successfully';
    } catch (error) {
      handleServiceError(error, this.logger, 'ConsultationService.bookConsultation');
    }
  }

  /**
   * Update: Reschedule consultation to a new date or slot.
   */
  async rescheduleConsultation(
    userId: string,
    rescheduleDto: RescheduleConsultationDto,
  ): Promise<string> {
    try {
      const consultation = await this.consultationRepository.findOne({
        where: { consultation_id: rescheduleDto.consultation_id },
        relations: {
          doctor: { user: { profile: true } },
          patient: { profile: true },
          slot: true,
        },
      });

      if (!consultation) {
        throw new NotFoundException('Consultation not found');
      }

      // Authorization check
      const isPatient = consultation.patient_id === userId;
      const isDoctor = consultation.doctor?.user_id === userId;

      if (!isPatient && !isDoctor) {
        throw new ForbiddenException(
          'You are not authorized to reschedule this consultation',
        );
      }

      if (
        consultation.status === 'COMPLETED' ||
        consultation.status === 'CANCELLED'
      ) {
        throw new BadRequestException(
          `Cannot reschedule a ${consultation.status.toLowerCase()} consultation`,
        );
      }

      // Release previous slot if changing
      if (
        consultation.slot_id &&
        consultation.slot_id !== rescheduleDto.slot_id
      ) {
        const previousSlot = await this.slotRepository.findOne({
          where: { slot_id: consultation.slot_id },
        });
        if (previousSlot) {
          previousSlot.status = 'AVAILABLE';
          await this.slotRepository.save(previousSlot);
        }
      }

      // Claim new slot if specified
      if (
        rescheduleDto.slot_id &&
        rescheduleDto.slot_id !== consultation.slot_id
      ) {
        const newSlot = await this.slotRepository.findOne({
          where: { slot_id: rescheduleDto.slot_id },
        });

        if (!newSlot) {
          throw new NotFoundException('New availability slot not found');
        }

        if (newSlot.doctor_id !== consultation.doctor_id) {
          throw new BadRequestException(
            'New slot does not belong to the assigned doctor',
          );
        }

        if (newSlot.status !== 'AVAILABLE') {
          throw new ConflictException(
            'New availability slot is no longer available',
          );
        }

        newSlot.status = 'BOOKED';
        await this.slotRepository.save(newSlot);
        consultation.slot_id = rescheduleDto.slot_id;
      }

      consultation.scheduled_at = rescheduleDto.scheduled_at;
      await this.consultationRepository.save(consultation);

      return 'Consultation rescheduled successfully';
    } catch (error) {
      handleServiceError(
        error,
        this.logger,
        'ConsultationService.rescheduleConsultation',
      );
    }
  }

  /**
   * Update: Cancel consultation and release any assigned availability slot.
   */
  async cancelConsultation(
    userId: string,
    consultationId: string,
    reason?: string,
  ): Promise<string> {
    try {
      const consultation = await this.consultationRepository.findOne({
        where: { consultation_id: consultationId },
        relations: {
          doctor: { user: { profile: true } },
          patient: { profile: true },
          slot: true,
        },
      });

      if (!consultation) {
        throw new NotFoundException('Consultation not found');
      }

      const isPatient = consultation.patient_id === userId;
      const isDoctor = consultation.doctor?.user_id === userId;

      if (!isPatient && !isDoctor) {
        throw new ForbiddenException(
          'You are not authorized to cancel this consultation',
        );
      }

      if (consultation.status === 'CANCELLED') {
        throw new BadRequestException('Consultation is already cancelled');
      }

      if (consultation.status === 'COMPLETED') {
        throw new BadRequestException(
          'Cannot cancel an already completed consultation',
        );
      }

      // Free up the availability slot
      if (consultation.slot_id) {
        const slot = await this.slotRepository.findOne({
          where: { slot_id: consultation.slot_id },
        });
        if (slot) {
          slot.status = 'AVAILABLE';
          await this.slotRepository.save(slot);
        }
      }

      consultation.status = 'CANCELLED';
      if (reason) {
        consultation.notes = consultation.notes
          ? `${consultation.notes}\nCancellation reason: ${reason}`
          : `Cancellation reason: ${reason}`;
      }

      await this.consultationRepository.save(consultation);
      return 'Consultation cancelled successfully';
    } catch (error) {
      handleServiceError(
        error,
        this.logger,
        'ConsultationService.cancelConsultation',
      );
    }
  }

  /**
   * Update: Mark consultation as completed with optional doctor notes.
   */
  async completeConsultation(
    doctorUserId: string,
    consultationId: string,
    notes?: string,
  ): Promise<string> {
    try {
      const consultation = await this.consultationRepository.findOne({
        where: { consultation_id: consultationId },
        relations: {
          doctor: { user: { profile: true } },
          patient: { profile: true },
        },
      });

      if (!consultation) {
        throw new NotFoundException('Consultation not found');
      }

      if (consultation.doctor?.user_id !== doctorUserId) {
        throw new ForbiddenException(
          'Only the assigned doctor can complete this consultation',
        );
      }

      if (consultation.status === 'CANCELLED') {
        throw new BadRequestException('Cannot complete a cancelled consultation');
      }

      consultation.status = 'COMPLETED';
      if (notes) {
        consultation.notes = notes;
      }

      await this.consultationRepository.save(consultation);
      return 'Consultation completed successfully';
    } catch (error) {
      handleServiceError(
        error,
        this.logger,
        'ConsultationService.completeConsultation',
      );
    }
  }

  /**
   * Get: Retrieve single consultation by ID.
   */
  async getConsultationById(
    userId: string,
    consultationId: string,
  ): Promise<ConsultationEntity> {
    try {
      const consultation = await this.consultationRepository.findOne({
        where: { consultation_id: consultationId },
        relations: {
          doctor: { user: { profile: true } },
          patient: { profile: true },
        },
      });

      if (!consultation) {
        throw new NotFoundException('Consultation not found');
      }

      const isPatient = consultation.patient_id === userId;
      const isDoctor = consultation.doctor?.user_id === userId;

      if (!isPatient && !isDoctor) {
        throw new ForbiddenException(
          'You are not authorized to view this consultation',
        );
      }

      return consultation as ConsultationEntity;
    } catch (error) {
      handleServiceError(
        error,
        this.logger,
        'ConsultationService.getConsultationById',
      );
    }
  }

  /**
   * Get: List consultations for current authenticated user (patient or doctor).
   */
  async myConsultations(userId: string): Promise<ConsultationEntity[]> {
    try {
      const doctor = await this.doctorRepository.findOne({
        where: { user_id: userId },
      });

      const whereConditions: any[] = [{ patient_id: userId }];
      if (doctor) {
        whereConditions.push({ doctor_id: doctor.doctor_id });
      }

      const consultations = await this.consultationRepository.find({
        where: whereConditions,
        relations: {
          doctor: { user: { profile: true } },
          patient: { profile: true },
        },
        order: { scheduled_at: 'DESC' },
      });

      return consultations as ConsultationEntity[];
    } catch (error) {
      handleServiceError(
        error,
        this.logger,
        'ConsultationService.myConsultations',
      );
    }
  }
}
