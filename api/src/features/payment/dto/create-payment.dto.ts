import { InputType, Field, ID } from '@nestjs/graphql';
import {
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

@InputType()
export class CreatePaymentDto {
  @Field(() => ID)
  @IsNotEmpty({ message: 'Consultation ID is required' })
  consultation_id: string;

  @Field(() => String)
  @IsNumberString({}, { message: 'Amount must be a valid numeric value' })
  @IsNotEmpty({ message: 'Amount is required' })
  amount: string;

  @Field(() => String, { defaultValue: 'INR' })
  @IsString()
  @Length(3, 3, { message: 'Currency must be a 3-letter ISO code (e.g. INR, USD)' })
  currency: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty({ message: 'Payment method is required (e.g. UPI, CARD, NETBANKING)' })
  payment_method: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  transaction_reference?: string;
}
