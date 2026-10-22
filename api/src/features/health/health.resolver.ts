import { Resolver, Query } from '@nestjs/graphql';
import { Public } from '../../common/decorator/public.decorator';
import { SkipThrottle } from '../../common/decorator/throttle.decorator';
import { HealthService } from './health.service';

@Resolver()
export class HealthResolver {
  constructor(private readonly healthService: HealthService) {}

  @SkipThrottle()
  @Public()
  @Query(() => String, { name: 'health', description: 'Health check and welcome message for Amrutam API' })
  health(): string {
    return this.healthService.getHealth();
  }
}
