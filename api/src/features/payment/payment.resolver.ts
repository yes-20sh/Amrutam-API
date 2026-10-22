import { Resolver, Mutation, Query, Args, ID } from '@nestjs/graphql';

import { PaymentService } from './payment.service';
import { CurrentUserId } from '../../common/decorator/current-user.decorator';
import { ThrottleTransactional } from '../../common/decorator/throttle.decorator';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { PaymentEntity } from './entities/payment.entity';
import { CreatePaymentResponse } from './entities/create-payment-response.entity';
import { Roles } from '../../common/decorator/roles.decorator';
import { UserRole } from '../../common/enum/user-role.enum';

@Resolver(() => PaymentEntity)
export class PaymentResolver {
  constructor(private readonly paymentService: PaymentService) {}

  @ThrottleTransactional()
  @Roles(UserRole.PATIENT)
  @Mutation(() => CreatePaymentResponse)
  async createPayment(
    @Args('input') createDto: CreatePaymentDto,
    @CurrentUserId() userId: string,
  ): Promise<CreatePaymentResponse> {
    return this.paymentService.createPayment(userId, createDto);
  }

  @ThrottleTransactional()
  @Roles(UserRole.PATIENT, UserRole.DOCTOR, UserRole.ADMIN)
  @Mutation(() => String)
  async processPayment(
    @Args('input') processDto: ProcessPaymentDto,
    @CurrentUserId() userId: string,
  ): Promise<string> {
    return this.paymentService.processPayment(userId, processDto);
  }

  @ThrottleTransactional()
  @Roles(UserRole.PATIENT, UserRole.DOCTOR, UserRole.ADMIN)
  @Mutation(() => String)
  async refundPayment(
    @Args('paymentId', { type: () => ID }) paymentId: string,
    @CurrentUserId() userId: string,
  ): Promise<string> {
    return this.paymentService.refundPayment(userId, paymentId);
  }

  @Roles(UserRole.PATIENT, UserRole.DOCTOR, UserRole.ADMIN)
  @Query(() => PaymentEntity)
  async getPaymentById(
    @Args('paymentId', { type: () => ID }) paymentId: string,
    @CurrentUserId() userId: string,
  ): Promise<PaymentEntity> {
    return this.paymentService.getPaymentById(userId, paymentId);
  }

  @Roles(UserRole.PATIENT, UserRole.DOCTOR, UserRole.ADMIN)
  @Query(() => [PaymentEntity])
  async getPaymentsByConsultation(
    @Args('consultationId', { type: () => ID }) consultationId: string,
    @CurrentUserId() userId: string,
  ): Promise<PaymentEntity[]> {
    return this.paymentService.getPaymentsByConsultation(
      userId,
      consultationId,
    );
  }

  @Roles(UserRole.PATIENT, UserRole.DOCTOR, UserRole.ADMIN)
  @Query(() => [PaymentEntity])
  async myPayments(
    @CurrentUserId() userId: string,
  ): Promise<PaymentEntity[]> {
    return this.paymentService.myPayments(userId);
  }
}
