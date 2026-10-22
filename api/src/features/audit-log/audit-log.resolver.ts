import { Resolver, Query, Mutation, Args, ID, Int } from '@nestjs/graphql';

import { AuditLogService } from './audit-log.service';
import { Roles } from '../../common/decorator/roles.decorator';
import { UserRole } from '../../common/enum/user-role.enum';
import { AuditLogAction } from '../../common/enum/audit-action.enum';
import { AuditLogEntity } from './entities/audit-log.entity';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { ThrottleHeavy } from '../../common/decorator/throttle.decorator';

@ThrottleHeavy()
@Resolver(() => AuditLogEntity)
export class AuditLogResolver {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Roles(UserRole.ADMIN)
  @Mutation(() => String)
  async recordAuditLog(
    @Args('input') input: CreateAuditLogDto,
  ): Promise<string> {
    await this.auditLogService.recordLog({
      api_name: input.api_name,
      error: input.error,
      action: input.action,
      user_id: input.user_id,
      ip_address: input.ip_address,
    });
    return 'Audit log recorded successfully';
  }

  @Roles(UserRole.ADMIN)
  @Mutation(() => String)
  async updateAuditLogAction(
    @Args('auditId', { type: () => ID }) auditId: string,
    @Args('action', { type: () => AuditLogAction }) action: AuditLogAction,
  ): Promise<string> {
    return this.auditLogService.updateAction(auditId, action);
  }

  @Roles(UserRole.ADMIN)
  @Query(() => [AuditLogEntity])
  async getAuditLogs(
    @Args('action', { type: () => AuditLogAction, nullable: true })
    action?: AuditLogAction,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('offset', { type: () => Int, nullable: true }) offset?: number,
  ): Promise<AuditLogEntity[]> {
    return this.auditLogService.getAuditLogs(action, limit, offset);
  }

  @Roles(UserRole.ADMIN)
  @Query(() => AuditLogEntity)
  async getAuditLogById(
    @Args('auditId', { type: () => ID }) auditId: string,
  ): Promise<AuditLogEntity> {
    return this.auditLogService.getAuditLogById(auditId);
  }

  @Roles(UserRole.ADMIN)
  @Query(() => [AuditLogEntity])
  async getAuditLogsByApi(
    @Args('apiName', { type: () => String }) apiName: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('offset', { type: () => Int, nullable: true }) offset?: number,
  ): Promise<AuditLogEntity[]> {
    return this.auditLogService.getAuditLogsByApi(apiName, limit, offset);
  }

  @Roles(UserRole.ADMIN)
  @Query(() => [AuditLogEntity])
  async getAuditLogsByUser(
    @Args('userId', { type: () => ID }) userId: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('offset', { type: () => Int, nullable: true }) offset?: number,
  ): Promise<AuditLogEntity[]> {
    return this.auditLogService.getAuditLogsByUser(userId, limit, offset);
  }
}
