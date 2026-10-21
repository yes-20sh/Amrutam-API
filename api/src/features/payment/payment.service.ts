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

import { Payment } from '../../schemas/payment.schema';
import { Consultation } from '../../schemas/consultation.schema';
import { handleServiceError } from '../../utils/error/error.util';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { PaymentEntity } from './entities/payment.entity';
import { CreatePaymentResponse } from './entities/create-payment-response.entity';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Consultation)
    private readonly consultationRepository: Repository<Consultation>,
  ) {}

  /**
   * Insert: Create and initiate a payment for a consultation.
   */
  async createPayment(
    patientUserId: string,
    createDto: CreatePaymentDto,
  ): Promise<CreatePaymentResponse> {
    try {
      const consultation = await this.consultationRepository.findOne({
        where: { consultation_id: createDto.consultation_id },
        relations: {
          patient: { profile: true },
          doctor: { user: { profile: true } },
        },
      });

      if (!consultation) {
        throw new NotFoundException('Consultation not found');
      }

      if (consultation.patient_id !== patientUserId) {
        throw new ForbiddenException(
          'Only the patient of this consultation can initiate a payment',
        );
      }

      if (consultation.status === 'CANCELLED') {
        throw new BadRequestException('Cannot initiate payment for a cancelled consultation');
      }

      // Generate unique transaction reference if not supplied
      const txRef =
        createDto.transaction_reference?.trim() ||
        `TXN_${Date.now()}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

      const existingPayment = await this.paymentRepository.findOne({
        where: { transaction_reference: txRef },
      });

      if (existingPayment) {
        throw new ConflictException(
          'A payment with this transaction reference already exists',
        );
      }

      const payment = this.paymentRepository.create({
        consultation_id: createDto.consultation_id,
        amount: createDto.amount.trim(),
        currency: createDto.currency.toUpperCase().trim(),
        payment_method: createDto.payment_method.trim(),
        payment_status: 'PENDING',
        transaction_reference: txRef,
        paid_at: null,
      });

      const savedPayment = await this.paymentRepository.save(payment);

      return {
        message: 'Payment initiated successfully',
        payment_id: savedPayment.payment_id,
      };
    } catch (error) {
      handleServiceError(error, this.logger, 'PaymentService.createPayment');
    }
  }

  /**
   * Update: Process and update payment transaction status (e.g. mark as PAID).
   */
  async processPayment(
    userId: string,
    processDto: ProcessPaymentDto,
  ): Promise<string> {
    try {
      const payment = await this.paymentRepository.findOne({
        where: { payment_id: processDto.payment_id },
        relations: {
          consultation: {
            patient: true,
            doctor: { user: true },
          },
        },
      });

      if (!payment) {
        throw new NotFoundException('Payment record not found');
      }

      const isPatient = payment.consultation?.patient_id === userId;
      const isDoctor = payment.consultation?.doctor?.user_id === userId;

      if (!isPatient && !isDoctor) {
        throw new ForbiddenException(
          'You are not authorized to process this payment',
        );
      }

      payment.payment_status = processDto.payment_status.toUpperCase().trim();

      if (processDto.payment_method) {
        payment.payment_method = processDto.payment_method.trim();
      }

      if (processDto.transaction_reference) {
        payment.transaction_reference = processDto.transaction_reference.trim();
      }

      if (
        payment.payment_status === 'PAID' ||
        payment.payment_status === 'COMPLETED'
      ) {
        payment.paid_at = new Date();
      }

      await this.paymentRepository.save(payment);
      return 'Payment processed successfully';
    } catch (error) {
      handleServiceError(error, this.logger, 'PaymentService.processPayment');
    }
  }

  /**
   * Update: Refund a completed payment.
   */
  async refundPayment(
    userId: string,
    paymentId: string,
  ): Promise<string> {
    try {
      const payment = await this.paymentRepository.findOne({
        where: { payment_id: paymentId },
        relations: {
          consultation: {
            patient: true,
            doctor: { user: true },
          },
        },
      });

      if (!payment) {
        throw new NotFoundException('Payment record not found');
      }

      const isPatient = payment.consultation?.patient_id === userId;
      const isDoctor = payment.consultation?.doctor?.user_id === userId;

      if (!isPatient && !isDoctor) {
        throw new ForbiddenException(
          'You are not authorized to refund this payment',
        );
      }

      if (payment.payment_status === 'REFUNDED') {
        throw new BadRequestException('This payment has already been refunded');
      }

      if (
        payment.payment_status !== 'PAID' &&
        payment.payment_status !== 'COMPLETED'
      ) {
        throw new BadRequestException(
          'Cannot refund a payment that has not been completed',
        );
      }

      payment.payment_status = 'REFUNDED';
      await this.paymentRepository.save(payment);

      return 'Payment refunded successfully';
    } catch (error) {
      handleServiceError(error, this.logger, 'PaymentService.refundPayment');
    }
  }

  /**
   * Get: Retrieve payment by ID.
   */
  async getPaymentById(
    userId: string,
    paymentId: string,
  ): Promise<PaymentEntity> {
    try {
      const payment = await this.paymentRepository.findOne({
        where: { payment_id: paymentId },
        relations: {
          consultation: {
            patient: { profile: true },
            doctor: { user: { profile: true } },
          },
        },
      });

      if (!payment) {
        throw new NotFoundException('Payment record not found');
      }

      const isPatient = payment.consultation?.patient_id === userId;
      const isDoctor = payment.consultation?.doctor?.user_id === userId;

      if (!isPatient && !isDoctor) {
        throw new ForbiddenException(
          'You are not authorized to view this payment',
        );
      }

      return payment as unknown as PaymentEntity;
    } catch (error) {
      handleServiceError(error, this.logger, 'PaymentService.getPaymentById');
    }
  }

  /**
   * Get: Retrieve all payments for a consultation.
   */
  async getPaymentsByConsultation(
    userId: string,
    consultationId: string,
  ): Promise<PaymentEntity[]> {
    try {
      const consultation = await this.consultationRepository.findOne({
        where: { consultation_id: consultationId },
        relations: { doctor: { user: true } },
      });

      if (!consultation) {
        throw new NotFoundException('Consultation not found');
      }

      const isPatient = consultation.patient_id === userId;
      const isDoctor = consultation.doctor?.user_id === userId;

      if (!isPatient && !isDoctor) {
        throw new ForbiddenException(
          'You are not authorized to view payments for this consultation',
        );
      }

      const payments = await this.paymentRepository.find({
        where: { consultation_id: consultationId },
        relations: {
          consultation: {
            patient: { profile: true },
            doctor: { user: { profile: true } },
          },
        },
        order: { created_at: 'DESC' },
      });

      return payments as unknown as PaymentEntity[];
    } catch (error) {
      handleServiceError(
        error,
        this.logger,
        'PaymentService.getPaymentsByConsultation',
      );
    }
  }

  /**
   * Get: List all payments for the authenticated user (patient or doctor).
   */
  async myPayments(userId: string): Promise<PaymentEntity[]> {
    try {
      const payments = await this.paymentRepository
        .createQueryBuilder('payment')
        .leftJoinAndSelect('payment.consultation', 'consultation')
        .leftJoinAndSelect('consultation.doctor', 'doctor')
        .leftJoinAndSelect('doctor.user', 'doctorUser')
        .leftJoinAndSelect('doctorUser.profile', 'doctorProfile')
        .leftJoinAndSelect('consultation.patient', 'patient')
        .leftJoinAndSelect('patient.profile', 'patientProfile')
        .where(
          'consultation.patient_id = :userId OR doctor.user_id = :userId',
          { userId },
        )
        .orderBy('payment.created_at', 'DESC')
        .getMany();

      return payments as unknown as PaymentEntity[];
    } catch (error) {
      handleServiceError(error, this.logger, 'PaymentService.myPayments');
    }
  }
}
