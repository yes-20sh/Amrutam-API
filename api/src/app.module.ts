import 'dotenv/config';
import { APP_GUARD } from '@nestjs/core';
import { PublicApiGuard } from './common/gaurds/public-api.guard';
import { RolesGuard } from './common/gaurds/roles.guard';
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { helmetMiddleware } from './core/security/helmet.config';
import { corsMiddleware } from './core/security/cors.config';
import { createObserveModule } from '@nestjs/observe';
import { GraphqlModule } from './core/graphql/graphql.module';
import { DatabaseModule } from './core/database/database.module';
import { RedisModule } from './core/redis/redis.module';
import { PaginationModule } from './common/pagination/pagination.module';
import { AuthModule } from './features/auth/auth.module';
import { AuthMiddleware } from './core/middleware/auth.middleware';
import { DoctorModule } from './features/doctor/doctor.module';
import { AvailabilitySlotModule } from './features/availability-slot/availability-slot.module';
import { ConsultationModule } from './features/consultation/consultation.module';
import { PrescriptionModule } from './features/prescription/prescription.module';
import { PaymentModule } from './features/payment/payment.module';
import { AuditLogModule } from './features/audit-log/audit-log.module';
import { AnalyticsModule } from './features/analytics/analytics.module';
import { ProfileModule } from './features/profile/profile.module';
import { HealthModule } from './features/health/health.module';

export const { ObserveModule, ObserveInstrument } = createObserveModule({
  attachTraceIdToLogs: true,
});

@Module({
  imports: [
    ObserveModule.forRoot({
      serviceId: process.env.OBSERVE_SERVICE_ID || 'amrutam-api',
      appKey: process.env.OBSERVE_APP_KEY,
      appSecret: process.env.OBSERVE_APP_SECRET,
      enabled: process.env.OBSERVE_ENABLE === 'true',
    }),
    GraphqlModule,
    DatabaseModule,
    RedisModule,
    PaginationModule,
    AuthModule,
    DoctorModule,
    AvailabilitySlotModule,
    ConsultationModule,
    PrescriptionModule,
    PaymentModule,
    AuditLogModule,
    AnalyticsModule,
    ProfileModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: PublicApiGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(helmetMiddleware(), corsMiddleware(), AuthMiddleware)
      .forRoutes('*');
  }
}
