/**
 * Settings Routes
 * Mounted at /api/v1/admin/settings
 */

const express = require('express');
const SettingsController = require('../controllers/settings.controller');
const { authenticate, enforceTenantScope } = require('../../../middleware/auth.middleware');
const { requirePermission } = require('../../../middleware/rbac.middleware');
const { SystemModule } = require('@fleet/shared');

const router = express.Router();

router.use(authenticate, enforceTenantScope);

router.get('/', requirePermission(SystemModule.SETTINGS, 'view'), SettingsController.getSettings);
router.patch('/', requirePermission(SystemModule.SETTINGS, 'edit'), SettingsController.updateSettings);

module.exports = router;
