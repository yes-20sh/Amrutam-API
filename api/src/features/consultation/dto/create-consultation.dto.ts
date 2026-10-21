import { InputType, Field, ID } from '@nestjs/graphql';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ConsultationType } from '../../../common/enum/consultation-type.enum';

@InputType()
export class CreateConsultationDto {
  @Field(() => ID)
  @IsNotEmpty({ message: 'Doctor ID is required' })
  doctor_id: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  slot_id?: string;

  @Field(() => Date)
  @IsDate({ message: 'Scheduled date must be a valid date' })
  scheduled_at: Date;

  @Field(() => ConsultationType)
  @IsEnum(ConsultationType, { message: 'Consultation type must be ONLINE or IN_PERSON' })
  consultation_type: ConsultationType;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  reason?: string;
}
