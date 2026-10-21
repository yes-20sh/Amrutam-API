import { ObjectType, Field, ID } from '@nestjs/graphql';
import { AuditLogAction } from '../../../common/enum/audit-action.enum';

@ObjectType('AuditLog')
export class AuditLogEntity {
  @Field(() => ID)
  audit_id: string;

  @Field(() => String)
  api_name: string;

  @Field(() => String)
  error: string;

  @Field(() => AuditLogAction)
  action: AuditLogAction;

  @Field(() => ID, { nullable: true })
  user_id?: string | null;

  @Field(() => String, { nullable: true })
  ip_address?: string | null;

  @Field(() => Date)
  created_at: Date;
}
