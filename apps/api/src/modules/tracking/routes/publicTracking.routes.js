/**
 * Public Consignment Tracking Routes
 * Open to public, rate-limited, no authentication required.
 */

const express = require('express');
const router = express.Router();
const publicTrackingController = require('../controllers/publicTracking.controller');
const { publicTrackingRateLimiter } = require('../../../middleware/rateLimiter');

// Apply dedicated rate limiter to prevent scraping
router.use(publicTrackingRateLimiter);

// 1. Root query lookup: GET /api/v1/public/track?q=LR-2026-0001
router.get('/', publicTrackingController.track);

// 2. Path param lookup: GET /api/v1/public/track/:identifier
router.get('/:identifier', publicTrackingController.track);

module.exports = router;
