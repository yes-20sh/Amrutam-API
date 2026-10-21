import { NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { AuditLog } from '../../schemas/audit_log.schema';
import type { AuditLogAction as AuditLogActionType } from '../../common/enum/audit-action.enum';
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
  ObjectType: () => () => {},
  InputType: () => () => {},
  Field: () => () => {},
  ID: class ID {},
  registerEnumType: () => {},
}));
bunTest.mock.module('../../schemas/audit_log.schema', () => ({
  AuditLog: class AuditLog {},
}));

let createService: (repository: Repository<AuditLog>) => AuditLogServiceType;
let pendingAction: AuditLogActionType;

describe('AuditLogService', () => {
  let service: AuditLogServiceType;
  let auditLogRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
  };

  beforeAll(async () => {
    const [{ AuditLogService }, { AuditLogAction }] = await Promise.all([
      import('./audit-log.service.js'),
      import('../../common/enum/audit-action.enum.js'),
    ]);
    createService = (repository) => new AuditLogService(repository);
    pendingAction = AuditLogAction.PENDING;
  });

  beforeEach(() => {
    auditLogRepository = {
      create: bunTest.mock(),
      save: bunTest.mock(),
      findOne: bunTest.mock(),
      find: bunTest.mock(),
    };
    auditLogRepository.create.mockImplementation((record) => record);
    auditLogRepository.save.mockImplementation(async (record) => record);
    service = createService(
      auditLogRepository as unknown as Repository<AuditLog>,
    );
  });

  describe('recordLog', () => {
    it('applies defaults, truncates API names, and persists the record', async () => {
      const apiName = 'a'.repeat(260);
      const saved = await service.recordLog({
        api_name: apiName,
        error: 'Unexpected error',
      });

      expect(auditLogRepository.create).toHaveBeenCalledWith({
        api_name: 'a'.repeat(255),
        error: 'Unexpected error',
        action: pendingAction,
        user_id: null,
        ip_address: null,
      });
      expect(auditLogRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ action: pendingAction }),
      );
      expect(saved.api_name).toHaveLength(255);
    });

    it('preserves explicitly provided audit metadata', async () => {
      const record = {
        api_name: 'AuthService.login',
        error: 'Invalid credentials',
        action: 'FIXED' as AuditLogActionType,
        user_id: 'user-123',
        ip_address: '127.0.0.1',
      };

      await service.recordLog(record);

      expect(auditLogRepository.create).toHaveBeenCalledWith(record);
    });
  });

  describe('updateAction', () => {
    it('updates an existing audit log action', async () => {
      const log = { audit_id: 'audit-123', action: pendingAction };
      auditLogRepository.findOne.mockResolvedValue(log);
      const action = 'FIXED' as AuditLogActionType;

      await expect(service.updateAction('audit-123', action)).resolves.toBe(
        'Audit log action updated to FIXED',
      );
      expect(log.action).toBe(action);
      expect(auditLogRepository.save).toHaveBeenCalledWith(log);
    });

    it('throws when the audit log does not exist', async () => {
      auditLogRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateAction('missing-audit', pendingAction),
      ).rejects.toThrow(
        new NotFoundException('Audit log with ID missing-audit not found'),
      );
      expect(auditLogRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('getAuditLogs', () => {
    it('filters by action and applies pagination limits', async () => {
      const logs = [{ audit_id: 'audit-123' }];
      auditLogRepository.find.mockResolvedValue(logs);

      await expect(service.getAuditLogs(pendingAction, 500, -10)).resolves.toBe(
        logs,
      );
      expect(auditLogRepository.find).toHaveBeenCalledWith({
        where: { action: pendingAction },
        order: { created_at: 'DESC' },
        take: 100,
        skip: 0,
      });
    });

    it('uses default pagination and no action filter when omitted', async () => {
      auditLogRepository.find.mockResolvedValue([]);

      await service.getAuditLogs();

      expect(auditLogRepository.find).toHaveBeenCalledWith({
        where: {},
        order: { created_at: 'DESC' },
        take: 50,
        skip: 0,
      });
    });
  });

  describe('getAuditLogById', () => {
    it('returns the requested audit log', async () => {
      const log = { audit_id: 'audit-123' };
      auditLogRepository.findOne.mockResolvedValue(log);

      await expect(service.getAuditLogById('audit-123')).resolves.toBe(log);
    });

    it('throws when the requested audit log is missing', async () => {
      auditLogRepository.findOne.mockResolvedValue(null);

      await expect(service.getAuditLogById('missing-audit')).rejects.toThrow(
        new NotFoundException('Audit log with ID missing-audit not found'),
      );
    });
  });

  describe('getAuditLogsByApi', () => {
    it('filters by API name and clamps limit and offset', async () => {
      auditLogRepository.find.mockResolvedValue([]);

      await service.getAuditLogsByApi('AuthService.login', 0, -2);

      expect(auditLogRepository.find).toHaveBeenCalledWith({
        where: { api_name: 'AuthService.login' },
        order: { created_at: 'DESC' },
        take: 1,
        skip: 0,
      });
    });
  });

  describe('getAuditLogsByUser', () => {
    it('filters by user ID and applies pagination', async () => {
      auditLogRepository.find.mockResolvedValue([]);

      await service.getAuditLogsByUser('user-123', 25, 10);

      expect(auditLogRepository.find).toHaveBeenCalledWith({
        where: { user_id: 'user-123' },
        order: { created_at: 'DESC' },
        take: 25,
        skip: 10,
      });
    });
  });
});
