import { InputType, Field } from '@nestjs/graphql';
import {
  IsOptional,
  IsString,
  MaxLength,
  IsEnum,
  IsDate,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Gender } from '../../../common/enum/gender.enum';

@InputType()
export class UpdateProfileInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  full_name?: string;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  date_of_birth?: Date;

  @Field(() => Gender, { nullable: true })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  address?: string;

  /**
   * Accepts:
   * - Base64 data URI (e.g. data:image/jpeg;base64,...) or remote URL to upload to Cloudinary.
   * - null or empty string "" to delete the existing Cloudinary image and remove it from profile.
   * - undefined / omitted to keep the existing profile image.
   */
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  profile_image?: string | null;
}
