import { InputType, PartialType, OmitType } from '@nestjs/graphql';
import { SignupDto } from './signup.dto';

@InputType()
export class UpdateProfileDto extends PartialType(
  OmitType(SignupDto, ['password', 'role'] as const),
) { }
