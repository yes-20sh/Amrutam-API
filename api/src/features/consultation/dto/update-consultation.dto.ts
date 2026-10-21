import { InputType, Field, PartialType, OmitType } from '@nestjs/graphql';
import { IsOptional, IsString } from 'class-validator';
import { CreateConsultationDto } from './create-consultation.dto';

@InputType()
export class UpdateConsultationDto extends PartialType(
  OmitType(CreateConsultationDto, ['doctor_id'] as const),
) {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  status?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}
