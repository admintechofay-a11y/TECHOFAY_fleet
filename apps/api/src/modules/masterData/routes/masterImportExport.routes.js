/**
 * Master Data & Operational Import/Export Routes
 */

const express = require('express');
const multer = require('multer');
const masterImportExportController = require('../controllers/masterImportExport.controller');
const { authenticate, enforceTenantScope } = require('../../../middleware/auth.middleware');
const { requirePermission } = require('../../../middleware/rbac.middleware');
const { SystemModule, ActionPermission } = require('../../../shared');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit for large spreadsheets
});

router.use(authenticate, enforceTenantScope);

// 1. Download Blank/Sample Template
router.get(
  '/template/:entityType',
  requirePermission(SystemModule.IMPORT_EXPORT, ActionPermission.VIEW),
  masterImportExportController.downloadTemplate
);

// 2. Dry-Run / Preview Validation
router.post(
  '/dry-run/:entityType',
  requirePermission(SystemModule.IMPORT_EXPORT, ActionPermission.ADD),
  upload.single('file'),
  masterImportExportController.dryRun
);

// 3. Confirm Import Persistence
router.post(
  '/confirm/:entityType',
  requirePermission(SystemModule.IMPORT_EXPORT, ActionPermission.ADD),
  masterImportExportController.confirmImport
);

// 4. Synchronous Streaming Export
router.get(
  '/export/:entityType',
  requirePermission(SystemModule.IMPORT_EXPORT, ActionPermission.EXPORT),
  masterImportExportController.exportData
);

// 5. Asynchronous / Background Import & Export Jobs
router.post(
  '/jobs/import/:entityType',
  requirePermission(SystemModule.IMPORT_EXPORT, ActionPermission.ADD),
  upload.single('file'),
  masterImportExportController.createImportJob
);

router.post(
  '/jobs/export',
  requirePermission(SystemModule.IMPORT_EXPORT, ActionPermission.EXPORT),
  masterImportExportController.createJob
);

router.get(
  '/jobs',
  requirePermission(SystemModule.IMPORT_EXPORT, ActionPermission.VIEW),
  masterImportExportController.listJobs
);

router.get(
  '/jobs/:id',
  requirePermission(SystemModule.IMPORT_EXPORT, ActionPermission.VIEW),
  masterImportExportController.getJobById
);

router.get(
  '/jobs/:id/download',
  requirePermission(SystemModule.IMPORT_EXPORT, ActionPermission.EXPORT),
  masterImportExportController.downloadJobFile
);

module.exports = router;
