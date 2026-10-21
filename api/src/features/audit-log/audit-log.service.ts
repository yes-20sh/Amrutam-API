import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AuditLog } from '../../schemas/audit_log.schema';
import { AuditLogAction } from '../../common/enum/audit-action.enum';
import { handleServiceError, registerAuditLogWriter } from '../../utils/error/error.util';
import { AuditLogEntity } from './entities/audit-log.entity';

@Injectable()
export class AuditLogService implements OnModuleInit {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  onModuleInit(): void {
    // Automatically register audit log handler with global error utility
    registerAuditLogWriter(async (log) => {
      try {
        await this.recordLog(log);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to save audit log: ${msg}`);
      }
    });
    this.logger.log('AuditLogService successfully registered as global audit log writer.');
  }

  /**
   * Persist a new audit log record.
   */
  async recordLog(data: {
    api_name: string;
    error: string;
    action?: AuditLogAction;
    user_id?: string | null;
    ip_address?: string | null;
  }): Promise<AuditLog> {
    const auditLog = this.auditLogRepository.create({
      api_name: data.api_name.slice(0, 255),
      error: data.error,
      action: data.action || AuditLogAction.PENDING,
      user_id: data.user_id || null,
      ip_address: data.ip_address || null,
    });

    return this.auditLogRepository.save(auditLog);
  }

  /**
   * Update the action/status of an existing audit log (PENDING, PROCESS, FIXED).
   */
  async updateAction(
    auditId: string,
    action: AuditLogAction,
  ): Promise<string> {
    try {
      const log = await this.auditLogRepository.findOne({
        where: { audit_id: auditId },
      });

      if (!log) {
        throw new NotFoundException(`Audit log with ID ${auditId} not found`);
      }

      log.action = action;
      await this.auditLogRepository.save(log);

      return `Audit log action updated to ${action}`;
    } catch (error) {
      handleServiceError(error, this.logger, 'AuditLogService.updateAction');
    }
  }

  /**
   * Retrieve all audit logs with optional action filter and pagination.
   */
  async getAuditLogs(
    action?: AuditLogAction,
    limit = 50,
    offset = 0,
  ): Promise<AuditLogEntity[]> {
    try {
      const take = Math.min(Math.max(limit, 1), 100);
      const skip = Math.max(offset, 0);

      const whereClause = action ? { action } : {};

      const logs = await this.auditLogRepository.find({
        where: whereClause,
        order: { created_at: 'DESC' },
        take,
        skip,
      });

      return logs as unknown as AuditLogEntity[];
    } catch (error) {
      handleServiceError(error, this.logger, 'AuditLogService.getAuditLogs');
    }
  }

  /**
   * Retrieve a single audit log by its UUID.
   */
  async getAuditLogById(auditId: string): Promise<AuditLogEntity> {
    try {
      const log = await this.auditLogRepository.findOne({
        where: { audit_id: auditId },
      });

      if (!log) {
        throw new NotFoundException(`Audit log with ID ${auditId} not found`);
      }

      return log as unknown as AuditLogEntity;
    } catch (error) {
      handleServiceError(error, this.logger, 'AuditLogService.getAuditLogById');
    }
  }

  /**
   * Retrieve audit logs filtered by API name.
   */
  async getAuditLogsByApi(
    apiName: string,
    limit = 50,
    offset = 0,
  ): Promise<AuditLogEntity[]> {
    try {
      const take = Math.min(Math.max(limit, 1), 100);
      const skip = Math.max(offset, 0);

      const logs = await this.auditLogRepository.find({
        where: { api_name: apiName },
        order: { created_at: 'DESC' },
        take,
        skip,
      });

      return logs as unknown as AuditLogEntity[];
    } catch (error) {
      handleServiceError(error, this.logger, 'AuditLogService.getAuditLogsByApi');
    }
  }

  /**
   * Retrieve audit logs for a specific user ID.
   */
  async getAuditLogsByUser(
    userId: string,
    limit = 50,
    offset = 0,
  ): Promise<AuditLogEntity[]> {
    try {
      const take = Math.min(Math.max(limit, 1), 100);
      const skip = Math.max(offset, 0);

      const logs = await this.auditLogRepository.find({
        where: { user_id: userId },
        order: { created_at: 'DESC' },
        take,
        skip,
      });

      return logs as unknown as AuditLogEntity[];
    } catch (error) {
      handleServiceError(error, this.logger, 'AuditLogService.getAuditLogsByUser');
    }
  }
}
