import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { RedisService } from '../../core/redis/redis.service';
import type { Doctor } from '../../schemas/doctor.schema';
import type { User } from '../../schemas/user.schema';
import type { CreateDoctorDto } from './dto/create-doctor.dto';
import type { UpdateDoctorDto } from './dto/update-doctor.dto';
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

type ServiceDependencies = [Repository<Doctor>, Repository<User>, RedisService];
let createService: (...dependencies: ServiceDependencies) => DoctorServiceType;

describe('DoctorService', () => {
  let service: DoctorServiceType;
  let doctorRepository: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let userRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
  };
  let redisService: {
    getCache: jest.Mock;
    setCache: jest.Mock;
    invalidateDoctorList: jest.Mock;
    invalidateDoctorProfile: jest.Mock;
  };

  const userId = 'doctor-user-123';
  const doctorId = 'doctor-123';

  beforeAll(async () => {
    const { DoctorService } = await import('./doctor.service.js');
    createService = (...dependencies) => new DoctorService(...dependencies);
  });

  beforeEach(() => {
    doctorRepository = {
      findOne: bunTest.mock(),
      find: bunTest.mock(),
      create: bunTest.mock(),
      save: bunTest.mock(),
    };
    userRepository = {
      findOne: bunTest.mock(),
      save: bunTest.mock(),
    };
    redisService = {
      getCache: bunTest.mock().mockResolvedValue(null),
      setCache: bunTest.mock().mockResolvedValue(undefined),
      invalidateDoctorList: bunTest.mock().mockResolvedValue(undefined),
      invalidateDoctorProfile: bunTest.mock().mockResolvedValue(undefined),
    };
    service = createService(
      doctorRepository as unknown as Repository<Doctor>,
      userRepository as unknown as Repository<User>,
      redisService as unknown as RedisService,
    );
  });

  describe('createDoctorProfile', () => {
    const input: CreateDoctorDto = {
      specialization: '  Cardiology  ',
      license_number: '  LIC-123  ',
      qualification: '  MBBS, MD  ',
      experience_years: 8,
      consultation_fee: ' 800 ',
      bio: '  Heart specialist  ',
    };

    it('creates a pending doctor profile and invalidates the doctor list', async () => {
      const user = { user_id: userId, role: 'DOCTOR' };
      doctorRepository.findOne.mockResolvedValue(null);
      userRepository.findOne.mockResolvedValue(user);
      const doctor = { user_id: userId };
      doctorRepository.create.mockReturnValue(doctor);
      doctorRepository.save.mockResolvedValue(doctor);

      await expect(service.createDoctorProfile(userId, input)).resolves.toBe(
        'Doctor profile created successfully',
      );
      expect(doctorRepository.findOne).toHaveBeenNthCalledWith(1, {
        where: { user_id: userId },
      });
      expect(doctorRepository.findOne).toHaveBeenNthCalledWith(2, {
        where: { license_number: 'LIC-123' },
      });
      expect(doctorRepository.create).toHaveBeenCalledWith({
        user_id: userId,
        specialization: 'Cardiology',
        license_number: 'LIC-123',
        qualification: 'MBBS, MD',
        experience_years: 8,
        consultation_fee: '800',
        verification_status: 'PENDING',
        bio: 'Heart specialist',
      });
      expect(doctorRepository.save).toHaveBeenCalledWith(doctor);
      expect(redisService.invalidateDoctorList).toHaveBeenCalled();
    });

    it('rejects creating a second profile for the same user', async () => {
      doctorRepository.findOne.mockResolvedValueOnce({ doctor_id: doctorId });

      await expect(service.createDoctorProfile(userId, input)).rejects.toThrow(
        new ConflictException('Doctor profile already exists for this account'),
      );
      expect(userRepository.findOne).not.toHaveBeenCalled();
      expect(doctorRepository.save).not.toHaveBeenCalled();
    });

    it('rejects a license number already used by another doctor', async () => {
      doctorRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ doctor_id: 'another-doctor' });

      await expect(service.createDoctorProfile(userId, input)).rejects.toThrow(
        new ConflictException(
          'A doctor with this license number already exists',
        ),
      );
      expect(userRepository.findOne).not.toHaveBeenCalled();
    });

    it('rejects when the user account does not exist', async () => {
      doctorRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.createDoctorProfile(userId, input)).rejects.toThrow(
        new NotFoundException('User account not found'),
      );
      expect(doctorRepository.save).not.toHaveBeenCalled();
    });

    it('promotes the account to doctor before saving the profile', async () => {
      const user = { user_id: userId, role: 'PATIENT' };
      doctorRepository.findOne.mockResolvedValue(null);
      userRepository.findOne.mockResolvedValue(user);
      doctorRepository.create.mockReturnValue({ user_id: userId });
      doctorRepository.save.mockResolvedValue(undefined);

      await service.createDoctorProfile(userId, input);

      expect(user.role).toBe('DOCTOR');
      expect(userRepository.save).toHaveBeenCalledWith(user);
    });
  });

  describe('updateDoctorProfile', () => {
    it('updates and trims provided fields, then invalidates profile cache', async () => {
      const doctor = {
        doctor_id: doctorId,
        specialization: 'Old specialty',
        qualification: 'Old degree',
        consultation_fee: '500',
        bio: 'Old bio',
        experience_years: 2,
      };
      doctorRepository.findOne.mockResolvedValue(doctor);

      const input: UpdateDoctorDto = {
        specialization: '  Cardiology ',
        qualification: ' MD ',
        consultation_fee: ' 950 ',
        bio: ' Updated bio ',
        experience_years: 12,
      };
      await expect(service.updateDoctorProfile(userId, input)).resolves.toBe(
        'Doctor profile updated successfully',
      );
      expect(doctor).toMatchObject({
        specialization: 'Cardiology',
        qualification: 'MD',
        consultation_fee: '950',
        bio: 'Updated bio',
        experience_years: 12,
      });
      expect(doctorRepository.save).toHaveBeenCalledWith(doctor);
      expect(redisService.invalidateDoctorProfile).toHaveBeenCalledWith(
        doctorId,
      );
    });

    it('rejects updating a missing doctor profile', async () => {
      doctorRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateDoctorProfile(userId, { bio: 'New bio' }),
      ).rejects.toThrow(new NotFoundException('Doctor profile not found'));
      expect(doctorRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('getDoctorProfile', () => {
    it('returns the authenticated user doctor profile', async () => {
      const doctor = { doctor_id: doctorId, user_id: userId };
      doctorRepository.findOne.mockResolvedValue(doctor);

      await expect(service.getDoctorProfile(userId)).resolves.toBe(doctor);
      expect(doctorRepository.findOne).toHaveBeenCalledWith({
        where: { user_id: userId },
        relations: { user: { profile: true } },
      });
    });

    it('rejects when the authenticated user has no doctor profile', async () => {
      doctorRepository.findOne.mockResolvedValue(null);

      await expect(service.getDoctorProfile(userId)).rejects.toThrow(
        new NotFoundException('Doctor profile not found'),
      );
    });
  });

  describe('getDoctorById', () => {
    it('returns a cached doctor without querying the repository', async () => {
      const cachedDoctor = { doctor_id: doctorId };
      redisService.getCache.mockResolvedValue(cachedDoctor);

      await expect(service.getDoctorById(doctorId)).resolves.toBe(cachedDoctor);
      expect(redisService.getCache).toHaveBeenCalledWith(
        `cache:doctor:${doctorId}`,
      );
      expect(doctorRepository.findOne).not.toHaveBeenCalled();
    });

    it('loads and caches an existing doctor', async () => {
      const doctor = { doctor_id: doctorId };
      doctorRepository.findOne.mockResolvedValue(doctor);

      await expect(service.getDoctorById(doctorId)).resolves.toBe(doctor);
      expect(redisService.setCache).toHaveBeenCalledWith(
        `cache:doctor:${doctorId}`,
        doctor,
        600,
      );
    });

    it('rejects a missing doctor', async () => {
      doctorRepository.findOne.mockResolvedValue(null);

      await expect(service.getDoctorById(doctorId)).rejects.toThrow(
        new NotFoundException('Doctor not found'),
      );
    });
  });

  describe('listDoctors', () => {
    it('returns the cached doctor directory when available', async () => {
      const doctors = [{ doctor_id: doctorId }];
      redisService.getCache.mockResolvedValue(doctors);

      await expect(service.listDoctors()).resolves.toBe(doctors);
      expect(doctorRepository.find).not.toHaveBeenCalled();
    });

    it('loads and caches doctors ordered newest first', async () => {
      const doctors = [{ doctor_id: doctorId }];
      doctorRepository.find.mockResolvedValue(doctors);

      await expect(service.listDoctors()).resolves.toBe(doctors);
      expect(doctorRepository.find).toHaveBeenCalledWith({
        relations: { user: { profile: true } },
        order: { created_at: 'DESC' },
      });
      expect(redisService.setCache).toHaveBeenCalledWith(
        'cache:doctors:list',
        doctors,
        600,
      );
    });
  });
});
