/**
 * Role Management Routes
 */

const express = require('express');
const RoleController = require('../controllers/role.controller');
const { authenticate, enforceTenantScope } = require('../../../middleware/auth.middleware');
const { requirePermission } = require('../../../middleware/rbac.middleware');
const { SystemModule } = require('@fleet/shared');

const router = express.Router();

// Apply auth and tenant scoping
router.use(authenticate, enforceTenantScope);

router.get('/', requirePermission(SystemModule.ROLES, 'view'), RoleController.listRoles);
router.post('/', requirePermission(SystemModule.ROLES, 'add'), RoleController.createRole);
router.get('/:id', requirePermission(SystemModule.ROLES, 'view'), RoleController.getRole);

module.exports = router;
