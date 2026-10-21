import { registerEnumType } from '@nestjs/graphql';

export enum ConsultationType {
  ONLINE = 'ONLINE',
  IN_PERSON = 'IN_PERSON',
}

registerEnumType(ConsultationType, {
  name: 'ConsultationType',
});
