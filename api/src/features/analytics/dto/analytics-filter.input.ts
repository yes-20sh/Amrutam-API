import { InputType, Field } from '@nestjs/graphql';
import { IsDate, IsEnum, IsOptional } from 'class-validator';
import { TimeGranularity } from './time-granularity.enum';

@InputType({ description: 'Filter parameters for analytics queries' })
export class AnalyticsFilterInput {
  @Field(() => Date, { nullable: true, description: 'Start date of the reporting window (defaults to 30 days ago)' })
  @IsOptional()
  @IsDate()
  startDate?: Date;

  @Field(() => Date, { nullable: true, description: 'End date of the reporting window (defaults to current timestamp)' })
  @IsOptional()
  @IsDate()
  endDate?: Date;

  @Field(() => TimeGranularity, {
    nullable: true,
    defaultValue: TimeGranularity.DAY,
    description: 'Time bucket granularity for series data (DAY, WEEK, MONTH)',
  })
  @IsOptional()
  @IsEnum(TimeGranularity)
  granularity?: TimeGranularity = TimeGranularity.DAY;
}
