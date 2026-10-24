/**
 * WhatsApp Core Communication Service
 * Orchestrates template rendering, document attachments, provider dispatch,
 * webhook processing, retry backoff, and tenant isolation.
 */

const MessageLog = require('../models/MessageLog');
const WhatsAppConfig = require('../models/WhatsAppConfig');
const WhatsAppAdapterFactory = require('../adapters/WhatsAppAdapterFactory');
const { normalizePhoneNumber, renderTemplate } = require('./whatsappTemplate.service');
const auditLogService = require('../../audit/services/auditLog.service');
const LrNumber = require('../../lr/models/LrNumber');
const Bilty = require('../../bilties/models/Bilty');
const Load = require('../../loads/models/Load');
const Trip = require('../../trips/models/Trip');
const {
  SystemModule,
  AuditAction,
  WhatsAppMessageType,
  WhatsAppMessageStatus,
  WhatsAppTemplateType
} = require('@fleet/shared');
const { AppError } = require('../../../middleware/errorHandler');

class WhatsAppService {
  /**
   * Resolve tenant-specific provider configuration or create default mock
   */
  async getTenantConfig(companyId) {
    let config = await WhatsAppConfig.findOne({ companyId });
    if (!config) {
      config = await WhatsAppConfig.create({
        companyId,
        provider: 'MOCK',
        isEnabled: true
      });
    }
    return config;
  }

  /**
   * 1. Send Pre-Approved Template Message
   */
  async sendMessage({ companyId, toPhone, recipientName = '', templateName, variables = {}, relatedEntity = null, userId = null, ipAddress = '' }) {
    if (!companyId) throw new AppError('Tenant company ID is required.', 400);

    const normalizedPhone = normalizePhoneNumber(toPhone);
    const renderedMessage = renderTemplate(templateName, variables);

    const tenantConfig = await this.getTenantConfig(companyId);
    if (!tenantConfig.isEnabled) {
      throw new AppError('WhatsApp notifications are disabled for this organization.', 400);
    }

    const adapter = WhatsAppAdapterFactory.getAdapter(tenantConfig);

    // Initial queued log
    const messageLog = new MessageLog({
      companyId,
      provider: adapter.name,
      recipientPhone: normalizedPhone,
      recipientName,
      templateName,
      messageType: WhatsAppMessageType.TEMPLATE,
      payload: variables,
      renderedMessage,
      status: WhatsAppMessageStatus.QUEUED,
      relatedEntity: relatedEntity || undefined,
      sentBy: userId
    });
    await messageLog.save();

    // Dispatch via selected provider adapter
    const result = await adapter.sendMessage({
      toPhone: normalizedPhone,
      templateName,
      variables,
      companyId: companyId.toString()
    });

    messageLog.status = result.status;
    messageLog.providerMessageId = result.providerMessageId;
    messageLog.errorMessage = result.error || null;
    messageLog.lastAttemptAt = new Date();
    if (result.status === WhatsAppMessageStatus.MOCK_DELIVERED || result.status === WhatsAppMessageStatus.DELIVERED) {
      messageLog.deliveredAt = new Date();
    }
    await messageLog.save();

    // Audit log
    await auditLogService.logAction({
      companyId,
      actorId: userId,
      module: SystemModule.WHATSAPP,
      action: AuditAction.CREATE,
      entityId: messageLog._id.toString(),
      newValues: {
        recipientPhone: normalizedPhone,
        templateName,
        status: messageLog.status,
        provider: adapter.name
      },
      ipAddress
    });

    return messageLog;
  }

