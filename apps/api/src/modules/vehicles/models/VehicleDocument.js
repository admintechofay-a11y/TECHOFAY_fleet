/**
 * VehicleDocument Mongoose Model
 * Tracks regulatory and operational documents (RC, Insurance, PUC, Fitness, Permits).
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { VehicleDocumentType, ComplianceStatus } = require('../../../shared');

const vehicleDocumentSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true
    },
    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
      index: true
    },
    documentType: {
      type: String,
      enum: Object.values(VehicleDocumentType),
      required: [true, 'Document type is required']
    },
    documentNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: ''
    },
    issueDate: {
      type: Date,
      default: null
    },
    expiryDate: {
      type: Date,
      required: [true, 'Document expiry date is required'],
      index: true
    },
    fileKey: {
      type: String,
      required: [true, 'File storage key is required']
    },
    originalFileName: {
      type: String,
      required: true
    },
    mimeType: {
      type: String,
      required: true
    },
    fileSize: {
      type: Number,
      required: true
    },
    complianceStatus: {
      type: String,
      enum: Object.values(ComplianceStatus),
      default: ComplianceStatus.VALID,
      index: true
    },
    notes: {
      type: String,
      trim: true,
      default: ''
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Method to re-calculate compliance status relative to reference date (default now)
vehicleDocumentSchema.methods.calculateComplianceStatus = function (now = new Date()) {
  if (!this.expiryDate) {
    this.complianceStatus = ComplianceStatus.MISSING;
    return this.complianceStatus;
  }
  const expiry = new Date(this.expiryDate);
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    this.complianceStatus = ComplianceStatus.EXPIRED;
  } else if (diffDays <= 30) {
    this.complianceStatus = ComplianceStatus.EXPIRING_SOON;
  } else {
    this.complianceStatus = ComplianceStatus.VALID;
  }

  return this.complianceStatus;
};

// Pre-save hook: auto-evaluate compliance status
vehicleDocumentSchema.pre('save', function (next) {
  this.calculateComplianceStatus();
  next();
});

// Compound indexes
vehicleDocumentSchema.index({ companyId: 1, vehicleId: 1, documentType: 1 });
vehicleDocumentSchema.index({ companyId: 1, expiryDate: 1 });

module.exports = mongoose.model('VehicleDocument', vehicleDocumentSchema);
