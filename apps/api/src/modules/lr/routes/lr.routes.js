/**
 * Lorry Receipt (LR) Routes
 */

const express = require('express');
const lrController = require('../controllers/lr.controller');
const { authenticate, enforceTenantScope } = require('../../../middleware/auth.middleware');
const { requirePermission } = require('../../../middleware/rbac.middleware');
const { SystemModule, ActionPermission } = require('../../../shared');

const router = express.Router();

router.use(authenticate, enforceTenantScope);

router.get(
  '/',
  requirePermission(SystemModule.LR, ActionPermission.VIEW),
  lrController.list
);

router.get(
  '/:id',
  requirePermission(SystemModule.LR, ActionPermission.VIEW),
  lrController.getById
);

router.post(
  '/',
  requirePermission(SystemModule.LR, ActionPermission.ADD),
  lrController.create
);

router.patch(
  '/:id/status',
  requirePermission(SystemModule.LR, ActionPermission.EDIT),
  lrController.updateStatus
);

router.get(
  '/:id/pdf',
  requirePermission(SystemModule.LR, ActionPermission.VIEW),
  lrController.getLrPdf
);

module.exports = router;
