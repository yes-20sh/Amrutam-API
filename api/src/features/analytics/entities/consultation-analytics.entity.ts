import { ObjectType, Field, Float, Int } from '@nestjs/graphql';

@ObjectType({ description: 'Consultation trends grouped by time bucket' })
export class ConsultationTimeSeriesPoint {
  @Field(() => String, { description: 'Date timestamp of the bucket (e.g. YYYY-MM-DD)' })
  date: string;

  @Field(() => Int, { description: 'Total appointments scheduled in this bucket' })
  total: number;

  @Field(() => Int, { description: 'Appointments completed successfully' })
  completed: number;

  @Field(() => Int, { description: 'Appointments cancelled' })
  cancelled: number;
}

@ObjectType({ description: 'Count of consultations grouped by status' })
export class ConsultationStatusCount {
  @Field(() => String, { description: 'Consultation status (e.g. BOOKED, COMPLETED, CANCELLED)' })
  status: string;

  @Field(() => Int, { description: 'Number of consultations' })
  count: number;
}

@ObjectType({ description: 'Count of consultations grouped by delivery mode' })
export class ConsultationTypeCount {
  @Field(() => String, { description: 'Consultation type (ONLINE or IN_PERSON)' })
  type: string;

  @Field(() => Int, { description: 'Number of consultations' })
  count: number;
}

@ObjectType({ description: 'Booking frequency across hours of the day (0-23)' })
export class PeakBookingHour {
  @Field(() => Int, { description: 'Hour of the day in 24h format (0 - 23)' })
  hour: number;

  @Field(() => Int, { description: 'Number of appointments booked at this hour' })
  count: number;
}

@ObjectType({ description: 'Comprehensive consultation and appointment operational analytics' })
export class ConsultationAnalyticsEntity {
  @Field(() => Int, { description: 'Total appointments booked within window' })
  total_consultations: number;

  @Field(() => Float, { description: 'Percentage of booked consultations that were completed' })
  completion_rate: number;

  @Field(() => Float, { description: 'Percentage of booked consultations that were cancelled' })
  cancellation_rate: number;

  @Field(() => [ConsultationStatusCount], { description: 'Distribution across lifecycle statuses' })
  consultations_by_status: ConsultationStatusCount[];

  @Field(() => [ConsultationTypeCount], { description: 'Distribution across online vs in-person modalities' })
  consultations_by_type: ConsultationTypeCount[];

  @Field(() => [ConsultationTimeSeriesPoint], { description: 'Appointment volume and completion trends over time' })
  timeline: ConsultationTimeSeriesPoint[];

  @Field(() => [PeakBookingHour], { description: 'Hourly consultation booking density' })
  peak_hours: PeakBookingHour[];
}
