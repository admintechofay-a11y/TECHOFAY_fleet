/**
 * Dashboard Routes
 * Mounted at /api/v1/dashboard
 */

const express = require('express');
const DashboardController = require('../controllers/dashboard.controller');
const { authenticate, enforceTenantScope } = require('../../../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate, enforceTenantScope);

router.get('/metrics', DashboardController.getMetrics);
router.get('/trends', DashboardController.getTrends);
router.get('/alerts', DashboardController.getAlerts);

module.exports = router;
