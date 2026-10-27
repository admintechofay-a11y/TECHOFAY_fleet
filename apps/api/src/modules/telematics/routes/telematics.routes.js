/**
 * Telematics Routes
 * Mounted at /api/v1/telematics
 */

const express = require('express');
const TelematicsController = require('../controllers/telematics.controller');
const { authenticate, enforceTenantScope } = require('../../../middleware/auth.middleware');

const router = express.Router();

// Hardware Status (Honest provider availability report)
router.get('/status', TelematicsController.getStatus);

// Telemetry Ping Ingestion (Hardware Gateway / Webhook)
router.post('/ping', TelematicsController.ingestPing);

// Tenant-Scoped Vehicle Location Resolution
router.get(
  '/vehicles/:id/location',
  authenticate,
  enforceTenantScope,
  TelematicsController.getVehicleLocation
);

module.exports = router;
