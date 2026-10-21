import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConsultationType } from '../../common/enum/consultation-type.enum';
import type { DataSource, Repository } from 'typeorm';
import type { RedisService } from '../../core/redis/redis.service';
import type { Consultation } from '../../schemas/consultation.schema';
import type { Doctor } from '../../schemas/doctor.schema';
import type { User } from '../../schemas/user.schema';
import type { AvailabilitySlot } from '../../schemas/availability_slot.schema';
import type { CreateConsultationDto } from './dto/create-consultation.dto';
import type { RescheduleConsultationDto } from './dto/reschedule-consultation.dto';
import type { ConsultationService as ConsultationServiceType } from './consultation.service';

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

bunTest.mock.module('../../schemas/consultation.schema', () => ({
  Consultation: class Consultation {},
}));
bunTest.mock.module('../../schemas/doctor.schema', () => ({
  Doctor: class Doctor {},
}));
bunTest.mock.module('../../schemas/user.schema', () => ({
  User: class User {},
}));
bunTest.mock.module('../../schemas/availability_slot.schema', () => ({
  AvailabilitySlot: class AvailabilitySlot {},
}));

type ServiceDependencies = [
  Repository<Consultation>,
  Repository<Doctor>,
  Repository<User>,
  Repository<AvailabilitySlot>,
  RedisService,
  DataSource,
];
let createService: (...dependencies: ServiceDependencies) => ConsultationServiceType;

