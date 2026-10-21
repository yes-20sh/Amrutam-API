import { ObjectType, Field, Float, Int } from '@nestjs/graphql';

@ObjectType({ description: 'Patient segmentation by consultation repeat booking frequency' })
export class PatientRetentionCohort {
  @Field(() => String, { description: 'Cohort label (e.g. 1 Consultation, 2-3 Consultations, 4+ Consultations)' })
  cohort: string;

  @Field(() => Int, { description: 'Number of distinct patients in this cohort' })
  patient_count: number;
}

@ObjectType({ description: 'Patient distribution across reported genders' })
export class PatientGenderCount {
  @Field(() => String, { description: 'Gender label (MALE, FEMALE, OTHER, NOT_SPECIFIED)' })
  gender: string;

  @Field(() => Int, { description: 'Number of patients' })
  count: number;
}

@ObjectType({ description: 'New patient signups over time' })
export class PatientSignupTrendPoint {
  @Field(() => String, { description: 'Date timestamp of the bucket' })
  date: string;

  @Field(() => Int, { description: 'New patient accounts registered' })
  count: number;
}

@ObjectType({ description: 'Patient growth, demographics, and retention intelligence' })
export class PatientAnalyticsEntity {
  @Field(() => Int, { description: 'Total patients registered on the platform' })
  total_patients: number;

  @Field(() => Int, { description: 'New patients registered within the reporting window' })
  new_signups_in_period: number;

  @Field(() => Float, { description: 'Percentage of patients who booked more than 1 consultation' })
  repeat_consultation_rate: number;

  @Field(() => [PatientRetentionCohort], { description: 'Repeat engagement frequency cohorts' })
  retention_cohorts: PatientRetentionCohort[];

  @Field(() => [PatientGenderCount], { description: 'Demographic breakdown by gender' })
  gender_distribution: PatientGenderCount[];

  @Field(() => [PatientSignupTrendPoint], { description: 'Registration volume timeline' })
  signups_timeline: PatientSignupTrendPoint[];
}
