import type { AuditLogAction } from '../../common/enum/audit-action.enum';
import { ROLES } from '../../common/decorator/roles.decorator';
import type { CreateAuditLogDto } from './dto/create-audit-log.dto';
import type { AuditLogEntity } from './entities/audit-log.entity';
import type { AuditLogResolver as AuditLogResolverType } from './audit-log.resolver';
import type { AuditLogService as AuditLogServiceType } from './audit-log.service';

const bunTest = require('bun:test') as {
  beforeAll: (callback: () => void | Promise<void>) => void;
  beforeEach: (callback: () => void | Promise<void>) => void;
  describe: (name: string, callback: () => void) => void;
  expect: jest.Expect;
  it: (name: string, callback: () => void | Promise<void>) => void;
  mock: {
    (): jest.Mock;
    module: (specifier: string, factory: () => unknown) => void;
  };
};
const { beforeAll, beforeEach, describe, expect, it } = bunTest;

bunTest.mock.module('@nestjs/graphql', () => ({
  Resolver: () => () => {},
  Mutation: () => () => {},
  Query: () => () => {},
  Args: () => () => {},
  ID: class ID {},
  Int: class Int {},
  ObjectType: () => () => {},
  InputType: () => () => {},
  Field: () => () => {},
  registerEnumType: () => {},
}));
bunTest.mock.module('../../schemas/audit_log.schema', () => ({
  AuditLog: class AuditLog {},
}));

let createResolver: (service: AuditLogServiceType) => AuditLogResolverType;
let auditLogResolverClass: typeof import('./audit-log.resolver').AuditLogResolver;

describe('AuditLogResolver', () => {
  let resolver: AuditLogResolverType;
  let auditLogService: {
    recordLog: jest.Mock;
    updateAction: jest.Mock;
    getAuditLogs: jest.Mock;
    getAuditLogById: jest.Mock;
    getAuditLogsByApi: jest.Mock;
    getAuditLogsByUser: jest.Mock;
  };

  beforeAll(async () => {
    const { AuditLogResolver } = await import('./audit-log.resolver.js');
    auditLogResolverClass = AuditLogResolver;
    createResolver = (service) => new AuditLogResolver(service);
  });

  beforeEach(() => {
    auditLogService = {
      recordLog: bunTest.mock(),
      updateAction: bunTest.mock(),
      getAuditLogs: bunTest.mock(),
      getAuditLogById: bunTest.mock(),
      getAuditLogsByApi: bunTest.mock(),
      getAuditLogsByUser: bunTest.mock(),
    };
    resolver = createResolver(
      auditLogService as unknown as AuditLogServiceType,
    );
  });

  it('records the supplied audit fields and returns confirmation', async () => {
    const input = {
      api_name: 'PaymentService.createPayment',
      error: 'Payment failed',
      action: 'PENDING',
      user_id: 'user-123',
      ip_address: '127.0.0.1',
    } as CreateAuditLogDto;

    await expect(resolver.recordAuditLog(input)).resolves.toBe(
      'Audit log recorded successfully',
    );
    expect(auditLogService.recordLog).toHaveBeenCalledWith({
      api_name: input.api_name,
      error: input.error,
      action: input.action,
      user_id: input.user_id,
      ip_address: input.ip_address,
    });
  });

  it('forwards the audit ID and action when updating a log', async () => {
    const action = 'FIXED' as AuditLogAction;
    auditLogService.updateAction.mockResolvedValue(
      'Audit log action updated to FIXED',
    );

    await expect(
      resolver.updateAuditLogAction('audit-123', action),
    ).resolves.toBe('Audit log action updated to FIXED');
    expect(auditLogService.updateAction).toHaveBeenCalledWith(
      'audit-123',
      action,
    );
  });

  it('forwards action and pagination filters when listing logs', async () => {
    const action = 'PENDING' as AuditLogAction;
    const logs = [{ audit_id: 'audit-123' }] as AuditLogEntity[];
    auditLogService.getAuditLogs.mockResolvedValue(logs);

    await expect(resolver.getAuditLogs(action, 20, 5)).resolves.toBe(logs);
    expect(auditLogService.getAuditLogs).toHaveBeenCalledWith(action, 20, 5);
  });

  it('forwards the ID when retrieving a log', async () => {
    const log = { audit_id: 'audit-123' } as AuditLogEntity;
    auditLogService.getAuditLogById.mockResolvedValue(log);

    await expect(resolver.getAuditLogById('audit-123')).resolves.toBe(log);
    expect(auditLogService.getAuditLogById).toHaveBeenCalledWith('audit-123');
  });

  it('forwards API name and pagination when filtering logs by API', async () => {
    const logs = [{ audit_id: 'audit-123' }] as AuditLogEntity[];
    auditLogService.getAuditLogsByApi.mockResolvedValue(logs);

    await expect(
      resolver.getAuditLogsByApi('AuthService.login', 10, 2),
    ).resolves.toBe(logs);
    expect(auditLogService.getAuditLogsByApi).toHaveBeenCalledWith(
      'AuthService.login',
      10,
      2,
    );
  });

  it('forwards user ID and pagination when filtering logs by user', async () => {
    const logs = [{ audit_id: 'audit-123' }] as AuditLogEntity[];
    auditLogService.getAuditLogsByUser.mockResolvedValue(logs);

    await expect(resolver.getAuditLogsByUser('user-123', 15, 3)).resolves.toBe(
      logs,
    );
    expect(auditLogService.getAuditLogsByUser).toHaveBeenCalledWith(
      'user-123',
      15,
      3,
    );
  });

  it('restricts every audit-log operation to admins', () => {
    const methods = [
      'recordAuditLog',
      'updateAuditLogAction',
      'getAuditLogs',
      'getAuditLogById',
      'getAuditLogsByApi',
      'getAuditLogsByUser',
    ] as const;

    for (const method of methods) {
      const handler = Object.getOwnPropertyDescriptor(
        auditLogResolverClass.prototype,
        method,
      )?.value;
      expect(Reflect.getMetadata(ROLES, handler)).toEqual(['ADMIN']);
    }
  });
});
