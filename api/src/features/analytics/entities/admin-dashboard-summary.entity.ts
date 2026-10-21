import { ObjectType, Field, Float, Int } from '@nestjs/graphql';

@ObjectType({ description: 'Executive dashboard KPI metrics for the administrator' })
export class AdminDashboardSummaryEntity {
  @Field(() => Float, { description: 'Total revenue collected in INR within reporting window' })
  total_revenue: number;

  @Field(() => Float, { description: 'Revenue change percentage compared to preceding period of same duration' })
  revenue_growth_percentage: number;

  @Field(() => Int, { description: 'Total consultations booked within the window' })
  total_consultations: number;

  @Field(() => Int, { description: 'Total successfully completed consultations' })
  completed_consultations: number;

  @Field(() => Float, { description: 'Percentage of booked consultations that were cancelled' })
  cancellation_rate: number;

  @Field(() => Int, { description: 'Total registered patients on the platform' })
  total_patients: number;

  @Field(() => Int, { description: 'New patients registered within this period' })
  new_patients_in_period: number;

  @Field(() => Int, { description: 'Total doctors registered on the platform' })
  total_doctors: number;

  @Field(() => Int, { description: 'Doctors awaiting administrative license verification' })
  pending_doctor_verifications: number;

  @Field(() => Float, { description: 'Percentage of availability slots that were booked by patients' })
  slot_utilization_rate: number;

  @Field(() => Int, { description: 'Active users who logged in within the last 30 days' })
  active_users_last_30_days: number;
}
