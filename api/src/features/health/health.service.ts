import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  getHealth(): string {
    return 'Welcome to Amrutam API';
  }
}
