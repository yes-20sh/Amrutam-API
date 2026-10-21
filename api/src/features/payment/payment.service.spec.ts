import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';
import type { RedisService } from '../../core/redis/redis.service';
import type { Consultation } from '../../schemas/consultation.schema';
import type { Payment } from '../../schemas/payment.schema';
import type { CreatePaymentDto } from './dto/create-payment.dto';
import type { ProcessPaymentDto } from './dto/process-payment.dto';
import type { PaymentService as PaymentServiceType } from './payment.service';

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

bunTest.mock.module('../../schemas/payment.schema', () => ({
  Payment: class Payment {},
}));
bunTest.mock.module('../../schemas/consultation.schema', () => ({
  Consultation: class Consultation {},
}));
bunTest.mock.module('../../schemas/availability_slot.schema', () => ({
  AvailabilitySlot: class AvailabilitySlot {},
}));

type ServiceDependencies = [
  Repository<Payment>,
  Repository<Consultation>,
  RedisService,
  DataSource,
];
let createService: (...dependencies: ServiceDependencies) => PaymentServiceType;

describe('PaymentService', () => {
  let service: PaymentServiceType;
  let paymentRepository: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let consultationRepository: { findOne: jest.Mock };
  let redisService: {
    releaseSlotHold: jest.Mock;
    invalidateDoctorSlots: jest.Mock;
  };
  let queryBuilder: {
    leftJoinAndSelect: jest.Mock;
    where: jest.Mock;
    orderBy: jest.Mock;
    getMany: jest.Mock;
  };
  let queryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    release: jest.Mock;
    manager: {
      findOne: jest.Mock;
      save: jest.Mock;
      update: jest.Mock;
    };
  };
  let dataSource: { createQueryRunner: jest.Mock };

  const patientId = 'patient-123';
  const doctorId = 'doctor-123';
  const consultationId = 'consultation-123';
  const paymentId = 'payment-123';

  beforeAll(async () => {
    const { PaymentService } = await import('./payment.service.js');
    createService = (...dependencies) => new PaymentService(...dependencies);
  });

  beforeEach(() => {
    queryBuilder = {
      leftJoinAndSelect: bunTest.mock(),
      where: bunTest.mock(),
      orderBy: bunTest.mock(),
      getMany: bunTest.mock(),
    };
    queryBuilder.leftJoinAndSelect.mockReturnValue(queryBuilder);
    queryBuilder.where.mockReturnValue(queryBuilder);
    queryBuilder.orderBy.mockReturnValue(queryBuilder);
    paymentRepository = {
      findOne: bunTest.mock(),
      find: bunTest.mock(),
      create: bunTest.mock(),
      save: bunTest.mock(),
      createQueryBuilder: bunTest.mock().mockReturnValue(queryBuilder),
    };
    consultationRepository = { findOne: bunTest.mock() };
    redisService = {
      releaseSlotHold: bunTest.mock().mockResolvedValue(true),
      invalidateDoctorSlots: bunTest.mock().mockResolvedValue(undefined),
    };
    queryRunner = {
      connect: bunTest.mock().mockResolvedValue(undefined),
      startTransaction: bunTest.mock().mockResolvedValue(undefined),
      rollbackTransaction: bunTest.mock().mockResolvedValue(undefined),
      commitTransaction: bunTest.mock().mockResolvedValue(undefined),
      release: bunTest.mock().mockResolvedValue(undefined),
      manager: {
        findOne: bunTest.mock(),
        save: bunTest.mock().mockResolvedValue(undefined),
        update: bunTest.mock().mockResolvedValue(undefined),
      },
    };
    dataSource = {
      createQueryRunner: bunTest.mock().mockReturnValue(queryRunner),
    };
    service = createService(
      paymentRepository as unknown as Repository<Payment>,
      consultationRepository as unknown as Repository<Consultation>,
      redisService as unknown as RedisService,
      dataSource as unknown as DataSource,
    );
  });

  describe('createPayment', () => {
    const input: CreatePaymentDto = {
      consultation_id: consultationId,
      amount: ' 500.00 ',
      currency: ' inr ',
      payment_method: ' UPI ',
      transaction_reference: ' ref-123 ',
    };

    it('creates a pending payment for its patient', async () => {
      consultationRepository.findOne.mockResolvedValue({
        patient_id: patientId,
        status: 'CONFIRMED',
      });
      paymentRepository.findOne.mockResolvedValue(null);
      paymentRepository.create.mockReturnValue({
        transaction_reference: 'ref-123',
      });
      paymentRepository.save.mockResolvedValue({ payment_id: paymentId });

      await expect(service.createPayment(patientId, input)).resolves.toEqual({
        message: 'Payment initiated successfully',
        payment_id: paymentId,
      });
      expect(paymentRepository.create).toHaveBeenCalledWith({
        consultation_id: consultationId,
        amount: '500.00',
        currency: 'INR',
        payment_method: 'UPI',
        payment_status: 'PENDING',
        transaction_reference: 'ref-123',
        paid_at: null,
      });
    });

    it('rejects payment initiation by someone other than the patient', async () => {
      consultationRepository.findOne.mockResolvedValue({
        patient_id: 'another-patient',
        status: 'CONFIRMED',
      });

      await expect(service.createPayment(patientId, input)).rejects.toThrow(
        new ForbiddenException(
          'Only the patient of this consultation can initiate a payment',
        ),
      );
      expect(paymentRepository.save).not.toHaveBeenCalled();
    });

    it('rejects payment initiation for a cancelled consultation', async () => {
      consultationRepository.findOne.mockResolvedValue({
        patient_id: patientId,
        status: 'CANCELLED',
      });

      await expect(service.createPayment(patientId, input)).rejects.toThrow(
        new BadRequestException(
          'Cannot initiate payment for a cancelled consultation. The reservation window may have expired.',
        ),
      );
    });

    it('rejects a duplicate transaction reference', async () => {
      consultationRepository.findOne.mockResolvedValue({
        patient_id: patientId,
        status: 'CONFIRMED',
      });
      paymentRepository.findOne.mockResolvedValue({ payment_id: 'existing' });

      await expect(service.createPayment(patientId, input)).rejects.toThrow(
        new ConflictException(
          'A payment with this transaction reference already exists',
        ),
      );
      expect(paymentRepository.save).not.toHaveBeenCalled();
    });

    it('rejects a missing consultation', async () => {
      consultationRepository.findOne.mockResolvedValue(null);

      await expect(service.createPayment(patientId, input)).rejects.toThrow(
        new NotFoundException('Consultation not found'),
      );
    });
  });

  describe('processPayment', () => {
    const processDto: ProcessPaymentDto = {
      payment_id: paymentId,
      payment_status: ' paid ',
      payment_method: 'UPI',
    };

    it('confirms the consultation, books its slot, and clears Redis holds on success', async () => {
      const consultation = {
        patient_id: patientId,
        doctor_id: doctorId,
        slot_id: 'slot-123',
        status: 'PENDING_PAYMENT',
      };
      const payment: {
        payment_status: string;
        paid_at?: Date | null;
        consultation: typeof consultation;
      } = {
        payment_status: 'PENDING',
        consultation,
      };
      queryRunner.manager.findOne.mockResolvedValue(payment);

      await expect(service.processPayment(patientId, processDto)).resolves.toBe(
        'Payment processed successfully',
      );
      expect(consultation.status).toBe('CONFIRMED');
      expect(queryRunner.manager.update).toHaveBeenCalledWith(
        expect.anything(),
        { slot_id: 'slot-123' },
        { status: 'BOOKED' },
      );
      expect(payment.payment_status).toBe('PAID');
      expect(payment.paid_at).toBeInstanceOf(Date);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(redisService.releaseSlotHold).toHaveBeenCalledWith('slot-123');
      expect(redisService.invalidateDoctorSlots).toHaveBeenCalledWith(doctorId);
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('rolls back and rejects an unauthorized user', async () => {
      queryRunner.manager.findOne.mockResolvedValue({
        payment_status: 'PENDING',
        consultation: {
          patient_id: patientId,
          doctor: { user_id: doctorId },
        },
      });

      await expect(
        service.processPayment('other-user', processDto),
      ).rejects.toThrow(
        new ForbiddenException(
          'You are not authorized to process this payment',
        ),
      );
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('does not process a payment a second time when already paid', async () => {
      queryRunner.manager.findOne.mockResolvedValue({
        payment_status: 'PAID',
        consultation: { patient_id: patientId },
      });

      await expect(service.processPayment(patientId, processDto)).resolves.toBe(
        'Payment has already been processed and confirmed.',
      );
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.manager.save).not.toHaveBeenCalled();
    });

    it('rejects a missing payment', async () => {
      queryRunner.manager.findOne.mockResolvedValue(null);

      await expect(
        service.processPayment(patientId, processDto),
      ).rejects.toThrow(new NotFoundException('Payment record not found'));
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });
  });

  describe('refundPayment', () => {
    it('refunds a completed payment belonging to the patient', async () => {
      const payment = {
        payment_status: 'PAID',
        consultation: { patient_id: patientId },
      };
      paymentRepository.findOne.mockResolvedValue(payment);

      await expect(service.refundPayment(patientId, paymentId)).resolves.toBe(
        'Payment refunded successfully',
      );
      expect(payment.payment_status).toBe('REFUNDED');
      expect(paymentRepository.save).toHaveBeenCalledWith(payment);
    });

    it('rejects refunding a payment that is not completed', async () => {
      paymentRepository.findOne.mockResolvedValue({
        payment_status: 'PENDING',
        consultation: { patient_id: patientId },
      });

      await expect(service.refundPayment(patientId, paymentId)).rejects.toThrow(
        new BadRequestException(
          'Cannot refund a payment that has not been completed',
        ),
      );
      expect(paymentRepository.save).not.toHaveBeenCalled();
    });

    it('rejects refunding by an unauthorized user', async () => {
      paymentRepository.findOne.mockResolvedValue({
        payment_status: 'PAID',
        consultation: { patient_id: patientId, doctor: { user_id: doctorId } },
      });

      await expect(
        service.refundPayment('other-user', paymentId),
      ).rejects.toThrow(
        new ForbiddenException('You are not authorized to refund this payment'),
      );
      expect(paymentRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('getPaymentById', () => {
    it('returns the payment to its patient', async () => {
      const payment = {
        payment_id: paymentId,
        consultation: { patient_id: patientId },
      };
      paymentRepository.findOne.mockResolvedValue(payment);

      await expect(service.getPaymentById(patientId, paymentId)).resolves.toBe(
        payment,
      );
    });

    it('rejects a user who is not associated with the payment', async () => {
      paymentRepository.findOne.mockResolvedValue({
        consultation: { patient_id: patientId, doctor: { user_id: doctorId } },
      });

      await expect(
        service.getPaymentById('other-user', paymentId),
      ).rejects.toThrow(
        new ForbiddenException('You are not authorized to view this payment'),
      );
    });
  });

  describe('getPaymentsByConsultation', () => {
    it('returns consultation payments to an authorized doctor', async () => {
      const payments = [{ payment_id: paymentId }];
      consultationRepository.findOne.mockResolvedValue({
        patient_id: patientId,
        doctor: { user_id: doctorId },
      });
      paymentRepository.find.mockResolvedValue(payments);

      await expect(
        service.getPaymentsByConsultation(doctorId, consultationId),
      ).resolves.toBe(payments);
      expect(paymentRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { consultation_id: consultationId },
          order: { created_at: 'DESC' },
        }),
      );
    });

    it('rejects a user who is not associated with the consultation', async () => {
      consultationRepository.findOne.mockResolvedValue({
        patient_id: patientId,
        doctor: { user_id: doctorId },
      });

      await expect(
        service.getPaymentsByConsultation('other-user', consultationId),
      ).rejects.toThrow(
        new ForbiddenException(
          'You are not authorized to view payments for this consultation',
        ),
      );
      expect(paymentRepository.find).not.toHaveBeenCalled();
    });
  });

  describe('myPayments', () => {
    it('lists the current user payments ordered newest first', async () => {
      const payments = [{ payment_id: paymentId }];
      queryBuilder.getMany.mockResolvedValue(payments);

      await expect(service.myPayments(patientId)).resolves.toBe(payments);
      expect(queryBuilder.where).toHaveBeenCalledWith(
        'consultation.patient_id = :userId OR doctor.user_id = :userId',
        { userId: patientId },
      );
      expect(queryBuilder.orderBy).toHaveBeenCalledWith(
        'payment.created_at',
        'DESC',
      );
    });
  });
});
