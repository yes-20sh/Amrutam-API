import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

function getRequest(context: ExecutionContext): any {
  if ((context.getType() as string) === 'graphql') {
    const gqlContext = GqlExecutionContext.create(context);
    return gqlContext.getContext()?.req;
  }
  return context.switchToHttp().getRequest();
}

/**
 * Injects the authenticated user's ID (user.sub) directly as a string.
 * Automatically throws UnauthorizedException if the user is missing.
 */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const req = getRequest(context);
    const userId = req?.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'Authentication credentials were not provided',
      );
    }

    return userId;
  },
);

/**
 * Injects the authenticated user payload (JwtPayload) or a specific property of it.
 * Automatically throws UnauthorizedException if the user is missing.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, context: ExecutionContext) => {
    const req = getRequest(context);
    const user = req?.user;

    if (!user?.sub) {
      throw new UnauthorizedException(
        'Authentication credentials were not provided',
      );
    }

    return data ? user[data] : user;
  },
);

/**
 * Injects user payload if available, or null for @Public() routes.
 */
export const OptionalUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, context: ExecutionContext) => {
    const req = getRequest(context);
    const user = req?.user;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);

