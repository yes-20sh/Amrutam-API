import { ObjectType, Field, Float, Int } from '@nestjs/graphql';

@ObjectType()
export class RevenueTimeSeriesPoint {
  @Field(() => String)
  date: string;

  @Field(() => Float)
  revenue: number;

  @Field(() => Int)
  transaction_count: number;
}

@ObjectType()
export class RevenueByStatus {
  @Field(() => String)
  status: string;

  @Field(() => Float)
  amount: number;

  @Field(() => Int)
  count: number;
}

@ObjectType()
export class RevenueByPaymentMethod {
  @Field(() => String)
  payment_method: string;

  @Field(() => Float)
  amount: number;

  @Field(() => Int)
  count: number;
}

@ObjectType()
export class RevenueAnalyticsEntity {
  @Field(() => Float)
  total_revenue: number;

  @Field(() => Int)
  total_transactions: number;

  @Field(() => Float)
  average_transaction_value: number;

  @Field(() => [RevenueByStatus])
  revenue_by_status: RevenueByStatus[];

  @Field(() => [RevenueByPaymentMethod])
  revenue_by_payment_method: RevenueByPaymentMethod[];

  @Field(() => [RevenueTimeSeriesPoint])
  timeline: RevenueTimeSeriesPoint[];
}
