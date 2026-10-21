import {
  Injectable,
  NestMiddleware,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request, Response, NextFunction } from 'express';
import { extractTokenFromRequest } from '../../utils/cookie/cookie.util';

/**
 * AuthMiddleware extracts and validates JWT access tokens on incoming requests.
 * If a valid token is found, the decoded payload is attached to req.user.
 */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuthMiddleware.name);

  constructor(private readonly jwtService: JwtService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const token = extractTokenFromRequest(req);

    if (!token) {
      return next();
    }

    try {
      const decoded = this.jwtService.verify<Record<string, unknown>>(token, {
        secret:
          process.env.JWT_SECRET ||
          'super-secret-jwt-key-for-development-change-in-prod',
      });
      (req as any).user = decoded;
    } catch {
      this.logger.debug('Token present in request could not be verified by AuthMiddleware');
    }

    next();
  }
}
