/**
 * LrNumber Mongoose Model
 * Manages official Lorry Receipts (LRs), E-Way bill linkage, and lifecycle states.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { LrStatus } = require('@fleet/shared');

const lrNumberSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true
    },
    lrNumber: {
      type: String,
      required: [true, 'LR number is required'],
      trim: true,
      uppercase: true
    },
    isManualNumber: {
      type: Boolean,
      default: false
    },
    loadId: {
      type: Schema.Types.ObjectId,
      ref: 'Load',
      required: [true, 'Linked Load is required'],
      index: true
    },
    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
      default: null,
      index: true
    },
    driverId: {
      type: Schema.Types.ObjectId,
      ref: 'Driver',
      default: null,
      index: true
    },
    consignorId: {
      type: Schema.Types.ObjectId,
      ref: 'CustomerParty',
      required: true
    },
    consigneeId: {
      type: Schema.Types.ObjectId,
      ref: 'CustomerParty',
      required: true
    },
    fromLocationId: {
      type: Schema.Types.ObjectId,
      ref: 'Location',
      default: null
    },
    toLocationId: {
      type: Schema.Types.ObjectId,
      ref: 'Location',
      default: null
    },
    status: {
      type: String,
      enum: Object.values(LrStatus),
      default: LrStatus.BOOKED,
      index: true
    },
    issuedDate: {
      type: Date,
      default: Date.now
    },
    deliveryDate: {
      type: Date,
      default: null
    },
    eWayBillNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: ''
    },
    eWayBillExpiry: {
      type: Date,
      default: null
    },
    pdfFileKey: {
      type: String,
      default: null
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        reason: { type: String, default: '' },
        timestamp: { type: Date, default: Date.now }
      }
    ],
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

// Compound unique index: LR numbers unique within tenant
lrNumberSchema.index({ companyId: 1, lrNumber: 1 }, { unique: true });
lrNumberSchema.index({ companyId: 1, status: 1 });

module.exports = mongoose.model('LrNumber', lrNumberSchema);
