/**
 * Bilty Controller
 * Manages Consignment Notes, Goods Transport Agency (GTA SAC 9965) compliance, and Bilty PDF generation.
 */

const Bilty = require('../models/Bilty');
const LrNumber = require('../../lr/models/LrNumber');
const Load = require('../../loads/models/Load');
const sequenceService = require('../../sequences/services/sequence.service');
const auditLogService = require('../../audit/services/auditLog.service');
const pdfService = require('../../../services/pdf.service');
const { AuditAction, BiltyStatus, PaymentTerms, SystemModule } = require('@fleet/shared');
const { AppError } = require('../../../middleware/errorHandler');

class BiltyController {
  async list(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const {
        page = 1,
        limit = 20,
        search = '',
        status = '',
        paymentTerms = ''
      } = req.query;

      const filter = { companyId, isActive: true };

      if (status) filter.status = status;
      if (paymentTerms) filter.paymentTerms = paymentTerms;

      if (search) {
        const regex = new RegExp(search.trim(), 'i');
        filter.$or = [
          { biltyNumber: regex },
          { remarks: regex }
        ];
      }

      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
      const skip = (pageNum - 1) * limitNum;

      const [bilties, total] = await Promise.all([
        Bilty.find(filter)
          .populate('lrId', 'lrNumber eWayBillNumber status')
          .populate('loadId', 'loadNumber totalWeightMt totalQuantity packageType')
          .populate('consignorId', 'name gstin billingAddress')
          .populate('consigneeId', 'name gstin billingAddress')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum),
        Bilty.countDocuments(filter)
      ]);

      res.status(200).json({
        success: true,
        statusCode: 200,
        data: {
          items: bilties,
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

      const bilty = await Bilty.findOne({ _id: id, companyId, isActive: true })
        .populate('lrId')
        .populate('loadId')
        .populate('consignorId')
        .populate('consigneeId')
        .populate('fromLocationId')
        .populate('toLocationId');

      if (!bilty) {
        return next(new AppError('Consignment Bilty not found.', 404));
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        data: bilty
      });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const {
        lrId,
        paymentTerms = PaymentTerms.TO_PAY,
        totalFreightPaise,
        advancePaise = 0,
        remarks
      } = req.body;

      if (!lrId) {
        return next(new AppError('Valid Lorry Receipt (LR) ID is required to issue a Bilty.', 400));
      }

      const lr = await LrNumber.findOne({ _id: lrId, companyId, isActive: true });
      if (!lr) {
        return next(new AppError('Linked Lorry Receipt not found.', 404));
      }

      const load = await Load.findOne({ _id: lr.loadId, companyId, isActive: true });
      if (!load) {
        return next(new AppError('Underlying Consignment Load not found.', 404));
      }

      // Check if bilty already issued for this LR
      const existingBilty = await Bilty.findOne({ lrId: lr._id, companyId, isActive: true });
      if (existingBilty) {
        return next(new AppError(`Bilty '${existingBilty.biltyNumber}' has already been issued for this LR.`, 409));
      }

      // Allocate next collision-safe atomic Bilty Number (e.g. BL-2026-00001)
      const biltyNumber = await sequenceService.getNextSequence(companyId, 'BILTY', 'BL');

      // Calculate freight numbers
      const freightPaise = totalFreightPaise !== undefined
        ? Math.round(Number(totalFreightPaise))
        : (load.financials?.totalFreightPaise || 0);

      const advPaise = advancePaise !== undefined
        ? Math.round(Number(advancePaise))
        : (load.financials?.advancePaise || 0);

      const balPaise = Math.max(0, freightPaise - advPaise);

      const bilty = new Bilty({
        companyId,
        biltyNumber,
        lrId: lr._id,
        loadId: load._id,
        consignorId: lr.consignorId,
        consigneeId: lr.consigneeId,
        fromLocationId: lr.fromLocationId,
        toLocationId: lr.toLocationId,
        paymentTerms,
        totalFreightPaise: freightPaise,
        advancePaise: advPaise,
        balancePaise: balPaise,
        gstGtaRate: 5.0,
        gstGtaSac: '9965',
        status: BiltyStatus.ISSUED,
        remarks: remarks || '',
        isActive: true
      });

      await bilty.save();

      await auditLogService.logAction({
        companyId,
        actorId: req.user._id,
        module: SystemModule.BILTIES,
        action: AuditAction.CREATE,
        entityId: bilty._id,
        newValues: { biltyNumber: bilty.biltyNumber, lrId: lr._id, balancePaise: balPaise },
        ipAddress: req.ip
      });

      res.status(201).json({
        success: true,
        statusCode: 201,
        message: 'Consignment Bilty generated successfully.',
        data: bilty
      });
    } catch (err) {
      next(err);
    }
  }

  async getBiltyPdf(req, res, next) {
    try {
      const { id } = req.params;
      const companyId = req.tenant.companyId;

      const bilty = await Bilty.findOne({ _id: id, companyId, isActive: true })
        .populate('lrId')
        .populate('loadId')
        .populate('consignorId')
        .populate('consigneeId');

      if (!bilty) {
        return next(new AppError('Consignment Bilty not found.', 404));
      }

      const copy = req.query.copy || 'ORIGINAL';
      const pdfBuffer = await pdfService.generateBiltyPdf(bilty, req.tenant.company, { copy });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="Bilty_${bilty.biltyNumber}_${copy}.pdf"`
      );
      res.send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new BiltyController();
