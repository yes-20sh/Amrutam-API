import { ObjectType, Field, ID } from '@nestjs/graphql';
import { ConsultationEntity } from '../../consultation/entities/consultation.entity';

@ObjectType('Payment')
export class PaymentEntity {
  @Field(() => ID)
  payment_id: string;

  @Field(() => ID)
  consultation_id: string;

  @Field(() => String)
  amount: string;

  @Field(() => String)
  currency: string;

  @Field(() => String)
  payment_method: string;

  @Field(() => String)
  payment_status: string;

  @Field(() => String)
  transaction_reference: string;

  @Field(() => Date, { nullable: true })
  paid_at?: Date | null;

  @Field(() => Date)
  created_at: Date;

  @Field(() => ConsultationEntity, { nullable: true })
  consultation?: ConsultationEntity | null;
}