  /**
   * 2. Send Document / PDF via WhatsApp
   */
  async sendDocument({ companyId, toPhone, recipientName = '', documentType, documentId, caption = '', userId = null, ipAddress = '' }) {
    if (!companyId) throw new AppError('Tenant company ID is required.', 400);
    const normalizedPhone = normalizePhoneNumber(toPhone);

    // Resolve document details and construct server download URL
    let docRefNumber = '';
    let fileName = `${documentType.toLowerCase()}_${documentId}.pdf`;

    if (documentType.toUpperCase() === 'LR') {
      const lr = await LrNumber.findOne({ _id: documentId, companyId });
      if (!lr) throw new AppError('Lorry Receipt document not found.', 404);
      docRefNumber = lr.lrNumber;
      fileName = `LR_${lr.lrNumber}.pdf`;
    } else if (documentType.toUpperCase() === 'BILTY') {
      const bilty = await Bilty.findOne({ _id: documentId, companyId });
      if (!bilty) throw new AppError('Bilty document not found.', 404);
      docRefNumber = bilty.biltyNumber;
      fileName = `Bilty_${bilty.biltyNumber}.pdf`;
    }

    const documentUrl = `/api/v1/documents/${documentType.toLowerCase()}/${documentId}/pdf`;
    const finalCaption = caption || `Official ${documentType} document: ${docRefNumber}`;

    const tenantConfig = await this.getTenantConfig(companyId);
    const adapter = WhatsAppAdapterFactory.getAdapter(tenantConfig);

    const messageLog = new MessageLog({
      companyId,
      provider: adapter.name,
      recipientPhone: normalizedPhone,
      recipientName,
      messageType: WhatsAppMessageType.PDF,
      documentUrl,
      documentFileName: fileName,
      renderedMessage: finalCaption,
      status: WhatsAppMessageStatus.QUEUED,
      relatedEntity: {
        entityType: documentType.toUpperCase(),
        entityId: documentId,
        referenceNumber: docRefNumber
      },
      sentBy: userId
    });
    await messageLog.save();

    const result = await adapter.sendPdf({
      toPhone: normalizedPhone,
      pdfUrl: documentUrl,
      caption: finalCaption,
      fileName,
      companyId: companyId.toString()
    });

    messageLog.status = result.status;
    messageLog.providerMessageId = result.providerMessageId;
    messageLog.errorMessage = result.error || null;
    messageLog.lastAttemptAt = new Date();
    if (result.status === WhatsAppMessageStatus.MOCK_DELIVERED || result.status === WhatsAppMessageStatus.DELIVERED) {
      messageLog.deliveredAt = new Date();
    }
    await messageLog.save();

    await auditLogService.logAction({
      companyId,
      actorId: userId,
      module: SystemModule.WHATSAPP,
      action: AuditAction.CREATE,
      entityId: messageLog._id,
      newValues: {
        recipientPhone: normalizedPhone,
        documentType,
        documentId,
        status: messageLog.status
      },
      ipAddress
    });

    return messageLog;
  }

  /**
   * 3. Send Direct Custom Text Message
   */
  async sendCustomText({ companyId, toPhone, recipientName = '', message, relatedEntity = null, userId = null, ipAddress = '' }) {
    if (!companyId) throw new AppError('Tenant company ID is required.', 400);
    if (!message || !message.trim()) throw new AppError('Message body cannot be empty.', 400);

    const normalizedPhone = normalizePhoneNumber(toPhone);
    const tenantConfig = await this.getTenantConfig(companyId);
    const adapter = WhatsAppAdapterFactory.getAdapter(tenantConfig);

    const messageLog = new MessageLog({
      companyId,
      provider: adapter.name,
      recipientPhone: normalizedPhone,
      recipientName,
      messageType: WhatsAppMessageType.CUSTOM_TEXT,
      renderedMessage: message.trim(),
      status: WhatsAppMessageStatus.QUEUED,
      relatedEntity: relatedEntity || undefined,
      sentBy: userId
    });
    await messageLog.save();

    const result = await adapter.sendCustomMessage({
      toPhone: normalizedPhone,
      message: message.trim(),
      companyId: companyId.toString()
    });

    messageLog.status = result.status;
    messageLog.providerMessageId = result.providerMessageId;
    messageLog.errorMessage = result.error || null;
    messageLog.lastAttemptAt = new Date();
    if (result.status === WhatsAppMessageStatus.MOCK_DELIVERED || result.status === WhatsAppMessageStatus.DELIVERED) {
      messageLog.deliveredAt = new Date();
    }
    await messageLog.save();

    return messageLog;
  }

