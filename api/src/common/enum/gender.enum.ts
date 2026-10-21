import { registerEnumType } from '@nestjs/graphql';

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
  UNDISCLOSED = 'UNDISCLOSED',
}

registerEnumType(Gender, {
  name: 'Gender',
});
