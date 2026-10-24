/**
 * Master Data Import/Export Routes
 */

const express = require('express');
const multer = require('multer');
const masterImportExportController = require('../controllers/masterImportExport.controller');
const { authenticate, enforceTenantScope } = require('../../../middleware/auth.middleware');
const { requirePermission } = require('../../../middleware/rbac.middleware');
const { SystemModule, ActionPermission } = require('@fleet/shared');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit for large spreadsheets
});

router.use(authenticate, enforceTenantScope);

router.get(
  '/template/:entityType',
  requirePermission(SystemModule.IMPORT_EXPORT, ActionPermission.VIEW),
  masterImportExportController.downloadTemplate
);

router.post(
  '/dry-run/:entityType',
  requirePermission(SystemModule.IMPORT_EXPORT, ActionPermission.ADD),
  upload.single('file'),
  masterImportExportController.dryRun
);

router.post(
  '/confirm/:entityType',
  requirePermission(SystemModule.IMPORT_EXPORT, ActionPermission.ADD),
  masterImportExportController.confirmImport
);

router.get(
  '/export/:entityType',
  requirePermission(SystemModule.IMPORT_EXPORT, ActionPermission.EXPORT),
  masterImportExportController.exportData
);

module.exports = router;
