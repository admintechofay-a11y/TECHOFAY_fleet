/**
 * Location Mongoose Model
 * Manages Loading points, Unloading points, Hubs, and Waypoints.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { LocationType } = require('@fleet/shared');

const locationSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Location name is required'],
      trim: true
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      default: ''
    },
    locationType: {
      type: String,
      enum: Object.values(LocationType),
      default: LocationType.PICKUP
    },
    address: {
      street: { type: String, trim: true, default: '' },
      city: { type: String, required: [true, 'City is required'], trim: true },
      state: { type: String, required: [true, 'State is required'], trim: true },
      pincode: { type: String, trim: true, default: '' }
    },
    coordinates: {
      lat: { type: Number, min: -90, max: 90, default: null },
      lng: { type: Number, min: -180, max: 180, default: null }
    },
    contactPerson: {
      type: String,
      trim: true,
      default: ''
    },
    contactPhone: {
      type: String,
      trim: true,
      default: ''
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'CustomerParty',
      default: null,
      index: true
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
locationSchema.index({ companyId: 1, name: 1 });
locationSchema.index({ companyId: 1, locationType: 1 });

module.exports = mongoose.model('Location', locationSchema);
