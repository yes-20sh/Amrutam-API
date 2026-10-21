import { ObjectType, Field, Float, Int } from '@nestjs/graphql';

@ObjectType({ description: 'Most frequently recorded clinical diagnosis' })
export class TopDiagnosisCount {
  @Field(() => String, { description: 'Diagnosis or medical condition summary' })
  diagnosis: string;

  @Field(() => Int, { description: 'Count of prescriptions with this diagnosis' })
  count: number;
}

@ObjectType({ description: 'Audit log errors aggregated by status/action' })
export class ErrorActionCount {
  @Field(() => String, { description: 'Audit action status (PENDING, PROCESS, FIXED)' })
  action: string;

  @Field(() => Int, { description: 'Number of audit error logs' })
  count: number;
}

@ObjectType({ description: 'API endpoint with highest frequency of recorded failures' })
export class TopFailingApi {
  @Field(() => String, { description: 'Context message or API name (e.g. Service.method)' })
  api_name: string;

  @Field(() => Int, { description: 'Total recorded errors' })
  error_count: number;
}

@ObjectType({ description: 'System error frequency over time' })
export class ErrorTimeSeriesPoint {
  @Field(() => String, { description: 'Date timestamp of the bucket' })
  date: string;

  @Field(() => Int, { description: 'Number of errors logged' })
  count: number;
}

@ObjectType({ description: 'Clinical prescription insights and system reliability / error metrics' })
export class ClinicalAndSystemAnalyticsEntity {
  @Field(() => Int, { description: 'Total digital prescriptions issued' })
  total_prescriptions: number;

  @Field(() => Float, { description: 'Percentage of completed consultations that received a digital prescription' })
  prescription_issuance_rate: number;

  @Field(() => [TopDiagnosisCount], { description: 'Top clinical diagnoses issued by doctors' })
  top_diagnoses: TopDiagnosisCount[];

  @Field(() => Int, { description: 'Total unhandled or service errors recorded in audit log' })
  total_system_errors: number;

  @Field(() => [ErrorActionCount], { description: 'Breakdown of audit logs by resolution action' })
  errors_by_action: ErrorActionCount[];

  @Field(() => [TopFailingApi], { description: 'Top 5 failing services/APIs by error volume' })
  top_failing_apis: TopFailingApi[];

  @Field(() => [ErrorTimeSeriesPoint], { description: 'System error incident rate over time' })
  errors_timeline: ErrorTimeSeriesPoint[];
}
