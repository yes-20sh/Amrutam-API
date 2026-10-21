import { Module } from '@nestjs/common';
import { AvailabilitySlotService } from './availability-slot.service';
import { AvailabilitySlotResolver } from './availability-slot.resolver';
import { RedisModule } from '../../core/redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [AvailabilitySlotResolver, AvailabilitySlotService],
  exports: [AvailabilitySlotService],
})
export class AvailabilitySlotModule { }
