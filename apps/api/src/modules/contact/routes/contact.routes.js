/**
 * Contact Routes
 * Mounted at /api/v1/contact
 */

const express = require('express');
const ContactController = require('../controllers/contact.controller');
const { authenticate } = require('../../../middleware/auth.middleware');
const { requireRole } = require('../../../middleware/rbac.middleware');
const { UserRole } = require('@fleet/shared');

const router = express.Router();

// Public submission
router.post('/', ContactController.submitInquiry);

// Admin review
router.get('/', authenticate, requireRole(UserRole.SUPER_ADMIN), ContactController.getInquiries);

module.exports = router;
