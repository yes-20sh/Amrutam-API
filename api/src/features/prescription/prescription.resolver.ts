import { Resolver, Mutation, Query, Args, ID } from '@nestjs/graphql';

import { PrescriptionService } from './prescription.service';
import { Public } from '../../common/decorator/public.decorator';
import { CurrentUserId } from '../../common/decorator/current-user.decorator';
import { ThrottleMutations } from '../../common/decorator/throttle.decorator';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { PrescriptionEntity } from './entities/prescription.entity';
import { Roles } from '../../common/decorator/roles.decorator';
import { UserRole } from '../../common/enum/user-role.enum';

@Resolver(() => PrescriptionEntity)
export class PrescriptionResolver {
  constructor(private readonly prescriptionService: PrescriptionService) {}

  @ThrottleMutations()
  @Roles(UserRole.DOCTOR)
  @Mutation(() => String)
  async createPrescription(
    @Args('input') createDto: CreatePrescriptionDto,
    @CurrentUserId() userId: string,
  ): Promise<string> {
    return this.prescriptionService.createPrescription(userId, createDto);
  }

  @ThrottleMutations()
  @Roles(UserRole.DOCTOR)
  @Mutation(() => String)
  async updatePrescription(
    @Args('prescriptionId', { type: () => ID }) prescriptionId: string,
    @Args('input') updateDto: UpdatePrescriptionDto,
    @CurrentUserId() userId: string,
  ): Promise<string> {
    return this.prescriptionService.updatePrescription(
      userId,
      prescriptionId,
      updateDto,
    );
  }

  @Public()
  @Query(() => PrescriptionEntity)
  async getPrescriptionById(
    @Args('prescriptionId', { type: () => ID }) prescriptionId: string,
  ): Promise<PrescriptionEntity> {
    return this.prescriptionService.getPrescriptionById(prescriptionId);
  }

  @Roles(UserRole.DOCTOR, UserRole.PATIENT)
  @Query(() => [PrescriptionEntity])
  async getPrescriptionsByConsultation(
    @Args('consultationId', { type: () => ID }) consultationId: string,
    @CurrentUserId() userId: string,
  ): Promise<PrescriptionEntity[]> {
    return this.prescriptionService.getPrescriptionsByConsultation(
      userId,
      consultationId,
    );
  }

  @Roles(UserRole.DOCTOR, UserRole.PATIENT)
  @Query(() => [PrescriptionEntity])
  async myPrescriptions(
    @CurrentUserId() userId: string,
  ): Promise<PrescriptionEntity[]> {
    return this.prescriptionService.myPrescriptions(userId);
  }
}
