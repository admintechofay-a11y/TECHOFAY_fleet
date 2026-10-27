/**
 * Vercel Serverless Function Entrypoint
 * Routes all /api/* requests to the Express application.
 */

const app = require('../apps/api/src/app');

module.exports = app;
