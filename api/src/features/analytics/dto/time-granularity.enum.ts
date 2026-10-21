import { registerEnumType } from '@nestjs/graphql';

export enum TimeGranularity {
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
}

registerEnumType(TimeGranularity, {
  name: 'TimeGranularity',
});
