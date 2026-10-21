import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType('CreatePaymentResponse')
export class CreatePaymentResponse {
  @Field(() => String)
  message: string;

  @Field(() => ID)
  payment_id: string;
}
