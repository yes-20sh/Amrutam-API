import { ObjectType, Field, Float, Int } from '@nestjs/graphql';

@ObjectType()
export class PatientRetentionCohort {
  @Field(() => String)
  cohort: string;

  @Field(() => Int)
  patient_count: number;
}

@ObjectType()
export class PatientGenderCount {
  @Field(() => String)
  gender: string;

  @Field(() => Int)
  count: number;
}

@ObjectType()
export class PatientSignupTrendPoint {
  @Field(() => String)
  date: string;

  @Field(() => Int)
  count: number;
}

@ObjectType()
export class PatientAnalyticsEntity {
  @Field(() => Int)
  total_patients: number;

  @Field(() => Int)
  new_signups_in_period: number;

  @Field(() => Float)
  repeat_consultation_rate: number;

  @Field(() => [PatientRetentionCohort])
  retention_cohorts: PatientRetentionCohort[];

  @Field(() => [PatientGenderCount])
  gender_distribution: PatientGenderCount[];

  @Field(() => [PatientSignupTrendPoint])
  signups_timeline: PatientSignupTrendPoint[];
}
