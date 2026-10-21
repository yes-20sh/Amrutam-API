import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../../schemas/user.schema';
import { Doctor } from '../../schemas/doctor.schema';
import { Profile } from '../../schemas/profile.schema';
import { Consultation } from '../../schemas/consultation.schema';
import { Payment } from '../../schemas/payment.schema';
import { Prescription } from '../../schemas/prescription.schema';
import { AvailabilitySlot } from '../../schemas/availability_slot.schema';
import { AuditLog } from '../../schemas/audit_log.schema';

import { AnalyticsService } from './analytics.service';
import { AnalyticsResolver } from './analytics.resolver';
import { RolesGuard } from '../../common/gaurds/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Doctor,
      Profile,
      Consultation,
      Payment,
      Prescription,
      AvailabilitySlot,
      AuditLog,
    ]),
  ],
  providers: [AnalyticsService, AnalyticsResolver, RolesGuard],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
