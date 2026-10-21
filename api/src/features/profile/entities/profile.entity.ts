import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Gender } from '../../../common/enum/gender.enum';

@ObjectType('UserProfile')
export class ProfileEntity {
  @Field(() => ID)
  profile_id: string;

  @Field(() => ID)
  user_id: string;

  @Field(() => String)
  full_name: string;

  @Field(() => Date, { nullable: true })
  date_of_birth?: Date | null;

  @Field(() => Gender, { nullable: true })
  gender?: Gender | null;

  @Field(() => String, { nullable: true })
  phone?: string | null;

  @Field(() => String, { nullable: true })
  address?: string | null;

  @Field(() => String, { nullable: true })
  profile_image_url?: string | null;

  @Field(() => Date)
  created_at: Date;

  @Field(() => Date)
  updated_at: Date;
}
