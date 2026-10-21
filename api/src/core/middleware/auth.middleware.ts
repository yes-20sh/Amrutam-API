import {
  Injectable,
  NestMiddleware,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request, Response, NextFunction } from 'express';
import { extractTokenFromRequest } from '../../utils/cookie/cookie.util';
import { requestContext } from '../context/request-context';

/**
 * AuthMiddleware extracts and validates JWT access tokens on incoming requests.
 * If a valid token is found, the decoded payload is attached to req.user.
 * Also stores client IP address and authenticated user ID in AsyncLocalStorage request context.
 */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuthMiddleware.name);

  constructor(private readonly jwtService: JwtService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const forwarded = req.headers['x-forwarded-for'];
    const rawIp =
      (typeof forwarded === 'string' ? forwarded.split(',')[0] : null) ||
      req.ip ||
      req.socket?.remoteAddress ||
      null;
    const ipAddress = rawIp ? rawIp.trim().replace(/^::ffff:/, '') : null;

    const token = extractTokenFromRequest(req);
    let userId: string | null = null;

    if (token) {
      try {
        const decoded = this.jwtService.verify<Record<string, unknown>>(token, {
          secret:
            process.env.JWT_SECRET ||
            'super-secret-jwt-key-for-development-change-in-prod',
        });
        (req as any).user = decoded;
        userId = ((decoded as any)?.sub as string) || null;
      } catch {
        this.logger.debug(
          'Token present in request could not be verified by AuthMiddleware',
        );
      }
    }

    requestContext.run({ userId, ipAddress }, () => {
      next();
    });
  }
}
