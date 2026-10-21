import { ObjectType, Field, Float, Int, ID } from '@nestjs/graphql';

@ObjectType()
export class DoctorVerificationStatusCount {
  @Field(() => String)
  status: string;

  @Field(() => Int)
  count: number;
}

@ObjectType()
export class DoctorSpecializationCount {
  @Field(() => String)
  specialization: string;

  @Field(() => Int)
  count: number;

  @Field(() => Float)
  percentage: number;
}

@ObjectType()
export class DoctorCapacityMetrics {
  @Field(() => Int)
  total_slots: number;

  @Field(() => Int)
  booked_slots: number;

  @Field(() => Int)
  available_slots: number;

  @Field(() => Float)
  utilization_rate: number;
}

@ObjectType()
export class TopDoctorPerformer {
  @Field(() => ID)
  doctor_id: string;

  @Field(() => String)
  full_name: string;

  @Field(() => String)
  specialization: string;

  @Field(() => Float)
  consultation_fee: number;

  @Field(() => Int)
  completed_consultations: number;

  @Field(() => Float)
  total_revenue: number;
}

@ObjectType()
export class DoctorAnalyticsEntity {
  @Field(() => Int)
  total_doctors: number;

  @Field(() => [DoctorVerificationStatusCount])
  verification_breakdown: DoctorVerificationStatusCount[];

  @Field(() => [DoctorSpecializationCount])
  specialization_breakdown: DoctorSpecializationCount[];

  @Field(() => DoctorCapacityMetrics)
  capacity: DoctorCapacityMetrics;

  @Field(() => [TopDoctorPerformer])
  top_doctors: TopDoctorPerformer[];
}
