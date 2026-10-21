import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AvailabilitySlot } from '../../schemas/availability_slot.schema';
import { Doctor } from '../../schemas/doctor.schema';
import { handleServiceError } from '../../utils/error/error.util';
import { CreateAvailabilitySlotDto } from './dto/create-slot.dto';
import { UpdateAvailabilitySlotDto } from './dto/update-slot.dto';
import { BulkCreateSlotsDto } from './dto/bulk-create-slots.dto';
import { AvailabilitySlotEntity } from './entities/availability-slot.entity';
import { RedisService } from '../../core/redis/redis.service';

@Injectable()
export class AvailabilitySlotService {
  private readonly logger = new Logger(AvailabilitySlotService.name);

  constructor(
    @InjectRepository(AvailabilitySlot)
    private readonly slotRepository: Repository<AvailabilitySlot>,
    @InjectRepository(Doctor)
    private readonly doctorRepository: Repository<Doctor>,
    private readonly redisService: RedisService,
  ) { }

  /**
   * Insert: Create a single availability slot for the authenticated doctor.
   */
  async createSlot(
    userId: string,
    createDto: CreateAvailabilitySlotDto,
  ): Promise<string> {
    try {
      const doctor = await this.doctorRepository.findOne({
        where: { user_id: userId },
        relations: { user: { profile: true } },
      });

      if (!doctor) {
        throw new NotFoundException('Doctor profile not found');
      }

      const start = new Date(createDto.start_time);
      const end = new Date(createDto.end_time);

      if (start >= end) {
        throw new BadRequestException(
          'Start time must be strictly before end time',
        );
      }

      if (start.getTime() < Date.now() - 60000) {
        throw new BadRequestException(
          'Cannot create availability slots in the past',
        );
      }

      // Check for overlapping slots
      const overlapping = await this.slotRepository
        .createQueryBuilder('slot')
        .where('slot.doctor_id = :doctorId', { doctorId: doctor.doctor_id })
        .andWhere('slot.status != :cancelled', { cancelled: 'CANCELLED' })
        .andWhere('slot.start_time < :end AND slot.end_time > :start', {
          start,
          end,
        })
        .getOne();

      if (overlapping) {
        throw new ConflictException(
          'An overlapping availability slot already exists for this time window',
        );
      }

      const slot = this.slotRepository.create({
        doctor_id: doctor.doctor_id,
        start_time: start,
        end_time: end,
        status: 'AVAILABLE',
      });

      await this.slotRepository.save(slot);

      // Invalidate Redis availability cache for this doctor
      await this.redisService.invalidateDoctorSlots(doctor.doctor_id);

      return 'Availability slot created successfully';
    } catch (error) {
      handleServiceError(
        error,
        this.logger,
        'AvailabilitySlotService.createSlot',
      );
    }
  }

  /**
   * Insert: Bulk generate sequential availability slots within a time window.
   */
  async createBulkSlots(
    userId: string,
    bulkDto: BulkCreateSlotsDto,
  ): Promise<string> {
    try {
      const doctor = await this.doctorRepository.findOne({
        where: { user_id: userId },
        relations: { user: { profile: true } },
      });

      if (!doctor) {
        throw new NotFoundException('Doctor profile not found');
      }

      const windowStart = new Date(bulkDto.start_time).getTime();
      const windowEnd = new Date(bulkDto.end_time).getTime();
      const durationMs = bulkDto.slot_duration_minutes * 60 * 1000;

      if (windowStart >= windowEnd) {
        throw new BadRequestException('Start time must be before end time');
      }

      if (windowStart < Date.now() - 60000) {
        throw new BadRequestException(
          'Cannot create availability slots in the past',
        );
      }

      const slotsToCreate: AvailabilitySlot[] = [];
      let currentStart = windowStart;

      while (currentStart + durationMs <= windowEnd) {
        const currentEnd = currentStart + durationMs;
        slotsToCreate.push(
          this.slotRepository.create({
            doctor_id: doctor.doctor_id,
            start_time: new Date(currentStart),
            end_time: new Date(currentEnd),
            status: 'AVAILABLE',
          }),
        );
        currentStart = currentEnd;
      }

      if (slotsToCreate.length === 0) {
        throw new BadRequestException(
          'No slots could be generated with the given duration and window',
        );
      }

      await this.slotRepository.save(slotsToCreate);

      // Invalidate Redis availability cache for this doctor
      await this.redisService.invalidateDoctorSlots(doctor.doctor_id);

      return 'Availability slots created successfully';
    } catch (error) {
      handleServiceError(
        error,
        this.logger,
        'AvailabilitySlotService.createBulkSlots',
      );
    }
  }

