import { InputType, Field, ID } from '@nestjs/graphql';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AuditLogAction } from '../../../common/enum/audit-action.enum';

@InputType()
export class CreateAuditLogDto {
  @Field(() => String)
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  api_name: string;

  @Field(() => String)
  @IsNotEmpty()
  @IsString()
  error: string;

  @Field(() => AuditLogAction, { nullable: true })
  @IsOptional()
  @IsEnum(AuditLogAction)
  action?: AuditLogAction;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  user_id?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  ip_address?: string | null;
}
