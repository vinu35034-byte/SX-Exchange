/**
 * Shared CORS configuration — single source of truth for allowed origins.
 * Used by both Express cors() middleware and Socket.IO.
 */

const buildCorsOrigins = () => {
  const origins = new Set([
    'https://nexabitexchange.pro',
    'https://www.nexabitexchange.pro',
    'http://localhost:5173',
    'http://localhost:5174'
  ]);

  // Add environment-based origins
  if (process.env.CORS_ORIGIN) {
    process.env.CORS_ORIGIN.split(',').forEach(o => origins.add(o.trim()));
  }
  if (process.env.CORS_ORIGIN_DEV) {
    process.env.CORS_ORIGIN_DEV.split(',').forEach(o => origins.add(o.trim()));
  }
  if (process.env.CORS_ORIGIN_PROD) {
    process.env.CORS_ORIGIN_PROD.split(',').forEach(o => origins.add(o.trim()));
  }
  if (process.env.FRONTEND_URL) {
    origins.add(process.env.FRONTEND_URL.trim());
  }
  if (process.env.FRONTEND_URL_PROD) {
    origins.add(process.env.FRONTEND_URL_PROD.trim());
  }

  return Array.from(origins);
};

/**
 * Standard CORS origin validator.
 * Allows requests with no Origin header (server-to-server, curl, health checks).
 * Validates browser-originated requests against the allowed origins list.
 */
const corsOriginValidator = (requestOrigin, callback) => {
  const allowedOrigins = buildCorsOrigins();

  // No Origin header: server-to-server, curl, health checks, monitoring — allow
  if (!requestOrigin) {
    return callback(null, true);
  }

  if (allowedOrigins.includes(requestOrigin)) {
    callback(null, requestOrigin);
  } else {
    console.warn(`⚠️ CORS rejected origin: ${requestOrigin}`);
    callback(new Error('Not allowed by CORS'));
  }
};

module.exports = { buildCorsOrigins, corsOriginValidator };
