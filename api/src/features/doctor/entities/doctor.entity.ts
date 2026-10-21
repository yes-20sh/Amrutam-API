import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { VerificationStatus } from '../../../common/enum/verification-status.enum';
import { UserEntity } from '../../auth/entities/user.entity';

@ObjectType('Doctor')
export class DoctorEntity {
  @Field(() => ID)
  doctor_id: string;

  @Field(() => ID)
  user_id: string;

  @Field(() => String)
  specialization: string;

  @Field(() => String)
  license_number: string;

  @Field(() => String)
  qualification: string;

  @Field(() => Int)
  experience_years: number;

  @Field(() => String)
  consultation_fee: string;

  @Field(() => VerificationStatus)
  verification_status: VerificationStatus;

  @Field(() => String, { nullable: true })
  bio?: string | null;

  @Field(() => Date)
  created_at: Date;

  @Field(() => Date)
  updated_at: Date;

  @Field(() => UserEntity, { nullable: true })
  user?: UserEntity | null;
}
