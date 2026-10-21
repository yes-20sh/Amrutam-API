import { InputType, Field, ID, PickType } from '@nestjs/graphql';
import { IsNotEmpty } from 'class-validator';
import { CreateConsultationDto } from './create-consultation.dto';

@InputType()
export class RescheduleConsultationDto extends PickType(
  CreateConsultationDto,
  ['slot_id', 'scheduled_at'] as const,
) {
  @Field(() => ID)
  @IsNotEmpty({ message: 'Consultation ID is required' })
  consultation_id: string;
}
