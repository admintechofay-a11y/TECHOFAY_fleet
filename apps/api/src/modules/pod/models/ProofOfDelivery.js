/**
 * ProofOfDelivery (POD) Mongoose Model
 * Manages physical or digital delivery acknowledgements, uploaded documents, and supervisor verifications.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { PodStatus } = require('../../../shared');

const proofOfDeliverySchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true
    },
    podNumber: {
      type: String,
      required: [true, 'POD number is required'],
      trim: true,
      uppercase: true
    },
    tripId: {
      type: Schema.Types.ObjectId,
      ref: 'Trip',
      required: [true, 'Linked Trip is required'],
      index: true
    },
    loadId: {
      type: Schema.Types.ObjectId,
      ref: 'Load',
      required: [true, 'Linked Load is required'],
      index: true
    },
    lrId: {
      type: Schema.Types.ObjectId,
      ref: 'LrNumber',
      default: null,
      index: true
    },
    stopId: {
      type: Schema.Types.ObjectId,
      default: null
    },
    receiverName: {
      type: String,
      required: [true, 'Receiver full name is required'],
      trim: true
    },
    receiverPhone: {
      type: String,
      trim: true,
      default: ''
    },
    deliveredAt: {
      type: Date,
      default: Date.now
    },
    quantityDelivered: {
      type: Number,
      required: true,
      min: [1, 'Quantity delivered must be at least 1']
    },
    fileKey: {
      type: String,
      required: [true, 'Uploaded POD file reference is required']
    },
    fileName: {
      type: String,
      default: 'pod_document'
    },
    mimeType: {
      type: String,
      default: 'image/jpeg'
    },
    fileSize: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: Object.values(PodStatus),
      default: PodStatus.PENDING_VERIFICATION,
      index: true
    },
    verifiedBySupervisor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    verifiedAt: {
      type: Date,
      default: null
    },
    verificationRemarks: {
      type: String,
      trim: true,
      default: ''
    },
    remarks: {
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

proofOfDeliverySchema.index({ companyId: 1, podNumber: 1 }, { unique: true });
proofOfDeliverySchema.index({ companyId: 1, tripId: 1 });
proofOfDeliverySchema.index({ companyId: 1, loadId: 1 });

module.exports = mongoose.model('ProofOfDelivery', proofOfDeliverySchema);
