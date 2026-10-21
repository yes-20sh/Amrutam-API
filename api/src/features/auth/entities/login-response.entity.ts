import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType('LoginResponse')
export class LoginResponseEntity {
  @Field(() => String)
  message: string;

  @Field(() => Boolean)
  mfa_required: boolean;

  @Field(() => String, { nullable: true })
  mfa_ticket?: string | null;
}
