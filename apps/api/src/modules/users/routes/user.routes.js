/**
 * User Management Routes
 */

const express = require('express');
const UserController = require('../controllers/user.controller');
const { authenticate, enforceTenantScope } = require('../../../middleware/auth.middleware');
const { requirePermission } = require('../../../middleware/rbac.middleware');
const { SystemModule } = require('@fleet/shared');

const router = express.Router();

// Apply auth and tenant scoping to all user management routes
router.use(authenticate, enforceTenantScope);

router.get('/', requirePermission(SystemModule.USERS, 'view'), UserController.listUsers);
router.post('/', requirePermission(SystemModule.USERS, 'add'), UserController.createUser);
router.patch('/:id', requirePermission(SystemModule.USERS, 'edit'), UserController.updateUser);
router.patch('/:id/status', requirePermission(SystemModule.USERS, 'edit'), UserController.toggleStatus);

module.exports = router;
