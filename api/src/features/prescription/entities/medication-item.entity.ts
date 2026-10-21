import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType('MedicationItem')
export class MedicationItemEntity {
  @Field(() => String)
  medicine_name: string;

  @Field(() => String)
  dosage: string;

  @Field(() => String)
  frequency: string;

  @Field(() => String)
  duration: string;

  @Field(() => String, { nullable: true })
  instructions?: string | null;
}
