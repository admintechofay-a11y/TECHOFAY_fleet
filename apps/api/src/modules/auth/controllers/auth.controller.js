/**
 * Authentication Controller
 */

const crypto = require('node:crypto');
const User = require('../models/User');
const UserSession = require('../models/UserSession');
const Company = require('../models/Company');
const BootstrapService = require('../services/bootstrap.service');
const TokenService = require('../services/token.service');
const AuditLogService = require('../../audit/services/auditLog.service');
const { SystemModule, AuditAction } = require('@fleet/shared');
const { AppError } = require('../../../middleware/errorHandler');

class AuthController {
  /**
   * POST /api/v1/auth/register
   * Registers a new tenant organization and super administrator user
   */
  static async register(req, res, next) {
    try {
      const {
        companyLegalName,
        tradeName,
        companyGstin,
        adminName,
        email,
        password,
        phone,
        street,
        city,
        state,
        pincode
      } = req.body || {};

      if (!companyLegalName || !adminName || !email || !password) {
        return next(new AppError('Company name, administrator name, email, and password are required', 400));
      }

      if (typeof password !== 'string' || password.length < 8) {
        return next(new AppError('Password must be at least 8 characters long', 400));
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Check if user already exists
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser) {
        return next(new AppError('An account with this email address already exists. Please log in.', 409));
      }

      // Format or generate GSTIN if not supplied
      let gstin = (companyGstin || '').trim().toUpperCase();
      if (!gstin) {
        const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
        gstin = `24TEMP${randomHex}Z1`;
      }

      // Check if company with this GSTIN already exists
      const existingCompany = await Company.findOne({ gstin });
      if (existingCompany) {
        const randomHex = crypto.randomBytes(2).toString('hex').toUpperCase();
        gstin = `${gstin.slice(0, 10)}${randomHex}Z1`;
      }

      // Bootstrap company, system roles, and super admin user
      const { company, roles, superAdmin } = await BootstrapService.bootstrapSystem({
        companyLegalName: companyLegalName.trim(),
        tradeName: tradeName ? tradeName.trim() : companyLegalName.trim(),
        companyGstin: gstin,
        adminEmail: normalizedEmail,
        adminPassword: password,
        adminName: adminName.trim(),
        phone: phone ? phone.trim() : '+91 98765 43210',
        address: {
          street: street ? street.trim() : 'Transport Hub Complex',
          city: city ? city.trim() : 'Ahmedabad',
          state: state ? state.trim() : 'Gujarat',
          pincode: pincode ? pincode.trim() : '380001',
          country: 'IN'
        }
      });

      // Populate user for token generation
      const populatedUser = await User.findById(superAdmin._id)
        .populate('roleId')
        .populate('companyId');

      // Generate Tokens & Active Session
      const accessToken = TokenService.generateAccessToken(populatedUser);
      const rawRefreshToken = TokenService.generateRefreshToken();
      const refreshTokenHash = TokenService.hashToken(rawRefreshToken);

      const ipAddress = req.ip || req.connection.remoteAddress || '';
      const userAgent = req.headers['user-agent'] || '';
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await UserSession.create({
        userId: populatedUser._id,
        companyId: company._id,
        refreshTokenHash,
        ipAddress,
        userAgent,
        expiresAt
      });

      // Audit Log
      await AuditLogService.log({
        companyId: company._id,
        actorId: populatedUser._id,
        module: SystemModule.AUTH,
        action: AuditAction.CREATE,
        newValues: {
          event: 'ORGANIZATION_REGISTERED',
          company: company.legalName,
          email: normalizedEmail
        },
        ipAddress,
        userAgent
      });

      // Set Cookies
      TokenService.setAuthCookies(res, accessToken, rawRefreshToken);

      res.status(201).json({
        success: true,
        statusCode: 201,
        message: 'Organization and administrator account registered successfully',
        data: {
          accessToken,
          user: populatedUser.toSafeObject(),
          tenant: company
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/login
   */
  static async login(req, res, next) {
    try {
      const { email, password } = req.body || {};

      if (!email || !password) {
        return next(new AppError('Email and password are required', 400));
      }

      if (typeof password !== 'string' || password.length < 8) {
        return next(new AppError('Password must be at least 8 characters long', 400));
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Find user by email across all companies
      const user = await User.findOne({ email: normalizedEmail })
        .populate('roleId')
        .populate('companyId');

      const ipAddress = req.ip || req.connection.remoteAddress || '';
      const userAgent = req.headers['user-agent'] || '';

      if (!user) {
        // Generic failure to prevent user enumeration
        return next(new AppError('Invalid email or password', 401));
      }

      if (!user.isActive) {
        await AuditLogService.log({
          companyId: user.companyId._id,
          actorId: user._id,
          module: SystemModule.AUTH,
          action: AuditAction.LOGIN_FAILED,
          newValues: { reason: 'ACCOUNT_DEACTIVATED', email: normalizedEmail },
          ipAddress,
          userAgent
        });
        return next(new AppError('Your account has been deactivated. Please contact your administrator.', 401));
      }

      // Check password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        await AuditLogService.log({
          companyId: user.companyId._id,
          actorId: user._id,
          module: SystemModule.AUTH,
          action: AuditAction.LOGIN_FAILED,
          newValues: { reason: 'PASSWORD_MISMATCH', email: normalizedEmail },
          ipAddress,
          userAgent
        });
        return next(new AppError('Invalid email or password', 401));
      }

      // Generate Tokens
      const accessToken = TokenService.generateAccessToken(user);
      const rawRefreshToken = TokenService.generateRefreshToken();
      const refreshTokenHash = TokenService.hashToken(rawRefreshToken);

      // Create Active Session (7 days expiry)
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await UserSession.create({
        userId: user._id,
        companyId: user.companyId._id,
        refreshTokenHash,
        ipAddress,
        userAgent,
        expiresAt
      });

      // Update last login
      user.lastLoginAt = new Date();
      await user.save();

      // Audit Log
      await AuditLogService.log({
        companyId: user.companyId._id,
        actorId: user._id,
        module: SystemModule.AUTH,
        action: AuditAction.LOGIN_SUCCESS,
        ipAddress,
        userAgent
      });

      // Set Cookies
      TokenService.setAuthCookies(res, accessToken, rawRefreshToken);

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Login successful',
        data: {
          accessToken,
          user: user.toSafeObject()
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/refresh
   */
  static async refresh(req, res, next) {
    try {
      const rawRefreshToken =
        (req.cookies && req.cookies.refreshToken) ||
        (req.body && req.body.refreshToken);

      if (!rawRefreshToken) {
        return next(new AppError('Refresh token required', 401));
      }

      const refreshTokenHash = TokenService.hashToken(rawRefreshToken);

      // Look up session
      const session = await UserSession.findOne({
        refreshTokenHash,
        isRevoked: false,
        expiresAt: { $gt: new Date() }
      });

      if (!session) {
        TokenService.clearAuthCookies(res);
        return next(new AppError('Invalid or expired refresh session. Please login again.', 401));
      }

      const user = await User.findById(session.userId)
        .populate('roleId')
        .populate('companyId');

      if (!user || !user.isActive) {
        session.isRevoked = true;
        await session.save();
        TokenService.clearAuthCookies(res);
        return next(new AppError('User account is invalid or deactivated.', 401));
      }

      // Rotate Refresh Token
      session.isRevoked = true;
      await session.save();

      const newAccessToken = TokenService.generateAccessToken(user);
      const newRawRefreshToken = TokenService.generateRefreshToken();
      const newRefreshTokenHash = TokenService.hashToken(newRawRefreshToken);

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await UserSession.create({
        userId: user._id,
        companyId: user.companyId._id,
        refreshTokenHash: newRefreshTokenHash,
        ipAddress: req.ip || '',
        userAgent: req.headers['user-agent'] || '',
        expiresAt
      });

      TokenService.setAuthCookies(res, newAccessToken, newRawRefreshToken);

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Token refreshed successfully',
        data: {
          accessToken: newAccessToken,
          user: user.toSafeObject()
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/logout
   */
  static async logout(req, res, next) {
    try {
      const rawRefreshToken =
        (req.cookies && req.cookies.refreshToken) ||
        (req.body && req.body.refreshToken);

      if (rawRefreshToken) {
        const refreshTokenHash = TokenService.hashToken(rawRefreshToken);
        await UserSession.updateMany(
          { refreshTokenHash },
          { $set: { isRevoked: true } }
        );
      }

      if (req.user) {
        await AuditLogService.log({
          companyId: req.user.companyId._id || req.user.companyId,
          actorId: req.user._id,
          module: SystemModule.AUTH,
          action: AuditAction.LOGOUT,
          ipAddress: req.ip || '',
          userAgent: req.headers['user-agent'] || ''
        });
      }

      TokenService.clearAuthCookies(res);

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Logged out successfully',
        data: null
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/auth/me
   */
  static async me(req, res) {
    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Current user profile retrieved',
      data: {
        user: req.user.toSafeObject(),
        tenant: req.tenant.company
      }
    });
  }

  /**
   * POST /api/v1/auth/forgot-password
   */
  static async forgotPassword(req, res, next) {
    try {
      const { email } = req.body || {};
      if (!email) {
        return next(new AppError('Email is required', 400));
      }

      const user = await User.findOne({ email: email.toLowerCase().trim() });
      if (user) {
        const resetToken = crypto.randomBytes(32).toString('hex');
        user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await user.save();

        await AuditLogService.log({
          companyId: user.companyId,
          actorId: user._id,
          module: SystemModule.AUTH,
          action: AuditAction.PASSWORD_RESET,
          newValues: { event: 'RESET_TOKEN_GENERATED' },
          ipAddress: req.ip || '',
          userAgent: req.headers['user-agent'] || ''
        });
      }

      // Always return 200 to prevent user enumeration
      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'If this email is registered, password reset instructions have been generated.',
        data: null
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/reset-password
   */
  static async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body || {};
      if (!token || !newPassword) {
        return next(new AppError('Reset token and new password are required', 400));
      }

      if (newPassword.length < 8) {
        return next(new AppError('Password must be at least 8 characters long', 400));
      }

      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
      const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: new Date() }
      });

      if (!user) {
        return next(new AppError('Invalid or expired password reset token', 400));
      }

      user.passwordHash = newPassword; // Pre-save hook will hash
      user.passwordResetToken = null;
      user.passwordResetExpires = null;
      await user.save();

      // Invalidate all active sessions for security
      await UserSession.updateMany(
        { userId: user._id },
        { $set: { isRevoked: true } }
      );

      await AuditLogService.log({
        companyId: user.companyId,
        actorId: user._id,
        module: SystemModule.AUTH,
        action: AuditAction.PASSWORD_RESET,
        newValues: { event: 'PASSWORD_RESET_SUCCESSFUL' },
        ipAddress: req.ip || '',
        userAgent: req.headers['user-agent'] || ''
      });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Password reset successful. Please login with your new password.',
        data: null
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;
