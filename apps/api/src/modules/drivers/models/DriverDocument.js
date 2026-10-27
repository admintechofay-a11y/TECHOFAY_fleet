/**
 * DriverDocument Mongoose Model
 * Tracks regulatory and identity documents for drivers (Driving Licence, Aadhaar, PAN, Police Verification).
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { DriverDocumentType, ComplianceStatus } = require('../../../shared');

const driverDocumentSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true
    },
    driverId: {
      type: Schema.Types.ObjectId,
      ref: 'Driver',
      required: true,
      index: true
    },
    documentType: {
      type: String,
      enum: Object.values(DriverDocumentType),
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
      default: null, // Note: PAN and Aadhaar do not have expiry dates, whereas DL and Medical do
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
driverDocumentSchema.methods.calculateComplianceStatus = function (now = new Date()) {
  if (!this.expiryDate) {
    this.complianceStatus = ComplianceStatus.VALID; // Non-expiring documents (e.g. Aadhaar, PAN) are VALID
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
driverDocumentSchema.pre('save', function (next) {
  this.calculateComplianceStatus();
  next();
});

// Compound indexes
driverDocumentSchema.index({ companyId: 1, driverId: 1, documentType: 1 });
driverDocumentSchema.index({ companyId: 1, expiryDate: 1 });

module.exports = mongoose.model('DriverDocument', driverDocumentSchema);
