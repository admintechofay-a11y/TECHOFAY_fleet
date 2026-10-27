/**
 * WhatsApp Messaging & Webhook Routes
 */

const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsapp.controller');
const { authenticate, enforceTenantScope } = require('../../../middleware/auth.middleware');
const { requirePermission } = require('../../../middleware/rbac.middleware');
const { whatsappRateLimiter } = require('../../../middleware/rateLimiter');
const { SystemModule, ActionPermission } = require('@fleet/shared');

// 1. Inbound Public Webhooks (Secured by HMAC Signature Header & Replay Defense)
router.post('/webhook', (req, res, next) => whatsappController.handleWebhook(req, res, next));
router.post('/webhook/:provider', (req, res, next) => whatsappController.handleWebhook(req, res, next));

// All subsequent routes require authenticated tenant user
router.use(authenticate);
router.use(enforceTenantScope);

// 2. Templates List
router.get(
  '/templates',
  requirePermission(SystemModule.WHATSAPP, ActionPermission.VIEW),
  (req, res, next) => whatsappController.getTemplates(req, res, next)
);

// 3. Provider Settings & Health
router.get(
  '/config',
  requirePermission(SystemModule.WHATSAPP, ActionPermission.VIEW),
  (req, res, next) => whatsappController.getConfig(req, res, next)
);

router.put(
  '/config',
  requirePermission(SystemModule.SETTINGS, ActionPermission.EDIT),
  (req, res, next) => whatsappController.updateConfig(req, res, next)
);

// 4. Send Operations (Protected by Outbound WhatsApp Rate Limiter)
router.post(
  '/send',
  whatsappRateLimiter,
  requirePermission(SystemModule.WHATSAPP, ActionPermission.ADD),
  (req, res, next) => whatsappController.sendTemplateMessage(req, res, next)
);

router.post(
  '/send-batch',
  whatsappRateLimiter,
  requirePermission(SystemModule.WHATSAPP, ActionPermission.ADD),
  (req, res, next) => whatsappController.sendBatchMessages(req, res, next)
);

router.post(
  '/send-document',
  whatsappRateLimiter,
  requirePermission(SystemModule.WHATSAPP, ActionPermission.ADD),
  (req, res, next) => whatsappController.sendDocumentMessage(req, res, next)
);

router.post(
  '/send-custom',
  whatsappRateLimiter,
  requirePermission(SystemModule.WHATSAPP, ActionPermission.ADD),
  (req, res, next) => whatsappController.sendCustomTextMessage(req, res, next)
);

// 5. Message History & Retries
router.get(
  '/messages',
  requirePermission(SystemModule.WHATSAPP, ActionPermission.VIEW),
  (req, res, next) => whatsappController.getMessages(req, res, next)
);

router.get(
  '/messages/:id',
  requirePermission(SystemModule.WHATSAPP, ActionPermission.VIEW),
  (req, res, next) => whatsappController.getMessageById(req, res, next)
);

router.post(
  '/retry/:id',
  whatsappRateLimiter,
  requirePermission(SystemModule.WHATSAPP, ActionPermission.ADD),
  (req, res, next) => whatsappController.retryMessage(req, res, next)
);

module.exports = router;
