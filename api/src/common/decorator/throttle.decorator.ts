import { Throttle, SkipThrottle } from '@nestjs/throttler';

/**
 * ThrottleAuth: Strict rate limit for authentication & brute-force sensitive endpoints.
 * 5 requests per 15 minutes (900,000 ms).
 */
export const ThrottleAuth = () =>
  Throttle({ default: { limit: 5, ttl: 900000 } });

/**
 * ThrottleSecurity: Stricter rate limit for 2FA / MFA and account security actions.
 * 5 requests per 10 minutes (600,000 ms).
 */
export const ThrottleSecurity = () =>
  Throttle({ default: { limit: 5, ttl: 600000 } });

/**
 * ThrottleTransactional: Rate limit for booking consultations, payments, and refunds.
 * 10 requests per 1 minute (60,000 ms).
 */
export const ThrottleTransactional = () =>
  Throttle({ default: { limit: 10, ttl: 60000 } });

/**
 * ThrottleMutations: Standard rate limit for state-changing CRUD operations.
 * 20 requests per 1 minute (60,000 ms).
 */
export const ThrottleMutations = () =>
  Throttle({ default: { limit: 20, ttl: 60000 } });

/**
 * ThrottleHeavy: Rate limit for intensive analytics & audit log queries.
 * 30 requests per 1 minute (60,000 ms).
 */
export const ThrottleHeavy = () =>
  Throttle({ default: { limit: 30, ttl: 60000 } });

export { SkipThrottle, Throttle };
