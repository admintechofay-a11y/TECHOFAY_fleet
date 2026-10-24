/**
 * IWhatsAppProvider Interface
 * Formal contract for all WhatsApp Business API adapters (Mock, Interakt, Twilio).
 */

class IWhatsAppProvider {
  /**
   * Send pre-approved template message
   * @param {Object} params
   * @param {string} params.toPhone E.164 normalized recipient phone
   * @param {string} params.templateName Approved template identifier
   * @param {Object} params.variables Template placeholder variable values
   * @param {string} params.companyId Tenant company identifier
   * @returns {Promise<{ success: boolean, providerMessageId: string, status: string, error?: string }>}
   */
  async sendMessage(params) {
    throw new Error('sendMessage() must be implemented by adapter.');
  }

  /**
   * Send media / PDF document
   * @param {Object} params
   * @param {string} params.toPhone E.164 normalized recipient phone
   * @param {string} params.pdfUrl Public or authenticated stream URL
   * @param {string} params.caption Message caption / note
   * @param {string} params.fileName Display document file name
   * @param {string} params.companyId Tenant company identifier
   * @returns {Promise<{ success: boolean, providerMessageId: string, status: string, error?: string }>}
   */
  async sendPdf(params) {
    throw new Error('sendPdf() must be implemented by adapter.');
  }

  /**
   * Send direct custom text message
   * @param {Object} params
   * @param {string} params.toPhone E.164 normalized recipient phone
   * @param {string} params.message Text message content
   * @param {string} params.companyId Tenant company identifier
   * @returns {Promise<{ success: boolean, providerMessageId: string, status: string, error?: string }>}
   */
  async sendCustomMessage(params) {
    throw new Error('sendCustomMessage() must be implemented by adapter.');
  }

  /**
   * Verify authenticity of inbound webhook
   * @param {Object} params
   * @param {string} params.signature Header signature (HMAC-SHA256)
   * @param {string|Buffer} params.rawBody Raw request payload body
   * @param {string} params.webhookSecret Configured webhook secret
   * @returns {boolean}
   */
  verifyWebhookSignature(params) {
    throw new Error('verifyWebhookSignature() must be implemented by adapter.');
  }

  /**
   * Normalize inbound provider webhook event to standard status structure
   * @param {Object} payload Raw webhook body
   * @returns {{ providerMessageId: string, status: string, timestamp: Date, rawEvent: any }}
   */
  parseWebhookEvent(payload) {
    throw new Error('parseWebhookEvent() must be implemented by adapter.');
  }
}

module.exports = IWhatsAppProvider;
