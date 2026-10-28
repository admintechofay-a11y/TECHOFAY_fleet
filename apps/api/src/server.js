/**
 * Server Entry Point
 */

const app = require('./app');
const config = require('./config/env');
const db = require('./config/db');
const BootstrapService = require('./modules/auth/services/bootstrap.service');

async function startServer() {
  try {
    console.log(`[BOOT] Initializing Fleet & Transport API (${config.env})...`);

    // 0. Validate Production Secrets (safe fallback)
    config.validateConfig();

    // 1. Start Listening IMMEDIATELY so Vercel / serverless never gets connection refused
    const port = parseInt(process.env.PORT || config.port || 5000, 10);
    const host = process.env.HOST || '0.0.0.0';

    const server = app.listen(port, host, () => {
      console.log(`🚀 Fleet API is listening on http://${host}:${port}`);
      console.log(`📖 Health Check: http://${host}:${port}/api/v1/health`);
      console.log(`📖 OpenAPI Docs: http://${host}:${port}/api/v1/docs`);
    });

    // 2. Connect to Database asynchronously without blocking server readiness
    db.connectDatabase()
      .then(async () => {
        console.log('[DB] Database connected successfully.');
        try {
          await BootstrapService.bootstrapSystem({
            companyLegalName: 'Techofay Global Logistics Pvt Ltd',
            companyGstin: '24AAACT1234A1Z5',
            adminEmail: process.env.BOOTSTRAP_ADMIN_EMAIL || (config.env === 'production' ? null : 'admin@technofay.com'),
            adminPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD || (config.env === 'production' ? null : 'fleet2026_SecureAdmin!'),
            adminName: 'Lead System Administrator'
          });
        } catch (bootstrapErr) {
          console.warn('[BOOTSTRAP] System bootstrap note:', bootstrapErr.message);
        }
      })
      .catch((dbErr) => {
        console.warn('[DB-WARN] Initial MongoDB connection not available:', dbErr.message);
        console.warn('[DB-WARN] API server running in resilient fallback mode for health, auth, and dashboard.');
      });

    // Graceful Shutdown
    const handleShutdown = async (signal) => {
      console.log(`\n[SHUTDOWN] Received ${signal}. Gracefully stopping server...`);
      server.close(async () => {
        await db.disconnectDatabase();
        console.log('[SHUTDOWN] Server closed gracefully.');
        process.exit(0);
      });

      // Force close if graceful timeout exceeded
      setTimeout(() => {
        console.error('[SHUTDOWN] Forcefully shutting down after timeout.');
        process.exit(1);
      }, 5000).unref();
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));

    return server;
  } catch (error) {
    console.error('[FATAL] Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();

module.exports = app;
module.exports.startServer = startServer;
