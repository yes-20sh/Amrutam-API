import { Resolver, Query, Args } from '@nestjs/graphql';

import { AnalyticsService } from './analytics.service';
import { AnalyticsFilterInput } from './dto/analytics-filter.input';
import { AdminDashboardSummaryEntity } from './entities/admin-dashboard-summary.entity';
import { RevenueAnalyticsEntity } from './entities/revenue-analytics.entity';
import { ConsultationAnalyticsEntity } from './entities/consultation-analytics.entity';
import { DoctorAnalyticsEntity } from './entities/doctor-analytics.entity';
import { PatientAnalyticsEntity } from './entities/patient-analytics.entity';
import { ClinicalAndSystemAnalyticsEntity } from './entities/clinical-and-system-analytics.entity';
import { ThrottleHeavy } from '../../common/decorator/throttle.decorator';
import { Roles } from '../../common/decorator/roles.decorator';
import { UserRole } from '../../common/enum/user-role.enum';

@ThrottleHeavy()
@Resolver(() => AdminDashboardSummaryEntity)
export class AnalyticsResolver {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Roles(UserRole.ADMIN)
  @Query(() => AdminDashboardSummaryEntity)
  async adminDashboardSummary(
    @Args('filter', { nullable: true }) filter?: AnalyticsFilterInput,
  ): Promise<AdminDashboardSummaryEntity> {
    return this.analyticsService.getDashboardSummary(filter);
  }

  @Roles(UserRole.ADMIN)
  @Query(() => RevenueAnalyticsEntity)
  async adminRevenueAnalytics(
    @Args('filter', { nullable: true }) filter?: AnalyticsFilterInput,
  ): Promise<RevenueAnalyticsEntity> {
    return this.analyticsService.getRevenueAnalytics(filter);
  }

  @Roles(UserRole.ADMIN)
  @Query(() => ConsultationAnalyticsEntity)
  async adminConsultationAnalytics(
    @Args('filter', { nullable: true }) filter?: AnalyticsFilterInput,
  ): Promise<ConsultationAnalyticsEntity> {
    return this.analyticsService.getConsultationAnalytics(filter);
  }

  @Roles(UserRole.ADMIN)
  @Query(() => DoctorAnalyticsEntity)
  async adminDoctorAnalytics(
    @Args('filter', { nullable: true }) filter?: AnalyticsFilterInput,
  ): Promise<DoctorAnalyticsEntity> {
    return this.analyticsService.getDoctorAnalytics(filter);
  }

  @Roles(UserRole.ADMIN)
  @Query(() => PatientAnalyticsEntity)
  async adminPatientAnalytics(
    @Args('filter', { nullable: true }) filter?: AnalyticsFilterInput,
  ): Promise<PatientAnalyticsEntity> {
    return this.analyticsService.getPatientAnalytics(filter);
  }

  @Roles(UserRole.ADMIN)
  @Query(() => ClinicalAndSystemAnalyticsEntity)
  async adminClinicalAndSystemAnalytics(
    @Args('filter', { nullable: true }) filter?: AnalyticsFilterInput,
  ): Promise<ClinicalAndSystemAnalyticsEntity> {
    return this.analyticsService.getClinicalAndSystemAnalytics(filter);
  }
}
