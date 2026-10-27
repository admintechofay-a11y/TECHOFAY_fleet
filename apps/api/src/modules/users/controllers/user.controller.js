/**
 * User Administration Controller
 */

const User = require('../../auth/models/User');
const Role = require('../../auth/models/Role');
const AuditLogService = require('../../audit/services/auditLog.service');
const { SystemModule, AuditAction, UserRole } = require('../../../shared');
const { AppError } = require('../../../middleware/errorHandler');

class UserController {
  /**
   * GET /api/v1/admin/users
   */
  static async listUsers(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const page = parseInt(req.query.page || '1', 10);
      const limit = parseInt(req.query.limit || '20', 10);
      const search = req.query.search ? req.query.search.trim() : '';

      const query = { companyId };
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ];
      }

      const skip = (page - 1) * limit;
      const [users, totalRecords] = await Promise.all([
        User.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('roleId', 'name slug isSystemRole')
          .lean(),
        User.countDocuments(query)
      ]);

      const safeUsers = users.map((u) => {
        delete u.passwordHash;
        delete u.passwordResetToken;
        delete u.passwordResetExpires;
        delete u.__v;
        return u;
      });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Users retrieved successfully',
        data: safeUsers,
        meta: {
          page,
          limit,
          totalRecords,
          totalPages: Math.ceil(totalRecords / limit) || 1
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/users
   */
  static async createUser(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const { name, email, password, phone, roleId } = req.body || {};

      if (!name || !email || !password || !roleId) {
        return next(new AppError('Name, email, password, and roleId are required', 400));
      }

      if (password.length < 8) {
        return next(new AppError('Password must be at least 8 characters long', 400));
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Check role belongs to this company
      const role = await Role.findOne({ _id: roleId, companyId });
      if (!role) {
        return next(new AppError('Invalid role specified for this organization', 400));
      }

      // Check duplicate email in company
      const existing = await User.findOne({ companyId, email: normalizedEmail });
      if (existing) {
        return next(new AppError(`User with email '${normalizedEmail}' already exists in this organization`, 409));
      }

      const newUser = await User.create({
        companyId,
        name: name.trim(),
        email: normalizedEmail,
        passwordHash: password, // Pre-save hook will hash
        phone: phone || '',
        roleId: role._id,
        isActive: true
      });

      await AuditLogService.log({
        companyId,
        actorId: req.user._id,
        module: SystemModule.USERS,
        action: AuditAction.CREATE,
        entityId: newUser._id,
        newValues: { name: newUser.name, email: newUser.email, role: role.slug },
        ipAddress: req.ip || '',
        userAgent: req.headers['user-agent'] || ''
      });

      res.status(201).json({
        success: true,
        statusCode: 201,
        message: 'User created successfully',
        data: newUser.toSafeObject()
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/admin/users/:id
   */
  static async updateUser(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const targetUserId = req.params.id;
      const { name, phone, roleId } = req.body || {};

      const user = await User.findOne({ _id: targetUserId, companyId }).populate('roleId');
      if (!user) {
        return next(new AppError('User not found', 404));
      }

      const oldValues = {
        name: user.name,
        phone: user.phone,
        roleId: user.roleId ? user.roleId._id : null
      };

      if (name) user.name = name.trim();
      if (phone !== undefined) user.phone = phone.trim();

      // If updating role, check self-demotion lockout
      if (roleId && roleId.toString() !== user.roleId._id.toString()) {
        const newRole = await Role.findOne({ _id: roleId, companyId });
        if (!newRole) {
          return next(new AppError('Invalid role specified', 400));
        }

        if (user.roleId.slug === UserRole.SUPER_ADMIN && newRole.slug !== UserRole.SUPER_ADMIN) {
          // Check if another active super admin exists
          const superAdminRole = await Role.findOne({ companyId, slug: UserRole.SUPER_ADMIN });
          const otherSuperAdmins = await User.countDocuments({
            companyId,
            roleId: superAdminRole._id,
            isActive: true,
            _id: { $ne: user._id }
          });
          if (otherSuperAdmins === 0) {
            return next(new AppError('Cannot demote the last active Super Administrator.', 400));
          }
        }
        user.roleId = newRole._id;
      }

      await user.save();

      await AuditLogService.log({
        companyId,
        actorId: req.user._id,
        module: SystemModule.USERS,
        action: AuditAction.UPDATE,
        entityId: user._id,
        oldValues,
        newValues: { name: user.name, phone: user.phone, roleId: user.roleId },
        ipAddress: req.ip || '',
        userAgent: req.headers['user-agent'] || ''
      });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'User updated successfully',
        data: user.toSafeObject()
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/admin/users/:id/status
   */
  static async toggleStatus(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const targetUserId = req.params.id;
      const { isActive } = req.body;

      if (typeof isActive !== 'boolean') {
        return next(new AppError('isActive boolean is required', 400));
      }

      const user = await User.findOne({ _id: targetUserId, companyId }).populate('roleId');
      if (!user) {
        return next(new AppError('User not found', 404));
      }

      // Prevent deactivating last super admin
      if (!isActive && user.roleId.slug === UserRole.SUPER_ADMIN) {
        const superAdminRole = await Role.findOne({ companyId, slug: UserRole.SUPER_ADMIN });
        const otherSuperAdmins = await User.countDocuments({
          companyId,
          roleId: superAdminRole._id,
          isActive: true,
          _id: { $ne: user._id }
        });
        if (otherSuperAdmins === 0) {
          return next(new AppError('Cannot deactivate the last active Super Administrator.', 400));
        }
      }

      const oldStatus = user.isActive;
      user.isActive = isActive;
      await user.save();

      await AuditLogService.log({
        companyId,
        actorId: req.user._id,
        module: SystemModule.USERS,
        action: AuditAction.STATUS_CHANGE,
        entityId: user._id,
        oldValues: { isActive: oldStatus },
        newValues: { isActive },
        ipAddress: req.ip || '',
        userAgent: req.headers['user-agent'] || ''
      });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
        data: user.toSafeObject()
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = UserController;
