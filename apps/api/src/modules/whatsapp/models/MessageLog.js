/**
 * MessageLog Mongoose Model
 * Tracks all outbound and inbound WhatsApp communications, templates,
 * delivery lifecycle, retries, and linked operational entities.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;
const {
  WhatsAppProvider,
  WhatsAppMessageType,
  WhatsAppMessageStatus,
  WhatsAppTemplateType
} = require('@fleet/shared');

const messageLogSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true
    },
    provider: {
      type: String,
      enum: Object.values(WhatsAppProvider),
      required: true,
      default: WhatsAppProvider.MOCK
    },
    recipientPhone: {
      type: String,
      required: [true, 'Recipient phone number is required'],
      trim: true
    },
    recipientName: {
      type: String,
      trim: true,
      default: ''
    },
    templateName: {
      type: String,
      enum: [...Object.values(WhatsAppTemplateType), null],
      default: null
    },
    messageType: {
      type: String,
      enum: Object.values(WhatsAppMessageType),
      required: true,
      default: WhatsAppMessageType.TEMPLATE
    },
    payload: {
      type: Schema.Types.Mixed,
      default: {}
    },
    renderedMessage: {
      type: String,
      default: ''
    },
    documentUrl: {
      type: String,
      default: null
    },
    documentFileName: {
      type: String,
      default: null
    },
    providerMessageId: {
      type: String,
      index: true,
      default: null
    },
    status: {
      type: String,
      enum: Object.values(WhatsAppMessageStatus),
      default: WhatsAppMessageStatus.QUEUED,
      index: true
    },
    errorMessage: {
      type: String,
      default: null
    },
    relatedEntity: {
      entityType: {
        type: String,
        enum: ['LOAD', 'LR', 'BILTY', 'TRIP', 'POD', 'DOCUMENT', null],
        default: null
      },
      entityId: {
        type: Schema.Types.ObjectId,
        default: null
      },
      referenceNumber: {
        type: String,
        default: ''
      }
    },
    retryCount: {
      type: Number,
      default: 0
    },
    maxRetries: {
      type: Number,
      default: 3
    },
    lastAttemptAt: {
      type: Date,
      default: null
    },
    nextRetryAllowedAt: {
      type: Date,
      default: null
    },
    deliveredAt: {
      type: Date,
      default: null
    },
    readAt: {
      type: Date,
      default: null
    },
    sentBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for tenant filtering and delivery reporting
messageLogSchema.index({ companyId: 1, createdAt: -1 });
messageLogSchema.index({ companyId: 1, status: 1 });
messageLogSchema.index({ companyId: 1, recipientPhone: 1 });
messageLogSchema.index({ 'relatedEntity.entityType': 1, 'relatedEntity.entityId': 1 });

module.exports = mongoose.model('MessageLog', messageLogSchema);
