import 'dotenv/config';
import { APP_GUARD } from '@nestjs/core';
import { PublicApiGuard } from './common/gaurds/public-api.guard';
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import helmet from 'helmet';
import cors from 'cors';
import { GraphqlModule } from './core/graphql/graphql.module';
import { DatabaseModule } from './core/database/database.module';
import { PaginationModule } from './common/pagination/pagination.module';
import { AuthModule } from './features/auth/auth.module';
import { AuthMiddleware } from './core/middleware/auth.middleware';
import { DoctorModule } from './features/doctor/doctor.module';
import { AvailabilitySlotModule } from './features/availability-slot/availability-slot.module';
import { ConsultationModule } from './features/consultation/consultation.module';
import { PrescriptionModule } from './features/prescription/prescription.module';
import { PaymentModule } from './features/payment/payment.module';
import { AuditLogModule } from './features/audit-log/audit-log.module';

@Module({
  imports: [
    GraphqlModule,
    DatabaseModule,
    PaginationModule,
    AuthModule,
    DoctorModule,
    AvailabilitySlotModule,
    ConsultationModule,
    PrescriptionModule,
    PaymentModule,
    AuditLogModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: PublicApiGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(helmet(), cors(), AuthMiddleware).forRoutes('*');
  }
}
