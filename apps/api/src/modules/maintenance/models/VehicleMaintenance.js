/**
 * VehicleMaintenance Mongoose Model
 * Manages preventative fleet maintenance, scheduled overhauls, repair logs, and asset status updates.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { MaintenanceStatus, MaintenanceServiceType } = require('../../../shared');

const vehicleMaintenanceSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true
    },
    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: [true, 'Vehicle is required for maintenance record'],
      index: true
    },
    maintenanceNumber: {
      type: String,
      required: [true, 'Maintenance reference number is required'],
      trim: true,
      uppercase: true
    },
    serviceType: {
      type: String,
      enum: Object.values(MaintenanceServiceType),
      default: MaintenanceServiceType.GENERAL_SERVICE
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM'
    },
    status: {
      type: String,
      enum: Object.values(MaintenanceStatus),
      default: MaintenanceStatus.SCHEDULED
    },
    scheduledDate: {
      type: Date,
      required: [true, 'Scheduled service date is required']
    },
    startDate: {
      type: Date,
      default: null
    },
    completedDate: {
      type: Date,
      default: null
    },
    odometerReadingKm: {
      type: Number,
      default: 0,
      min: [0, 'Odometer reading cannot be negative']
    },
    nextDueOdometerKm: {
      type: Number,
      default: null
    },
    nextDueDate: {
      type: Date,
      default: null
    },
    serviceCenter: {
      name: { type: String, trim: true, default: '' },
      contactPhone: { type: String, trim: true, default: '' },
      city: { type: String, trim: true, default: '' }
    },
    costPaise: {
      type: Number,
      default: 0,
      min: [0, 'Cost in paise cannot be negative']
    },
    invoiceNumber: {
      type: String,
      trim: true,
      default: ''
    },
    partsReplaced: [
      {
        partName: { type: String, required: true, trim: true },
        quantity: { type: Number, default: 1, min: 1 },
        costPaise: { type: Number, default: 0, min: 0 }
      }
    ],
    technicianRemarks: {
      type: String,
      trim: true,
      default: ''
    },
    supervisorNotes: {
      type: String,
      trim: true,
      default: ''
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

vehicleMaintenanceSchema.index({ companyId: 1, maintenanceNumber: 1 }, { unique: true });
vehicleMaintenanceSchema.index({ companyId: 1, status: 1, scheduledDate: 1 });
vehicleMaintenanceSchema.index({ companyId: 1, vehicleId: 1, status: 1 });

module.exports = mongoose.model('VehicleMaintenance', vehicleMaintenanceSchema);
