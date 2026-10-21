import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { RedisService } from '../../core/redis/redis.service';
import type { AvailabilitySlot } from '../../schemas/availability_slot.schema';
import type { Doctor } from '../../schemas/doctor.schema';
import type { BulkCreateSlotsDto } from './dto/bulk-create-slots.dto';
import type { CreateAvailabilitySlotDto } from './dto/create-slot.dto';
import type { UpdateAvailabilitySlotDto } from './dto/update-slot.dto';
import type { AvailabilitySlotService as AvailabilitySlotServiceType } from './availability-slot.service';

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
  Roles: () => () => {},
  Public: () => () => {},
  CurrentUserId: () => () => {},
  Mutation: () => () => {},
  Query: () => () => {},
  Args: () => () => {},
  ID: class ID {},
  ObjectType: () => () => {},
  InputType: () => () => {},
  Field: () => () => {},
  Int: class Int {},
  PartialType: (base: new (...args: never[]) => object) =>
    class PartialType extends base {},
  registerEnumType: () => {},
}));
bunTest.mock.module('../../schemas/availability_slot.schema', () => ({
  AvailabilitySlot: class AvailabilitySlot {},
}));
bunTest.mock.module('../../schemas/doctor.schema', () => ({
  Doctor: class Doctor {},
}));
bunTest.mock.module('./entities/availability-slot.entity', () => ({
  AvailabilitySlotEntity: class AvailabilitySlotEntity {},
}));

type ServiceDependencies = [
  Repository<AvailabilitySlot>,
  Repository<Doctor>,
  RedisService,
];
let createService: (
  ...dependencies: ServiceDependencies
) => AvailabilitySlotServiceType;

