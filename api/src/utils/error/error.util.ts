import {
  HttpException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { AuditLogAction } from '../../common/enum/audit-action.enum';
import { getRequestContext } from '../../core/context/request-context';

export interface AuditErrorMetadata {
  userId?: string | null;
  ipAddress?: string | null;
  action?: AuditLogAction;
}

export type AuditLogWriter = (log: {
  api_name: string;
  error: string;
  action: AuditLogAction;
  user_id?: string | null;
  ip_address?: string | null;
}) => Promise<void> | void;

let auditLogWriter: AuditLogWriter | null = null;

export function registerAuditLogWriter(writer: AuditLogWriter): void {
  auditLogWriter = writer;
}

export function handleServiceError(
  error: unknown,
  logger: Logger,
  contextMessage: string,
  metadata?: AuditErrorMetadata,
): never {
  const reqCtx = getRequestContext();
  const userId = metadata?.userId || reqCtx?.userId || null;
  const ipAddress = metadata?.ipAddress || reqCtx?.ipAddress || null;
  const action = metadata?.action || AuditLogAction.PENDING;
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  // Persist to audit_logs table via registered writer
  if (auditLogWriter) {
    Promise.resolve(
      auditLogWriter({
        api_name: contextMessage,
        error: errorMessage,
        action,
        user_id: userId,
        ip_address: ipAddress,
      }),
    ).catch((writeErr) => {
      logger.warn(`Failed to write audit log: ${writeErr?.message || writeErr}`);
    });
  }

  if (error instanceof HttpException) {
    throw error;
  }

  logger.error(`${contextMessage}: ${errorMessage}`, errorStack);
  throw new InternalServerErrorException('Something went wrong');
}
