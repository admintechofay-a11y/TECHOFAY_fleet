/**
 * Role Administration Controller
 */

const Role = require('../../auth/models/Role');
const AuditLogService = require('../../audit/services/auditLog.service');
const { SystemModule, AuditAction } = require('../../../shared');
const { AppError } = require('../../../middleware/errorHandler');

class RoleController {
  /**
   * GET /api/v1/admin/roles
   */
  static async listRoles(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const roles = await Role.find({ companyId }).sort({ isSystemRole: -1, name: 1 });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Roles retrieved successfully',
        data: roles
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/roles
   */
  static async createRole(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const { name, description, permissions } = req.body || {};

      if (!name) {
        return next(new AppError('Role name is required', 400));
      }

      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

      const existing = await Role.findOne({ companyId, slug });
      if (existing) {
        return next(new AppError(`Role with slug '${slug}' already exists`, 409));
      }

      const role = await Role.create({
        companyId,
        name: name.trim(),
        slug,
        description: description || '',
        isSystemRole: false,
        permissions: permissions || []
      });

      await AuditLogService.log({
        companyId,
        actorId: req.user._id,
        module: SystemModule.ROLES,
        action: AuditAction.CREATE,
        entityId: role._id,
        newValues: { name: role.name, slug: role.slug },
        ipAddress: req.ip || '',
        userAgent: req.headers['user-agent'] || ''
      });

      res.status(201).json({
        success: true,
        statusCode: 201,
        message: 'Role created successfully',
        data: role
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/roles/:id
   */
  static async getRole(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const role = await Role.findOne({ _id: req.params.id, companyId });
      if (!role) {
        return next(new AppError('Role not found', 404));
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Role retrieved successfully',
        data: role
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = RoleController;
