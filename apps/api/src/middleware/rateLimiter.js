/**
 * Sliding Window In-Memory Rate Limiter & Brute-Force Guard
 */

const { AppError } = require('./errorHandler');

class SlidingWindowLimiter {
  constructor(windowMs, maxRequests, keyPrefix = 'rate') {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.keyPrefix = keyPrefix;
    this.hits = new Map();

    // Auto-cleanup stale keys every 5 minutes
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, timestamps] of this.hits.entries()) {
        const valid = timestamps.filter((t) => now - t < this.windowMs);
        if (valid.length === 0) {
          this.hits.delete(key);
        } else {
          this.hits.set(key, valid);
        }
      }
    }, 5 * 60 * 1000);

    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  isAllowed(key) {
    const now = Date.now();
    const timestamps = this.hits.get(key) || [];
    const valid = timestamps.filter((t) => now - t < this.windowMs);

    if (valid.length >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: Math.ceil((valid[0] + this.windowMs - now) / 1000)
      };
    }

    valid.push(now);
    this.hits.set(key, valid);

    return {
      allowed: true,
      remaining: this.maxRequests - valid.length,
      resetTime: Math.ceil(this.windowMs / 1000)
    };
  }

  reset(key) {
    this.hits.delete(key);
  }
}

// 1. General API Limiter (100 req per 15m)
const generalLimiterInstance = new SlidingWindowLimiter(15 * 60 * 1000, 100, 'gen');

// 2. Auth / Login Brute Force Limiter (5 attempts per 15m)
const authLimiterInstance = new SlidingWindowLimiter(15 * 60 * 1000, 5, 'auth');

function generalRateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
  const result = generalLimiterInstance.isAllowed(ip);

  res.setHeader('X-RateLimit-Limit', generalLimiterInstance.maxRequests);
  res.setHeader('X-RateLimit-Remaining', result.remaining);

  if (!result.allowed) {
    res.setHeader('Retry-After', result.resetTime);
    return next(new AppError(`Too many requests. Please retry in ${result.resetTime} seconds.`, 429));
  }

  next();
}

function authRateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
  const email = (req.body && req.body.email) ? req.body.email.toLowerCase().trim() : '';
  const key = `${ip}_${email}`;

  const result = authLimiterInstance.isAllowed(key);

  res.setHeader('X-Auth-RateLimit-Limit', authLimiterInstance.maxRequests);
  res.setHeader('X-Auth-RateLimit-Remaining', result.remaining);

  if (!result.allowed) {
    res.setHeader('Retry-After', result.resetTime);
    return next(new AppError(`Too many failed login attempts. Account temporarily locked. Please retry in ${result.resetTime} seconds.`, 429));
  }

  next();
}

// 3. Public Tracking Lookup Limiter (30 lookups per minute per IP)
const trackingLimiterInstance = new SlidingWindowLimiter(60 * 1000, 30, 'track');

function publicTrackingRateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
  const result = trackingLimiterInstance.isAllowed(ip);

  res.setHeader('X-Tracking-RateLimit-Limit', trackingLimiterInstance.maxRequests);
  res.setHeader('X-Tracking-RateLimit-Remaining', result.remaining);

  if (!result.allowed) {
    res.setHeader('Retry-After', result.resetTime);
    return next(new AppError(`Too many tracking lookup requests. Please retry in ${result.resetTime} seconds.`, 429));
  }

  next();
}

// 4. WhatsApp Dispatch Rate Limiter (60 dispatches per minute per tenant/IP)
const whatsappLimiterInstance = new SlidingWindowLimiter(60 * 1000, 60, 'wa_send');

function whatsappRateLimiter(req, res, next) {
  const tenantId = req.tenant?.companyId ? req.tenant.companyId.toString() : (req.ip || '127.0.0.1');
  const result = whatsappLimiterInstance.isAllowed(tenantId);

  res.setHeader('X-WhatsApp-RateLimit-Limit', whatsappLimiterInstance.maxRequests);
  res.setHeader('X-WhatsApp-RateLimit-Remaining', result.remaining);

  if (!result.allowed) {
    res.setHeader('Retry-After', result.resetTime);
    return next(new AppError(`WhatsApp outbound message rate limit exceeded. Please wait ${result.resetTime} seconds.`, 429));
  }

  next();
}

module.exports = {
  generalRateLimiter,
  authRateLimiter,
  authLimiterInstance,
  publicTrackingRateLimiter,
  trackingLimiterInstance,
  whatsappRateLimiter,
  whatsappLimiterInstance
};