  /**
   * 4. Retry Failed Message with Exponential Backoff Tracking
   */
  async retryFailedMessage(messageId, companyId, userId = null, ipAddress = '') {
    const messageLog = await MessageLog.findOne({ _id: messageId, companyId });
    if (!messageLog) {
      throw new AppError('Message log record not found.', 404);
    }

    if (messageLog.status !== WhatsAppMessageStatus.FAILED) {
      throw new AppError(`Cannot retry message with status '${messageLog.status}'. Only FAILED messages can be retried.`, 400);
    }

    if (messageLog.retryCount >= messageLog.maxRetries) {
      throw new AppError(`Maximum retry limit of ${messageLog.maxRetries} attempts has been reached for this message.`, 400);
    }

    messageLog.retryCount += 1;
    messageLog.lastAttemptAt = new Date();

    const tenantConfig = await this.getTenantConfig(companyId);
    const adapter = WhatsAppAdapterFactory.getAdapter(tenantConfig);

    let result;
    if (messageLog.messageType === WhatsAppMessageType.TEMPLATE) {
      result = await adapter.sendMessage({
        toPhone: messageLog.recipientPhone,
        templateName: messageLog.templateName,
        variables: messageLog.payload,
        companyId: companyId.toString()
      });
    } else if (messageLog.messageType === WhatsAppMessageType.PDF) {
      result = await adapter.sendPdf({
        toPhone: messageLog.recipientPhone,
        pdfUrl: messageLog.documentUrl,
        caption: messageLog.renderedMessage,
        fileName: messageLog.documentFileName,
        companyId: companyId.toString()
      });
    } else {
      result = await adapter.sendCustomMessage({
        toPhone: messageLog.recipientPhone,
        message: messageLog.renderedMessage,
        companyId: companyId.toString()
      });
    }

    messageLog.status = result.status;
    messageLog.providerMessageId = result.providerMessageId || messageLog.providerMessageId;
    messageLog.errorMessage = result.error || null;
    if (result.status === WhatsAppMessageStatus.DELIVERED || result.status === WhatsAppMessageStatus.MOCK_DELIVERED) {
      messageLog.deliveredAt = new Date();
    }
    await messageLog.save();

    await auditLogService.logAction({
      companyId,
      actorId: userId,
      module: SystemModule.WHATSAPP,
      action: AuditAction.UPDATE,
      entityId: messageLog._id,
      newValues: {
        retryAttempt: messageLog.retryCount,
        status: messageLog.status
      },
      ipAddress
    });

    return messageLog;
  }

  /**
   * 5. Process Inbound Webhook with HMAC Signature Verification & Idempotency
   */
  async handleWebhook({ signature, rawBody, payload }) {
    if (!signature) {
      throw new AppError('Missing webhook signature header.', 401);
    }

    // Identify provider message ID to locate the tenant and matching message log
    const providerMessageId =
      payload?.providerMessageId ||
      payload?.data?.message?.id ||
      payload?.messageId ||
      payload?.id ||
      payload?.MessageSid ||
      payload?.SmsSid;

    if (!providerMessageId) {
      throw new AppError('Unable to extract providerMessageId from webhook payload.', 400);
    }

    const messageLog = await MessageLog.findOne({ providerMessageId });
    if (!messageLog) {
      // Return 200 acknowledged even if message not tracked (prevents provider retrying indefinitely)
      return { acknowledged: true, processed: false, reason: 'Message record not found in system.' };
    }

    const tenantConfig = await this.getTenantConfig(messageLog.companyId);
    const adapter = WhatsAppAdapterFactory.getAdapter(tenantConfig);

    // Verify cryptographic HMAC signature
    const isValid = adapter.verifyWebhookSignature({
      signature,
      rawBody,
      webhookSecret: tenantConfig.webhookSecret || process.env.WHATSAPP_WEBHOOK_SECRET
    });

    if (!isValid) {
      throw new AppError('Invalid webhook HMAC signature.', 401);
    }

    // Parse event details
    const parsedEvent = adapter.parseWebhookEvent(payload);

    // Idempotent status update: do NOT downgrade status (e.g. READ to DELIVERED)
    const statusHierarchy = {
      [WhatsAppMessageStatus.QUEUED]: 1,
      [WhatsAppMessageStatus.DISPATCHED]: 2,
      [WhatsAppMessageStatus.FAILED]: 2,
      [WhatsAppMessageStatus.DELIVERED]: 3,
      [WhatsAppMessageStatus.MOCK_DELIVERED]: 3,
      [WhatsAppMessageStatus.READ]: 4
    };

    const currentRank = statusHierarchy[messageLog.status] || 0;
    const newRank = statusHierarchy[parsedEvent.status] || 0;

    if (newRank > currentRank || messageLog.status === WhatsAppMessageStatus.FAILED) {
      messageLog.status = parsedEvent.status;
      if (parsedEvent.status === WhatsAppMessageStatus.DELIVERED) {
        messageLog.deliveredAt = parsedEvent.timestamp;
      } else if (parsedEvent.status === WhatsAppMessageStatus.READ) {
        messageLog.readAt = parsedEvent.timestamp;
        if (!messageLog.deliveredAt) messageLog.deliveredAt = parsedEvent.timestamp;
      }
      if (parsedEvent.error) {
        messageLog.errorMessage = parsedEvent.error;
      }
      await messageLog.save();
    }

    return { acknowledged: true, processed: true, messageId: messageLog._id, newStatus: messageLog.status };
  }

