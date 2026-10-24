/**
 * Fleet Vehicle Maintenance Controller
 */

const VehicleMaintenance = require('../models/VehicleMaintenance');
const Vehicle = require('../../vehicles/models/Vehicle');
const sequenceService = require('../../sequences/services/sequence.service');
const auditLogService = require('../../audit/services/auditLog.service');
const { VehicleStatus, MaintenanceStatus, SystemModule, AuditAction } = require('@fleet/shared');
const { AppError } = require('../../../middleware/errorHandler');
const pdfService = require('../../../services/pdf.service');

class MaintenanceController {
  /**
   * Schedule or Record Maintenance
   * POST /api/v1/maintenance
   */
  async create(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const userId = req.user.id;
      const {
        vehicleId,
        serviceType,
        priority = 'MEDIUM',
        status = MaintenanceStatus.SCHEDULED,
        scheduledDate,
        odometerReadingKm = 0,
        nextDueOdometerKm,
        nextDueDate,
        serviceCenter,
        costPaise = 0,
        invoiceNumber = '',
        partsReplaced = [],
        technicianRemarks = '',
        supervisorNotes = ''
      } = req.body;

      if (!vehicleId) throw new AppError('Vehicle ID is required', 400);
      if (!scheduledDate) throw new AppError('Scheduled date is required', 400);

      const vehicle = await Vehicle.findOne({ _id: vehicleId, companyId, isActive: true });
      if (!vehicle) {
        throw new AppError('Vehicle not found or does not belong to your company', 404);
      }

      const maintenanceNumber = await sequenceService.getNextSequence(companyId, 'MAINTENANCE', 'MNT', 4);

      const maintenance = await VehicleMaintenance.create({
        companyId,
        vehicleId,
        maintenanceNumber,
        serviceType,
        priority,
        status,
        scheduledDate: new Date(scheduledDate),
        startDate: status === MaintenanceStatus.IN_PROGRESS ? new Date() : null,
        odometerReadingKm,
        nextDueOdometerKm,
        nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
        serviceCenter: serviceCenter || {},
        costPaise,
        invoiceNumber,
        partsReplaced,
        technicianRemarks,
        supervisorNotes,
        createdBy: userId
      });

      // If status starts directly in progress, update vehicle status to UNDER_MAINTENANCE
      if (status === MaintenanceStatus.IN_PROGRESS) {
        vehicle.status = VehicleStatus.UNDER_MAINTENANCE;
        await vehicle.save();
      }

      // Log Audit Trail
      await auditLogService.logAction({
        companyId,
        userId,
        module: SystemModule.MAINTENANCE || 'maintenance',
        action: AuditAction.CREATE,
        entityId: maintenance._id,
        entityType: 'VehicleMaintenance',
        details: {
          maintenanceNumber,
          vehiclePlate: vehicle.plateNumber,
          serviceType,
          status
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.status(201).json({
        success: true,
        statusCode: 201,
        message: `Maintenance ${maintenanceNumber} successfully scheduled for vehicle ${vehicle.plateNumber}`,
        data: maintenance
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * List Maintenance Records with Filters and Pagination
   * GET /api/v1/maintenance
   */
  async list(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const { status, vehicleId, serviceType, page = 1, limit = 20 } = req.query;

      const query = { companyId, isActive: true };
      if (status) query.status = status;
      if (vehicleId) query.vehicleId = vehicleId;
      if (serviceType) query.serviceType = serviceType;

      const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
      const take = parseInt(limit, 10);

      const [records, total] = await Promise.all([
        VehicleMaintenance.find(query)
          .populate('vehicleId', 'plateNumber vehicleType make model capacityTonnage status')
          .sort({ scheduledDate: -1, createdAt: -1 })
          .skip(skip)
          .limit(take),
        VehicleMaintenance.countDocuments(query)
      ]);

      res.status(200).json({
        success: true,
        statusCode: 200,
        data: {
          items: records,
          pagination: {
            page: parseInt(page, 10),
            limit: take,
            total,
            pages: Math.ceil(total / take)
          }
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get Single Maintenance Record by ID
   * GET /api/v1/maintenance/:id
   */
  async getById(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const { id } = req.params;

      const record = await VehicleMaintenance.findOne({ _id: id, companyId, isActive: true })
        .populate('vehicleId', 'plateNumber vehicleType make model status capacityTonnage')
        .populate('createdBy', 'fullName email');

      if (!record) {
        throw new AppError('Maintenance record not found', 404);
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        data: record
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update Status with Automated Vehicle State Management
   * PATCH /api/v1/maintenance/:id/status
   */
  async updateStatus(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const userId = req.user.id;
      const { id } = req.params;
      const { status, costPaise, invoiceNumber, technicianRemarks, completedDate } = req.body;

      if (!status || !Object.values(MaintenanceStatus).includes(status)) {
        throw new AppError(`Invalid status '${status}'. Must be one of: ${Object.values(MaintenanceStatus).join(', ')}`, 400);
      }

      const maintenance = await VehicleMaintenance.findOne({ _id: id, companyId, isActive: true });
      if (!maintenance) {
        throw new AppError('Maintenance record not found', 404);
      }

      const prevStatus = maintenance.status;
      maintenance.status = status;

      if (costPaise !== undefined) maintenance.costPaise = costPaise;
      if (invoiceNumber !== undefined) maintenance.invoiceNumber = invoiceNumber;
      if (technicianRemarks !== undefined) maintenance.technicianRemarks = technicianRemarks;

      const vehicle = await Vehicle.findOne({ _id: maintenance.vehicleId, companyId, isActive: true });

      // State Transitions
      if (status === MaintenanceStatus.IN_PROGRESS) {
        maintenance.startDate = maintenance.startDate || new Date();
        if (vehicle) {
          vehicle.status = VehicleStatus.UNDER_MAINTENANCE;
          await vehicle.save();
        }
      } else if (status === MaintenanceStatus.COMPLETED) {
        maintenance.completedDate = completedDate ? new Date(completedDate) : new Date();
        if (vehicle && vehicle.status === VehicleStatus.UNDER_MAINTENANCE) {
          vehicle.status = VehicleStatus.AVAILABLE;
          await vehicle.save();
        }
      } else if (status === MaintenanceStatus.CANCELLED) {
        if (vehicle && vehicle.status === VehicleStatus.UNDER_MAINTENANCE) {
          vehicle.status = VehicleStatus.AVAILABLE;
          await vehicle.save();
        }
      }

      await maintenance.save();

      // Log Audit Trail
      await auditLogService.logAction({
        companyId,
        userId,
        module: SystemModule.MAINTENANCE || 'maintenance',
        action: AuditAction.UPDATE,
        entityId: maintenance._id,
        entityType: 'VehicleMaintenance',
        details: {
          maintenanceNumber: maintenance.maintenanceNumber,
          previousStatus: prevStatus,
          newStatus: status
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: `Maintenance ${maintenance.maintenanceNumber} status updated to ${status}`,
        data: maintenance
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get Maintenance KPI Metrics and Overdue Alerts
   * GET /api/v1/maintenance/stats
   */
  async getStats(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [scheduledCount, inProgressCount, completedThisMonth, overdueCount, costAggregation] = await Promise.all([
        VehicleMaintenance.countDocuments({ companyId, status: MaintenanceStatus.SCHEDULED, isActive: true }),
        VehicleMaintenance.countDocuments({ companyId, status: MaintenanceStatus.IN_PROGRESS, isActive: true }),
        VehicleMaintenance.countDocuments({
          companyId,
          status: MaintenanceStatus.COMPLETED,
          completedDate: { $gte: startOfMonth },
          isActive: true
        }),
        VehicleMaintenance.countDocuments({
          companyId,
          status: MaintenanceStatus.SCHEDULED,
          scheduledDate: { $lt: now },
          isActive: true
        }),
        VehicleMaintenance.aggregate([
          {
            $match: {
              companyId,
              status: MaintenanceStatus.COMPLETED,
              completedDate: { $gte: startOfMonth },
              isActive: true
            }
          },
          {
            $group: {
              _id: null,
              totalCostPaise: { $sum: '$costPaise' }
            }
          }
        ])
      ]);

      const totalCostPaise = costAggregation[0]?.totalCostPaise || 0;

      res.status(200).json({
        success: true,
        statusCode: 200,
        data: {
          scheduledCount,
          inProgressCount,
          completedThisMonth,
          overdueCount,
          totalCostThisMonthPaise: totalCostPaise,
          totalCostThisMonthRupees: totalCostPaise / 100
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Stream Maintenance Job Card PDF
   * GET /api/v1/maintenance/:id/job-card
   */
  async getJobCardPdf(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const { id } = req.params;

      const maintenance = await VehicleMaintenance.findOne({ _id: id, companyId, isActive: true })
        .populate('vehicleId');

      if (!maintenance) {
        throw new AppError('Maintenance record not found', 404);
      }

      const copy = req.query.copy || 'ORIGINAL';
      const pdfBuffer = await pdfService.generateMaintenancePdf(maintenance, req.tenant.company || {}, { copy });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="JobCard-${maintenance.maintenanceNumber}-${copy}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.status(200).send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new MaintenanceController();
