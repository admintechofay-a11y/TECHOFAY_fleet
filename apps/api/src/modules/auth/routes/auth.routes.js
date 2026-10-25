/**
 * Authentication Routes
 */

const express = require('express');
const AuthController = require('../controllers/auth.controller');
const { authenticate, enforceTenantScope } = require('../../../middleware/auth.middleware');
const { authRateLimiter } = require('../../../middleware/rateLimiter');

const router = express.Router();

// Public auth routes with rate limiting
router.post('/register', authRateLimiter, AuthController.register);
router.post('/login', authRateLimiter, AuthController.login);
router.post('/refresh', AuthController.refresh);
router.post('/forgot-password', authRateLimiter, AuthController.forgotPassword);
router.post('/reset-password', authRateLimiter, AuthController.resetPassword);

// Authenticated session routes
router.post('/logout', authenticate, AuthController.logout);
router.get('/me', authenticate, enforceTenantScope, AuthController.me);

module.exports = router;
