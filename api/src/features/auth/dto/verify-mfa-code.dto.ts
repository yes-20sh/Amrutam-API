import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsString, Length } from 'class-validator';

@InputType()
export class VerifyMfaCodeDto {
  @Field(() => String, { description: '6-digit TOTP code from Google Authenticator' })
  @IsNotEmpty()
  @IsString()
  @Length(6, 8)
  code: string;
}
