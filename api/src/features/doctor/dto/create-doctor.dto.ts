import { InputType, Field, Int } from '@nestjs/graphql';
import {
  IsInt,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

@InputType()
export class CreateDoctorDto {
  @Field(() => String)
  @IsString()
  @IsNotEmpty({ message: 'Specialization is required' })
  specialization: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty({ message: 'License number is required' })
  license_number: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty({ message: 'Qualification is required' })
  qualification: string;

  @Field(() => Int, { defaultValue: 0 })
  @IsInt({ message: 'Experience years must be an integer' })
  @Min(0, { message: 'Experience years cannot be negative' })
  experience_years: number;

  @Field(() => String)
  @IsNumberString({}, { message: 'Consultation fee must be a valid numeric amount' })
  @IsNotEmpty({ message: 'Consultation fee is required' })
  consultation_fee: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  bio?: string;
}
