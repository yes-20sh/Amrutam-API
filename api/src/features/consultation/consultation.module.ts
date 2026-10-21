import { Module } from '@nestjs/common';
import { ConsultationService } from './consultation.service';
import { ConsultationResolver } from './consultation.resolver';

@Module({
  providers: [ConsultationResolver, ConsultationService],
  exports: [ConsultationService],
})
export class ConsultationModule { }
