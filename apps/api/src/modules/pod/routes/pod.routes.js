/**
 * Proof of Delivery Routes
 */

const express = require('express');
const multer = require('multer');
const podController = require('../controllers/pod.controller');
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
  requirePermission(SystemModule.POD, ActionPermission.VIEW),
  podController.list
);

router.get(
  '/:id',
  requirePermission(SystemModule.POD, ActionPermission.VIEW),
  podController.getById
);

router.post(
  '/',
  upload.single('file'),
  requirePermission(SystemModule.POD, ActionPermission.ADD),
  podController.upload
);

router.get(
  '/:id/download',
  requirePermission(SystemModule.POD, ActionPermission.VIEW),
  podController.download
);

router.patch(
  '/:id/verify',
  requirePermission(SystemModule.POD, ActionPermission.EDIT),
  podController.verify
);

module.exports = router;
