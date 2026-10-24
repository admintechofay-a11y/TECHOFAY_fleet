/**
 * AuditLog (Append-Only) Mongoose Model
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { SystemModule, AuditAction } = require('@fleet/shared');

const auditLogSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      default: null
    },
    module: {
      type: String,
      lowercase: true,
      enum: Object.values(SystemModule),
      required: true
    },
    action: {
      type: String,
      uppercase: true,
      enum: Object.values(AuditAction),
      required: true
    },
    entityId: {
      type: Schema.Types.Mixed,
      default: null
    },
    oldValues: {
      type: Schema.Types.Mixed,
      default: null
    },
    newValues: {
      type: Schema.Types.Mixed,
      default: null
    },
    ipAddress: {
      type: String,
      default: ''
    },
    userAgent: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

auditLogSchema.index({ companyId: 1, module: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
