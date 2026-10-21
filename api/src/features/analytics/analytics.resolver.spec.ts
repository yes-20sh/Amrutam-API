import type { AnalyticsFilterInput } from './dto/analytics-filter.input';
import type { AdminDashboardSummaryEntity } from './entities/admin-dashboard-summary.entity';
import type { RevenueAnalyticsEntity } from './entities/revenue-analytics.entity';
import type { ConsultationAnalyticsEntity } from './entities/consultation-analytics.entity';
import type { DoctorAnalyticsEntity } from './entities/doctor-analytics.entity';
import type { PatientAnalyticsEntity } from './entities/patient-analytics.entity';
import type { ClinicalAndSystemAnalyticsEntity } from './entities/clinical-and-system-analytics.entity';
import type { AnalyticsResolver as AnalyticsResolverType } from './analytics.resolver';
import type { AnalyticsService as AnalyticsServiceType } from './analytics.service';

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

bunTest.mock.module('../../schemas/user.schema', () => ({
  User: class User {},
}));
bunTest.mock.module('../../schemas/doctor.schema', () => ({
  Doctor: class Doctor {},
}));
bunTest.mock.module('../../schemas/profile.schema', () => ({
  Profile: class Profile {},
}));
bunTest.mock.module('../../schemas/consultation.schema', () => ({
  Consultation: class Consultation {},
}));
bunTest.mock.module('../../schemas/payment.schema', () => ({
  Payment: class Payment {},
}));
bunTest.mock.module('../../schemas/prescription.schema', () => ({
  Prescription: class Prescription {},
}));
bunTest.mock.module('../../schemas/availability_slot.schema', () => ({
  AvailabilitySlot: class AvailabilitySlot {},
}));
bunTest.mock.module('../../schemas/audit_log.schema', () => ({
  AuditLog: class AuditLog {},
}));

let createResolver: (service: AnalyticsServiceType) => AnalyticsResolverType;

describe('AnalyticsResolver', () => {
  let resolver: AnalyticsResolverType;
  let analyticsService: {
    getDashboardSummary: jest.Mock;
    getRevenueAnalytics: jest.Mock;
    getConsultationAnalytics: jest.Mock;
    getDoctorAnalytics: jest.Mock;
    getPatientAnalytics: jest.Mock;
    getClinicalAndSystemAnalytics: jest.Mock;
  };

  const mockFilter: AnalyticsFilterInput = {
    startDate: new Date('2026-01-01T00:00:00Z'),
    endDate: new Date('2026-01-31T23:59:59Z'),
    granularity: 'DAY' as any,
  };

  beforeAll(async () => {
    const { AnalyticsResolver } = await import('./analytics.resolver.js');
    createResolver = (service) => new AnalyticsResolver(service);
  });

  beforeEach(() => {
    analyticsService = {
      getDashboardSummary: bunTest.mock(),
      getRevenueAnalytics: bunTest.mock(),
      getConsultationAnalytics: bunTest.mock(),
      getDoctorAnalytics: bunTest.mock(),
      getPatientAnalytics: bunTest.mock(),
      getClinicalAndSystemAnalytics: bunTest.mock(),
    };
    resolver = createResolver(analyticsService as unknown as AnalyticsServiceType);
  });

  describe('adminDashboardSummary', () => {
    it('delegates to getDashboardSummary with filter', async () => {
      const mockResult = {
        total_revenue: 50000,
        total_consultations: 120,
      } as AdminDashboardSummaryEntity;
      analyticsService.getDashboardSummary.mockResolvedValue(mockResult);

      const result = await resolver.adminDashboardSummary(mockFilter);

      expect(result).toBe(mockResult);
      expect(analyticsService.getDashboardSummary).toHaveBeenCalledWith(mockFilter);
    });
  });

  describe('adminRevenueAnalytics', () => {
    it('delegates to getRevenueAnalytics with filter', async () => {
      const mockResult = {
        total_revenue: 50000,
        timeline: [],
      } as unknown as RevenueAnalyticsEntity;
      analyticsService.getRevenueAnalytics.mockResolvedValue(mockResult);

      const result = await resolver.adminRevenueAnalytics(mockFilter);

      expect(result).toBe(mockResult);
      expect(analyticsService.getRevenueAnalytics).toHaveBeenCalledWith(mockFilter);
    });
  });

  describe('adminConsultationAnalytics', () => {
    it('delegates to getConsultationAnalytics with filter', async () => {
      const mockResult = {
        total_consultations: 200,
        completed_rate: 85.5,
      } as unknown as ConsultationAnalyticsEntity;
      analyticsService.getConsultationAnalytics.mockResolvedValue(mockResult);

      const result = await resolver.adminConsultationAnalytics(mockFilter);

      expect(result).toBe(mockResult);
      expect(analyticsService.getConsultationAnalytics).toHaveBeenCalledWith(mockFilter);
    });
  });

  describe('adminDoctorAnalytics', () => {
    it('delegates to getDoctorAnalytics with filter', async () => {
      const mockResult = {
        total_doctors: 45,
        top_doctors: [],
      } as unknown as DoctorAnalyticsEntity;
      analyticsService.getDoctorAnalytics.mockResolvedValue(mockResult);

      const result = await resolver.adminDoctorAnalytics(mockFilter);

      expect(result).toBe(mockResult);
      expect(analyticsService.getDoctorAnalytics).toHaveBeenCalledWith(mockFilter);
    });
  });

  describe('adminPatientAnalytics', () => {
    it('delegates to getPatientAnalytics with filter', async () => {
      const mockResult = {
        total_patients: 600,
        retention_rate: 68.2,
      } as unknown as PatientAnalyticsEntity;
      analyticsService.getPatientAnalytics.mockResolvedValue(mockResult);

      const result = await resolver.adminPatientAnalytics(mockFilter);

      expect(result).toBe(mockResult);
      expect(analyticsService.getPatientAnalytics).toHaveBeenCalledWith(mockFilter);
    });
  });

  describe('adminClinicalAndSystemAnalytics', () => {
    it('delegates to getClinicalAndSystemAnalytics with filter', async () => {
      const mockResult = {
        prescription_rate: 92.4,
        error_rate: 0.8,
      } as unknown as ClinicalAndSystemAnalyticsEntity;
      analyticsService.getClinicalAndSystemAnalytics.mockResolvedValue(mockResult);

      const result = await resolver.adminClinicalAndSystemAnalytics(mockFilter);

      expect(result).toBe(mockResult);
      expect(analyticsService.getClinicalAndSystemAnalytics).toHaveBeenCalledWith(mockFilter);
    });
  });
});
