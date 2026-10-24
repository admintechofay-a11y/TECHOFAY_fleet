/**
 * Authentication & Tenant Scoping Middleware
 */

const jwt = require('jsonwebtoken');
const config = require('../config/env');
const User = require('../modules/auth/models/User');
const { AppError } = require('./errorHandler');

async function authenticate(req, res, next) {
  try {
    let token = null;

    // 1. Check Authorization Header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.accessToken) {
      // 2. Fallback to HttpOnly Cookie
      token = req.cookies.accessToken;
    }

    if (!token) {
      return next(new AppError('Authentication required. Missing access token.', 401));
    }

    // 3. Verify Token
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new AppError('Session expired. Please refresh your token.', 401));
      }
      return next(new AppError('Invalid authentication token.', 401));
    }

    // 4. Fetch User and Role
    const user = await User.findById(decoded.userId).populate('roleId').populate('companyId');
    if (!user) {
      return next(new AppError('User account not found.', 401));
    }

    if (!user.isActive) {
      return next(new AppError('Your account has been deactivated. Please contact your administrator.', 401));
    }

    if (!user.companyId || !user.companyId.isActive) {
      return next(new AppError('Organization account is inactive or not found.', 403));
    }

    // 5. Attach User & Tenant Context to Request
    req.user = user;
    req.tenant = {
      companyId: user.companyId._id,
      company: user.companyId
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware ensuring valid company tenant is attached to request
 */
function enforceTenantScope(req, res, next) {
  if (!req.tenant || !req.tenant.companyId) {
    return next(new AppError('Tenant context missing. Cross-tenant access forbidden.', 403));
  }
  next();
}

module.exports = {
  authenticate,
  enforceTenantScope
};
