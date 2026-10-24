/**
 * Express Application Setup
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const config = require('./config/env');
const db = require('./config/db');
const correlationIdMiddleware = require('./middleware/correlationId');
const { generalRateLimiter } = require('./middleware/rateLimiter');
const { errorHandler, AppError } = require('./middleware/errorHandler');

// Route Modules
const authRoutes = require('./modules/auth/routes/auth.routes');
const userRoutes = require('./modules/users/routes/user.routes');
const roleRoutes = require('./modules/roles/routes/role.routes');
const auditRoutes = require('./modules/audit/routes/audit.routes');

const app = express();

// 1. Security Headers
app.use(helmet({
  contentSecurityPolicy: false, // Allows flexible API usage
  crossOriginEmbedderPolicy: false
}));

// 2. CORS
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server) or localhost
    if (!origin || origin.includes('localhost') || origin === config.clientUrl) {
      return callback(null, true);
    }
    callback(new Error('Blocked by CORS policy'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID', 'X-Requested-With']
}));

// 3. Body Parsing & Cookies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(config.cookieSecret));

// 4. Request Correlation ID
app.use(correlationIdMiddleware);

// 5. General Rate Limiter
app.use('/api/', generalRateLimiter);

// 6. Health & Readiness Probes
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    success: true,
    statusCode: 200,
    message: 'Fleet Management API service is operational',
    data: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: config.env,
      version: '1.0.0'
    }
  });
});

app.get('/api/v1/ready', (req, res) => {
  const isDbReady = db.isConnected();
  if (!isDbReady) {
    return res.status(503).json({
      success: false,
      statusCode: 503,
      error: 'Service Unavailable',
      message: 'Database connection is not ready'
    });
  }

  res.status(200).json({
    success: true,
    statusCode: 200,
    message: 'System is ready to receive requests',
    data: {
      database: 'connected'
    }
  });
});

// 7. OpenAPI Spec Summary Endpoint
app.get('/api/v1/docs', (req, res) => {
  res.status(200).json({
    openapi: '3.0.3',
    info: {
      title: 'Technofay Fleet & Transport Management Platform API',
      version: '1.0.0',
      description: 'Production MERN Transport Operations & Fleet API'
    },
    paths: {
      '/api/v1/auth/login': { post: { summary: 'User login with rate limiting & JWT session' } },
      '/api/v1/auth/refresh': { post: { summary: 'Rotate refresh token' } },
      '/api/v1/auth/logout': { post: { summary: 'Invalidate active session' } },
      '/api/v1/auth/me': { get: { summary: 'Retrieve current profile & permissions' } },
      '/api/v1/admin/users': {
        get: { summary: 'List tenant users' },
        post: { summary: 'Provision new tenant user' }
      },
      '/api/v1/admin/roles': {
        get: { summary: 'List role definitions' },
        post: { summary: 'Create custom role' }
      },
      '/api/v1/admin/audit-logs': { get: { summary: 'Query immutable operational audit trail' } }
    }
  });
});

// 8. Register Domain Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin/users', userRoutes);
app.use('/api/v1/admin/roles', roleRoutes);
app.use('/api/v1/admin/audit-logs', auditRoutes);

// 9. Catch-all 404 for Unmatched Routes
app.use('*', (req, res, next) => {
  next(new AppError(`Cannot ${req.method} ${req.originalUrl}. Route not found.`, 404));
});

// 10. Global Error Handling Middleware
app.use(errorHandler);

module.exports = app;
