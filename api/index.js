/**
 * Vercel Serverless Function Bridge for Technofay Fleet Express API
 */

const app = require('../apps/api/src/app');
const db = require('../apps/api/src/config/db');

module.exports = async (req, res) => {
  try {
    // Ensure MongoDB connection is established in serverless lifecycle
    if (!db.isConnected()) {
      await db.connectDatabase();
    }

    // Normalize URL path if Vercel serverless rewrite strips /api
    if (req.url && !req.url.startsWith('/api') && req.url.startsWith('/v1')) {
      req.url = `/api${req.url}`;
    }

    return app(req, res);
  } catch (error) {
    console.error('[VERCEL-SERVERLESS] Database connection or runtime failure:', error);
    return res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Failed to connect to database or process request in serverless environment.',
      error: error.message
    });
  }
};
