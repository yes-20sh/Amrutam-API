import { InputType, Field, PartialType } from '@nestjs/graphql';
import { IsOptional, IsString } from 'class-validator';
import { CreateAvailabilitySlotDto } from './create-slot.dto';

@InputType()
export class UpdateAvailabilitySlotDto extends PartialType(
  CreateAvailabilitySlotDto,
) {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  status?: string;
}
