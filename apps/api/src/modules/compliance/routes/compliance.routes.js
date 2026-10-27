/**
 * Compliance & Notification Routes
 */

const express = require('express');
const complianceController = require('../controllers/compliance.controller');
const { authenticate, enforceTenantScope } = require('../../../middleware/auth.middleware');
const { requirePermission } = require('../../../middleware/rbac.middleware');
const { SystemModule, ActionPermission } = require('../../../shared');

const router = express.Router();

router.use(authenticate, enforceTenantScope);

router.get(
  '/overview',
  requirePermission(SystemModule.VEHICLES, ActionPermission.VIEW),
  complianceController.getOverview
);

router.post(
  '/scan',
  requirePermission(SystemModule.VEHICLES, ActionPermission.ADMIN),
  complianceController.triggerScan
);

router.get(
  '/notifications',
  complianceController.listNotifications
);

router.patch(
  '/notifications/:id/read',
  complianceController.markAsRead
);

router.post(
  '/notifications/read-all',
  complianceController.markAllAsRead
);

module.exports = router;
