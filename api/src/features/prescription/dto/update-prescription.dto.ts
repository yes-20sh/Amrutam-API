import { InputType, PartialType, OmitType } from '@nestjs/graphql';
import { CreatePrescriptionDto } from './create-prescription.dto';

@InputType()
export class UpdatePrescriptionDto extends PartialType(
  OmitType(CreatePrescriptionDto, ['consultation_id'] as const),
) {}
