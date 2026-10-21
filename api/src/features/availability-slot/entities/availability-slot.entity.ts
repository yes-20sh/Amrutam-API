import { ObjectType, Field, ID } from '@nestjs/graphql';
import { DoctorEntity } from '../../doctor/entities/doctor.entity';

@ObjectType('AvailabilitySlot')
export class AvailabilitySlotEntity {
  @Field(() => ID)
  slot_id: string;

  @Field(() => ID)
  doctor_id: string;

  @Field(() => Date)
  start_time: Date;

  @Field(() => Date)
  end_time: Date;

  @Field(() => String)
  status: string;

  @Field(() => Date)
  created_at: Date;

  @Field(() => DoctorEntity, { nullable: true })
  doctor?: DoctorEntity | null;
}
