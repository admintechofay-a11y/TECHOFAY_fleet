/**
 * Environment Configuration & Validation
 */

const dotenv = require('dotenv');
const path = require('node:path');

// Load .env from project root or apps/api
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  host: process.env.HOST || '0.0.0.0',
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fleet_transport_dev',
  jwtSecret: process.env.JWT_SECRET || 'dev_jwt_secret_min_32_characters_for_transport_platform',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_min_32_characters_transport',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  cookieSecret: process.env.COOKIE_SECRET || 'dev_cookie_secret_key_fleet_transport',
  cookieSecure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
  cookieSameSite: process.env.COOKIE_SAME_SITE || 'lax',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  authRateLimitMaxRequests: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || '5', 10),
  defaultTimezone: process.env.DEFAULT_TIMEZONE || 'Asia/Kolkata',
  defaultCurrency: process.env.DEFAULT_CURRENCY || 'INR'
};

module.exports = config;
