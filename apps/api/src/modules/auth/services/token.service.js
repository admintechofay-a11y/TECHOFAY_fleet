/**
 * JWT & Session Token Service
 */

const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const config = require('../../../config/env');

class TokenService {
  /**
   * Generate short-lived Access Token (JWT)
   */
  static generateAccessToken(user) {
    return jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        companyId: user.companyId._id ? user.companyId._id.toString() : user.companyId.toString(),
        role: user.roleId.slug || 'user'
      },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );
  }

  /**
   * Generate secure cryptographically random Refresh Token
   */
  static generateRefreshToken() {
    return crypto.randomBytes(40).toString('hex');
  }

  /**
   * Hash token with SHA-256 for safe database storage
   */
  static hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Verify Access Token
   */
  static verifyAccessToken(token) {
    return jwt.verify(token, config.jwtSecret);
  }

  /**
   * Set secure HttpOnly cookies for tokens
   */
  static setAuthCookies(res, accessToken, refreshToken) {
    // Access Token Cookie (15 min)
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: config.cookieSameSite,
      maxAge: 15 * 60 * 1000
    });

    // Refresh Token Cookie (7 days)
    if (refreshToken) {
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: config.cookieSecure,
        sameSite: config.cookieSameSite,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/api/v1/auth'
      });
    }
  }

  /**
   * Clear auth cookies
   */
  static clearAuthCookies(res) {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken', { path: '/api/v1/auth' });
  }
}

module.exports = TokenService;
