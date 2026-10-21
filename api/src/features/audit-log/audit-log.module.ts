import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditLog } from '../../schemas/audit_log.schema';
import { AuditLogService } from './audit-log.service';
import { AuditLogResolver } from './audit-log.resolver';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [AuditLogService, AuditLogResolver],
  exports: [AuditLogService],
})
export class AuditLogModule {}
