import { Module } from '@nestjs/common';
import { DoctorService } from './doctor.service';
import { DoctorResolver } from './doctor.resolver';


@Module({
  providers: [DoctorResolver, DoctorService],
  exports: [DoctorService],
})
export class DoctorModule { }
