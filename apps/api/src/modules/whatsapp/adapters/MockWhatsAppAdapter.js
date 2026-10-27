/**
 * MockWhatsAppAdapter
 * High-fidelity test and local development adapter.
 * Emulates full WhatsApp message delivery and webhook lifecycle without external calls.
 */

const crypto = require('crypto');
const IWhatsAppProvider = require('../interfaces/IWhatsAppProvider');
const { WhatsAppMessageStatus } = require('../../../shared');

class MockWhatsAppAdapter extends IWhatsAppProvider {
  constructor(config = {}) {
    super();
    this.config = config;
    this.name = 'MOCK';
  }

  /**
   * Simulate sending template message
   */
  async sendMessage({ toPhone, templateName, variables, companyId }) {
    const providerMessageId = `mock_tpl_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    // Check for simulated failure trigger for testing retries
    if (toPhone.endsWith('999999')) {
      return {
        success: false,
        providerMessageId: null,
        status: WhatsAppMessageStatus.FAILED,
        error: 'Simulated network timeout error for test number ending in 999999'
      };
    }

    return {
      success: true,
      providerMessageId,
      status: WhatsAppMessageStatus.MOCK_DELIVERED,
      deliveredAt: new Date()
    };
  }

  /**
   * Simulate sending PDF / document
   */
  async sendPdf({ toPhone, pdfUrl, caption, fileName, companyId }) {
    const providerMessageId = `mock_pdf_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    return {
      success: true,
      providerMessageId,
      status: WhatsAppMessageStatus.MOCK_DELIVERED,
      deliveredAt: new Date()
    };
  }

  /**
   * Simulate sending custom text message
   */
  async sendCustomMessage({ toPhone, message, companyId }) {
    const providerMessageId = `mock_txt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    return {
      success: true,
      providerMessageId,
      status: WhatsAppMessageStatus.MOCK_DELIVERED,
      deliveredAt: new Date()
    };
  }

  /**
   * Verify HMAC-SHA256 signature for mock webhooks
   */
  verifyWebhookSignature({ signature, rawBody, webhookSecret }) {
    if (!signature || !webhookSecret) return false;
    const bodyStr = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody || {});
    const cleanSig = signature.replace(/^sha256=/i, '').trim();
    const expected = crypto.createHmac('sha256', webhookSecret).update(bodyStr).digest('hex');

    try {
      return crypto.timingSafeEqual(Buffer.from(cleanSig, 'hex'), Buffer.from(expected, 'hex'));
    } catch {
      return false;
    }
  }

  /**
   * Parse simulated webhook event
   */
  parseWebhookEvent(payload) {
    const providerMessageId = payload.messageId || payload.id || payload.providerMessageId;
    let status = WhatsAppMessageStatus.DELIVERED;

    const rawStatus = String(payload.status || payload.event || '').toLowerCase();
    if (rawStatus.includes('read')) status = WhatsAppMessageStatus.READ;
    else if (rawStatus.includes('deliver')) status = WhatsAppMessageStatus.DELIVERED;
    else if (rawStatus.includes('fail') || rawStatus.includes('undeliver')) status = WhatsAppMessageStatus.FAILED;
    else if (rawStatus.includes('sent') || rawStatus.includes('dispatch')) status = WhatsAppMessageStatus.DISPATCHED;

    return {
      providerMessageId,
      status,
      timestamp: payload.timestamp ? new Date(payload.timestamp) : new Date(),
      error: payload.error || null,
      rawEvent: payload
    };
  }
}

module.exports = MockWhatsAppAdapter;
