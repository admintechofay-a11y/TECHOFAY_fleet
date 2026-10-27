/**
 * InAppNotification Mongoose Model
 * Deduplicated operational alerts and expiry notifications.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { NotificationCategory, NotificationSeverity } = require('../../../shared');

const inAppNotificationSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null, // Null indicates organization-wide broadcast for operations team
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      enum: Object.values(NotificationCategory),
      default: NotificationCategory.DOCUMENT_EXPIRY,
      index: true
    },
    severity: {
      type: String,
      enum: Object.values(NotificationSeverity),
      default: NotificationSeverity.WARNING
    },
    entityType: {
      type: String,
      enum: ['VEHICLE', 'DRIVER', 'VEHICLE_DOC', 'DRIVER_DOC', 'LOAD', 'TRIP', 'SYSTEM'],
      required: true
    },
    entityId: {
      type: Schema.Types.ObjectId,
      default: null
    },
    dedupKey: {
      type: String,
      required: true // e.g. "EXPIRY:VEHICLE_DOC:60a123:2026-10-24"
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true
    },
    readAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Unique compound index for deduplication: same event cannot trigger duplicate alert
inAppNotificationSchema.index({ companyId: 1, dedupKey: 1 }, { unique: true });
inAppNotificationSchema.index({ companyId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('InAppNotification', inAppNotificationSchema);
