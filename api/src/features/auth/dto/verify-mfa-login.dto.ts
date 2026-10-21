import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsString, Length } from 'class-validator';

@InputType()
export class VerifyMfaLoginDto {
  @Field(() => String, { description: 'Temporary MFA ticket token received from login mutation' })
  @IsNotEmpty()
  @IsString()
  mfa_ticket: string;

  @Field(() => String, { description: '6-digit TOTP code from Google Authenticator or backup code' })
  @IsNotEmpty()
  @IsString()
  @Length(6, 16)
  code: string;
}
