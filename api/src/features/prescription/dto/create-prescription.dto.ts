import { InputType, Field, ID } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { MedicationItemInput } from './medication-item.input';

@InputType()
export class CreatePrescriptionDto {
  @Field(() => ID)
  @IsNotEmpty({ message: 'Consultation ID is required' })
  consultation_id: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty({ message: 'Diagnosis is required' })
  diagnosis: string;

  @Field(() => [MedicationItemInput])
  @IsArray({ message: 'Medication details must be a list of medications' })
  @ValidateNested({ each: true })
  @Type(() => MedicationItemInput)
  medication_details: MedicationItemInput[];

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  instructions?: string;
}
