import { registerEnumType } from '@nestjs/graphql';

export enum AuditLogAction {
  PENDING = 'PENDING',
  PROCESS = 'PROCESS',
  FIXED = 'FIXED',
}

registerEnumType(AuditLogAction, {
  name: 'AuditLogAction',
});
