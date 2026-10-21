import { ObjectType, Field, Float, Int } from '@nestjs/graphql';

@ObjectType()
export class TopDiagnosisCount {
  @Field(() => String)
  diagnosis: string;

  @Field(() => Int)
  count: number;
}

@ObjectType()
export class ErrorActionCount {
  @Field(() => String)
  action: string;

  @Field(() => Int)
  count: number;
}

@ObjectType()
export class TopFailingApi {
  @Field(() => String)
  api_name: string;

  @Field(() => Int)
  error_count: number;
}

@ObjectType()
export class ErrorTimeSeriesPoint {
  @Field(() => String)
  date: string;

  @Field(() => Int)
  count: number;
}

@ObjectType()
export class ClinicalAndSystemAnalyticsEntity {
  @Field(() => Int)
  total_prescriptions: number;

  @Field(() => Float)
  prescription_issuance_rate: number;

  @Field(() => [TopDiagnosisCount])
  top_diagnoses: TopDiagnosisCount[];

  @Field(() => Int)
  total_system_errors: number;

  @Field(() => [ErrorActionCount])
  errors_by_action: ErrorActionCount[];

  @Field(() => [TopFailingApi])
  top_failing_apis: TopFailingApi[];

  @Field(() => [ErrorTimeSeriesPoint])
  errors_timeline: ErrorTimeSeriesPoint[];
}
