import { ObjectType, Field, ID } from '@nestjs/graphql';
import { ConsultationType } from '../../../common/enum/consultation-type.enum';
import { UserEntity } from '../../auth/entities/user.entity';
import { DoctorEntity } from '../../doctor/entities/doctor.entity';

@ObjectType('Consultation')
export class ConsultationEntity {
  @Field(() => ID)
  consultation_id: string;

  @Field(() => ID)
  patient_id: string;

  @Field(() => ID)
  doctor_id: string;

  @Field(() => ID, { nullable: true })
  slot_id?: string | null;

  @Field(() => Date)
  scheduled_at: Date;

  @Field(() => ConsultationType)
  consultation_type: ConsultationType;

  @Field(() => String, { nullable: true })
  reason?: string | null;

  @Field(() => String)
  status: string;

  @Field(() => Date, { nullable: true })
  hold_expires_at?: Date | null;

  @Field(() => String, { nullable: true })
  notes?: string | null;

  @Field(() => Date)
  created_at: Date;

  @Field(() => Date)
  updated_at: Date;

  @Field(() => UserEntity, { nullable: true })
  patient?: UserEntity | null;

  @Field(() => DoctorEntity, { nullable: true })
  doctor?: DoctorEntity | null;
}
