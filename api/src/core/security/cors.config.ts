import cors, { CorsOptions } from 'cors';

/**
 * Creates and configures CORS middleware for the Amrutam Telemedicine API.
 * 
 * Features:
 * - Dynamic origin resolution (supports comma-separated CORS_ORIGIN in production)
 * - Safe localhost and Apollo GraphQL Studio fallback in development
 * - Strict credentials (cookies) support for JWT authentication
 * - Preflight caching (maxAge: 86400)
 * - Apollo GraphQL Sandbox preflight headers support
 */
export const corsMiddleware = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const configuredOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

  const defaultDevOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:8000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'https://studio.apollographql.com',
  ];

  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      if (!isProduction) {
        // In development, allow default frontend ports and Apollo Studio
        if (defaultDevOrigins.includes(origin) || origin.startsWith('http://localhost:')) {
          return callback(null, true);
        }
      }

      if (configuredOrigins.length > 0) {
        if (configuredOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} not allowed by CORS policy`));
      }

      // Default fallback when CORS_ORIGIN is not set
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'Apollo-Require-Preflight',
      'x-apollo-operation-name',
      'baggage',
      'sentry-trace',
      'traceparent',
    ],
    exposedHeaders: ['Set-Cookie', 'Authorization'],
    maxAge: 86400, // 24 hours preflight cache
  };

  return cors(corsOptions);
};
