import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

@InputType('MedicationItemInput')
export class MedicationItemInput {
  @Field(() => String)
  @IsString()
  @IsNotEmpty({ message: 'Medicine name is required' })
  medicine_name: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty({ message: 'Dosage is required (e.g. 500mg, 1 tablet)' })
  dosage: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty({ message: 'Frequency is required (e.g. Twice daily after meals)' })
  frequency: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty({ message: 'Duration is required (e.g. 5 days, 2 weeks)' })
  duration: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  instructions?: string;
}
