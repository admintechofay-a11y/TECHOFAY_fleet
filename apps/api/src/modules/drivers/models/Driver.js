/**
 * Driver Mongoose Model
 * Manages Driver profiles, Driving Licence details, and Availability Status.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { DriverStatus, DriverLicenseType } = require('@fleet/shared');

const driverSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Driver full name is required'],
      trim: true
    },
    phone: {
      type: String,
      required: [true, 'Driver contact phone number is required'],
      trim: true
    },
    alternatePhone: {
      type: String,
      trim: true,
      default: ''
    },
    licenseNumber: {
      type: String,
      required: [true, 'Driving licence number is required'],
      trim: true,
      uppercase: true
    },
    licenseType: {
      type: String,
      enum: Object.values(DriverLicenseType),
      default: DriverLicenseType.HMV
    },
    licenseExpiryDate: {
      type: Date,
      required: [true, 'Licence expiry date is required'],
      index: true
    },
    address: {
      type: String,
      trim: true,
      default: ''
    },
    emergencyContact: {
      name: { type: String, trim: true, default: '' },
      relation: { type: String, trim: true, default: '' },
      phone: { type: String, trim: true, default: '' }
    },
    status: {
      type: String,
      enum: Object.values(DriverStatus),
      default: DriverStatus.AVAILABLE,
      index: true
    },
    currentVehicleId: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
      default: null
    },
    currentTripId: {
      type: Schema.Types.ObjectId,
      ref: 'Trip',
      default: null
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual alias: licenceNumber maps seamlessly to licenseNumber
driverSchema
  .virtual('licenceNumber')
  .get(function () {
    return this.licenseNumber;
  })
  .set(function (v) {
    this.licenseNumber = v;
  });

// Compound Unique Index: License unique within tenant
driverSchema.index({ companyId: 1, licenseNumber: 1 }, { unique: true });
driverSchema.index({ companyId: 1, status: 1 });
driverSchema.index({ companyId: 1, licenseExpiryDate: 1 });

module.exports = mongoose.model('Driver', driverSchema);
