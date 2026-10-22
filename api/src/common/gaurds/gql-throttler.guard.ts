import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { Request, Response } from 'express';

interface RequestWithUser extends Request {
  user?: {
    sub?: string;
    id?: string;
    email?: string;
    role?: string;
  };
}

/**
 * GqlThrottlerGuard adapts NestJS ThrottlerGuard to GraphQL context.
 * Resolves request context from Apollo Server and tracks rate limits
 * using authenticated user ID or real client IP address.
 */
@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  protected override getRequestResponse(context: ExecutionContext): {
    req: Record<string, any>;
    res: Record<string, any>;
  } {
    if ((context.getType() as string) === 'graphql') {
      const gqlContext = GqlExecutionContext.create(context);
      const ctx = gqlContext.getContext<{ req?: Request; res?: Response }>();
      const http = context.switchToHttp();
      return {
        req: ctx?.req ?? (http.getRequest() as Record<string, any>),
        res: ctx?.res ?? (http.getResponse() as Record<string, any>),
      };
    }
    return super.getRequestResponse(context);
  }

  protected override async getTracker(
    req: Record<string, any>,
  ): Promise<string> {
    const request = req as RequestWithUser;

    // 1. If user is authenticated, throttle by unique user ID
    const userId = request?.user?.sub ?? request?.user?.id;
    if (userId) {
      return `usr:${userId}`;
    }

    // 2. Otherwise throttle by client IP
    const forwarded = request?.headers?.['x-forwarded-for'];
    const rawIp =
      (typeof forwarded === 'string' ? forwarded.split(',')[0] : null) ||
      request?.ip ||
      request?.socket?.remoteAddress ||
      'anonymous';

    const cleanIp = String(rawIp).trim().replace(/^::ffff:/, '');
    return `ip:${cleanIp}`;
  }

  protected override async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: any,
  ): Promise<void> {
    const timeToWait =
      throttlerLimitDetail?.timeToBlockExpire ||
      throttlerLimitDetail?.timeToExpire ||
      60;

    throw new ThrottlerException(
      `Too many requests. Rate limit exceeded. Please wait ${timeToWait} second(s) before trying again.`,
    );
  }
}
