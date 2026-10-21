import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType('MfaSetupResponse')
export class MfaSetupEntity {
  @Field(() => String, { description: 'Manual entry Base32 secret key for Google Authenticator' })
  secret: string;

  @Field(() => String, { description: 'Data URI PNG image of the QR code to scan' })
  qr_code_url: string;
}
