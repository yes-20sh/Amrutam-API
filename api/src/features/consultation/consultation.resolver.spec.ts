import type { CreateConsultationDto } from './dto/create-consultation.dto';
import type { RescheduleConsultationDto } from './dto/reschedule-consultation.dto';
import type { ConsultationEntity } from './entities/consultation.entity';
import type { ConsultationResolver as ConsultationResolverType } from './consultation.resolver';
import type { ConsultationService as ConsultationServiceType } from './consultation.service';

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

bunTest.mock.module('../../schemas/consultation.schema', () => ({
  Consultation: class Consultation {},
}));

let createResolver: (service: ConsultationServiceType) => ConsultationResolverType;

describe('ConsultationResolver', () => {
  let resolver: ConsultationResolverType;
  let consultationService: {
    bookConsultation: jest.Mock;
    rescheduleConsultation: jest.Mock;
    cancelConsultation: jest.Mock;
    completeConsultation: jest.Mock;
    getConsultationById: jest.Mock;
    myConsultations: jest.Mock;
  };

  const userId = 'user-123';
  const consultationId = 'consultation-123';

  beforeAll(async () => {
    const { ConsultationResolver } = await import('./consultation.resolver.js');
    createResolver = (service) => new ConsultationResolver(service);
  });

  beforeEach(() => {
    consultationService = {
      bookConsultation: bunTest.mock(),
      rescheduleConsultation: bunTest.mock(),
      cancelConsultation: bunTest.mock(),
      completeConsultation: bunTest.mock(),
      getConsultationById: bunTest.mock(),
      myConsultations: bunTest.mock(),
    };
    resolver = createResolver(
      consultationService as unknown as ConsultationServiceType,
    );
  });

  describe('bookConsultation', () => {
    it('delegates consultation booking to consultationService', async () => {
      const input: CreateConsultationDto = {
        doctor_id: 'doc-123',
        slot_id: 'slot-123',
        scheduled_at: new Date('2026-11-01T10:00:00Z'),
        consultation_type: 'VIDEO' as any,
      };
      consultationService.bookConsultation.mockResolvedValue(
        'Consultation reserved successfully',
      );

      const result = await resolver.bookConsultation(input, userId);

      expect(result).toBe('Consultation reserved successfully');
      expect(consultationService.bookConsultation).toHaveBeenCalledWith(
        userId,
        input,
      );
    });
  });

  describe('rescheduleConsultation', () => {
    it('delegates consultation rescheduling to consultationService', async () => {
      const input: RescheduleConsultationDto = {
        consultation_id: consultationId,
        slot_id: 'new-slot-123',
        scheduled_at: new Date('2026-11-05T14:00:00Z'),
      };
      consultationService.rescheduleConsultation.mockResolvedValue(
        'Consultation rescheduled successfully',
      );

      const result = await resolver.rescheduleConsultation(input, userId);

      expect(result).toBe('Consultation rescheduled successfully');
      expect(consultationService.rescheduleConsultation).toHaveBeenCalledWith(
        userId,
        input,
      );
    });
  });

  describe('cancelConsultation', () => {
    it('delegates cancellation to consultationService', async () => {
      consultationService.cancelConsultation.mockResolvedValue(
        'Consultation cancelled successfully',
      );

      const result = await resolver.cancelConsultation(
        consultationId,
        'Personal emergency',
        userId,
      );

      expect(result).toBe('Consultation cancelled successfully');
      expect(consultationService.cancelConsultation).toHaveBeenCalledWith(
        userId,
        consultationId,
        'Personal emergency',
      );
    });
  });

  describe('completeConsultation', () => {
    it('delegates consultation completion to consultationService', async () => {
      consultationService.completeConsultation.mockResolvedValue(
        'Consultation completed successfully',
      );

      const result = await resolver.completeConsultation(
        consultationId,
        'Prescribed medications.',
        userId,
      );

      expect(result).toBe('Consultation completed successfully');
      expect(consultationService.completeConsultation).toHaveBeenCalledWith(
        userId,
        consultationId,
        'Prescribed medications.',
      );
    });
  });

  describe('getConsultationById', () => {
    it('retrieves single consultation by ID from consultationService', async () => {
      const mockConsultation = {
        consultation_id: consultationId,
        patient_id: userId,
      } as ConsultationEntity;
      consultationService.getConsultationById.mockResolvedValue(mockConsultation);

      const result = await resolver.getConsultationById(consultationId, userId);

      expect(result).toBe(mockConsultation);
      expect(consultationService.getConsultationById).toHaveBeenCalledWith(
        userId,
        consultationId,
      );
    });
  });

  describe('myConsultations', () => {
    it('lists all consultations for the authenticated user from consultationService', async () => {
      const mockList = [
        { consultation_id: 'c-1', patient_id: userId },
      ] as ConsultationEntity[];
      consultationService.myConsultations.mockResolvedValue(mockList);

      const result = await resolver.myConsultations(userId);

      expect(result).toBe(mockList);
      expect(consultationService.myConsultations).toHaveBeenCalledWith(userId);
    });
  });
});
