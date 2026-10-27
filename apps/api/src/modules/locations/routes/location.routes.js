/**
 * Location Routes
 */

const express = require('express');
const locationController = require('../controllers/location.controller');
const { authenticate, enforceTenantScope } = require('../../../middleware/auth.middleware');
const { requirePermission } = require('../../../middleware/rbac.middleware');
const { SystemModule, ActionPermission } = require('../../../shared');

const router = express.Router();

router.use(authenticate, enforceTenantScope);

router.get(
  '/',
  requirePermission(SystemModule.LOCATIONS, ActionPermission.VIEW),
  locationController.list
);

router.get(
  '/:id',
  requirePermission(SystemModule.LOCATIONS, ActionPermission.VIEW),
  locationController.getById
);

router.post(
  '/',
  requirePermission(SystemModule.LOCATIONS, ActionPermission.ADD),
  locationController.create
);

router.put(
  '/:id',
  requirePermission(SystemModule.LOCATIONS, ActionPermission.EDIT),
  locationController.update
);

router.delete(
  '/:id',
  requirePermission(SystemModule.LOCATIONS, ActionPermission.DELETE),
  locationController.delete
);

module.exports = router;
