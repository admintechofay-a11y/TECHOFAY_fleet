/**
 * Role-Based Access Control (RBAC) Middleware
 */

const { UserRole } = require('@fleet/shared');
const { AppError } = require('./errorHandler');

/**
 * Checks if user has specific permission on a module
 * @param {string} module - e.g. 'loads', 'vehicles', 'billing', 'users'
 * @param {string} action - e.g. 'view', 'add', 'edit', 'delete', 'admin', 'export'
 */
function requirePermission(module, action) {
  return (req, res, next) => {
    if (!req.user || !req.user.roleId) {
      return next(new AppError('Unauthorized: No role assigned to this account.', 401));
    }

    const role = req.user.roleId;

    // Super Admin has master access across all modules and actions
    if (role.slug === UserRole.SUPER_ADMIN) {
      return next();
    }

    // Find permission rule for the requested module
    const permissionRule = role.permissions.find((p) => p.module === module);
    if (!permissionRule) {
      return next(
        new AppError(`Access denied: You do not have permission to access the '${module}' module.`, 403)
      );
    }

    // Check if the specific action is permitted, or if 'admin' wildcard action is held
    const hasAction =
      permissionRule.actions.includes(action) ||
      permissionRule.actions.includes('admin');

    if (!hasAction) {
      return next(
        new AppError(`Access denied: You do not have '${action}' permission on '${module}'.`, 403)
      );
    }

    next();
  };
}

/**
 * Checks if user holds one of the required role slugs
 * @param {string[]} allowedRoles - array of allowed role slugs
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.roleId) {
      return next(new AppError('Unauthorized: No role assigned.', 401));
    }

    const userRoleSlug = req.user.roleId.slug;
    if (allowedRoles.includes(userRoleSlug)) {
      return next();
    }

    return next(new AppError(`Access denied: Requires one of [${allowedRoles.join(', ')}] role.`, 403));
  };
}

module.exports = {
  requirePermission,
  requireRole
};
