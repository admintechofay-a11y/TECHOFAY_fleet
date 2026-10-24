/**
 * Fleet Vehicle Maintenance Routes
 */

const express = require('express');
const maintenanceController = require('../controllers/maintenance.controller');
const { authenticate, enforceTenantScope } = require('../../../middleware/auth.middleware');
const { requirePermission } = require('../../../middleware/rbac.middleware');
const { SystemModule, ActionPermission } = require('@fleet/shared');

const router = express.Router();

router.use(authenticate, enforceTenantScope);

// Statistics and KPI cards (Placed before /:id)
router.get(
  '/stats',
  requirePermission(SystemModule.VEHICLES, ActionPermission.VIEW),
  maintenanceController.getStats
);

// List maintenance records
router.get(
  '/',
  requirePermission(SystemModule.VEHICLES, ActionPermission.VIEW),
  maintenanceController.list
);

// Get single maintenance record
router.get(
  '/:id',
  requirePermission(SystemModule.VEHICLES, ActionPermission.VIEW),
  maintenanceController.getById
);

// Stream Maintenance Job Card PDF
router.get(
  '/:id/job-card',
  requirePermission(SystemModule.VEHICLES, ActionPermission.VIEW),
  maintenanceController.getJobCardPdf
);

// Schedule new maintenance
router.post(
  '/',
  requirePermission(SystemModule.VEHICLES, ActionPermission.ADD),
  maintenanceController.create
);

// Update status (e.g. IN_PROGRESS -> COMPLETED)
router.patch(
  '/:id/status',
  requirePermission(SystemModule.VEHICLES, ActionPermission.EDIT),
  maintenanceController.updateStatus
);

module.exports = router;
