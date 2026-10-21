import type { CreatePrescriptionDto } from './dto/create-prescription.dto';
import type { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import type { PrescriptionEntity } from './entities/prescription.entity';
import type { PrescriptionResolver as PrescriptionResolverType } from './prescription.resolver';
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

let createResolver: (
  service: PrescriptionServiceType,
) => PrescriptionResolverType;

describe('PrescriptionResolver', () => {
  let resolver: PrescriptionResolverType;
  let prescriptionService: {
    createPrescription: jest.Mock;
    updatePrescription: jest.Mock;
    getPrescriptionById: jest.Mock;
    getPrescriptionsByConsultation: jest.Mock;
    myPrescriptions: jest.Mock;
  };

  beforeAll(async () => {
    const { PrescriptionResolver } = await import('./prescription.resolver.js');
    createResolver = (service) => new PrescriptionResolver(service);
  });

  beforeEach(() => {
    prescriptionService = {
      createPrescription: bunTest.mock(),
      updatePrescription: bunTest.mock(),
      getPrescriptionById: bunTest.mock(),
      getPrescriptionsByConsultation: bunTest.mock(),
      myPrescriptions: bunTest.mock(),
    };
    resolver = createResolver(
      prescriptionService as unknown as PrescriptionServiceType,
    );
  });

  it('forwards the authenticated doctor and input when creating a prescription', async () => {
    const doctorId = 'doctor-123';
    const input = {
      consultation_id: 'consultation-123',
      diagnosis: 'Seasonal allergies',
    } as CreatePrescriptionDto;
    prescriptionService.createPrescription.mockResolvedValue(
      'Prescription created successfully',
    );

    await expect(resolver.createPrescription(input, doctorId)).resolves.toBe(
      'Prescription created successfully',
    );
    expect(prescriptionService.createPrescription).toHaveBeenCalledWith(
      doctorId,
      input,
    );
  });

  it('forwards the authenticated doctor, prescription ID, and input when updating', async () => {
    const doctorId = 'doctor-123';
    const prescriptionId = 'prescription-123';
    const input = { diagnosis: 'Updated diagnosis' } as UpdatePrescriptionDto;
    prescriptionService.updatePrescription.mockResolvedValue(
      'Prescription updated successfully',
    );

    await expect(
      resolver.updatePrescription(prescriptionId, input, doctorId),
    ).resolves.toBe('Prescription updated successfully');
    expect(prescriptionService.updatePrescription).toHaveBeenCalledWith(
      doctorId,
      prescriptionId,
      input,
    );
  });

  it('forwards the ID when retrieving a prescription', async () => {
    const prescription = {
      prescription_id: 'prescription-123',
    } as PrescriptionEntity;
    prescriptionService.getPrescriptionById.mockResolvedValue(prescription);

    await expect(
      resolver.getPrescriptionById(prescription.prescription_id),
    ).resolves.toBe(prescription);
    expect(prescriptionService.getPrescriptionById).toHaveBeenCalledWith(
      prescription.prescription_id,
    );
  });

  it('forwards the authenticated user and consultation ID when listing consultation prescriptions', async () => {
    const userId = 'user-123';
    const consultationId = 'consultation-123';
    const prescriptions = [{ consultation_id: consultationId }];
    prescriptionService.getPrescriptionsByConsultation.mockResolvedValue(
      prescriptions,
    );

    await expect(
      resolver.getPrescriptionsByConsultation(consultationId, userId),
    ).resolves.toBe(prescriptions);
    expect(
      prescriptionService.getPrescriptionsByConsultation,
    ).toHaveBeenCalledWith(userId, consultationId);
  });

  it('forwards the authenticated user when listing their prescriptions', async () => {
    const userId = 'user-123';
    const prescriptions = [{ prescription_id: 'prescription-123' }];
    prescriptionService.myPrescriptions.mockResolvedValue(prescriptions);

    await expect(resolver.myPrescriptions(userId)).resolves.toBe(prescriptions);
    expect(prescriptionService.myPrescriptions).toHaveBeenCalledWith(userId);
  });
});