  /**
   * 6. Query Message History (Tenant-Scoped)
   */
  async getMessages(companyId, { page = 1, limit = 20, status, search, recipientPhone } = {}) {
    const filter = { companyId };

    if (status && Object.values(WhatsAppMessageStatus).includes(status.toUpperCase())) {
      filter.status = status.toUpperCase();
    }

    if (recipientPhone) {
      filter.recipientPhone = { $regex: recipientPhone.trim(), $options: 'i' };
    }

    if (search) {
      const q = search.trim();
      filter.$or = [
        { recipientPhone: { $regex: q, $options: 'i' } },
        { recipientName: { $regex: q, $options: 'i' } },
        { renderedMessage: { $regex: q, $options: 'i' } },
        { 'relatedEntity.referenceNumber': { $regex: q, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const [messages, total] = await Promise.all([
      MessageLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(take)
        .populate('sentBy', 'name email'),
      MessageLog.countDocuments(filter)
    ]);

    return {
      messages,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / take)
    };
  }

  /**
   * 7. Get Message by ID
   */
  async getMessageById(messageId, companyId) {
    const message = await MessageLog.findOne({ _id: messageId, companyId })
      .populate('sentBy', 'name email');
    if (!message) {
      throw new AppError('Message log record not found.', 404);
    }
    return message;
  }

  /**
   * 8. Retrieve Tenant WhatsApp Configuration (Masked)
   */
  async getConfig(companyId) {
    const config = await this.getTenantConfig(companyId);
    return config.toMaskedJSON();
  }

  /**
   * 9. Update Tenant WhatsApp Configuration
   */
  async updateConfig(companyId, data, userId = null, ipAddress = '') {
    let config = await WhatsAppConfig.findOne({ companyId });
    if (!config) {
      config = new WhatsAppConfig({ companyId });
    }

    if (data.provider) config.provider = data.provider.toUpperCase();
    if (typeof data.isEnabled === 'boolean') config.isEnabled = data.isEnabled;
    if (data.senderNumber !== undefined) config.senderNumber = data.senderNumber.trim();
    if (data.phoneNumberId !== undefined) config.phoneNumberId = data.phoneNumberId.trim();

    // Only update secrets if non-empty and not masked
    if (data.apiKey && !data.apiKey.includes('••••')) config.apiKey = data.apiKey.trim();
    if (data.apiSecret && !data.apiSecret.includes('••••')) config.apiSecret = data.apiSecret.trim();
    if (data.webhookSecret && !data.webhookSecret.includes('••••')) config.webhookSecret = data.webhookSecret.trim();

    config.updatedBy = userId;
    await config.save();

    await auditLogService.logAction({
      companyId,
      actorId: userId,
      module: SystemModule.SETTINGS,
      action: AuditAction.UPDATE,
      entityId: config._id,
      newValues: {
        provider: config.provider,
        isEnabled: config.isEnabled,
        hasApiKey: Boolean(config.apiKey)
      },
      ipAddress
    });

    return config.toMaskedJSON();
  }
}

module.exports = new WhatsAppService();
