import { registerEnumType } from '@nestjs/graphql';

export enum VerificationStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

registerEnumType(VerificationStatus, {
  name: 'VerificationStatus',
});
