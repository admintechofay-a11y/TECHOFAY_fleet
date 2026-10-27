/**
 * WhatsAppConfig Mongoose Model
 * Per-tenant WhatsApp Business API credentials and provider settings.
 * Supports secure storage and masked retrieval (e.g. ••••••••1234).
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { WhatsAppProvider } = require('../../../shared');

const whatsAppConfigSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      unique: true,
      index: true
    },
    provider: {
      type: String,
      enum: Object.values(WhatsAppProvider),
      default: WhatsAppProvider.MOCK
    },
    isEnabled: {
      type: Boolean,
      default: true
    },
    apiKey: {
      type: String,
      trim: true,
      default: ''
    },
    apiSecret: {
      type: String,
      trim: true,
      default: ''
    },
    phoneNumberId: {
      type: String,
      trim: true,
      default: ''
    },
    webhookSecret: {
      type: String,
      trim: true,
      default: ''
    },
    senderNumber: {
      type: String,
      trim: true,
      default: ''
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true
  }
);

/**
 * Returns safe JSON with secrets masked for frontend consumption
 */
whatsAppConfigSchema.methods.toMaskedJSON = function () {
  const mask = (val) => {
    if (!val || typeof val !== 'string') return '';
    if (val.length <= 4) return '••••';
    return `••••••••${val.slice(-4)}`;
  };

  return {
    _id: this._id,
    companyId: this.companyId,
    provider: this.provider,
    isEnabled: this.isEnabled,
    senderNumber: this.senderNumber || '',
    phoneNumberId: this.phoneNumberId || '',
    hasApiKey: Boolean(this.apiKey),
    maskedApiKey: mask(this.apiKey),
    hasApiSecret: Boolean(this.apiSecret),
    maskedApiSecret: mask(this.apiSecret),
    hasWebhookSecret: Boolean(this.webhookSecret),
    maskedWebhookSecret: mask(this.webhookSecret),
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.model('WhatsAppConfig', whatsAppConfigSchema);
