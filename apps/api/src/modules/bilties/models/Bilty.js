/**
 * Bilty Mongoose Model
 * Manages Consignment Notes, Goods Transport Agency (GTA SAC 9965) billing terms, and balances.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { BiltyStatus, PaymentTerms } = require('@fleet/shared');

const biltySchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true
    },
    biltyNumber: {
      type: String,
      required: [true, 'Bilty number is required'],
      trim: true,
      uppercase: true
    },
    lrId: {
      type: Schema.Types.ObjectId,
      ref: 'LrNumber',
      required: [true, 'Linked LR is required'],
      index: true
    },
    loadId: {
      type: Schema.Types.ObjectId,
      ref: 'Load',
      required: [true, 'Linked Load is required'],
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
    paymentTerms: {
      type: String,
      enum: Object.values(PaymentTerms),
      default: PaymentTerms.TO_PAY
    },
    totalFreightPaise: {
      type: Number,
      required: true,
      min: 0
    },
    advancePaise: {
      type: Number,
      default: 0,
      min: 0
    },
    balancePaise: {
      type: Number,
      required: true
    },
    gstGtaRate: {
      type: Number,
      default: 5.0 // Default 5.0% GTA GST
    },
    gstGtaSac: {
      type: String,
      default: '9965' // SAC 9965 Goods Transport Agency
    },
    status: {
      type: String,
      enum: Object.values(BiltyStatus),
      default: BiltyStatus.ISSUED,
      index: true
    },
    pdfFileKey: {
      type: String,
      default: null
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

// Compound unique index: Bilty numbers unique within tenant
biltySchema.index({ companyId: 1, biltyNumber: 1 }, { unique: true });

module.exports = mongoose.model('Bilty', biltySchema);
