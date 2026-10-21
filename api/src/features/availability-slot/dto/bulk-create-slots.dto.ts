import { InputType, Field, Int } from '@nestjs/graphql';
import { IsInt, Min } from 'class-validator';
import { CreateAvailabilitySlotDto } from './create-slot.dto';

@InputType()
export class BulkCreateSlotsDto extends CreateAvailabilitySlotDto {
  @Field(() => Int, { defaultValue: 30 })
  @IsInt({ message: 'Slot duration must be an integer' })
  @Min(10, { message: 'Slot duration must be at least 10 minutes' })
  slot_duration_minutes: number;
}