describe('ConsultationService', () => {
  let service: ConsultationServiceType;
  let consultationRepository: {
    findOne: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
  };
  let doctorRepository: { findOne: jest.Mock };
  let userRepository: { findOne: jest.Mock };
  let slotRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
  };
  let redisService: {
    acquireSlotHold: jest.Mock;
    releaseSlotHold: jest.Mock;
    invalidateDoctorSlots: jest.Mock;
  };
  let slotQueryBuilder: {
    setLock: jest.Mock;
    where: jest.Mock;
    getOne: jest.Mock;
  };
  let queryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    release: jest.Mock;
    manager: {
      getRepository: jest.Mock;
      create: jest.Mock;
      save: jest.Mock;
    };
  };
  let dataSource: { createQueryRunner: jest.Mock };

  const patientUserId = 'patient-user-123';
  const doctorUserId = 'doctor-user-456';
  const doctorId = 'doctor-123';
  const slotId = 'slot-123';
  const consultationId = 'consultation-123';

  beforeAll(async () => {
    const { ConsultationService } = await import('./consultation.service.js');
    createService = (...dependencies) => new ConsultationService(...dependencies);
  });

  beforeEach(() => {
    consultationRepository = {
      findOne: bunTest.mock(),
      find: bunTest.mock(),
      save: bunTest.mock().mockImplementation(async (data) => data),
    };
    doctorRepository = { findOne: bunTest.mock() };
    userRepository = { findOne: bunTest.mock() };
    slotRepository = {
      findOne: bunTest.mock(),
      save: bunTest.mock().mockImplementation(async (data) => data),
    };
    redisService = {
      acquireSlotHold: bunTest.mock().mockResolvedValue(true),
      releaseSlotHold: bunTest.mock().mockResolvedValue(true),
      invalidateDoctorSlots: bunTest.mock().mockResolvedValue(undefined),
    };

    slotQueryBuilder = {
      setLock: bunTest.mock(),
      where: bunTest.mock(),
      getOne: bunTest.mock(),
    };
    slotQueryBuilder.setLock.mockReturnValue(slotQueryBuilder);
    slotQueryBuilder.where.mockReturnValue(slotQueryBuilder);

    queryRunner = {
      connect: bunTest.mock().mockResolvedValue(undefined),
      startTransaction: bunTest.mock().mockResolvedValue(undefined),
      rollbackTransaction: bunTest.mock().mockResolvedValue(undefined),
      commitTransaction: bunTest.mock().mockResolvedValue(undefined),
      release: bunTest.mock().mockResolvedValue(undefined),
      manager: {
        getRepository: bunTest.mock().mockReturnValue({
          createQueryBuilder: bunTest.mock().mockReturnValue(slotQueryBuilder),
        }),
        create: bunTest.mock().mockImplementation((_cls, data) => ({
          ...data,
          consultation_id: consultationId,
        })),
        save: bunTest.mock().mockImplementation(async (data) => data),
      },
    };
    dataSource = {
      createQueryRunner: bunTest.mock().mockReturnValue(queryRunner),
    };

    service = createService(
      consultationRepository as unknown as Repository<Consultation>,
      doctorRepository as unknown as Repository<Doctor>,
      userRepository as unknown as Repository<User>,
      slotRepository as unknown as Repository<AvailabilitySlot>,
      redisService as unknown as RedisService,
      dataSource as unknown as DataSource,
    );
  });

  describe('bookConsultation', () => {
    const input: CreateConsultationDto = {
      doctor_id: doctorId,
      slot_id: slotId,
      scheduled_at: new Date('2026-11-01T10:00:00Z'),
      consultation_type: ConsultationType.ONLINE,
      reason: 'General checkup',
    };

    it('throws NotFoundException if doctor does not exist', async () => {
      doctorRepository.findOne.mockResolvedValue(null);

      await expect(
        service.bookConsultation(patientUserId, input),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException if a doctor tries to book with themselves', async () => {
      doctorRepository.findOne.mockResolvedValue({
        doctor_id: doctorId,
        user_id: patientUserId, // Same user
      });

      await expect(
        service.bookConsultation(patientUserId, input),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException if patient account is not found', async () => {
      doctorRepository.findOne.mockResolvedValue({
        doctor_id: doctorId,
        user_id: doctorUserId,
      });
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.bookConsultation(patientUserId, input),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ConflictException if slot is held by another user in Redis', async () => {
      doctorRepository.findOne.mockResolvedValue({
        doctor_id: doctorId,
        user_id: doctorUserId,
      });
      userRepository.findOne.mockResolvedValue({ user_id: patientUserId });
      redisService.acquireSlotHold.mockResolvedValueOnce(false); // slot lock failed

      await expect(
        service.bookConsultation(patientUserId, input),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws ConflictException if slot is not AVAILABLE in DB transaction', async () => {
      doctorRepository.findOne.mockResolvedValue({
        doctor_id: doctorId,
        user_id: doctorUserId,
      });
      userRepository.findOne.mockResolvedValue({ user_id: patientUserId });
      redisService.acquireSlotHold.mockResolvedValueOnce(true);
      slotQueryBuilder.getOne.mockResolvedValueOnce({
        slot_id: slotId,
        doctor_id: doctorId,
        status: 'BOOKED', // Already booked
      });

      await expect(
        service.bookConsultation(patientUserId, input),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(redisService.releaseSlotHold).toHaveBeenCalledWith(slotId);
    });

    it('successfully books consultation with slot hold and commits transaction', async () => {
      doctorRepository.findOne.mockResolvedValue({
        doctor_id: doctorId,
        user_id: doctorUserId,
      });
      userRepository.findOne.mockResolvedValue({ user_id: patientUserId });
      redisService.acquireSlotHold.mockResolvedValueOnce(true);
      const slot = {
        slot_id: slotId,
        doctor_id: doctorId,
        status: 'AVAILABLE',
      };
      slotQueryBuilder.getOne.mockResolvedValueOnce(slot);

      const result = await service.bookConsultation(patientUserId, input);

      expect(result).toContain('Consultation reserved successfully');
      expect(slot.status).toBe('HELD');
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(redisService.invalidateDoctorSlots).toHaveBeenCalledWith(doctorId);
    });
  });

  describe('rescheduleConsultation', () => {
    const rescheduleDto: RescheduleConsultationDto = {
      consultation_id: consultationId,
      slot_id: 'new-slot-456',
      scheduled_at: new Date('2026-11-05T14:00:00Z'),
    };

    it('throws NotFoundException if consultation is not found', async () => {
      consultationRepository.findOne.mockResolvedValue(null);

      await expect(
        service.rescheduleConsultation(patientUserId, rescheduleDto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException if user is neither patient nor assigned doctor', async () => {
      consultationRepository.findOne.mockResolvedValue({
        consultation_id: consultationId,
        patient_id: 'other-patient',
        doctor: { user_id: 'other-doctor' },
      });

      await expect(
        service.rescheduleConsultation(patientUserId, rescheduleDto),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws BadRequestException if consultation is already COMPLETED', async () => {
      consultationRepository.findOne.mockResolvedValue({
        consultation_id: consultationId,
        patient_id: patientUserId,
        status: 'COMPLETED',
      });

      await expect(
        service.rescheduleConsultation(patientUserId, rescheduleDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('successfully reschedules consultation and claims new slot', async () => {
      const prevSlot = { slot_id: 'prev-slot-123', status: 'BOOKED' };
      const newSlot = {
        slot_id: 'new-slot-456',
        doctor_id: doctorId,
        status: 'AVAILABLE',
      };
      const consultation = {
        consultation_id: consultationId,
        doctor_id: doctorId,
        patient_id: patientUserId,
        slot_id: 'prev-slot-123',
        status: 'CONFIRMED',
      };

      consultationRepository.findOne.mockResolvedValue(consultation);
      slotRepository.findOne
        .mockResolvedValueOnce(prevSlot) // finding prevSlot
        .mockResolvedValueOnce(newSlot); // finding newSlot

      const result = await service.rescheduleConsultation(
        patientUserId,
        rescheduleDto,
      );

      expect(result).toBe('Consultation rescheduled successfully');
      expect(prevSlot.status).toBe('AVAILABLE');
      expect(newSlot.status).toBe('BOOKED');
      expect(consultation.slot_id).toBe('new-slot-456');
      expect(redisService.invalidateDoctorSlots).toHaveBeenCalledWith(doctorId);
    });
  });

  describe('cancelConsultation', () => {
    it('throws NotFoundException if consultation not found', async () => {
      consultationRepository.findOne.mockResolvedValue(null);

      await expect(
        service.cancelConsultation(patientUserId, consultationId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException if user is not authorized', async () => {
      consultationRepository.findOne.mockResolvedValue({
        consultation_id: consultationId,
        patient_id: 'other-patient',
        doctor: { user_id: 'other-doctor' },
      });

      await expect(
        service.cancelConsultation(patientUserId, consultationId),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws BadRequestException if already CANCELLED', async () => {
      consultationRepository.findOne.mockResolvedValue({
        consultation_id: consultationId,
        patient_id: patientUserId,
        status: 'CANCELLED',
      });

      await expect(
        service.cancelConsultation(patientUserId, consultationId),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('successfully cancels consultation and releases slot to AVAILABLE', async () => {
      const slot = { slot_id: slotId, status: 'BOOKED' };
      const consultation = {
        consultation_id: consultationId,
        doctor_id: doctorId,
        patient_id: patientUserId,
        slot_id: slotId,
        status: 'CONFIRMED',
        notes: null,
      };

      consultationRepository.findOne.mockResolvedValue(consultation);
      slotRepository.findOne.mockResolvedValue(slot);

      const result = await service.cancelConsultation(
        patientUserId,
        consultationId,
        'Patient emergency',
      );

      expect(result).toBe('Consultation cancelled successfully');
      expect(consultation.status).toBe('CANCELLED');
      expect(consultation.notes).toContain('Cancellation reason: Patient emergency');
      expect(slot.status).toBe('AVAILABLE');
      expect(redisService.releaseSlotHold).toHaveBeenCalledWith(slotId);
      expect(redisService.invalidateDoctorSlots).toHaveBeenCalledWith(doctorId);
    });
  });

  describe('completeConsultation', () => {
    it('throws ForbiddenException if non-assigned doctor attempts completion', async () => {
      consultationRepository.findOne.mockResolvedValue({
        consultation_id: consultationId,
        doctor: { user_id: 'other-doctor-id' },
      });

      await expect(
        service.completeConsultation(doctorUserId, consultationId, 'Notes'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('successfully completes consultation with doctor notes', async () => {
      const consultation = {
        consultation_id: consultationId,
        doctor: { user_id: doctorUserId },
        status: 'CONFIRMED',
        notes: null,
      };
      consultationRepository.findOne.mockResolvedValue(consultation);

      const result = await service.completeConsultation(
        doctorUserId,
        consultationId,
        'Prescribed Ayurvedic remedies.',
      );

      expect(result).toBe('Consultation completed successfully');
      expect(consultation.status).toBe('COMPLETED');
      expect(consultation.notes).toBe('Prescribed Ayurvedic remedies.');
    });
  });

  describe('getConsultationById', () => {
    it('throws ForbiddenException if user is not part of consultation', async () => {
      consultationRepository.findOne.mockResolvedValue({
        consultation_id: consultationId,
        patient_id: 'unrelated-patient',
        doctor: { user_id: 'unrelated-doctor' },
      });

      await expect(
        service.getConsultationById(patientUserId, consultationId),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns consultation entity when user is the patient', async () => {
      const mockConsultation = {
        consultation_id: consultationId,
        patient_id: patientUserId,
        doctor: { user_id: doctorUserId },
      };
      consultationRepository.findOne.mockResolvedValue(mockConsultation);

      const result = await service.getConsultationById(
        patientUserId,
        consultationId,
      );

      expect(result).toBe(mockConsultation);
    });
  });

  describe('myConsultations', () => {
    it('lists consultations for patient user', async () => {
      doctorRepository.findOne.mockResolvedValue(null); // not a doctor
      const consultationsList = [
        { consultation_id: 'c-1', patient_id: patientUserId },
      ];
      consultationRepository.find.mockResolvedValue(consultationsList);

      const result = await service.myConsultations(patientUserId);

      expect(result).toBe(consultationsList);
      expect(consultationRepository.find).toHaveBeenCalledWith({
        where: [{ patient_id: patientUserId }],
        relations: {
          doctor: { user: { profile: true } },
          patient: { profile: true },
        },
        order: { scheduled_at: 'DESC' },
      });
    });

    it('lists consultations including doctor appointments when user is a doctor', async () => {
      doctorRepository.findOne.mockResolvedValue({ doctor_id: doctorId });
      const consultationsList = [{ consultation_id: 'c-2', doctor_id: doctorId }];
      consultationRepository.find.mockResolvedValue(consultationsList);

      const result = await service.myConsultations(doctorUserId);

      expect(result).toBe(consultationsList);
      expect(consultationRepository.find).toHaveBeenCalledWith({
        where: [{ patient_id: doctorUserId }, { doctor_id: doctorId }],
        relations: {
          doctor: { user: { profile: true } },
          patient: { profile: true },
        },
        order: { scheduled_at: 'DESC' },
      });
    });
  });
});
