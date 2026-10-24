/**
 * Load Controller
 * Manages Consignment Orders, Ordered Waypoint Stops, Asset Assignment, and Status Transitions.
 */

const Load = require('../models/Load');
const Vehicle = require('../../vehicles/models/Vehicle');
const Driver = require('../../drivers/models/Driver');
const sequenceService = require('../../sequences/services/sequence.service');
const loadStatusService = require('../services/loadStatus.service');
const auditLogService = require('../../audit/services/auditLog.service');
const pdfService = require('../../../services/pdf.service');
const { AuditAction, LoadStatus, SystemModule } = require('@fleet/shared');
const { AppError } = require('../../../middleware/errorHandler');

class LoadController {
  async list(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const {
        page = 1,
        limit = 20,
        search = '',
        status = '',
        customerId = ''
      } = req.query;

      const filter = { companyId, isActive: true };

      if (status) filter.status = status;
      if (customerId) filter.customerId = customerId;

      if (search) {
        const regex = new RegExp(search.trim(), 'i');
        filter.$or = [
          { loadNumber: regex },
          { packageType: regex },
          { remarks: regex }
        ];
      }

      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
      const skip = (pageNum - 1) * limitNum;

      const [loads, total] = await Promise.all([
        Load.find(filter)
          .populate('customerId', 'name code')
          .populate('consignorId', 'name')
          .populate('consigneeId', 'name')
          .populate('assignedVehicleId', 'plateNumber make model capacityTonnage')
          .populate('assignedDriverId', 'name phone')
          .sort({ orderDate: -1, createdAt: -1 })
          .skip(skip)
          .limit(limitNum),
        Load.countDocuments(filter)
      ]);

      res.status(200).json({
        success: true,
        statusCode: 200,
        data: {
          items: loads,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum)
          }
        }
      });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const companyId = req.tenant.companyId;

      const load = await Load.findOne({ _id: id, companyId, isActive: true })
        .populate('customerId')
        .populate('consignorId')
        .populate('consigneeId')
        .populate('assignedVehicleId')
        .populate('assignedDriverId')
        .populate('stops.locationId')
        .populate('statusHistory.changedBy', 'name email');

      if (!load) {
        return next(new AppError('Load not found.', 404));
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        data: load
      });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const {
        customerId,
        consignorId,
        consigneeId,
        totalWeightMt,
        totalQuantity,
        packageType,
        expectedDeliveryDate,
        financials = {},
        stops = [],
        remarks
      } = req.body;

      if (!customerId || !consignorId || !consigneeId) {
        return next(new AppError('Customer, Consignor, and Consignee are required.', 400));
      }

      if (!totalWeightMt || parseFloat(totalWeightMt) <= 0) {
        return next(new AppError('Total weight in Metric Tons (MT) is required and must be > 0.', 400));
      }

      // Allocate next collision-safe atomic Load Number (e.g. LD-2026-00001)
      const loadNumber = await sequenceService.getNextSequence(companyId, 'LOAD', 'LD');

      // Sort and assign 1-indexed sequences to stops
      const formattedStops = stops.map((s, idx) => ({
        ...s,
        sequence: s.sequence || idx + 1,
        deliveredQuantity: 0,
        pendingQuantity: s.allocatedQuantity || 0
      }));

      const load = new Load({
        companyId,
        loadNumber,
        customerId,
        consignorId,
        consigneeId,
        orderDate: new Date(),
        expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
        status: LoadStatus.CREATED,
        totalWeightMt: parseFloat(totalWeightMt),
        totalQuantity: parseInt(totalQuantity, 10) || 1,
        packageType: packageType || 'Bags',
        financials: {
          baseFreightPaise: Math.round(Number(financials.baseFreightPaise) || 0),
          loadingPaise: Math.round(Number(financials.loadingPaise) || 0),
          unloadingPaise: Math.round(Number(financials.unloadingPaise) || 0),
          detentionPaise: Math.round(Number(financials.detentionPaise) || 0),
          tollPaise: Math.round(Number(financials.tollPaise) || 0),
          handlingPaise: Math.round(Number(financials.handlingPaise) || 0),
          miscChargePaise: Math.round(Number(financials.miscChargePaise) || 0),
          advancePaise: Math.round(Number(financials.advancePaise) || 0),
          deductionPaise: Math.round(Number(financials.deductionPaise) || 0)
        },
        stops: formattedStops,
        statusHistory: [
          {
            status: LoadStatus.CREATED,
            changedBy: req.user._id,
            reason: 'Consignment created in system',
            timestamp: new Date()
          }
        ],
        remarks: remarks || '',
        isActive: true
      });

      await load.save();

      await auditLogService.logAction({
        companyId,
        actorId: req.user._id,
        module: SystemModule.LOADS,
        action: AuditAction.CREATE,
        entityId: load._id,
        newValues: { loadNumber: load.loadNumber, totalFreightPaise: load.financials.totalFreightPaise },
        ipAddress: req.ip
      });

      res.status(201).json({
        success: true,
        statusCode: 201,
        message: 'Load created successfully with unique consignment number.',
        data: load
      });
    } catch (err) {
      next(err);
    }
  }

  async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status, reason = '' } = req.body;
      const companyId = req.tenant.companyId;

      const load = await Load.findOne({ _id: id, companyId, isActive: true });
      if (!load) {
        return next(new AppError('Load not found.', 404));
      }

      // Enforce State Machine Transitions
      loadStatusService.validateLoadTransition(load.status, status);

      const oldStatus = load.status;
      load.status = status;
      load.statusHistory.push({
        status,
        changedBy: req.user._id,
        reason: reason || `Status changed from ${oldStatus} to ${status}`,
        timestamp: new Date()
      });

      await load.save();

      await auditLogService.logAction({
        companyId,
        actorId: req.user._id,
        module: SystemModule.LOADS,
        action: AuditAction.STATUS_CHANGE,
        entityId: load._id,
        oldValues: { status: oldStatus },
        newValues: { status, reason },
        ipAddress: req.ip
      });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: `Load status updated to ${status}.`,
        data: load
      });
    } catch (err) {
      next(err);
    }
  }

  async assignAssets(req, res, next) {
    try {
      const { id } = req.params;
      const { vehicleId, driverId } = req.body;
      const companyId = req.tenant.companyId;

      const load = await Load.findOne({ _id: id, companyId, isActive: true });
      if (!load) {
        return next(new AppError('Load not found.', 404));
      }

      if (vehicleId) {
        const vehicle = await Vehicle.findOne({ _id: vehicleId, companyId, isActive: true });
        if (!vehicle) {
          return next(new AppError('Selected vehicle not found in your fleet.', 404));
        }
        if (vehicle.status === 'OUT_OF_SERVICE' || vehicle.status === 'UNDER_MAINTENANCE') {
          return next(new AppError(`Vehicle ${vehicle.plateNumber} is currently ${vehicle.status}. Cannot assign.`, 400));
        }
        load.assignedVehicleId = vehicle._id;
      }

      if (driverId) {
        const driver = await Driver.findOne({ _id: driverId, companyId, isActive: true });
        if (!driver) {
          return next(new AppError('Selected driver not found.', 404));
        }
        if (new Date(driver.licenseExpiryDate) < new Date()) {
          return next(new AppError(`Driver ${driver.name}'s licence has expired. Cannot assign.`, 400));
        }
        load.assignedDriverId = driver._id;
      }

      // Advance status to ASSIGNED if currently CREATED
      if (load.status === LoadStatus.CREATED && (load.assignedVehicleId || load.assignedDriverId)) {
        load.status = LoadStatus.ASSIGNED;
        load.statusHistory.push({
          status: LoadStatus.ASSIGNED,
          changedBy: req.user._id,
          reason: 'Vehicle/Driver assigned to consignment',
          timestamp: new Date()
        });
      }

      await load.save();

      await auditLogService.logAction({
        companyId,
        actorId: req.user._id,
        module: SystemModule.LOADS,
        action: AuditAction.UPDATE,
        entityId: load._id,
        newValues: { vehicleId: load.assignedVehicleId, driverId: load.assignedDriverId, status: load.status },
        ipAddress: req.ip
      });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Vehicle and Driver assigned successfully to load.',
        data: load
      });
    } catch (err) {
      next(err);
    }
  }

  async getLoadingSlipPdf(req, res, next) {
    try {
      const { id } = req.params;
      const companyId = req.tenant.companyId;

      const load = await Load.findOne({ _id: id, companyId, isActive: true })
        .populate('assignedVehicleId')
        .populate('assignedDriverId')
        .populate('stops.locationId');

      if (!load) {
        return next(new AppError('Load not found.', 404));
      }

      const copy = req.query.copy || 'ORIGINAL';
      const pdfBuffer = await pdfService.generateLoadingSlipPdf(load, req.tenant.company, { copy });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="LoadingSlip_${load.loadNumber}_${copy}.pdf"`
      );
      res.send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new LoadController();