  /**
   * Update: Modify time or status of an existing slot.
   */
  async updateSlot(
    userId: string,
    slotId: string,
    updateDto: UpdateAvailabilitySlotDto,
  ): Promise<string> {
    try {
      const slot = await this.slotRepository.findOne({
        where: { slot_id: slotId },
        relations: { doctor: { user: { profile: true } } },
      });

      if (!slot) {
        throw new NotFoundException('Availability slot not found');
      }

      if (slot.doctor?.user_id !== userId) {
        throw new ForbiddenException(
          'You are not authorized to update this availability slot',
        );
      }

      if (
        slot.status === 'BOOKED' &&
        (updateDto.start_time || updateDto.end_time)
      ) {
        throw new BadRequestException(
          'Cannot modify the timing of an already booked slot',
        );
      }

      if (updateDto.start_time) {
        slot.start_time = new Date(updateDto.start_time);
      }

      if (updateDto.end_time) {
        slot.end_time = new Date(updateDto.end_time);
      }

      if (slot.start_time >= slot.end_time) {
        throw new BadRequestException(
          'Start time must be strictly before end time',
        );
      }

      if (updateDto.status) {
        slot.status = updateDto.status;
      }

      await this.slotRepository.save(slot);

      // Invalidate Redis availability cache
      if (slot.doctor_id) {
        await this.redisService.invalidateDoctorSlots(slot.doctor_id);
      }

      return 'Availability slot updated successfully';
    } catch (error) {
      handleServiceError(
        error,
        this.logger,
        'AvailabilitySlotService.updateSlot',
      );
    }
  }

  /**
   * Delete: Remove or cancel an unbooked availability slot.
   */
  async deleteSlot(userId: string, slotId: string): Promise<string> {
    try {
      const slot = await this.slotRepository.findOne({
        where: { slot_id: slotId },
        relations: { doctor: true },
      });

      if (!slot) {
        throw new NotFoundException('Availability slot not found');
      }

      if (slot.doctor?.user_id !== userId) {
        throw new ForbiddenException(
          'You are not authorized to delete this availability slot',
        );
      }

      if (slot.status === 'BOOKED') {
        throw new BadRequestException(
          'Cannot delete a slot that has an active booking',
        );
      }

      await this.slotRepository.remove(slot);

      // Invalidate Redis availability cache
      if (slot.doctor_id) {
        await this.redisService.invalidateDoctorSlots(slot.doctor_id);
      }

      return 'Availability slot deleted successfully';
    } catch (error) {
      handleServiceError(
        error,
        this.logger,
        'AvailabilitySlotService.deleteSlot',
      );
    }
  }

  /**
   * Get: Retrieve public available slots for a doctor with Redis caching.
   */
  async getDoctorAvailability(
    doctorId: string,
    fromDate?: Date,
  ): Promise<AvailabilitySlotEntity[]> {
    try {
      const dateKey = fromDate
        ? new Date(fromDate).toISOString().slice(0, 10)
        : 'upcoming';
      const cacheKey = `cache:slots:${doctorId}:${dateKey}`;

      // Check Redis cache first
      const cachedSlots =
        await this.redisService.getCache<AvailabilitySlotEntity[]>(cacheKey);
      if (cachedSlots) {
        return cachedSlots;
      }

      const query = this.slotRepository
        .createQueryBuilder('slot')
        .leftJoinAndSelect('slot.doctor', 'doctor')
        .leftJoinAndSelect('doctor.user', 'user')
        .leftJoinAndSelect('user.profile', 'profile')
        .where('slot.doctor_id = :doctorId', { doctorId })
        .andWhere('slot.status = :status', { status: 'AVAILABLE' });

      const dateFilter = fromDate || new Date();
      query.andWhere('slot.start_time >= :dateFilter', { dateFilter });
      query.orderBy('slot.start_time', 'ASC');

      const slots = await query.getMany();
      const result = slots as unknown as AvailabilitySlotEntity[];

      // Cache the result in Redis for 120 seconds
      await this.redisService.setCache(cacheKey, result, 120);

      return result;
    } catch (error) {
      handleServiceError(
        error,
        this.logger,
        'AvailabilitySlotService.getDoctorAvailability',
      );
    }
  }

  /**
   * Get: List all slots belonging to the current doctor.
   */
  async myAvailabilitySlots(userId: string): Promise<AvailabilitySlotEntity[]> {
    try {
      const doctor = await this.doctorRepository.findOne({
        where: { user_id: userId },
      });

      if (!doctor) {
        throw new NotFoundException('Doctor profile not found');
      }

      const slots = await this.slotRepository.find({
        where: { doctor_id: doctor.doctor_id },
        relations: { doctor: { user: { profile: true } } },
        order: { start_time: 'ASC' },
      });

      return slots as unknown as AvailabilitySlotEntity[];
    } catch (error) {
      handleServiceError(
        error,
        this.logger,
        'AvailabilitySlotService.myAvailabilitySlots',
      );
    }
  }

  /**
   * Get: Retrieve single slot by ID.
   */
  async getSlotById(slotId: string): Promise<AvailabilitySlotEntity> {
    try {
      const slot = await this.slotRepository.findOne({
        where: { slot_id: slotId },
        relations: { doctor: { user: { profile: true } } },
      });

      if (!slot) {
        throw new NotFoundException('Availability slot not found');
      }

      return slot as unknown as AvailabilitySlotEntity;
    } catch (error) {
      handleServiceError(
        error,
        this.logger,
        'AvailabilitySlotService.getSlotById',
      );
    }
  }
}
