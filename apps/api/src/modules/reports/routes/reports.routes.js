/**
 * Reports Routes
 * Mounted at /api/v1/reports
 */

const express = require('express');
const ReportsController = require('../controllers/reports.controller');
const { authenticate, enforceTenantScope } = require('../../../middleware/auth.middleware');
const { requirePermission } = require('../../../middleware/rbac.middleware');
const { SystemModule } = require('../../../shared');

const router = express.Router();

router.use(authenticate, enforceTenantScope);

router.get('/loads', requirePermission(SystemModule.REPORTS, 'view'), ReportsController.getLoadsReport);
router.get('/trips', requirePermission(SystemModule.REPORTS, 'view'), ReportsController.getTripsReport);
router.get('/freight', requirePermission(SystemModule.REPORTS, 'view'), ReportsController.getFreightReport);
router.get('/compliance', requirePermission(SystemModule.REPORTS, 'view'), ReportsController.getComplianceReport);
router.get('/export/:reportType', requirePermission(SystemModule.REPORTS, 'export'), ReportsController.exportReport);

module.exports = router;
