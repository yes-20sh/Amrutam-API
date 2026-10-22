import { Resolver, Mutation, Query, Args, ID } from '@nestjs/graphql';

import { AvailabilitySlotService } from './availability-slot.service';
import { Public } from '../../common/decorator/public.decorator';
import { CurrentUserId } from '../../common/decorator/current-user.decorator';
import { ThrottleMutations } from '../../common/decorator/throttle.decorator';
import { CreateAvailabilitySlotDto } from './dto/create-slot.dto';
import { UpdateAvailabilitySlotDto } from './dto/update-slot.dto';
import { BulkCreateSlotsDto } from './dto/bulk-create-slots.dto';
import { AvailabilitySlotEntity } from './entities/availability-slot.entity';
import { Roles } from '../../common/decorator/roles.decorator';
import { UserRole } from '../../common/enum/user-role.enum';

@Resolver(() => AvailabilitySlotEntity)
export class AvailabilitySlotResolver {
  constructor(
    private readonly availabilitySlotService: AvailabilitySlotService,
  ) {}

  @ThrottleMutations()
  @Roles(UserRole.DOCTOR)
  @Mutation(() => String)
  async createAvailabilitySlot(
    @Args('input') createDto: CreateAvailabilitySlotDto,
    @CurrentUserId() userId: string,
  ): Promise<string> {
    return this.availabilitySlotService.createSlot(userId, createDto);
  }

  @ThrottleMutations()
  @Roles(UserRole.DOCTOR)
  @Mutation(() => String)
  async createBulkAvailabilitySlots(
    @Args('input') bulkDto: BulkCreateSlotsDto,
    @CurrentUserId() userId: string,
  ): Promise<string> {
    return this.availabilitySlotService.createBulkSlots(userId, bulkDto);
  }

  @ThrottleMutations()
  @Roles(UserRole.DOCTOR)
  @Mutation(() => String)
  async updateAvailabilitySlot(
    @Args('slotId', { type: () => ID }) slotId: string,
    @Args('input') updateDto: UpdateAvailabilitySlotDto,
    @CurrentUserId() userId: string,
  ): Promise<string> {
    return this.availabilitySlotService.updateSlot(userId, slotId, updateDto);
  }

  @ThrottleMutations()
  @Roles(UserRole.DOCTOR)
  @Mutation(() => String)
  async deleteAvailabilitySlot(
    @Args('slotId', { type: () => ID }) slotId: string,
    @CurrentUserId() userId: string,
  ): Promise<string> {
    return this.availabilitySlotService.deleteSlot(userId, slotId);
  }

  @Public()
  @Query(() => [AvailabilitySlotEntity])
  async getDoctorAvailability(
    @Args('doctorId', { type: () => ID }) doctorId: string,
    @Args('fromDate', { type: () => Date, nullable: true }) fromDate?: Date,
  ): Promise<AvailabilitySlotEntity[]> {
    return this.availabilitySlotService.getDoctorAvailability(
      doctorId,
      fromDate,
    );
  }

  @Roles(UserRole.DOCTOR)
  @Query(() => [AvailabilitySlotEntity])
  async myAvailabilitySlots(
    @CurrentUserId() userId: string,
  ): Promise<AvailabilitySlotEntity[]> {
    return this.availabilitySlotService.myAvailabilitySlots(userId);
  }

  @Query(() => AvailabilitySlotEntity)
  async getAvailabilitySlotById(
    @Args('slotId', { type: () => ID }) slotId: string,
  ): Promise<AvailabilitySlotEntity> {
    return this.availabilitySlotService.getSlotById(slotId);
  }
}
