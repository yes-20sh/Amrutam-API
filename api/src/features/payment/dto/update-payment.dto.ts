import { InputType, PartialType, OmitType } from '@nestjs/graphql';
import { CreatePaymentDto } from './create-payment.dto';

@InputType()
export class UpdatePaymentDto extends PartialType(
  OmitType(CreatePaymentDto, ['consultation_id'] as const),
) {}
