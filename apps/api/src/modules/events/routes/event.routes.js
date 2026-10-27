/**
 * Event Stream Routes
 * Mounted at /api/v1/events
 */

const express = require('express');
const EventController = require('../controllers/event.controller');
const { authenticate, enforceTenantScope } = require('../../../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate, enforceTenantScope);

router.get('/stream', EventController.stream);
router.get('/status', EventController.getStatus);

module.exports = router;
