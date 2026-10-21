import { ObjectType, Field, Float, Int } from '@nestjs/graphql';

@ObjectType()
export class ConsultationTimeSeriesPoint {
  @Field(() => String)
  date: string;

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  completed: number;

  @Field(() => Int)
  cancelled: number;
}

@ObjectType()
export class ConsultationStatusCount {
  @Field(() => String)
  status: string;

  @Field(() => Int)
  count: number;
}

@ObjectType()
export class ConsultationTypeCount {
  @Field(() => String)
  type: string;

  @Field(() => Int)
  count: number;
}

@ObjectType()
export class PeakBookingHour {
  @Field(() => Int)
  hour: number;

  @Field(() => Int)
  count: number;
}

@ObjectType()
export class ConsultationAnalyticsEntity {
  @Field(() => Int)
  total_consultations: number;

  @Field(() => Float)
  completion_rate: number;

  @Field(() => Float)
  cancellation_rate: number;

  @Field(() => [ConsultationStatusCount])
  consultations_by_status: ConsultationStatusCount[];

  @Field(() => [ConsultationTypeCount])
  consultations_by_type: ConsultationTypeCount[];

  @Field(() => [ConsultationTimeSeriesPoint])
  timeline: ConsultationTimeSeriesPoint[];

  @Field(() => [PeakBookingHour])
  peak_hours: PeakBookingHour[];
}
