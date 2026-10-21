import { ObjectType, Field, Float, Int } from '@nestjs/graphql';

@ObjectType({ description: 'Data point representing revenue aggregated by time bucket' })
export class RevenueTimeSeriesPoint {
  @Field(() => String, { description: 'Date timestamp of the bucket (e.g. YYYY-MM-DD)' })
  date: string;

  @Field(() => Float, { description: 'Settled revenue in this bucket' })
  revenue: number;

  @Field(() => Int, { description: 'Count of successful transactions in this bucket' })
  transaction_count: number;
}

@ObjectType({ description: 'Revenue and count aggregated by payment status' })
export class RevenueByStatus {
  @Field(() => String, { description: 'Payment status (e.g. PAID, PENDING, REFUNDED, FAILED)' })
  status: string;

  @Field(() => Float, { description: 'Total monetary value' })
  amount: number;

  @Field(() => Int, { description: 'Total transaction count' })
  count: number;
}

@ObjectType({ description: 'Revenue and count aggregated by payment method' })
export class RevenueByPaymentMethod {
  @Field(() => String, { description: 'Payment gateway method (e.g. UPI, CARD, NETBANKING)' })
  payment_method: string;

  @Field(() => Float, { description: 'Total volume processed' })
  amount: number;

  @Field(() => Int, { description: 'Number of transactions' })
  count: number;
}

@ObjectType({ description: 'Detailed financial and revenue analytics' })
export class RevenueAnalyticsEntity {
  @Field(() => Float, { description: 'Total successful revenue collected in window' })
  total_revenue: number;

  @Field(() => Int, { description: 'Total successful transactions' })
  total_transactions: number;

  @Field(() => Float, { description: 'Average monetary value per transaction' })
  average_transaction_value: number;

  @Field(() => [RevenueByStatus], { description: 'Monetary volume and count by transaction status' })
  revenue_by_status: RevenueByStatus[];

  @Field(() => [RevenueByPaymentMethod], { description: 'Monetary volume and count by payment method' })
  revenue_by_payment_method: RevenueByPaymentMethod[];

  @Field(() => [RevenueTimeSeriesPoint], { description: 'Time series of revenue trends over the selected period' })
  timeline: RevenueTimeSeriesPoint[];
}
