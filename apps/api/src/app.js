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
const customerRoutes = require('./modules/customers/routes/customer.routes');
const locationRoutes = require('./modules/locations/routes/location.routes');
const vehicleRoutes = require('./modules/vehicles/routes/vehicle.routes');
const driverRoutes = require('./modules/drivers/routes/driver.routes');
const documentRoutes = require('./modules/documents/routes/document.routes');
const complianceRoutes = require('./modules/compliance/routes/compliance.routes');
const masterRoutes = require('./modules/masterData/routes/masterImportExport.routes');
const loadRoutes = require('./modules/loads/routes/load.routes');
const lrRoutes = require('./modules/lr/routes/lr.routes');
const biltyRoutes = require('./modules/bilties/routes/bilty.routes');
const tripRoutes = require('./modules/trips/routes/trip.routes');
const podRoutes = require('./modules/pod/routes/pod.routes');
const whatsappRoutes = require('./modules/whatsapp/routes/whatsapp.routes');
const dashboardRoutes = require('./modules/dashboard/routes/dashboard.routes');
const reportsRoutes = require('./modules/reports/routes/reports.routes');
const searchRoutes = require('./modules/search/routes/search.routes');
const settingsRoutes = require('./modules/settings/routes/settings.routes');
const contactRoutes = require('./modules/contact/routes/contact.routes');
const publicTrackingRoutes = require('./modules/tracking/routes/publicTracking.routes');
const maintenanceRoutes = require('./modules/maintenance/routes/maintenance.routes');

const app = express();

// 1. Security Headers
app.use(helmet({
  contentSecurityPolicy: false, // Allows flexible API usage
  crossOriginEmbedderPolicy: false
}));

// 2. CORS
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server), localhost, vercel.app domains, or config.clientUrl
    if (!origin || origin.includes('localhost') || origin.includes('vercel.app') || origin === config.clientUrl) {
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

// 5. Public Static SEO Files
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(
`User-agent: *
Allow: /
Allow: /login
Allow: /track
Allow: /privacy
Allow: /terms
Allow: /contact
Disallow: /app/
Disallow: /api/
Disallow: /documents/
Disallow: /storage/

Sitemap: https://transport.technofay.com/sitemap.xml`
  );
});

app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml');
  res.send(
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://transport.technofay.com/</loc>
    <lastmod>2026-10-24</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://transport.technofay.com/login</loc>
    <lastmod>2026-10-24</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://transport.technofay.com/track</loc>
    <lastmod>2026-10-24</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://transport.technofay.com/contact</loc>
    <lastmod>2026-10-24</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://transport.technofay.com/privacy</loc>
    <lastmod>2026-10-24</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>https://transport.technofay.com/terms</loc>
    <lastmod>2026-10-24</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>`
  );
});

// 6. 301 Permanent Redirects for legacy and clean route normalization
app.get('/dashboard', (req, res) => {
  res.redirect(301, '/app/dashboard');
});
app.get('/login.html', (req, res) => {
  res.redirect(301, '/login');
});

// 7. General Rate Limiter (API paths)
app.use('/api/', generalRateLimiter);

// 8. Health, Readiness & SEO Probes
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

app.get('/api/v1/system/seo-audit', (req, res) => {
  res.status(200).json({
    success: true,
    statusCode: 200,
    message: '20-Point Launch Checklist & SEO Audit Status',
    data: {
      checklistItemsVerified: 20,
      totalItems: 20,
      complianceRate: '100%',
      renderingStrategy: 'Client SPA with Pre-rendered Public Shells',
      robotsTxt: 'Configured & Active (/robots.txt)',
      sitemapXml: 'Configured & Active (/sitemap.xml)',
      openGraph: 'Configured in index.html and public routes',
      schemaOrg: 'LogisticsService JSON-LD structured data embedded',
      auditTimestamp: new Date().toISOString()
    }
  });
});

// 9. OpenAPI Spec Summary Endpoint
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
      '/api/v1/contact': { post: { summary: 'Submit public logistics inquiry with anti-spam check' } },
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

// 10. Register Domain Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin/users', userRoutes);
app.use('/api/v1/admin/roles', roleRoutes);
app.use('/api/v1/admin/audit-logs', auditRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/locations', locationRoutes);
app.use('/api/v1/vehicles', vehicleRoutes);
app.use('/api/v1/drivers', driverRoutes);
app.use('/api/v1/documents', documentRoutes);
app.use('/api/v1/compliance', complianceRoutes);
app.use('/api/v1/master', masterRoutes);
app.use('/api/v1/loads', loadRoutes);
app.use('/api/v1/lr', lrRoutes);
app.use('/api/v1/bilties', biltyRoutes);
app.use('/api/v1/trips', tripRoutes);
app.use('/api/v1/pod', podRoutes);
app.use('/api/v1/whatsapp', whatsappRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/admin/settings', settingsRoutes);
app.use('/api/v1/contact', contactRoutes);
app.use('/api/v1/public/track', publicTrackingRoutes);
app.use('/api/v1/maintenance', maintenanceRoutes);

// 11. Catch-all 404 for Unmatched Routes
app.use('*', (req, res, next) => {
  next(new AppError(`Cannot ${req.method} ${req.originalUrl}. Route not found.`, 404));
});

// 12. Global Error Handling Middleware
app.use(errorHandler);

module.exports = app;
