import { Response, Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { User } from '../../schemas/user.schema';

export function getAuthCookieName(): string {
  return process.env.JWT_COOKIE_NAME || 'jwt_access_token';
}

export function setAuthTokenCookie(
  res: Response,
  user: User,
  jwtService: JwtService,
): string {
  const payload = {
    sub: user.user_id,
    email: user.email,
    role: user.role,
  };

  const token = jwtService.sign(payload);
  const cookieName = getAuthCookieName();
  const cookieMaxAge = Number(process.env.JWT_COOKIE_MAX_AGE) || 86400000 * 7; // 7 days

  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: cookieMaxAge,
  });

  return token;
}

export function clearAuthTokenCookie(res: Response): void {
  const cookieName = getAuthCookieName();
  res.clearCookie(cookieName, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  // Also clear legacy cookie name if present
  res.clearCookie('access_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
}

export function extractTokenFromRequest(req?: Request): string | null {
  if (!req) return null;

  // 1. Authorization header (Bearer <token>)
  const authHeader = req.headers?.authorization || req.headers?.['Authorization'] as string;
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  // 2. Cookie header
  const cookieHeader = req.headers?.cookie;
  if (cookieHeader) {
    const cookieName = getAuthCookieName();
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${cookieName}=([^;]*)`))
      || cookieHeader.match(/(?:^|;\s*)access_token=([^;]*)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
  }

  // 3. req.cookies if cookie-parser is installed
  if ((req as any).cookies) {
    const cookieName = getAuthCookieName();
    const token = (req as any).cookies[cookieName] || (req as any).cookies['access_token'];
    if (token) return token;
  }

  return null;
}
