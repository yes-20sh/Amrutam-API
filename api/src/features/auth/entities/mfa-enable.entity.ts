import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType('MfaEnableResponse')
export class MfaEnableEntity {
  @Field(() => String)
  message: string;

  @Field(() => [String], { description: 'One-time emergency backup recovery codes' })
  backup_codes: string[];
}
