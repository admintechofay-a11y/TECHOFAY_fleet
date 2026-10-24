/**
 * Private Document Routes
 */

const express = require('express');
const documentController = require('../controllers/document.controller');
const { authenticate, enforceTenantScope } = require('../../../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate, enforceTenantScope);

router.get('/:id/download', documentController.download);

module.exports = router;
