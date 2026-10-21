import { ObjectType, Field, Float, Int } from '@nestjs/graphql';

@ObjectType()
export class AdminDashboardSummaryEntity {
  @Field(() => Float)
  total_revenue: number;

  @Field(() => Float)
  revenue_growth_percentage: number;

  @Field(() => Int)
  total_consultations: number;

  @Field(() => Int)
  completed_consultations: number;

  @Field(() => Float)
  cancellation_rate: number;

  @Field(() => Int)
  total_patients: number;

  @Field(() => Int)
  new_patients_in_period: number;

  @Field(() => Int)
  total_doctors: number;

  @Field(() => Int)
  pending_doctor_verifications: number;

  @Field(() => Float)
  slot_utilization_rate: number;

  @Field(() => Int)
  active_users_last_30_days: number;
}
