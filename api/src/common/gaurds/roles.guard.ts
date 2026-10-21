import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';

import { UserRole } from '../enum/user-role.enum';
import { ROLES } from '../decorator/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = this.getRequest(context);
    const user = request?.user;

    if (!user) {
      return false;
    }

    const userRoles: UserRole[] = Array.isArray(user.roles)
      ? user.roles
      : user.UserRole
        ? [user.UserRole]
        : [];

    return requiredRoles.some((UserRole) => userRoles.includes(UserRole));
  }

  private getRequest(context: ExecutionContext): any {
    if ((context.getType() as string) === 'graphql') {
      const gqlContext = GqlExecutionContext.create(context);
      return gqlContext.getContext()?.req;
    }
    return context.switchToHttp().getRequest();
  }
}
