/**
 * Correlation ID Middleware
 * Assigns or propagates a unique ID across the request lifecycle for audit & log tracing.
 */

const crypto = require('node:crypto');

function correlationIdMiddleware(req, res, next) {
  const incomingId = req.headers['x-correlation-id'] || req.headers['x-request-id'];
  const correlationId = incomingId || `req_${crypto.randomUUID()}`;

  req.id = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  next();
}

module.exports = correlationIdMiddleware;
