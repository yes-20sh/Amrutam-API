import { ObjectType, Field, Float, Int, ID } from '@nestjs/graphql';

@ObjectType({ description: 'Count of doctors grouped by verification status' })
export class DoctorVerificationStatusCount {
  @Field(() => String, { description: 'Verification status (PENDING, VERIFIED, REJECTED)' })
  status: string;

  @Field(() => Int, { description: 'Number of doctors in this state' })
  count: number;
}

@ObjectType({ description: 'Doctor distribution across clinical specializations' })
export class DoctorSpecializationCount {
  @Field(() => String, { description: 'Specialization name (e.g. Ayurveda, Dermatology)' })
  specialization: string;

  @Field(() => Int, { description: 'Count of doctors' })
  count: number;

  @Field(() => Float, { description: 'Percentage of total doctor pool' })
  percentage: number;
}

@ObjectType({ description: 'Platform slot generation and capacity utilization metrics' })
export class DoctorCapacityMetrics {
  @Field(() => Int, { description: 'Total availability slots created' })
  total_slots: number;

  @Field(() => Int, { description: 'Slots successfully reserved by patients' })
  booked_slots: number;

  @Field(() => Int, { description: 'Slots currently unbooked/available' })
  available_slots: number;

  @Field(() => Float, { description: 'Ratio of booked to total published slots' })
  utilization_rate: number;
}

@ObjectType({ description: 'Top performing doctor by consultations and revenue' })
export class TopDoctorPerformer {
  @Field(() => ID, { description: 'Doctor UUID' })
  doctor_id: string;

  @Field(() => String, { description: 'Doctor full name' })
  full_name: string;

  @Field(() => String, { description: 'Primary specialization' })
  specialization: string;

  @Field(() => Float, { description: 'Standard consultation fee' })
  consultation_fee: number;

  @Field(() => Int, { description: 'Completed consultations count in window' })
  completed_consultations: number;

  @Field(() => Float, { description: 'Total gross revenue generated in INR' })
  total_revenue: number;
}

@ObjectType({ description: 'Doctor network performance, capacity, and credentials analytics' })
export class DoctorAnalyticsEntity {
  @Field(() => Int, { description: 'Total registered doctors' })
  total_doctors: number;

  @Field(() => [DoctorVerificationStatusCount], { description: 'Verification pipeline breakdown' })
  verification_breakdown: DoctorVerificationStatusCount[];

  @Field(() => [DoctorSpecializationCount], { description: 'Distribution across medical specializations' })
  specialization_breakdown: DoctorSpecializationCount[];

  @Field(() => DoctorCapacityMetrics, { description: 'Slot capacity and booking efficiency' })
  capacity: DoctorCapacityMetrics;

  @Field(() => [TopDoctorPerformer], { description: 'Top 10 performing doctors ranked by revenue and activity' })
  top_doctors: TopDoctorPerformer[];
}
