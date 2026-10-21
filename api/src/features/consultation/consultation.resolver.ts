import { Resolver, Mutation, Query, Args, ID } from '@nestjs/graphql';

import { ConsultationService } from './consultation.service';
import { CurrentUserId } from '../../common/decorator/current-user.decorator';
import { CreateConsultationDto } from './dto/create-consultation.dto';
import { RescheduleConsultationDto } from './dto/reschedule-consultation.dto';
import { ConsultationEntity } from './entities/consultation.entity';

@Resolver(() => ConsultationEntity)
export class ConsultationResolver {
  constructor(private readonly consultationService: ConsultationService) {}

  @Mutation(() => String)
  async bookConsultation(
    @Args('input') createDto: CreateConsultationDto,
    @CurrentUserId() userId: string,
  ): Promise<string> {
    return this.consultationService.bookConsultation(userId, createDto);
  }

  @Mutation(() => String)
  async rescheduleConsultation(
    @Args('input') rescheduleDto: RescheduleConsultationDto,
    @CurrentUserId() userId: string,
  ): Promise<string> {
    return this.consultationService.rescheduleConsultation(userId, rescheduleDto);
  }

  @Mutation(() => String)
  async cancelConsultation(
    @Args('consultationId', { type: () => ID }) consultationId: string,
    @Args('reason', { type: () => String, nullable: true }) reason: string | undefined,
    @CurrentUserId() userId: string,
  ): Promise<string> {
    return this.consultationService.cancelConsultation(userId, consultationId, reason);
  }

  @Mutation(() => String)
  async completeConsultation(
    @Args('consultationId', { type: () => ID }) consultationId: string,
    @Args('notes', { type: () => String, nullable: true }) notes: string | undefined,
    @CurrentUserId() userId: string,
  ): Promise<string> {
    return this.consultationService.completeConsultation(userId, consultationId, notes);
  }

  @Query(() => ConsultationEntity)
  async getConsultationById(
    @Args('consultationId', { type: () => ID }) consultationId: string,
    @CurrentUserId() userId: string,
  ): Promise<ConsultationEntity> {
    return this.consultationService.getConsultationById(userId, consultationId);
  }

  @Query(() => [ConsultationEntity])
  async myConsultations(
    @CurrentUserId() userId: string,
  ): Promise<ConsultationEntity[]> {
    return this.consultationService.myConsultations(userId);
  }
}
