/**
 * Load & LoadStop Mongoose Model
 * Manages Consignment Orders, Multi-Stop Waypoints, Assigned Assets, and Integer Paise Financials.
 */

const crypto = require('crypto');
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { LoadStatus, StopType, StopStatus } = require('@fleet/shared');

const loadStopSchema = new Schema(
  {
    sequence: {
      type: Number,
      required: true
    },
    stopType: {
      type: String,
      enum: Object.values(StopType),
      default: StopType.PICKUP
    },
    locationId: {
      type: Schema.Types.ObjectId,
      ref: 'Location',
      required: true
    },
    consignorConsigneeId: {
      type: Schema.Types.ObjectId,
      ref: 'CustomerParty',
      default: null
    },
    allocatedQuantity: {
      type: Number,
      default: 0
    },
    allocatedWeightMt: {
      type: Number,
      default: 0
    },
    deliveredQuantity: {
      type: Number,
      default: 0
    },
    pendingQuantity: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: Object.values(StopStatus),
      default: StopStatus.PENDING
    },
    contactPerson: {
      type: String,
      default: ''
    },
    contactPhone: {
      type: String,
      default: ''
    },
    scheduledDate: {
      type: Date,
      default: null
    },
    actualArrivalTime: {
      type: Date,
      default: null
    },
    actualDepartureTime: {
      type: Date,
      default: null
    },
    remarks: {
      type: String,
      default: ''
    }
  },
  { _id: true, timestamps: true }
);

const loadSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true
    },
    loadNumber: {
      type: String,
      required: [true, 'Load number is required'],
      trim: true,
      uppercase: true
    },
    trackingToken: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'CustomerParty',
      required: [true, 'Customer/Billing party is required'],
      index: true
    },
    consignorId: {
      type: Schema.Types.ObjectId,
      ref: 'CustomerParty',
      required: [true, 'Consignor is required'],
      index: true
    },
    consigneeId: {
      type: Schema.Types.ObjectId,
      ref: 'CustomerParty',
      required: [true, 'Consignee is required'],
      index: true
    },
    originLocationId: {
      type: Schema.Types.ObjectId,
      ref: 'Location',
      default: null,
      index: true
    },
    destinationLocationId: {
      type: Schema.Types.ObjectId,
      ref: 'Location',
      default: null,
      index: true
    },
    orderDate: {
      type: Date,
      default: Date.now
    },
    expectedDeliveryDate: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: Object.values(LoadStatus),
      default: LoadStatus.CREATED,
      index: true
    },
    totalWeightMt: {
      type: Number,
      required: [true, 'Total weight in MT is required'],
      min: [0.01, 'Weight must be at least 0.01 MT']
    },
    totalQuantity: {
      type: Number,
      default: 1
    },
    packageType: {
      type: String,
      trim: true,
      default: 'Bags' // Bags, Drums, Boxes, Pallets, Loose, Liquid Bulk
    },
    materialType: {
      type: String,
      trim: true,
      default: 'Industrial Freight'
    },
    assignedVehicleId: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
      default: null,
      index: true
    },
    assignedDriverId: {
      type: Schema.Types.ObjectId,
      ref: 'Driver',
      default: null,
      index: true
    },
    currentTripId: {
      type: Schema.Types.ObjectId,
      ref: 'Trip',
      default: null
    },
    financials: {
      baseFreightPaise: { type: Number, required: true, default: 0 },
      loadingPaise: { type: Number, default: 0 },
      unloadingPaise: { type: Number, default: 0 },
      detentionPaise: { type: Number, default: 0 },
      tollPaise: { type: Number, default: 0 },
      handlingPaise: { type: Number, default: 0 },
      miscChargePaise: { type: Number, default: 0 },
      advancePaise: { type: Number, default: 0 },
      deductionPaise: { type: Number, default: 0 },
      totalFreightPaise: { type: Number, default: 0 },
      balancePaise: { type: Number, default: 0 }
    },
    stops: [loadStopSchema],
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

// Pre-save hook: server-side recalculation of total and balance financials (Integer Paise)
loadSchema.pre('save', function (next) {
  if (!this.trackingToken) {
    this.trackingToken = crypto.randomBytes(16).toString('hex');
  }

  if (this.financials) {
    const f = this.financials;
    const base = Number(f.baseFreightPaise) || 0;
    const loading = Number(f.loadingPaise) || 0;
    const unloading = Number(f.unloadingPaise) || 0;
    const detention = Number(f.detentionPaise) || 0;
    const toll = Number(f.tollPaise) || 0;
    const handling = Number(f.handlingPaise) || 0;
    const misc = Number(f.miscChargePaise) || 0;
    const advance = Number(f.advancePaise) || 0;
    const deduction = Number(f.deductionPaise) || 0;

    f.totalFreightPaise = Math.round(base + loading + unloading + detention + toll + handling + misc);
    f.balancePaise = Math.round(f.totalFreightPaise - advance - deduction);
  }

  // Pre-calculate pending quantities on stops
  if (this.stops && Array.isArray(this.stops)) {
    this.stops.forEach((stop) => {
      stop.pendingQuantity = Math.max(0, (stop.allocatedQuantity || 0) - (stop.deliveredQuantity || 0));
    });

    if (!this.originLocationId && this.stops.length > 0) {
      const orig = this.stops.find(s => s.stopType === StopType.PICKUP) || this.stops[0];
      if (orig && orig.locationId) this.originLocationId = orig.locationId;
    }
    if (!this.destinationLocationId && this.stops.length > 0) {
      const dest = this.stops.find(s => s.stopType === StopType.DELIVERY) || this.stops[this.stops.length - 1];
      if (dest && dest.locationId) this.destinationLocationId = dest.locationId;
    }
  }

  next();
});

// Compound unique index: Load numbers unique within tenant
loadSchema.index({ companyId: 1, loadNumber: 1 }, { unique: true });
loadSchema.index({ companyId: 1, status: 1 });
loadSchema.index({ companyId: 1, orderDate: -1 });

module.exports = mongoose.model('Load', loadSchema);
