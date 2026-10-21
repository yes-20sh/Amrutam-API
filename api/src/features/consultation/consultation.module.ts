import { Module } from '@nestjs/common';
import { ConsultationService } from './consultation.service';
import { ConsultationResolver } from './consultation.resolver';
import { ConsultationExpiryService } from './consultation-expiry.service';
import { RedisModule } from '../../core/redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [ConsultationResolver, ConsultationService, ConsultationExpiryService],
  exports: [ConsultationService, ConsultationExpiryService],
})
export class ConsultationModule { }
