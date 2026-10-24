/**
 * InteraktWhatsAppAdapter
 * Production-ready adapter for Interakt WhatsApp Business API.
 */

const crypto = require('crypto');
const IWhatsAppProvider = require('../interfaces/IWhatsAppProvider');
const { WhatsAppMessageStatus } = require('@fleet/shared');

class InteraktWhatsAppAdapter extends IWhatsAppProvider {
  constructor(config = {}) {
    super();
    this.config = config;
    this.name = 'INTERAKT';
    this.baseUrl = config.baseUrl || 'https://api.interakt.ai/v1/public';
  }

  getAuthHeader() {
    if (!this.config.apiKey) {
      throw new Error('Interakt API key is not configured for this organization.');
    }
    const token = Buffer.from(`${this.config.apiKey}:`).toString('base64');
    return `Basic ${token}`;
  }

  /**
   * Send template message via Interakt Public API
   */
  async sendMessage({ toPhone, templateName, variables, companyId }) {
    if (!this.config.apiKey) {
      return {
        success: false,
        providerMessageId: null,
        status: WhatsAppMessageStatus.FAILED,
        error: 'Interakt API key is missing. Please configure credentials in Admin Settings.'
      };
    }

    // Split country code and mobile number
    const match = toPhone.match(/^(\+\d{1,3})(\d+)$/);
    const countryCode = match ? match[1] : '+91';
    const phoneNumber = match ? match[2] : toPhone.replace(/\D/g, '');

    const bodyValues = Object.values(variables || {}).map(String);

    try {
      const response = await fetch(`${this.baseUrl}/message/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.getAuthHeader()
        },
        body: JSON.stringify({
          countryCode,
          phoneNumber,
          type: 'Template',
          template: {
            name: templateName.toLowerCase(),
            languageCode: 'en',
            bodyValues
          }
        })
      });

      const resData = await response.json();
      if (!response.ok || !resData.result) {
        return {
          success: false,
          providerMessageId: null,
          status: WhatsAppMessageStatus.FAILED,
          error: resData.message || `Interakt HTTP ${response.status}`
        };
      }

      return {
        success: true,
        providerMessageId: resData.id || resData.data?.id,
        status: WhatsAppMessageStatus.DISPATCHED
      };
    } catch (err) {
      return {
        success: false,
        providerMessageId: null,
        status: WhatsAppMessageStatus.FAILED,
        error: err.message
      };
    }
  }

  /**
   * Send document / PDF via Interakt
   */
  async sendPdf({ toPhone, pdfUrl, caption, fileName, companyId }) {
    if (!this.config.apiKey) {
      return {
        success: false,
        providerMessageId: null,
        status: WhatsAppMessageStatus.FAILED,
        error: 'Interakt API key is not configured.'
      };
    }

    const match = toPhone.match(/^(\+\d{1,3})(\d+)$/);
    const countryCode = match ? match[1] : '+91';
    const phoneNumber = match ? match[2] : toPhone.replace(/\D/g, '');

    try {
      const response = await fetch(`${this.baseUrl}/message/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.getAuthHeader()
        },
        body: JSON.stringify({
          countryCode,
          phoneNumber,
          type: 'Document',
          document: {
            url: pdfUrl,
            fileName: fileName || 'Document.pdf',
            caption: caption || ''
          }
        })
      });

      const resData = await response.json();
      return {
        success: response.ok,
        providerMessageId: resData.id || resData.data?.id,
        status: response.ok ? WhatsAppMessageStatus.DISPATCHED : WhatsAppMessageStatus.FAILED,
        error: response.ok ? null : (resData.message || 'Interakt document dispatch failed')
      };
    } catch (err) {
      return {
        success: false,
        providerMessageId: null,
        status: WhatsAppMessageStatus.FAILED,
        error: err.message
      };
    }
  }

  /**
   * Direct text message (when customer initiates or 24h window open)
   */
  async sendCustomMessage({ toPhone, message, companyId }) {
    if (!this.config.apiKey) {
      return {
        success: false,
        providerMessageId: null,
        status: WhatsAppMessageStatus.FAILED,
        error: 'Interakt API key is not configured.'
      };
    }

    const match = toPhone.match(/^(\+\d{1,3})(\d+)$/);
    const countryCode = match ? match[1] : '+91';
    const phoneNumber = match ? match[2] : toPhone.replace(/\D/g, '');

    try {
      const response = await fetch(`${this.baseUrl}/message/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.getAuthHeader()
        },
        body: JSON.stringify({
          countryCode,
          phoneNumber,
          type: 'Text',
          text: { body: message }
        })
      });

      const resData = await response.json();
      return {
        success: response.ok,
        providerMessageId: resData.id,
        status: response.ok ? WhatsAppMessageStatus.DISPATCHED : WhatsAppMessageStatus.FAILED,
        error: response.ok ? null : resData.message
      };
    } catch (err) {
      return {
        success: false,
        providerMessageId: null,
        status: WhatsAppMessageStatus.FAILED,
        error: err.message
      };
    }
  }

  /**
   * Verify Interakt webhook signature using HMAC-SHA256
   */
  verifyWebhookSignature({ signature, rawBody, webhookSecret }) {
    const secret = webhookSecret || this.config.webhookSecret;
    if (!signature || !secret) return false;
    const bodyStr = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody || {});
    const cleanSig = signature.replace(/^sha256=/i, '').trim();
    const expected = crypto.createHmac('sha256', secret).update(bodyStr).digest('hex');

    try {
      return crypto.timingSafeEqual(Buffer.from(cleanSig, 'hex'), Buffer.from(expected, 'hex'));
    } catch {
      return false;
    }
  }

  /**
   * Normalize Interakt webhook delivery status
   */
  parseWebhookEvent(payload) {
    const providerMessageId = payload.data?.message?.id || payload.messageId || payload.id;
    const event = String(payload.event || payload.type || '').toLowerCase();

    let status = WhatsAppMessageStatus.DELIVERED;
    if (event.includes('read') || event.includes('seen')) {
      status = WhatsAppMessageStatus.READ;
    } else if (event.includes('deliver')) {
      status = WhatsAppMessageStatus.DELIVERED;
    } else if (event.includes('fail') || event.includes('error') || event.includes('undelivered')) {
      status = WhatsAppMessageStatus.FAILED;
    } else if (event.includes('sent') || event.includes('dispatched')) {
      status = WhatsAppMessageStatus.DISPATCHED;
    }

    return {
      providerMessageId,
      status,
      timestamp: payload.timestamp ? new Date(payload.timestamp) : new Date(),
      error: payload.data?.error || null,
      rawEvent: payload
    };
  }
}

module.exports = InteraktWhatsAppAdapter;
