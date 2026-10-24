/**
 * ExportJob Mongoose Model
 * Tracks asynchronous bulk export and import operations, status, record counts, and download expiration.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const exportJobSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true
    },
    jobType: {
      type: String,
      enum: ['EXPORT', 'IMPORT'],
      default: 'EXPORT',
      index: true
    },
    entityType: {
      type: String,
      required: [true, 'Entity type is required'],
      trim: true,
      lowercase: true,
      index: true
    },
    format: {
      type: String,
      enum: ['xlsx', 'csv'],
      default: 'xlsx'
    },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
      default: 'PENDING',
      index: true
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    totalRecords: {
      type: Number,
      default: 0
    },
    fileKey: {
      type: String,
      default: null
    },
    fileName: {
      type: String,
      default: null
    },
    fileSize: {
      type: Number,
      default: 0
    },
    downloadExpiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours retention
    },
    errorDetails: [
      {
        row: { type: Number },
        field: { type: String, default: '' },
        message: { type: String, default: '' }
      }
    ],
    filtersApplied: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

exportJobSchema.index({ companyId: 1, createdAt: -1 });
exportJobSchema.index({ companyId: 1, status: 1 });

module.exports = mongoose.model('ExportJob', exportJobSchema);
