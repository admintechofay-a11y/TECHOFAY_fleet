/**
 * Bilty Routes
 */

const express = require('express');
const biltyController = require('../controllers/bilty.controller');
const { authenticate, enforceTenantScope } = require('../../../middleware/auth.middleware');
const { requirePermission } = require('../../../middleware/rbac.middleware');
const { SystemModule, ActionPermission } = require('@fleet/shared');

const router = express.Router();

router.use(authenticate, enforceTenantScope);

router.get(
  '/',
  requirePermission(SystemModule.BILTIES, ActionPermission.VIEW),
  biltyController.list
);

router.get(
  '/:id',
  requirePermission(SystemModule.BILTIES, ActionPermission.VIEW),
  biltyController.getById
);

router.post(
  '/',
  requirePermission(SystemModule.BILTIES, ActionPermission.ADD),
  biltyController.create
);

router.get(
  '/:id/pdf',
  requirePermission(SystemModule.BILTIES, ActionPermission.VIEW),
  biltyController.getBiltyPdf
);

module.exports = router;
