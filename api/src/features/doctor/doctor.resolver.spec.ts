import type { CreateDoctorDto } from './dto/create-doctor.dto';
import type { UpdateDoctorDto } from './dto/update-doctor.dto';
import type { DoctorEntity } from './entities/doctor.entity';
import type { DoctorResolver as DoctorResolverType } from './doctor.resolver';
import type { DoctorService as DoctorServiceType } from './doctor.service';

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

bunTest.mock.module('../../schemas/doctor.schema', () => ({
  Doctor: class Doctor {},
}));
bunTest.mock.module('../../schemas/user.schema', () => ({
  User: class User {},
}));

let createResolver: (service: DoctorServiceType) => DoctorResolverType;

describe('DoctorResolver', () => {
  let resolver: DoctorResolverType;
  let doctorService: {
    createDoctorProfile: jest.Mock;
    updateDoctorProfile: jest.Mock;
    getDoctorProfile: jest.Mock;
    getDoctorById: jest.Mock;
    listDoctors: jest.Mock;
  };

  beforeAll(async () => {
    const { DoctorResolver } = await import('./doctor.resolver.js');
    createResolver = (service) => new DoctorResolver(service);
  });

  beforeEach(() => {
    doctorService = {
      createDoctorProfile: bunTest.mock(),
      updateDoctorProfile: bunTest.mock(),
      getDoctorProfile: bunTest.mock(),
      getDoctorById: bunTest.mock(),
      listDoctors: bunTest.mock(),
    };
    resolver = createResolver(doctorService as unknown as DoctorServiceType);
  });

  it('forwards the authenticated user and input when creating a doctor profile', async () => {
    const input = {
      specialization: 'Cardiology',
      license_number: 'LIC-123',
      qualification: 'MBBS',
      experience_years: 8,
      consultation_fee: '800',
    } as CreateDoctorDto;
    doctorService.createDoctorProfile.mockResolvedValue(
      'Doctor profile created successfully',
    );

    await expect(
      resolver.createDoctorProfile(input, 'doctor-user-123'),
    ).resolves.toBe('Doctor profile created successfully');
    expect(doctorService.createDoctorProfile).toHaveBeenCalledWith(
      'doctor-user-123',
      input,
    );
  });

  it('forwards the authenticated user and input when updating a doctor profile', async () => {
    const input = { bio: 'Experienced cardiologist' } as UpdateDoctorDto;
    doctorService.updateDoctorProfile.mockResolvedValue(
      'Doctor profile updated successfully',
    );

    await expect(
      resolver.updateDoctorProfile(input, 'doctor-user-123'),
    ).resolves.toBe('Doctor profile updated successfully');
    expect(doctorService.updateDoctorProfile).toHaveBeenCalledWith(
      'doctor-user-123',
      input,
    );
  });

  it('returns the authenticated user doctor profile', async () => {
    const doctor = { user_id: 'doctor-user-123' } as DoctorEntity;
    doctorService.getDoctorProfile.mockResolvedValue(doctor);

    await expect(resolver.myDoctorProfile('doctor-user-123')).resolves.toBe(
      doctor,
    );
    expect(doctorService.getDoctorProfile).toHaveBeenCalledWith(
      'doctor-user-123',
    );
  });

  it('returns a doctor by ID', async () => {
    const doctor = { doctor_id: 'doctor-123' } as DoctorEntity;
    doctorService.getDoctorById.mockResolvedValue(doctor);

    await expect(resolver.getDoctorById('doctor-123')).resolves.toBe(doctor);
    expect(doctorService.getDoctorById).toHaveBeenCalledWith('doctor-123');
  });

  it('returns the public doctor list', async () => {
    const doctors = [{ doctor_id: 'doctor-123' }] as DoctorEntity[];
    doctorService.listDoctors.mockResolvedValue(doctors);

    await expect(resolver.listDoctors()).resolves.toBe(doctors);
    expect(doctorService.listDoctors).toHaveBeenCalledTimes(1);
  });
});
