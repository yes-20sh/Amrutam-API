import { ObjectType, Field, ID } from '@nestjs/graphql';
import { MedicationItemEntity } from './medication-item.entity';
import { ConsultationEntity } from '../../consultation/entities/consultation.entity';

@ObjectType('Prescription')
export class PrescriptionEntity {
  @Field(() => ID)
  prescription_id: string;

  @Field(() => ID)
  consultation_id: string;

  @Field(() => String)
  diagnosis: string;

  @Field(() => [MedicationItemEntity])
  medication_details: MedicationItemEntity[];

  @Field(() => String, { nullable: true })
  instructions?: string | null;

  @Field(() => Date)
  issued_at: Date;

  @Field(() => ConsultationEntity, { nullable: true })
  consultation?: ConsultationEntity | null;
}
