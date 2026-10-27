/**
 * Load Routes
 * Manages Consignment Orders, Multi-Stop Waypoints, and Loading Slips
 */

const express = require('express');
const loadController = require('../controllers/load.controller');
const { authenticate, enforceTenantScope } = require('../../../middleware/auth.middleware');
const { requirePermission } = require('../../../middleware/rbac.middleware');
const { SystemModule, ActionPermission } = require('../../../shared');

const router = express.Router();

router.use(authenticate, enforceTenantScope);

router.get(
  '/',
  requirePermission(SystemModule.LOADS, ActionPermission.VIEW),
  loadController.list
);

router.get(
  '/:id',
  requirePermission(SystemModule.LOADS, ActionPermission.VIEW),
  loadController.getById
);

router.post(
  '/',
  requirePermission(SystemModule.LOADS, ActionPermission.ADD),
  loadController.create
);

router.patch(
  '/:id/status',
  requirePermission(SystemModule.LOADS, ActionPermission.EDIT),
  loadController.updateStatus
);

router.post(
  '/:id/assign',
  requirePermission(SystemModule.LOADS, ActionPermission.EDIT),
  loadController.assignAssets
);

router.post(
  '/:id/assign-assets',
  requirePermission(SystemModule.LOADS, ActionPermission.EDIT),
  loadController.assignAssets
);

router.get(
  '/:id/loading-slip',
  requirePermission(SystemModule.LOADS, ActionPermission.VIEW),
  loadController.getLoadingSlipPdf
);

module.exports = router;
