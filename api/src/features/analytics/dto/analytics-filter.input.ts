import { InputType, Field } from '@nestjs/graphql';
import { IsDate, IsEnum, IsOptional } from 'class-validator';
import { TimeGranularity } from './time-granularity.enum';

@InputType()
export class AnalyticsFilterInput {
  @Field(() => Date, { nullable: true })
  @IsOptional()
  @IsDate()
  startDate?: Date;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  @IsDate()
  endDate?: Date;

  @Field(() => TimeGranularity, {
    nullable: true,
    defaultValue: TimeGranularity.DAY,
  })
  @IsOptional()
  @IsEnum(TimeGranularity)
  granularity?: TimeGranularity = TimeGranularity.DAY;
}
