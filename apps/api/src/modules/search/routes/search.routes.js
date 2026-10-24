/**
 * Search Routes
 * Mounted at /api/v1/search
 */

const express = require('express');
const SearchController = require('../controllers/search.controller');
const { authenticate, enforceTenantScope } = require('../../../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate, enforceTenantScope);

router.get('/', SearchController.search);

module.exports = router;
