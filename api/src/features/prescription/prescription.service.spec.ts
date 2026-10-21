import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { Prescription } from '../../schemas/prescription.schema';
import type { Consultation } from '../../schemas/consultation.schema';
import type { CreatePrescriptionDto } from './dto/create-prescription.dto';
import type { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import type { PrescriptionService as PrescriptionServiceType } from './prescription.service';

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

bunTest.mock.module('../../schemas/prescription.schema', () => ({
  Prescription: class Prescription {},
}));
bunTest.mock.module('../../schemas/consultation.schema', () => ({
  Consultation: class Consultation {},
}));

type ServiceDependencies = [Repository<Prescription>, Repository<Consultation>];
let createService: (
  ...dependencies: ServiceDependencies
) => PrescriptionServiceType;

describe('PrescriptionService', () => {
  let service: PrescriptionServiceType;
  let prescriptionRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let consultationRepository: { findOne: jest.Mock };
  let queryBuilder: {
    leftJoinAndSelect: jest.Mock;
    where: jest.Mock;
    orderBy: jest.Mock;
    getMany: jest.Mock;
  };

  const doctorId = 'doctor-123';
  const patientId = 'patient-123';
  const consultationId = 'consultation-123';
  const prescriptionId = 'prescription-123';

  beforeAll(async () => {
    const { PrescriptionService } = await import('./prescription.service.js');
    createService = (...dependencies) =>
      new PrescriptionService(...dependencies);
  });

  beforeEach(() => {
    queryBuilder = {
      leftJoinAndSelect: bunTest.mock(),
      where: bunTest.mock(),
      orderBy: bunTest.mock(),
      getMany: bunTest.mock(),
    };
    queryBuilder.leftJoinAndSelect.mockReturnValue(queryBuilder);
    queryBuilder.where.mockReturnValue(queryBuilder);
    queryBuilder.orderBy.mockReturnValue(queryBuilder);
    prescriptionRepository = {
      create: bunTest.mock(),
      save: bunTest.mock(),
      findOne: bunTest.mock(),
      find: bunTest.mock(),
      createQueryBuilder: bunTest.mock().mockReturnValue(queryBuilder),
    };
    consultationRepository = { findOne: bunTest.mock() };
    service = createService(
      prescriptionRepository as unknown as Repository<Prescription>,
      consultationRepository as unknown as Repository<Consultation>,
    );
  });

  describe('createPrescription', () => {
    const input: CreatePrescriptionDto = {
      consultation_id: consultationId,
      diagnosis: '  Seasonal allergies  ',
      medication_details: [
        {
          medicine_name: 'Cetirizine',
          dosage: '10 mg',
          frequency: 'Once daily',
          duration: '5 days',
        },
      ],
      instructions: '  Take after food  ',
    };

    it('creates a prescription for the assigned doctor and trims text fields', async () => {
      consultationRepository.findOne.mockResolvedValue({
        doctor: { user_id: doctorId },
        status: 'COMPLETED',
      });
      const created = { diagnosis: 'Seasonal allergies' };
      prescriptionRepository.create.mockReturnValue(created);
      prescriptionRepository.save.mockResolvedValue(created);

      await expect(service.createPrescription(doctorId, input)).resolves.toBe(
        'Prescription created successfully',
      );
      expect(consultationRepository.findOne).toHaveBeenCalledWith({
        where: { consultation_id: consultationId },
        relations: {
          doctor: { user: { profile: true } },
          patient: { profile: true },
        },
      });
      expect(prescriptionRepository.create).toHaveBeenCalledWith({
        consultation_id: consultationId,
        diagnosis: 'Seasonal allergies',
        medication_details: input.medication_details,
        instructions: 'Take after food',
      });
      expect(prescriptionRepository.save).toHaveBeenCalledWith(created);
    });

    it('throws when the consultation does not exist', async () => {
      consultationRepository.findOne.mockResolvedValue(null);

      await expect(service.createPrescription(doctorId, input)).rejects.toThrow(
        new NotFoundException('Consultation not found'),
      );
      expect(prescriptionRepository.save).not.toHaveBeenCalled();
    });

    it('rejects a doctor who is not assigned to the consultation', async () => {
      consultationRepository.findOne.mockResolvedValue({
        doctor: { user_id: 'another-doctor' },
        status: 'COMPLETED',
      });

      await expect(service.createPrescription(doctorId, input)).rejects.toThrow(
        new ForbiddenException(
          'Only the assigned doctor can issue prescriptions for this consultation',
        ),
      );
      expect(prescriptionRepository.save).not.toHaveBeenCalled();
    });

    it('rejects prescriptions for cancelled consultations', async () => {
      consultationRepository.findOne.mockResolvedValue({
        doctor: { user_id: doctorId },
        status: 'CANCELLED',
      });

      await expect(service.createPrescription(doctorId, input)).rejects.toThrow(
        new BadRequestException(
          'Cannot issue prescriptions for a cancelled consultation',
        ),
      );
      expect(prescriptionRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('updatePrescription', () => {
    it('updates provided fields for the issuing doctor', async () => {
      const prescription = {
        prescription_id: prescriptionId,
        diagnosis: 'Old diagnosis',
        medication_details: [],
        instructions: null,
        consultation: { doctor: { user_id: doctorId } },
      };
      const medicationDetails = [
        {
          medicine_name: 'Cetirizine',
          dosage: '10 mg',
          frequency: 'Once daily',
          duration: '5 days',
        },
      ];
      const input: UpdatePrescriptionDto = {
        diagnosis: '  New diagnosis  ',
        medication_details: medicationDetails,
        instructions: '  Take after food  ',
      };
      prescriptionRepository.findOne.mockResolvedValue(prescription);
      prescriptionRepository.save.mockResolvedValue(prescription);

      await expect(
        service.updatePrescription(doctorId, prescriptionId, input),
      ).resolves.toBe('Prescription updated successfully');
      expect(prescription).toMatchObject({
        diagnosis: 'New diagnosis',
        medication_details: medicationDetails,
        instructions: 'Take after food',
      });
      expect(prescriptionRepository.save).toHaveBeenCalledWith(prescription);
    });

    it('rejects updates when the prescription does not exist', async () => {
      prescriptionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updatePrescription(doctorId, prescriptionId, {}),
      ).rejects.toThrow(new NotFoundException('Prescription not found'));
      expect(prescriptionRepository.save).not.toHaveBeenCalled();
    });

    it('rejects updates from a doctor other than the issuer', async () => {
      prescriptionRepository.findOne.mockResolvedValue({
        consultation: { doctor: { user_id: 'another-doctor' } },
      });

      await expect(
        service.updatePrescription(doctorId, prescriptionId, {}),
      ).rejects.toThrow(
        new ForbiddenException(
          'Only the issuing doctor can modify this prescription',
        ),
      );
      expect(prescriptionRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('getPrescriptionById', () => {
    it('returns an existing prescription', async () => {
      const prescription = { prescription_id: prescriptionId };
      prescriptionRepository.findOne.mockResolvedValue(prescription);

      await expect(service.getPrescriptionById(prescriptionId)).resolves.toBe(
        prescription,
      );
    });

    it('rejects a user who is not the patient or assigned doctor', async () => {
      prescriptionRepository.findOne.mockResolvedValue({
        consultation: {
          patient_id: patientId,
          doctor: { user_id: doctorId },
        },
      });

      await expect(
        service.getPrescriptionById(prescriptionId, 'other-user'),
      ).rejects.toThrow(
        new ForbiddenException(
          'You are not authorized to view this prescription',
        ),
      );
    });

    it('allows the patient to retrieve their prescription', async () => {
      const prescription = {
        prescription_id: prescriptionId,
        consultation: {
          patient_id: patientId,
          doctor: { user_id: doctorId },
        },
      };
      prescriptionRepository.findOne.mockResolvedValue(prescription);

      await expect(
        service.getPrescriptionById(prescriptionId, patientId),
      ).resolves.toBe(prescription);
    });
  });

  describe('getPrescriptionsByConsultation', () => {
    it('returns prescriptions for an authorized patient, newest first', async () => {
      const prescriptions = [{ prescription_id: prescriptionId }];
      consultationRepository.findOne.mockResolvedValue({
        patient_id: patientId,
        doctor: { user_id: doctorId },
      });
      prescriptionRepository.find.mockResolvedValue(prescriptions);

      await expect(
        service.getPrescriptionsByConsultation(patientId, consultationId),
      ).resolves.toBe(prescriptions);
      expect(prescriptionRepository.find).toHaveBeenCalledWith({
        where: { consultation_id: consultationId },
        relations: {
          consultation: {
            doctor: { user: { profile: true } },
            patient: { profile: true },
          },
        },
        order: { issued_at: 'DESC' },
      });
    });

    it('rejects a user who is neither the consultation patient nor doctor', async () => {
      consultationRepository.findOne.mockResolvedValue({
        patient_id: patientId,
        doctor: { user_id: doctorId },
      });

      await expect(
        service.getPrescriptionsByConsultation('other-user', consultationId),
      ).rejects.toThrow(
        new ForbiddenException(
          'You are not authorized to view prescriptions for this consultation',
        ),
      );
      expect(prescriptionRepository.find).not.toHaveBeenCalled();
    });
  });

  describe('myPrescriptions', () => {
    it('lists prescriptions linked to the current user and orders them newest first', async () => {
      const prescriptions = [{ prescription_id: prescriptionId }];
      queryBuilder.getMany.mockResolvedValue(prescriptions);

      await expect(service.myPrescriptions(patientId)).resolves.toBe(
        prescriptions,
      );
      expect(prescriptionRepository.createQueryBuilder).toHaveBeenCalledWith(
        'prescription',
      );
      expect(queryBuilder.where).toHaveBeenCalledWith(
        'consultation.patient_id = :userId OR doctor.user_id = :userId',
        { userId: patientId },
      );
      expect(queryBuilder.orderBy).toHaveBeenCalledWith(
        'prescription.issued_at',
        'DESC',
      );
    });
  });
});
