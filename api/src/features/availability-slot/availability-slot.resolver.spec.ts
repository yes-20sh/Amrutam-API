import type { AvailabilitySlotEntity } from './entities/availability-slot.entity';
import type { AvailabilitySlotResolver as AvailabilitySlotResolverType } from './availability-slot.resolver';
import type { AvailabilitySlotService as AvailabilitySlotServiceType } from './availability-slot.service';
import type { CreateAvailabilitySlotDto } from './dto/create-slot.dto';
import type { BulkCreateSlotsDto } from './dto/bulk-create-slots.dto';
import type { UpdateAvailabilitySlotDto } from './dto/update-slot.dto';

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
  Roles: () => () => {},
  Public: () => () => {},
  CurrentUserId: () => () => {},
  ID: class ID {},
  ObjectType: () => () => {},
  InputType: () => () => {},
  Field: () => () => {},
  Int: class Int {},
  PartialType: (base: new (...args: never[]) => object) =>
    class PartialType extends base {},
  registerEnumType: () => {},
  GqlExecutionContext: class GqlExecutionContext {},
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

let createResolver: (
  service: AvailabilitySlotServiceType,
) => AvailabilitySlotResolverType;

describe('AvailabilitySlotResolver', () => {
  let resolver: AvailabilitySlotResolverType;
  let availabilitySlotService: {
    createSlot: jest.Mock;
    createBulkSlots: jest.Mock;
    updateSlot: jest.Mock;
    deleteSlot: jest.Mock;
    getDoctorAvailability: jest.Mock;
    myAvailabilitySlots: jest.Mock;
    getSlotById: jest.Mock;
  };

  beforeAll(async () => {
    const { AvailabilitySlotResolver } =
      await import('./availability-slot.resolver.js');
    createResolver = (service) => new AvailabilitySlotResolver(service);
  });

  beforeEach(() => {
    availabilitySlotService = {
      createSlot: bunTest.mock(),
      createBulkSlots: bunTest.mock(),
      updateSlot: bunTest.mock(),
      deleteSlot: bunTest.mock(),
      getDoctorAvailability: bunTest.mock(),
      myAvailabilitySlots: bunTest.mock(),
      getSlotById: bunTest.mock(),
    };
    resolver = createResolver(
      availabilitySlotService as unknown as AvailabilitySlotServiceType,
    );
  });

  it('forwards the authenticated doctor and input when creating a slot', async () => {
    const input = {
      start_time: new Date('2030-01-01T10:00:00.000Z'),
      end_time: new Date('2030-01-01T10:30:00.000Z'),
    } as CreateAvailabilitySlotDto;
    availabilitySlotService.createSlot.mockResolvedValue(
      'Availability slot created successfully',
    );

    await expect(
      resolver.createAvailabilitySlot(input, 'doctor-user-123'),
    ).resolves.toBe('Availability slot created successfully');
    expect(availabilitySlotService.createSlot).toHaveBeenCalledWith(
      'doctor-user-123',
      input,
    );
  });

  it('forwards the authenticated doctor and input when creating bulk slots', async () => {
    const input = {
      start_time: new Date('2030-01-01T10:00:00.000Z'),
      end_time: new Date('2030-01-01T11:00:00.000Z'),
      slot_duration_minutes: 30,
    } as BulkCreateSlotsDto;
    availabilitySlotService.createBulkSlots.mockResolvedValue(
      'Availability slots created successfully',
    );

    await expect(
      resolver.createBulkAvailabilitySlots(input, 'doctor-user-123'),
    ).resolves.toBe('Availability slots created successfully');
    expect(availabilitySlotService.createBulkSlots).toHaveBeenCalledWith(
      'doctor-user-123',
      input,
    );
  });

  it('forwards slot ID, input, and authenticated doctor when updating', async () => {
    const input = { status: 'CANCELLED' } as UpdateAvailabilitySlotDto;
    availabilitySlotService.updateSlot.mockResolvedValue(
      'Availability slot updated successfully',
    );

    await expect(
      resolver.updateAvailabilitySlot('slot-123', input, 'doctor-user-123'),
    ).resolves.toBe('Availability slot updated successfully');
    expect(availabilitySlotService.updateSlot).toHaveBeenCalledWith(
      'doctor-user-123',
      'slot-123',
      input,
    );
  });

  it('forwards the slot ID and authenticated doctor when deleting', async () => {
    availabilitySlotService.deleteSlot.mockResolvedValue(
      'Availability slot deleted successfully',
    );

    await expect(
      resolver.deleteAvailabilitySlot('slot-123', 'doctor-user-123'),
    ).resolves.toBe('Availability slot deleted successfully');
    expect(availabilitySlotService.deleteSlot).toHaveBeenCalledWith(
      'doctor-user-123',
      'slot-123',
    );
  });

  it('forwards doctor ID and optional date when retrieving availability', async () => {
    const fromDate = new Date('2030-01-01T00:00:00.000Z');
    const slots = [{ slot_id: 'slot-123' }] as AvailabilitySlotEntity[];
    availabilitySlotService.getDoctorAvailability.mockResolvedValue(slots);

    await expect(
      resolver.getDoctorAvailability('doctor-123', fromDate),
    ).resolves.toBe(slots);
    expect(availabilitySlotService.getDoctorAvailability).toHaveBeenCalledWith(
      'doctor-123',
      fromDate,
    );
  });

  it('forwards the authenticated doctor when listing their slots', async () => {
    const slots = [{ slot_id: 'slot-123' }] as AvailabilitySlotEntity[];
    availabilitySlotService.myAvailabilitySlots.mockResolvedValue(slots);

    await expect(resolver.myAvailabilitySlots('doctor-user-123')).resolves.toBe(
      slots,
    );
    expect(availabilitySlotService.myAvailabilitySlots).toHaveBeenCalledWith(
      'doctor-user-123',
    );
  });

  it('forwards the slot ID when retrieving a slot', async () => {
    const slot = { slot_id: 'slot-123' } as AvailabilitySlotEntity;
    availabilitySlotService.getSlotById.mockResolvedValue(slot);

    await expect(resolver.getAvailabilitySlotById('slot-123')).resolves.toBe(
      slot,
    );
    expect(availabilitySlotService.getSlotById).toHaveBeenCalledWith(
      'slot-123',
    );
  });
});
