/**
 * Trip Mongoose Model
 * Manages Vehicle & Driver Dispatch, Waypoint Progress, Route Expenses, and Financial Settlement.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { TripStatus, StopType, StopStatus, TripExpenseType } = require('@fleet/shared');

const tripStopSchema = new Schema(
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
    loadStopId: {
      type: Schema.Types.ObjectId,
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
    arrivedAt: {
      type: Date,
      default: null
    },
    completedAt: {
      type: Date,
      default: null
    },
    receiverName: {
      type: String,
      trim: true,
      default: ''
    },
    receiverPhone: {
      type: String,
      trim: true,
      default: ''
    },
    remarks: {
      type: String,
      trim: true,
      default: ''
    }
  },
  { _id: true, timestamps: true }
);

const tripExpenseSchema = new Schema(
  {
    expenseType: {
      type: String,
      enum: Object.values(TripExpenseType),
      required: true
    },
    amountPaise: {
      type: Number,
      required: true,
      min: 0
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    paidBy: {
      type: String,
      enum: ['DRIVER', 'COMPANY'],
      default: 'DRIVER'
    },
    receiptFileKey: {
      type: String,
      default: null
    },
    recordedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: true }
);

const tripSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true
    },
    tripNumber: {
      type: String,
      required: [true, 'Trip number is required'],
      trim: true,
      uppercase: true
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
      required: [true, 'Assigned Vehicle is required'],
      index: true
    },
    driverId: {
      type: Schema.Types.ObjectId,
      ref: 'Driver',
      required: [true, 'Assigned Driver is required'],
      index: true
    },
    startDateTime: {
      type: Date,
      default: Date.now
    },
    expectedDeliveryDateTime: {
      type: Date,
      default: null
    },
    actualEndDateTime: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: Object.values(TripStatus),
      default: TripStatus.CREATED,
      index: true
    },
    stops: [tripStopSchema],
    expenses: [tripExpenseSchema],
    financials: {
      grossFreightPaise: {
        type: Number,
        default: 0,
        min: 0
      },
      driverAdvancePaise: {
        type: Number,
        default: 0,
        min: 0
      },
      totalExpensesPaise: {
        type: Number,
        default: 0,
        min: 0
      },
      netSettlementPaise: {
        type: Number,
        default: 0
      }
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

// Pre-save calculate expenses and settlement balances
tripSchema.pre('save', function (next) {
  if (this.expenses && this.expenses.length > 0) {
    this.financials.totalExpensesPaise = this.expenses.reduce(
      (sum, e) => sum + (e.amountPaise || 0),
      0
    );
  } else {
    this.financials.totalExpensesPaise = 0;
  }

  // Net settlement: (Gross Freight - Total Expenses - Driver Advance)
  this.financials.netSettlementPaise =
    (this.financials.grossFreightPaise || 0) -
    (this.financials.totalExpensesPaise || 0) -
    (this.financials.driverAdvancePaise || 0);

  next();
});

// Indexes
tripSchema.index({ companyId: 1, tripNumber: 1 }, { unique: true });
tripSchema.index({ companyId: 1, status: 1 });
tripSchema.index({ companyId: 1, vehicleId: 1, status: 1 });
tripSchema.index({ companyId: 1, driverId: 1, status: 1 });
tripSchema.index({ companyId: 1, loadId: 1, status: 1 });

// Partial unique indexes to prevent concurrent double-booking of active assets at the DB level
const ACTIVE_STATUSES = [
  TripStatus.CREATED,
  TripStatus.VEHICLE_ASSIGNED,
  TripStatus.LOADING,
  TripStatus.IN_TRANSIT,
  TripStatus.PARTIALLY_DELIVERED
];

tripSchema.index(
  { companyId: 1, vehicleId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isActive: true,
      status: { $in: ACTIVE_STATUSES }
    }
  }
);

tripSchema.index(
  { companyId: 1, driverId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isActive: true,
      status: { $in: ACTIVE_STATUSES }
    }
  }
);

tripSchema.index(
  { companyId: 1, loadId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isActive: true,
      status: { $in: ACTIVE_STATUSES }
    }
  }
);

module.exports = mongoose.model('Trip', tripSchema);
