import { Resolver, Mutation, Query, Args, ID } from '@nestjs/graphql';

import { ConsultationService } from './consultation.service';
import { Public } from '../../common/decorator/public.decorator';
import { CurrentUserId } from '../../common/decorator/current-user.decorator';
import { CreateConsultationDto } from './dto/create-consultation.dto';
import { RescheduleConsultationDto } from './dto/reschedule-consultation.dto';
import { ConsultationEntity } from './entities/consultation.entity';
import { Roles } from '../../common/decorator/roles.decorator';
import { UserRole } from '../../common/enum/user-role.enum';

@Resolver(() => ConsultationEntity)
export class ConsultationResolver {
  constructor(private readonly consultationService: ConsultationService) {}

  @Roles(UserRole.PATIENT)
  @Mutation(() => String)
  async bookConsultation(
    @Args('input') createDto: CreateConsultationDto,
    @CurrentUserId() userId: string,
  ): Promise<string> {
    return this.consultationService.bookConsultation(userId, createDto);
  }

  @Roles(UserRole.PATIENT, UserRole.DOCTOR, UserRole.ADMIN)
  @Mutation(() => String)
  async rescheduleConsultation(
    @Args('input') rescheduleDto: RescheduleConsultationDto,
    @CurrentUserId() userId: string,
  ): Promise<string> {
    return this.consultationService.rescheduleConsultation(userId, rescheduleDto);
  }

  @Roles(UserRole.PATIENT, UserRole.DOCTOR, UserRole.ADMIN)
  @Mutation(() => String)
  async cancelConsultation(
    @Args('consultationId', { type: () => ID }) consultationId: string,
    @Args('reason', { type: () => String, nullable: true }) reason: string | undefined,
    @CurrentUserId() userId: string,
  ): Promise<string> {
    return this.consultationService.cancelConsultation(userId, consultationId, reason);
  }

  @Roles(UserRole.DOCTOR)
  @Mutation(() => String)
  async completeConsultation(
    @Args('consultationId', { type: () => ID }) consultationId: string,
    @Args('notes', { type: () => String, nullable: true }) notes: string | undefined,
    @CurrentUserId() userId: string,
  ): Promise<string> {
    return this.consultationService.completeConsultation(userId, consultationId, notes);
  }

  @Roles(UserRole.PATIENT, UserRole.DOCTOR, UserRole.ADMIN)
  @Query(() => ConsultationEntity)
  async getConsultationById(
    @Args('consultationId', { type: () => ID }) consultationId: string,
    @CurrentUserId() userId: string,
  ): Promise<ConsultationEntity> {
    return this.consultationService.getConsultationById(userId, consultationId);
  }

  @Roles(UserRole.PATIENT, UserRole.DOCTOR, UserRole.ADMIN)
  @Query(() => [ConsultationEntity])
  async myConsultations(
    @CurrentUserId() userId: string,
  ): Promise<ConsultationEntity[]> {
    return this.consultationService.myConsultations(userId);
  }
}
