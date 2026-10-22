import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { ProfileService } from './profile.service';
import { ProfileEntity } from './entities/profile.entity';
import { UpdateProfileInput } from './dto/update-profile.input';
import { CurrentUserId } from '../../common/decorator/current-user.decorator';
import { ThrottleMutations } from '../../common/decorator/throttle.decorator';
import { Roles } from '../../common/decorator/roles.decorator';
import { UserRole } from '../../common/enum/user-role.enum';

@Resolver(() => ProfileEntity)
export class ProfileResolver {
  constructor(private readonly profileService: ProfileService) { }

  @Roles(UserRole.PATIENT, UserRole.DOCTOR, UserRole.ADMIN)
  @Query(() => ProfileEntity)
  async myProfile(
    @CurrentUserId() userId: string,
  ): Promise<ProfileEntity> {
    return this.profileService.myProfile(userId);
  }

  @ThrottleMutations()
  @Roles(UserRole.PATIENT, UserRole.DOCTOR, UserRole.ADMIN)
  @Mutation(() => String)
  async updateProfile(
    @Args('input') input: UpdateProfileInput,
    @CurrentUserId() userId: string,
  ): Promise<string> {
    return this.profileService.updateProfile(userId, input);
  }
}
