/**
 * WhatsAppAdapterFactory
 * Resolves the appropriate WhatsApp provider adapter instance
 * based on organization-specific configuration or system environment defaults.
 */

const MockWhatsAppAdapter = require('./MockWhatsAppAdapter');
const InteraktWhatsAppAdapter = require('./InteraktWhatsAppAdapter');
const TwilioWhatsAppAdapter = require('./TwilioWhatsAppAdapter');
const { WhatsAppProvider } = require('@fleet/shared');

class WhatsAppAdapterFactory {
  /**
   * Get provider adapter for a tenant organization
   * @param {Object} tenantConfig WhatsAppConfig model or plain object
   * @returns {import('../interfaces/IWhatsAppProvider')}
   */
  static getAdapter(tenantConfig = null) {
    const providerName = (
      tenantConfig?.provider ||
      process.env.WHATSAPP_PROVIDER ||
      WhatsAppProvider.MOCK
    ).toUpperCase();

    const config = {
      apiKey: tenantConfig?.apiKey || process.env.WHATSAPP_API_KEY || '',
      apiSecret: tenantConfig?.apiSecret || process.env.WHATSAPP_API_SECRET || '',
      phoneNumberId: tenantConfig?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      webhookSecret: tenantConfig?.webhookSecret || process.env.WHATSAPP_WEBHOOK_SECRET || '',
      senderNumber: tenantConfig?.senderNumber || process.env.WHATSAPP_SENDER_NUMBER || ''
    };

    switch (providerName) {
      case WhatsAppProvider.INTERAKT:
        return new InteraktWhatsAppAdapter(config);
      case WhatsAppProvider.TWILIO:
        return new TwilioWhatsAppAdapter(config);
      case WhatsAppProvider.MOCK:
      default:
        return new MockWhatsAppAdapter(config);
    }
  }
}

module.exports = WhatsAppAdapterFactory;
