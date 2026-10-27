/**
 * WhatsApp Messaging & Webhooks Controller
 * Exposes endpoints for template messaging, PDF sharing,
 * webhook processing, retries, and provider configuration.
 */

const whatsappService = require('../services/whatsapp.service');
const { TEMPLATES } = require('../services/whatsappTemplate.service');
const { AppError } = require('../../../middleware/errorHandler');

class WhatsAppController {
  /**
   * 1. Send Pre-Approved Template Message
   */
  async sendTemplateMessage(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const { toPhone, recipientName, templateName, variables, relatedEntity } = req.body;

      if (!toPhone) throw new AppError('Recipient phone number is required.', 400);
      if (!templateName) throw new AppError('Template name is required.', 400);

      const messageLog = await whatsappService.sendMessage({
        companyId,
        toPhone,
        recipientName,
        templateName,
        variables,
        relatedEntity,
        userId: req.user._id,
        ipAddress: req.ip
      });

      res.status(201).json({
        success: true,
        statusCode: 201,
        message: `WhatsApp template message queued successfully (${messageLog.status}).`,
        data: messageLog
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 2. Share Official Document PDF via WhatsApp
   */
  async sendDocumentMessage(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const { toPhone, recipientName, documentType, documentId, caption } = req.body;

      if (!toPhone) throw new AppError('Recipient phone number is required.', 400);
      if (!documentType || !documentId) throw new AppError('Document type and ID are required.', 400);

      const messageLog = await whatsappService.sendDocument({
        companyId,
        toPhone,
        recipientName,
        documentType,
        documentId,
        caption,
        userId: req.user._id,
        ipAddress: req.ip
      });

      res.status(201).json({
        success: true,
        statusCode: 201,
        message: `Document dispatched via WhatsApp (${messageLog.status}).`,
        data: messageLog
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 3. Send Direct Custom Note
   */
  async sendCustomTextMessage(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const { toPhone, recipientName, message, relatedEntity } = req.body;

      if (!toPhone) throw new AppError('Recipient phone number is required.', 400);
      if (!message) throw new AppError('Message text is required.', 400);

      const messageLog = await whatsappService.sendCustomText({
        companyId,
        toPhone,
        recipientName,
        message,
        relatedEntity,
        userId: req.user._id,
        ipAddress: req.ip
      });

      res.status(201).json({
        success: true,
        statusCode: 201,
        message: `Custom message queued via WhatsApp (${messageLog.status}).`,
        data: messageLog
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 4. Retry Failed Message
   */
  async retryMessage(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const { id } = req.params;

      const messageLog = await whatsappService.retryFailedMessage(
        id,
        companyId,
        req.user._id,
        req.ip
      );

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: `Message retry initiated (Attempt #${messageLog.retryCount}). Status: ${messageLog.status}`,
        data: messageLog
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 5. List Tenant Messages with Filters
   */
  async getMessages(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const { page, limit, status, search, recipientPhone } = req.query;

      const result = await whatsappService.getMessages(companyId, {
        page,
        limit,
        status,
        search,
        recipientPhone
      });

      res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.messages,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 6. Get Message Details
   */
  async getMessageById(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const { id } = req.params;

      const message = await whatsappService.getMessageById(id, companyId);

      res.status(200).json({
        success: true,
        statusCode: 200,
        data: message
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 7. List Available Approved Templates
   */
  async getTemplates(req, res, next) {
    try {
      const list = Object.values(TEMPLATES).map(t => ({
        name: t.name,
        title: t.title,
        requiredVars: t.requiredVars
      }));

      res.status(200).json({
        success: true,
        statusCode: 200,
        data: list
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 8. Get Masked Tenant Configuration
   */
  async getConfig(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const config = await whatsappService.getConfig(companyId);

      res.status(200).json({
        success: true,
        statusCode: 200,
        data: config
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 9. Update Tenant Configuration
   */
  async updateConfig(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const updated = await whatsappService.updateConfig(
        companyId,
        req.body,
        req.user._id,
        req.ip
      );

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'WhatsApp provider settings updated successfully.',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 10. Inbound Webhook Receiver
   */
  async handleWebhook(req, res, next) {
    try {
      // Signature may come in X-Hub-Signature-256 or X-Twilio-Signature or X-Signature
      const signature =
        req.headers['x-hub-signature-256'] ||
        req.headers['x-interakt-signature'] ||
        req.headers['x-twilio-signature'] ||
        req.headers['x-signature'];

      const rawBody = req.body;

      const result = await whatsappService.handleWebhook({
        signature,
        rawBody,
        payload: req.body,
        url: `${req.protocol}://${req.get('host')}${req.originalUrl}`
      });

      res.status(200).json({
        success: true,
        statusCode: 200,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new WhatsAppController();
