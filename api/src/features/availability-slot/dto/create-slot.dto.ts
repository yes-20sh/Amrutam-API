import { InputType, Field } from '@nestjs/graphql';
import { IsDate, IsNotEmpty } from 'class-validator';

@InputType()
export class CreateAvailabilitySlotDto {
  @Field(() => Date)
  @IsDate({ message: 'Start time must be a valid date' })
  @IsNotEmpty({ message: 'Start time is required' })
  start_time: Date;

  @Field(() => Date)
  @IsDate({ message: 'End time must be a valid date' })
  @IsNotEmpty({ message: 'End time is required' })
  end_time: Date;
}
