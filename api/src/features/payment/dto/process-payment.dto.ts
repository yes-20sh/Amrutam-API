import { InputType, Field, ID, PickType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CreatePaymentDto } from './create-payment.dto';

@InputType()
export class ProcessPaymentDto extends PickType(CreatePaymentDto, [
  'payment_method',
] as const) {
  @Field(() => ID)
  @IsNotEmpty({ message: 'Payment ID is required' })
  payment_id: string;

  @Field(() => String, { defaultValue: 'PAID' })
  @IsString()
  payment_status: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  transaction_reference?: string;
}
