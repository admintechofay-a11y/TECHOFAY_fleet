/**
 * Driver Routes
 */

const express = require('express');
const multer = require('multer');
const driverController = require('../controllers/driver.controller');
const { authenticate, enforceTenantScope } = require('../../../middleware/auth.middleware');
const { requirePermission } = require('../../../middleware/rbac.middleware');
const { SystemModule, ActionPermission } = require('@fleet/shared');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.use(authenticate, enforceTenantScope);

router.get(
  '/',
  requirePermission(SystemModule.DRIVERS, ActionPermission.VIEW),
  driverController.list
);

router.get(
  '/:id',
  requirePermission(SystemModule.DRIVERS, ActionPermission.VIEW),
  driverController.getById
);

router.post(
  '/',
  requirePermission(SystemModule.DRIVERS, ActionPermission.ADD),
  driverController.create
);

router.put(
  '/:id',
  requirePermission(SystemModule.DRIVERS, ActionPermission.EDIT),
  driverController.update
);

router.delete(
  '/:id',
  requirePermission(SystemModule.DRIVERS, ActionPermission.DELETE),
  driverController.delete
);

// Driver Document sub-routes
router.post(
  '/:id/documents',
  requirePermission(SystemModule.DRIVER_DOCS, ActionPermission.ADD),
  upload.single('file'),
  driverController.uploadDocument
);

router.get(
  '/:id/documents',
  requirePermission(SystemModule.DRIVER_DOCS, ActionPermission.VIEW),
  driverController.listDocuments
);

router.delete(
  '/documents/:docId',
  requirePermission(SystemModule.DRIVER_DOCS, ActionPermission.DELETE),
  driverController.deleteDocument
);

module.exports = router;
