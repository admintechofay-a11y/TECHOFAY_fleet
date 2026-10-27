/**
 * CustomerParty Mongoose Model
 * Manages Customers, Consignors, Consignees, and Transporter parties.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { PartyType } = require('../../../shared');

const customerPartySchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Party name is required'],
      trim: true
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      default: ''
    },
    partyType: {
      type: String,
      enum: Object.values(PartyType),
      default: PartyType.CUSTOMER
    },
    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      validate: {
        validator: function (v) {
          if (!v) return true; // GSTIN is optional for non-GST registered small vendors/parties
          return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v);
        },
        message: props => `${props.value} is not a valid 15-character Indian GSTIN format.`
      }
    },
    pan: {
      type: String,
      trim: true,
      uppercase: true,
      validate: {
        validator: function (v) {
          if (!v) return true;
          return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v);
        },
        message: props => `${props.value} is not a valid Indian PAN format.`
      }
    },
    primaryContact: {
      name: { type: String, trim: true, default: '' },
      phone: { type: String, trim: true, default: '' },
      email: { type: String, trim: true, lowercase: true, default: '' },
      designation: { type: String, trim: true, default: '' }
    },
    billingAddress: {
      street: { type: String, trim: true, default: '' },
      city: { type: String, trim: true, default: '' },
      state: { type: String, trim: true, default: '' },
      stateCode: { type: String, trim: true, default: '' },
      pincode: { type: String, trim: true, default: '' }
    },
    deliveryAddresses: [
      {
        label: { type: String, trim: true, default: '' },
        street: { type: String, trim: true, default: '' },
        city: { type: String, trim: true, default: '' },
        state: { type: String, trim: true, default: '' },
        pincode: { type: String, trim: true, default: '' },
        contactPerson: { type: String, trim: true, default: '' },
        contactPhone: { type: String, trim: true, default: '' }
      }
    ],
    paymentTermsDays: {
      type: Number,
      default: 30,
      min: 0
    },
    creditLimitPaise: {
      type: Number,
      default: 0,
      min: 0
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

// Compound indexes
customerPartySchema.index({ companyId: 1, name: 1 });
customerPartySchema.index({ companyId: 1, partyType: 1 });
customerPartySchema.index(
  { companyId: 1, gstin: 1 },
  { unique: true, partialFilterExpression: { gstin: { $type: 'string', $gt: '' } } }
);

module.exports = mongoose.model('CustomerParty', customerPartySchema);
