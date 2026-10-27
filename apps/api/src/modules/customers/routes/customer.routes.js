/**
 * CustomerParty Routes
 */

const express = require('express');
const customerController = require('../controllers/customer.controller');
const { authenticate, enforceTenantScope } = require('../../../middleware/auth.middleware');
const { requirePermission } = require('../../../middleware/rbac.middleware');
const { SystemModule, ActionPermission } = require('../../../shared');

const router = express.Router();

// Enforce auth & tenant scoping across all customer endpoints
router.use(authenticate, enforceTenantScope);

router.get(
  '/',
  requirePermission(SystemModule.CUSTOMERS, ActionPermission.VIEW),
  customerController.list
);

router.get(
  '/:id',
  requirePermission(SystemModule.CUSTOMERS, ActionPermission.VIEW),
  customerController.getById
);

router.post(
  '/',
  requirePermission(SystemModule.CUSTOMERS, ActionPermission.ADD),
  customerController.create
);

router.put(
  '/:id',
  requirePermission(SystemModule.CUSTOMERS, ActionPermission.EDIT),
  customerController.update
);

router.delete(
  '/:id',
  requirePermission(SystemModule.CUSTOMERS, ActionPermission.DELETE),
  customerController.delete
);

module.exports = router;
