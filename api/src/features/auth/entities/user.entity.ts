import { ObjectType, Field, ID } from '@nestjs/graphql';
import { UserRole } from '../../../common/enum/user-role.enum';
import { UserStatus } from '../../../common/enum/user-status.enum';
import { ProfileEntity } from './profile.entity';

@ObjectType('AuthUser')
export class UserEntity {
  @Field(() => ID)
  user_id: string;

  @Field(() => String)
  email: string;

  @Field(() => UserRole)
  role: UserRole;

  @Field(() => UserStatus)
  status: UserStatus;

  @Field(() => Boolean)
  email_verified: boolean;

  @Field(() => Date, { nullable: true })
  last_login_at?: Date | null;

  @Field(() => Date)
  created_at: Date;

  @Field(() => Date)
  updated_at: Date;

  @Field(() => ProfileEntity, { nullable: true })
  profile?: ProfileEntity | null;
}
