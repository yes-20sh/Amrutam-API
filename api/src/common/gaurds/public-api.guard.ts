import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorator/public.decorator';
import { extractTokenFromRequest } from '../../utils/cookie/cookie.util';

/**
 * PublicApiGuard protects all endpoints by default unless explicitly
 * marked with the @Public() decorator. For non-public routes, it validates
 * the JWT token from the Authorization header or authentication cookies.
 */
@Injectable()
export class PublicApiGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) { }

  canActivate(context: ExecutionContext): boolean {
    // Allow routes marked with @Public() to bypass auth
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = this.getRequest(context);
    const token = extractTokenFromRequest(request);

    if (!token) {
      throw new UnauthorizedException(
        'Your session has expired or you are not authenticated. Please log in and try again.',
      );
    }

    try {
      const decoded = this.jwtService.verify(token, {
        secret:
          process.env.JWT_SECRET ||
          'super-secret-jwt-key-for-development-change-in-prod',
      });
      (request as any).user = decoded;
    } catch {
      throw new UnauthorizedException(
        'Authentication token is invalid or has expired',
      );
    }

    return true;
  }

  /**
   * Extracts the underlying HTTP request from the ExecutionContext.
   * Supports both HTTP and GraphQL contexts.
   */
  private getRequest(context: ExecutionContext): Request {
    if ((context.getType() as string) === 'graphql') {
      const gqlContext = GqlExecutionContext.create(context);
      return gqlContext.getContext()?.req;
    }
    return context.switchToHttp().getRequest();
  }
}
