import { Resolver, Mutation, Query, Args, ID } from '@nestjs/graphql';

import { DoctorService } from './doctor.service';
import { Public } from '../../common/decorator/public.decorator';
import { CurrentUserId } from '../../common/decorator/current-user.decorator';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { DoctorEntity } from './entities/doctor.entity';
import { Roles } from '../../common/decorator/roles.decorator';
import { UserRole } from '../../common/enum/user-role.enum';

@Resolver(() => DoctorEntity)
export class DoctorResolver {
  constructor(private readonly doctorService: DoctorService) { }

  @Roles(UserRole.DOCTOR)
  @Mutation(() => String)
  async createDoctorProfile(
    @Args('input') createDoctorDto: CreateDoctorDto,
    @CurrentUserId() userId: string,
  ): Promise<string> {
    return this.doctorService.createDoctorProfile(userId, createDoctorDto);
  }

  @Roles(UserRole.DOCTOR)
  @Mutation(() => String)
  async updateDoctorProfile(
    @Args('input') updateDoctorDto: UpdateDoctorDto,
    @CurrentUserId() userId: string,
  ): Promise<string> {
    return this.doctorService.updateDoctorProfile(userId, updateDoctorDto);
  }

  @Roles(UserRole.DOCTOR)
  @Query(() => DoctorEntity)
  async myDoctorProfile(
    @CurrentUserId() userId: string,
  ): Promise<DoctorEntity> {
    return this.doctorService.getDoctorProfile(userId);
  }

  @Public()
  @Query(() => DoctorEntity)
  async getDoctorById(
    @Args('doctorId', { type: () => ID }) doctorId: string,
  ): Promise<DoctorEntity> {
    return this.doctorService.getDoctorById(doctorId);
  }

  @Public()
  @Query(() => [DoctorEntity])
  async listDoctors(): Promise<DoctorEntity[]> {
    return this.doctorService.listDoctors();
  }
}
