/**
 * Company (Tenant / Organization) Mongoose Model
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const companySchema = new Schema(
  {
    legalName: { type: String, required: true, trim: true },
    tradeName: { type: String, required: true, trim: true },
    gstin: { type: String, required: true, uppercase: true, trim: true },
    pan: { type: String, uppercase: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    address: {
      street: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      pincode: { type: String, default: '' },
      country: { type: String, default: 'IN' }
    },
    settings: {
      timezone: { type: String, default: 'Asia/Kolkata' },
      currency: { type: String, default: 'INR' },
      weightUnit: { type: String, enum: ['MT', 'KG', 'QUINTAL'], default: 'MT' },
      distanceUnit: { type: String, enum: ['KM', 'MILE'], default: 'KM' },
      defaultGtaGstRate: { type: Number, default: 5.0 },
      defaultGtaSacCode: { type: String, default: '9965' }
    },
    branding: {
      logoUrl: { type: String, default: '' },
      letterheadHeaderUrl: { type: String, default: '' },
      authorizedSignatoryUrl: { type: String, default: '' }
    },
    isActive: { type: Boolean, default: true }
  },
  {
    timestamps: true
  }
);

companySchema.index({ gstin: 1 });
companySchema.index({ isActive: 1 });

module.exports = mongoose.model('Company', companySchema);
