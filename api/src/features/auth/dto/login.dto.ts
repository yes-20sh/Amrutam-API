import { InputType, PickType } from '@nestjs/graphql';
import { SignupDto } from './signup.dto';

@InputType()
export class LoginDto extends PickType(SignupDto, [
  'email',
  'password',
] as const) { }
