/**
 * TwilioWhatsAppAdapter
 * Production adapter for Twilio WhatsApp Programmable Messaging API.
 */

const crypto = require('crypto');
const IWhatsAppProvider = require('../interfaces/IWhatsAppProvider');
const { WhatsAppMessageStatus } = require('@fleet/shared');

class TwilioWhatsAppAdapter extends IWhatsAppProvider {
  constructor(config = {}) {
    super();
    this.config = config;
    this.name = 'TWILIO';
    this.accountSid = config.apiKey || process.env.TWILIO_ACCOUNT_SID;
    this.authToken = config.apiSecret || process.env.TWILIO_AUTH_TOKEN;
    this.senderNumber = config.senderNumber || process.env.TWILIO_WHATSAPP_SENDER || '+14155238886';
  }

  getAuthHeader() {
    if (!this.accountSid || !this.authToken) {
      throw new Error('Twilio Account SID or Auth Token is not configured.');
    }
    const token = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
    return `Basic ${token}`;
  }

  async sendMessage({ toPhone, templateName, variables, companyId }) {
    if (!this.accountSid || !this.authToken) {
      return {
        success: false,
        providerMessageId: null,
        status: WhatsAppMessageStatus.FAILED,
        error: 'Twilio credentials not configured.'
      };
    }

    const varList = Object.entries(variables || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
    const bodyText = `[${templateName}]\n${varList}`;

    return this._postToTwilio({ toPhone, body: bodyText });
  }

  async sendPdf({ toPhone, pdfUrl, caption, fileName, companyId }) {
    return this._postToTwilio({ toPhone, body: caption || 'Document attachment', mediaUrl: pdfUrl });
  }

  async sendCustomMessage({ toPhone, message, companyId }) {
    return this._postToTwilio({ toPhone, body: message });
  }

  async _postToTwilio({ toPhone, body, mediaUrl }) {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
      const params = new URLSearchParams();
      params.append('From', `whatsapp:${this.senderNumber}`);
      params.append('To', `whatsapp:${toPhone}`);
      params.append('Body', body);
      if (mediaUrl) params.append('MediaUrl', mediaUrl);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: this.getAuthHeader()
        },
        body: params.toString()
      });

      const resData = await response.json();
      if (!response.ok) {
        return {
          success: false,
          providerMessageId: null,
          status: WhatsAppMessageStatus.FAILED,
          error: resData.message || `Twilio error ${resData.code}`
        };
      }

      return {
        success: true,
        providerMessageId: resData.sid,
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

  verifyWebhookSignature({ signature, rawBody, webhookSecret, url, params }) {
    const secret = webhookSecret || this.authToken;
    if (!signature || !secret) return false;

    // 1. Official Twilio HMAC-SHA1 protocol: URL + sorted key-value pairs encoded in Base64
    const dataParams = params || (typeof rawBody === 'object' && rawBody !== null ? rawBody : {});
    const targetUrl = url || '';
    let twilioData = targetUrl;
    const sortedKeys = Object.keys(dataParams).sort();
    for (const key of sortedKeys) {
      twilioData += key + dataParams[key];
    }
    const expectedTwilio = crypto.createHmac('sha1', secret).update(twilioData, 'utf-8').digest('base64');
    if (signature === expectedTwilio) return true;
    try {
      if (
        Buffer.byteLength(signature) === Buffer.byteLength(expectedTwilio) &&
        crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedTwilio))
      ) {
        return true;
      }
    } catch {}

    // 2. Fallback HMAC-SHA256 check on raw body for generic/test webhook payloads
    const bodyStr = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody || {});
    const cleanSig = signature.replace(/^sha256=/i, '').trim();
    const expectedSha256 = crypto.createHmac('sha256', secret).update(bodyStr).digest('hex');
    try {
      if (
        Buffer.byteLength(cleanSig, 'hex') === Buffer.byteLength(expectedSha256, 'hex') &&
        crypto.timingSafeEqual(Buffer.from(cleanSig, 'hex'), Buffer.from(expectedSha256, 'hex'))
      ) {
        return true;
      }
    } catch {}

    return false;
  }

  parseWebhookEvent(payload) {
    const providerMessageId = payload.MessageSid || payload.SmsSid;
    const msgStatus = String(payload.MessageStatus || payload.SmsStatus || '').toLowerCase();

    let status = WhatsAppMessageStatus.DELIVERED;
    if (msgStatus === 'read') status = WhatsAppMessageStatus.READ;
    else if (msgStatus === 'delivered') status = WhatsAppMessageStatus.DELIVERED;
    else if (msgStatus === 'failed' || msgStatus === 'undelivered') status = WhatsAppMessageStatus.FAILED;
    else if (msgStatus === 'sent' || msgStatus === 'queued') status = WhatsAppMessageStatus.DISPATCHED;

    return {
      providerMessageId,
      status,
      timestamp: new Date(),
      error: payload.ErrorMessage || null,
      rawEvent: payload
    };
  }
}

module.exports = TwilioWhatsAppAdapter;
