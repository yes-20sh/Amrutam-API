import { InputType, PartialType, OmitType } from '@nestjs/graphql';
import { CreateDoctorDto } from './create-doctor.dto';

@InputType()
export class UpdateDoctorDto extends PartialType(
  OmitType(CreateDoctorDto, ['license_number'] as const),
) {}
