/**
 * ImportBatch Mongoose Model
 * Manages server-authoritative staging of dry-run import records with TTL expiration.
 * Prevents client payload tampering, re-validation bypass, and batch replay attacks.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const importBatchSchema = new Schema(
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
      required: true,
      index: true
    },
    entityType: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true
    },
    validRecords: {
      type: [Schema.Types.Mixed],
      default: []
    },
    totalRows: {
      type: Number,
      default: 0
    },
    validCount: {
      type: Number,
      default: 0
    },
    errorCount: {
      type: Number,
      default: 0
    },
    errors: {
      type: [Schema.Types.Mixed],
      default: []
    },
    status: {
      type: String,
      enum: ['STAGED', 'COMMITTED', 'EXPIRED'],
      default: 'STAGED',
      index: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 } // TTL index to auto-purge uncommitted batches
    }
  },
  {
    timestamps: true,
    suppressReservedKeysWarning: true
  }
);

module.exports = mongoose.model('ImportBatch', importBatchSchema);
