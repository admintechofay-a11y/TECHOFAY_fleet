/**
 * Lorry Receipt (LR) Controller
 * Manages official Lorry Receipts, Atomic Sequence Allocation, E-Way Bill linkage, and PDF rendering.
 */

const LrNumber = require('../models/LrNumber');
const Load = require('../../loads/models/Load');
const sequenceService = require('../../sequences/services/sequence.service');
const loadStatusService = require('../../loads/services/loadStatus.service');
const auditLogService = require('../../audit/services/auditLog.service');
const pdfService = require('../../../services/pdf.service');
const { AuditAction, LrStatus, SystemModule } = require('@fleet/shared');
const { AppError } = require('../../../middleware/errorHandler');

class LrController {
  async list(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const {
        page = 1,
        limit = 20,
        search = '',
        status = '',
        loadId = ''
      } = req.query;

      const filter = { companyId, isActive: true };

      if (status) filter.status = status;
      if (loadId) filter.loadId = loadId;

      if (search) {
        const regex = new RegExp(search.trim(), 'i');
        filter.$or = [
          { lrNumber: regex },
          { eWayBillNumber: regex },
          { remarks: regex }
        ];
      }

      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
      const skip = (pageNum - 1) * limitNum;

      const [lrs, total] = await Promise.all([
        LrNumber.find(filter)
          .populate('loadId', 'loadNumber totalWeightMt totalQuantity packageType financials')
          .populate('consignorId', 'name gstin billingAddress')
          .populate('consigneeId', 'name gstin billingAddress')
          .populate('vehicleId', 'plateNumber make model')
          .populate('driverId', 'name phone')
          .sort({ issuedDate: -1, createdAt: -1 })
          .skip(skip)
          .limit(limitNum),
        LrNumber.countDocuments(filter)
      ]);

      res.status(200).json({
        success: true,
        statusCode: 200,
        data: {
          items: lrs,
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

      const lr = await LrNumber.findOne({ _id: id, companyId, isActive: true })
        .populate('loadId')
        .populate('consignorId')
        .populate('consigneeId')
        .populate('vehicleId')
        .populate('driverId')
        .populate('fromLocationId')
        .populate('toLocationId')
        .populate('statusHistory.changedBy', 'name email');

      if (!lr) {
        return next(new AppError('Lorry Receipt not found.', 404));
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        data: lr
      });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const {
        loadId,
        lrNumber: customLrNumber,
        isManualNumber = false,
        consignorId,
        consigneeId,
        vehicleId,
        driverId,
        fromLocationId,
        toLocationId,
        eWayBillNumber,
        eWayBillExpiry,
        remarks
      } = req.body;

      if (!loadId) {
        return next(new AppError('Linked Load ID is required to issue an LR.', 400));
      }

      const load = await Load.findOne({ _id: loadId, companyId, isActive: true });
      if (!load) {
        return next(new AppError('Specified Load not found.', 404));
      }

      let assignedLrNumber;
      if (isManualNumber && customLrNumber) {
        assignedLrNumber = customLrNumber.trim().toUpperCase();
        // Check uniqueness within company
        const existing = await LrNumber.findOne({ companyId, lrNumber: assignedLrNumber });
        if (existing) {
          return next(new AppError(`LR Number '${assignedLrNumber}' already exists for your company. Duplicate numbers are prohibited.`, 409));
        }
      } else {
        // Allocate collision-safe atomic sequence (e.g. LR-2026-00001)
        assignedLrNumber = await sequenceService.getNextSequence(companyId, 'LR', 'LR');
      }

      const finalConsignorId = consignorId || load.consignorId;
      const finalConsigneeId = consigneeId || load.consigneeId;
      const finalVehicleId = vehicleId || load.assignedVehicleId || null;
      const finalDriverId = driverId || load.assignedDriverId || null;

      const lr = new LrNumber({
        companyId,
        lrNumber: assignedLrNumber,
        isManualNumber: !!isManualNumber,
        loadId: load._id,
        vehicleId: finalVehicleId,
        driverId: finalDriverId,
        consignorId: finalConsignorId,
        consigneeId: finalConsigneeId,
        fromLocationId: fromLocationId || null,
        toLocationId: toLocationId || null,
        status: LrStatus.BOOKED,
        issuedDate: new Date(),
        eWayBillNumber: eWayBillNumber ? eWayBillNumber.trim().toUpperCase() : '',
        eWayBillExpiry: eWayBillExpiry ? new Date(eWayBillExpiry) : null,
        remarks: remarks || '',
        statusHistory: [
          {
            status: LrStatus.BOOKED,
            changedBy: req.user._id,
            reason: 'Lorry Receipt generated',
            timestamp: new Date()
          }
        ],
        isActive: true
      });

      await lr.save();

      await auditLogService.logAction({
        companyId,
        actorId: req.user._id,
        module: SystemModule.LR,
        action: AuditAction.CREATE,
        entityId: lr._id,
        newValues: { lrNumber: lr.lrNumber, loadId: lr.loadId, eWayBillNumber: lr.eWayBillNumber },
        ipAddress: req.ip
      });

      res.status(201).json({
        success: true,
        statusCode: 201,
        message: 'Lorry Receipt (LR) created successfully.',
        data: lr
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

      const lr = await LrNumber.findOne({ _id: id, companyId, isActive: true });
      if (!lr) {
        return next(new AppError('Lorry Receipt not found.', 404));
      }

      // Enforce State Machine Transitions
      loadStatusService.validateLrTransition(lr.status, status);

      const oldStatus = lr.status;
      lr.status = status;
      lr.statusHistory.push({
        status,
        changedBy: req.user._id,
        reason: reason || `LR status transitioned from ${oldStatus} to ${status}`,
        timestamp: new Date()
      });

      await lr.save();

      await auditLogService.logAction({
        companyId,
        actorId: req.user._id,
        module: SystemModule.LR,
        action: AuditAction.STATUS_CHANGE,
        entityId: lr._id,
        oldValues: { status: oldStatus },
        newValues: { status, reason },
        ipAddress: req.ip
      });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: `LR status updated to ${status}.`,
        data: lr
      });
    } catch (err) {
      next(err);
    }
  }

  async getLrPdf(req, res, next) {
    try {
      const { id } = req.params;
      const companyId = req.tenant.companyId;

      const lr = await LrNumber.findOne({ _id: id, companyId, isActive: true })
        .populate('loadId')
        .populate('consignorId')
        .populate('consigneeId')
        .populate('vehicleId')
        .populate('driverId');

      if (!lr) {
        return next(new AppError('Lorry Receipt not found.', 404));
      }

      const copy = req.query.copy || 'ORIGINAL';
      const pdfBuffer = await pdfService.generateLrPdf(lr, req.tenant.company, { copy });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="LR_${lr.lrNumber}_${copy}.pdf"`
      );
      res.send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new LrController();
