import helmet from 'helmet';

/**
 * Creates and configures enterprise Helmet security middleware.
 * 
 * Includes:
 * - Environment-aware Content Security Policy (strict in production, permissive for Apollo Sandbox in dev)
 * - Cross-Origin Resource & Opener Policies
 * - HSTS (HTTP Strict Transport Security) in production
 * - Frameguard (clickjacking mitigation)
 * - MIME-sniffing prevention (nosniff)
 * - DNS prefetch control
 * - Server fingerprint removal (hides X-Powered-By)
 */
export const helmetMiddleware = () => {
  const isProduction = process.env.NODE_ENV === 'production';

  return helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    contentSecurityPolicy: isProduction
      ? {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", 'https:', 'data:'],
          objectSrc: ["'none'"],
          frameSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      }
      : false, // In development, allow Apollo GraphQL Sandbox assets to load cleanly
    hsts: isProduction
      ? {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      }
      : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    noSniff: true,
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
  });
};
