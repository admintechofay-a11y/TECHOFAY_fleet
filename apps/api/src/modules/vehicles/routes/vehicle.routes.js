/**
 * Vehicle Routes
 */

const express = require('express');
const multer = require('multer');
const vehicleController = require('../controllers/vehicle.controller');
const { authenticate, enforceTenantScope } = require('../../../middleware/auth.middleware');
const { requirePermission } = require('../../../middleware/rbac.middleware');
const { SystemModule, ActionPermission } = require('@fleet/shared');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

router.use(authenticate, enforceTenantScope);

router.get(
  '/',
  requirePermission(SystemModule.VEHICLES, ActionPermission.VIEW),
  vehicleController.list
);

router.get(
  '/:id',
  requirePermission(SystemModule.VEHICLES, ActionPermission.VIEW),
  vehicleController.getById
);

router.post(
  '/',
  requirePermission(SystemModule.VEHICLES, ActionPermission.ADD),
  vehicleController.create
);

router.put(
  '/:id',
  requirePermission(SystemModule.VEHICLES, ActionPermission.EDIT),
  vehicleController.update
);

router.delete(
  '/:id',
  requirePermission(SystemModule.VEHICLES, ActionPermission.DELETE),
  vehicleController.delete
);

// Vehicle Document sub-routes
router.post(
  '/:id/documents',
  requirePermission(SystemModule.VEHICLE_DOCS, ActionPermission.ADD),
  upload.single('file'),
  vehicleController.uploadDocument
);

router.get(
  '/:id/documents',
  requirePermission(SystemModule.VEHICLE_DOCS, ActionPermission.VIEW),
  vehicleController.listDocuments
);

router.delete(
  '/documents/:docId',
  requirePermission(SystemModule.VEHICLE_DOCS, ActionPermission.DELETE),
  vehicleController.deleteDocument
);

module.exports = router;