describe('AvailabilitySlotService', () => {
  let service: AvailabilitySlotServiceType;
  let slotRepository: {
    createQueryBuilder: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
    find: jest.Mock;
  };
  let doctorRepository: { findOne: jest.Mock };
  let redisService: {
    getCache: jest.Mock;
    setCache: jest.Mock;
    invalidateDoctorSlots: jest.Mock;
  };
  let queryBuilder: {
    where: jest.Mock;
    andWhere: jest.Mock;
    getOne: jest.Mock;
    leftJoinAndSelect: jest.Mock;
    orderBy: jest.Mock;
    getMany: jest.Mock;
  };

  const userId = 'doctor-user-123';
  const doctorId = 'doctor-123';
  const slotId = 'slot-123';
  const futureStart = new Date(Date.now() + 60 * 60 * 1000);
  const futureEnd = new Date(futureStart.getTime() + 30 * 60 * 1000);

  beforeAll(async () => {
    const { AvailabilitySlotService } =
      await import('./availability-slot.service.js');
    createService = (...dependencies) =>
      new AvailabilitySlotService(...dependencies);
  });

  beforeEach(() => {
    queryBuilder = {
      where: bunTest.mock(),
      andWhere: bunTest.mock(),
      getOne: bunTest.mock(),
      leftJoinAndSelect: bunTest.mock(),
      orderBy: bunTest.mock(),
      getMany: bunTest.mock(),
    };
    queryBuilder.where.mockReturnValue(queryBuilder);
    queryBuilder.andWhere.mockReturnValue(queryBuilder);
    queryBuilder.leftJoinAndSelect.mockReturnValue(queryBuilder);
    queryBuilder.orderBy.mockReturnValue(queryBuilder);
    slotRepository = {
      createQueryBuilder: bunTest.mock().mockReturnValue(queryBuilder),
      create: bunTest.mock(),
      save: bunTest.mock().mockResolvedValue(undefined),
      findOne: bunTest.mock(),
      remove: bunTest.mock().mockResolvedValue(undefined),
      find: bunTest.mock(),
    };
    slotRepository.create.mockImplementation((slot) => slot);
    doctorRepository = { findOne: bunTest.mock() };
    redisService = {
      getCache: bunTest.mock().mockResolvedValue(null),
      setCache: bunTest.mock().mockResolvedValue(undefined),
      invalidateDoctorSlots: bunTest.mock().mockResolvedValue(undefined),
    };
    service = createService(
      slotRepository as unknown as Repository<AvailabilitySlot>,
      doctorRepository as unknown as Repository<Doctor>,
      redisService as unknown as RedisService,
    );
  });

  describe('createSlot', () => {
    const input: CreateAvailabilitySlotDto = {
      start_time: futureStart,
      end_time: futureEnd,
    };

    it('creates an available slot and invalidates doctor availability cache', async () => {
      doctorRepository.findOne.mockResolvedValue({ doctor_id: doctorId });
      queryBuilder.getOne.mockResolvedValue(null);

      await expect(service.createSlot(userId, input)).resolves.toBe(
        'Availability slot created successfully',
      );
      expect(slotRepository.create).toHaveBeenCalledWith({
        doctor_id: doctorId,
        start_time: futureStart,
        end_time: futureEnd,
        status: 'AVAILABLE',
      });
      expect(slotRepository.save).toHaveBeenCalled();
      expect(redisService.invalidateDoctorSlots).toHaveBeenCalledWith(doctorId);
    });

    it('rejects when the doctor profile does not exist', async () => {
      doctorRepository.findOne.mockResolvedValue(null);

      await expect(service.createSlot(userId, input)).rejects.toThrow(
        new NotFoundException('Doctor profile not found'),
      );
      expect(slotRepository.save).not.toHaveBeenCalled();
    });

    it('rejects an invalid time range', async () => {
      doctorRepository.findOne.mockResolvedValue({ doctor_id: doctorId });

      await expect(
        service.createSlot(userId, {
          start_time: futureEnd,
          end_time: futureStart,
        }),
      ).rejects.toThrow(
        new BadRequestException('Start time must be strictly before end time'),
      );
      expect(slotRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('rejects a slot in the past', async () => {
      doctorRepository.findOne.mockResolvedValue({ doctor_id: doctorId });

      await expect(
        service.createSlot(userId, {
          start_time: new Date(Date.now() - 5 * 60 * 1000),
          end_time: new Date(Date.now() + 25 * 60 * 1000),
        }),
      ).rejects.toThrow(
        new BadRequestException('Cannot create availability slots in the past'),
      );
    });

    it('rejects overlapping slots', async () => {
      doctorRepository.findOne.mockResolvedValue({ doctor_id: doctorId });
      queryBuilder.getOne.mockResolvedValue({ slot_id: 'existing-slot' });

      await expect(service.createSlot(userId, input)).rejects.toThrow(
        new ConflictException(
          'An overlapping availability slot already exists for this time window',
        ),
      );
      expect(slotRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('createBulkSlots', () => {
    it('generates sequential slots and invalidates doctor availability cache', async () => {
      const endTime = new Date(futureStart.getTime() + 65 * 60 * 1000);
      doctorRepository.findOne.mockResolvedValue({ doctor_id: doctorId });
      const input: BulkCreateSlotsDto = {
        start_time: futureStart,
        end_time: endTime,
        slot_duration_minutes: 30,
      };

      await expect(service.createBulkSlots(userId, input)).resolves.toBe(
        'Availability slots created successfully',
      );
      expect(slotRepository.create).toHaveBeenCalledTimes(2);
      expect(slotRepository.save).toHaveBeenCalledWith([
        expect.objectContaining({
          doctor_id: doctorId,
          start_time: futureStart,
          end_time: new Date(futureStart.getTime() + 30 * 60 * 1000),
          status: 'AVAILABLE',
        }),
        expect.objectContaining({
          doctor_id: doctorId,
          start_time: new Date(futureStart.getTime() + 30 * 60 * 1000),
          end_time: new Date(futureStart.getTime() + 60 * 60 * 1000),
          status: 'AVAILABLE',
        }),
      ]);
      expect(redisService.invalidateDoctorSlots).toHaveBeenCalledWith(doctorId);
    });

    it('rejects a window too short to generate any slot', async () => {
      doctorRepository.findOne.mockResolvedValue({ doctor_id: doctorId });
      const input: BulkCreateSlotsDto = {
        start_time: futureStart,
        end_time: new Date(futureStart.getTime() + 5 * 60 * 1000),
        slot_duration_minutes: 30,
      };

      await expect(service.createBulkSlots(userId, input)).rejects.toThrow(
        new BadRequestException(
          'No slots could be generated with the given duration and window',
        ),
      );
      expect(slotRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('updateSlot', () => {
    it('updates an owned slot and invalidates its doctor cache', async () => {
      const slot = {
        slot_id: slotId,
        doctor_id: doctorId,
        start_time: futureStart,
        end_time: futureEnd,
        status: 'AVAILABLE',
        doctor: { user_id: userId },
      };
      slotRepository.findOne.mockResolvedValue(slot);
      const updatedEnd = new Date(futureEnd.getTime() + 30 * 60 * 1000);
      const input: UpdateAvailabilitySlotDto = {
        end_time: updatedEnd,
        status: 'CANCELLED',
      };

      await expect(service.updateSlot(userId, slotId, input)).resolves.toBe(
        'Availability slot updated successfully',
      );
      expect(slot.end_time).toEqual(updatedEnd);
      expect(slot.status).toBe('CANCELLED');
      expect(slotRepository.save).toHaveBeenCalledWith(slot);
      expect(redisService.invalidateDoctorSlots).toHaveBeenCalledWith(doctorId);
    });

    it('rejects an update by a user who does not own the slot', async () => {
      slotRepository.findOne.mockResolvedValue({
        status: 'AVAILABLE',
        doctor: { user_id: 'other-user' },
      });

      await expect(
        service.updateSlot(userId, slotId, { status: 'CANCELLED' }),
      ).rejects.toThrow(
        new ForbiddenException(
          'You are not authorized to update this availability slot',
        ),
      );
      expect(slotRepository.save).not.toHaveBeenCalled();
    });

    it('prevents changing the timing of a booked slot', async () => {
      slotRepository.findOne.mockResolvedValue({
        status: 'BOOKED',
        start_time: futureStart,
        end_time: futureEnd,
        doctor: { user_id: userId },
      });

      await expect(
        service.updateSlot(userId, slotId, { end_time: futureEnd }),
      ).rejects.toThrow(
        new BadRequestException(
          'Cannot modify the timing of an already booked slot',
        ),
      );
      expect(slotRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('deleteSlot', () => {
    it('removes an owned unbooked slot and invalidates its cache', async () => {
      const slot = {
        slot_id: slotId,
        doctor_id: doctorId,
        status: 'AVAILABLE',
        doctor: { user_id: userId },
      };
      slotRepository.findOne.mockResolvedValue(slot);

      await expect(service.deleteSlot(userId, slotId)).resolves.toBe(
        'Availability slot deleted successfully',
      );
      expect(slotRepository.remove).toHaveBeenCalledWith(slot);
      expect(redisService.invalidateDoctorSlots).toHaveBeenCalledWith(doctorId);
    });

    it('rejects deleting a booked slot', async () => {
      slotRepository.findOne.mockResolvedValue({
        status: 'BOOKED',
        doctor: { user_id: userId },
      });

      await expect(service.deleteSlot(userId, slotId)).rejects.toThrow(
        new BadRequestException(
          'Cannot delete a slot that has an active booking',
        ),
      );
      expect(slotRepository.remove).not.toHaveBeenCalled();
    });
  });

  describe('getDoctorAvailability', () => {
    it('returns cached availability without querying the repository', async () => {
      const slots = [{ slot_id: slotId }];
      redisService.getCache.mockResolvedValue(slots);

      await expect(service.getDoctorAvailability(doctorId)).resolves.toBe(
        slots,
      );
      expect(redisService.getCache).toHaveBeenCalledWith(
        `cache:slots:${doctorId}:upcoming`,
      );
      expect(slotRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('queries and caches available slots when the cache is empty', async () => {
      const slots = [{ slot_id: slotId }];
      queryBuilder.getMany.mockResolvedValue(slots);

      await expect(service.getDoctorAvailability(doctorId)).resolves.toBe(
        slots,
      );
      expect(queryBuilder.where).toHaveBeenCalledWith(
        'slot.doctor_id = :doctorId',
        { doctorId },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'slot.status = :status',
        { status: 'AVAILABLE' },
      );
      expect(queryBuilder.orderBy).toHaveBeenCalledWith(
        'slot.start_time',
        'ASC',
      );
      expect(redisService.setCache).toHaveBeenCalledWith(
        `cache:slots:${doctorId}:upcoming`,
        slots,
        120,
      );
    });
  });

  describe('myAvailabilitySlots', () => {
    it('returns slots belonging to the authenticated doctor ordered by start time', async () => {
      const slots = [{ slot_id: slotId }];
      doctorRepository.findOne.mockResolvedValue({ doctor_id: doctorId });
      slotRepository.find.mockResolvedValue(slots);

      await expect(service.myAvailabilitySlots(userId)).resolves.toBe(slots);
      expect(slotRepository.find).toHaveBeenCalledWith({
        where: { doctor_id: doctorId },
        relations: { doctor: { user: { profile: true } } },
        order: { start_time: 'ASC' },
      });
    });

    it('rejects when the user has no doctor profile', async () => {
      doctorRepository.findOne.mockResolvedValue(null);

      await expect(service.myAvailabilitySlots(userId)).rejects.toThrow(
        new NotFoundException('Doctor profile not found'),
      );
    });
  });

  describe('getSlotById', () => {
    it('returns an existing slot', async () => {
      const slot = { slot_id: slotId };
      slotRepository.findOne.mockResolvedValue(slot);

      await expect(service.getSlotById(slotId)).resolves.toBe(slot);
    });

    it('rejects a missing slot', async () => {
      slotRepository.findOne.mockResolvedValue(null);

      await expect(service.getSlotById(slotId)).rejects.toThrow(
        new NotFoundException('Availability slot not found'),
      );
    });
  });
});
