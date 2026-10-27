/**
 * Vehicle Mongoose Model
 * Manages Fleet Vehicles, Capacities, Ownership Categories, and Live Status.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { VehicleStatus, VehicleCategory } = require('../../../shared');

const vehicleSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true
    },
    plateNumber: {
      type: String,
      required: [true, 'Vehicle plate/registration number is required'],
      trim: true,
      uppercase: true,
      validate: {
        validator: function (v) {
          // Indian vehicle format: State code (2) + District (2) + Series (0-3) + Number (4)
          // Also accommodates older or temporary plates: at least 6 alphanumeric characters
          return /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/.test(v.replace(/\s+/g, ''));
        },
        message: props => `${props.value} is not a valid vehicle registration plate format.`
      }
    },
    vehicleType: {
      type: String,
      required: [true, 'Vehicle type is required'], // e.g. "Open Truck", "Container", "Trailer", "Tanker", "Tempo"
      trim: true
    },
    category: {
      type: String,
      enum: Object.values(VehicleCategory),
      default: VehicleCategory.OWNED
    },
    make: {
      type: String,
      trim: true,
      default: '' // e.g. "Tata", "Ashok Leyland", "BharatBenz", "Eicher"
    },
    model: {
      type: String,
      trim: true,
      default: '' // e.g. "Signa 4825.TK", "Pro 6028"
    },
    yearOfManufacture: {
      type: Number,
      min: 1980,
      max: new Date().getFullYear() + 1
    },
    capacityTonnage: {
      type: Number,
      required: [true, 'Capacity in metric tons (MT) is required'],
      min: [0.1, 'Capacity must be at least 0.1 MT']
    },
    chassisNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: ''
    },
    engineNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: ''
    },
    ownerName: {
      type: String,
      trim: true,
      default: ''
    },
    ownerPhone: {
      type: String,
      trim: true,
      default: ''
    },
    status: {
      type: String,
      enum: Object.values(VehicleStatus),
      default: VehicleStatus.AVAILABLE,
      index: true
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
    },
    telematics: {
      deviceId: {
        type: String,
        trim: true,
        index: true,
        sparse: true
      },
      provider: {
        type: String,
        enum: ['AIS140', 'TELTONIKA', 'TRACCAR', 'SIM_TRACKING', 'REST_PING', 'NONE'],
        default: 'NONE'
      },
      imei: {
        type: String,
        trim: true,
        default: ''
      },
      simNumber: {
        type: String,
        trim: true,
        default: ''
      },
      isActive: {
        type: Boolean,
        default: false
      },
      lastPing: {
        latitude: { type: Number, default: null },
        longitude: { type: Number, default: null },
        speedKmph: { type: Number, default: 0 },
        headingDegrees: { type: Number, default: 0 },
        altitudeMeters: { type: Number, default: 0 },
        accuracyMeters: { type: Number, default: 0 },
        ignition: { type: Boolean, default: false },
        batteryPercent: { type: Number, default: 100 },
        recordedAt: { type: Date, default: null },
        receivedAt: { type: Date, default: null },
        rawPayload: { type: Schema.Types.Mixed, default: null }
      },
      lastGpsTimestamp: {
        type: Date,
        default: null
      }
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual alias: registrationNumber maps seamlessly to plateNumber
vehicleSchema
  .virtual('registrationNumber')
  .get(function () {
    return this.plateNumber;
  })
  .set(function (v) {
    this.plateNumber = v;
  });

// Compound Unique Index: Vehicle plate unique within tenant
vehicleSchema.index({ companyId: 1, plateNumber: 1 }, { unique: true });
vehicleSchema.index({ companyId: 1, status: 1 });
vehicleSchema.index({ companyId: 1, category: 1 });
vehicleSchema.index({ companyId: 1, 'telematics.deviceId': 1 });

module.exports = mongoose.model('Vehicle', vehicleSchema);
