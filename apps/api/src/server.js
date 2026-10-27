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

    // 0. Validate Production Secrets
    config.validateConfig();

    // 1. Connect to Database
    await db.connectDatabase();

    // 2. Bootstrap System Roles & Organization
    await BootstrapService.bootstrapSystem({
      companyLegalName: 'Techofay Global Logistics Pvt Ltd',
      companyGstin: '24AAACT1234A1Z5',
      adminEmail: process.env.BOOTSTRAP_ADMIN_EMAIL || (config.env === 'production' ? null : 'admin@technofay.com'),
      adminPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD || (config.env === 'production' ? null : 'fleet2026_SecureAdmin!'),
      adminName: 'Lead System Administrator'
    });

    // 3. Start Listening
    const server = app.listen(config.port, config.host, () => {
      console.log(`🚀 Fleet API is listening on http://${config.host}:${config.port}`);
      console.log(`📖 Health Check: http://${config.host}:${config.port}/api/v1/health`);
      console.log(`📖 OpenAPI Docs: http://${config.host}:${config.port}/api/v1/docs`);
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

if (require.main === module) {
  startServer();
}

module.exports = app;
module.exports.startServer = startServer;
