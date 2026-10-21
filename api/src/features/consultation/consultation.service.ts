import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { Consultation } from '../../schemas/consultation.schema';
import { Doctor } from '../../schemas/doctor.schema';
import { User } from '../../schemas/user.schema';
import { AvailabilitySlot } from '../../schemas/availability_slot.schema';
import { RedisService } from '../../core/redis/redis.service';
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
    private readonly redisService: RedisService,
    private readonly dataSource: DataSource,
  ) { }

  /**
   * Insert: Book a new consultation with a doctor.
   * Concurrency & Saga:
   * 1. Atomically holds slot in Redis (SET NX EX 600) to reject competing requests in microseconds.
   * 2. Starts DB transaction with pessimistic write lock (SELECT FOR UPDATE).
   * 3. Sets slot to HELD and consultation to PENDING_PAYMENT with hold_expires_at (10 min).
   * 4. Invalidates Redis doctor availability cache.
   * 5. If uncompleted after 10 min, Redis keyspace expiry triggers compensation to release the slot.
   */
  async bookConsultation(
    patientUserId: string,
    createDto: CreateConsultationDto,
  ): Promise<string> {
    const HOLD_DURATION_SECONDS = 600; // 10 minutes hold
    let redisHoldAcquired = false;

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

      // 3. Fast Concurrency Check via Redis Atomic Lock (Saga Step 1)
      if (createDto.slot_id) {
        const acquired = await this.redisService.acquireSlotHold(
          createDto.slot_id,
          patientUserId,
          HOLD_DURATION_SECONDS,
        );

        if (!acquired) {
          throw new ConflictException(
            'Selected availability slot is currently being held by another user. Please choose another slot or try again in a few minutes.',
          );
        }
        redisHoldAcquired = true;
      }

      // 4. PostgreSQL Database Transaction with Row-Level Lock (Saga Step 2)
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        let slot: AvailabilitySlot | null = null;
        let holdExpiresAt: Date | null = null;

        if (createDto.slot_id) {
          slot = await queryRunner.manager
            .getRepository(AvailabilitySlot)
            .createQueryBuilder('slot')
            .setLock('pessimistic_write')
            .where('slot.slot_id = :slotId', { slotId: createDto.slot_id })
            .getOne();

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
              'Selected availability slot is already booked or reserved',
            );
          }

          slot.status = 'HELD';
          await queryRunner.manager.save(slot);

          holdExpiresAt = new Date(Date.now() + HOLD_DURATION_SECONDS * 1000);
        }

        // Create consultation in PENDING_PAYMENT status
        const consultation = queryRunner.manager.create(Consultation, {
          patient_id: patientUserId,
          doctor_id: createDto.doctor_id,
          slot_id: createDto.slot_id || null,
          scheduled_at: createDto.scheduled_at,
          consultation_type: createDto.consultation_type,
          reason: createDto.reason?.trim() || null,
          status: 'PENDING_PAYMENT',
          hold_expires_at: holdExpiresAt,
        });

        await queryRunner.manager.save(consultation);
        await queryRunner.commitTransaction();

        // Invalidate cached availability for this doctor
        await this.redisService.invalidateDoctorSlots(createDto.doctor_id);

        return `Consultation reserved successfully (ID: ${consultation.consultation_id}). Please complete payment within 10 minutes.`;
      } catch (txError) {
        await queryRunner.rollbackTransaction();
        if (redisHoldAcquired && createDto.slot_id) {
          await this.redisService.releaseSlotHold(createDto.slot_id);
        }
        throw txError;
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      handleServiceError(error, this.logger, 'ConsultationService.bookConsultation', {
        userId: patientUserId,
      });
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
          await this.redisService.releaseSlotHold(previousSlot.slot_id);
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

      await this.redisService.invalidateDoctorSlots(consultation.doctor_id);

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
        await this.redisService.releaseSlotHold(consultation.slot_id);
      }

      consultation.status = 'CANCELLED';
      if (reason) {
        consultation.notes = consultation.notes
          ? `${consultation.notes}\nCancellation reason: ${reason}`
          : `Cancellation reason: ${reason}`;
      }

      await this.consultationRepository.save(consultation);

      // Invalidate cached doctor availability
      await this.redisService.invalidateDoctorSlots(consultation.doctor_id);

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
