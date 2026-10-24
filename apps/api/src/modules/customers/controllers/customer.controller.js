/**
 * CustomerParty Controller
 */

const CustomerParty = require('../models/CustomerParty');
const auditLogService = require('../../audit/services/auditLog.service');
const { AuditAction } = require('@fleet/shared');
const { AppError } = require('../../../middleware/errorHandler');

class CustomerController {
  async list(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const {
        page = 1,
        limit = 20,
        search = '',
        partyType = '',
        isActive = ''
      } = req.query;

      const filter = { companyId };

      if (partyType) {
        filter.partyType = partyType;
      }

      if (isActive !== '') {
        filter.isActive = isActive === 'true';
      }

      if (search) {
        const regex = new RegExp(search.trim(), 'i');
        filter.$or = [
          { name: regex },
          { code: regex },
          { gstin: regex },
          { 'primaryContact.name': regex },
          { 'primaryContact.phone': regex },
          { 'billingAddress.city': regex }
        ];
      }

      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
      const skip = (pageNum - 1) * limitNum;

      const [customers, total] = await Promise.all([
        CustomerParty.find(filter)
          .sort({ name: 1 })
          .skip(skip)
          .limit(limitNum),
        CustomerParty.countDocuments(filter)
      ]);

      res.status(200).json({
        success: true,
        statusCode: 200,
        data: {
          items: customers,
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
      const customer = await CustomerParty.findOne({
        _id: id,
        companyId: req.tenant.companyId
      });

      if (!customer) {
        return next(new AppError('Customer party not found.', 404));
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        data: customer
      });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const {
        name,
        code,
        partyType,
        gstin,
        pan,
        primaryContact,
        billingAddress,
        deliveryAddresses,
        paymentTermsDays,
        creditLimitPaise
      } = req.body;

      if (!name || !name.trim()) {
        return next(new AppError('Customer/Party name is required.', 400));
      }

      // Check unique GSTIN within company if GSTIN provided
      if (gstin && gstin.trim()) {
        const existing = await CustomerParty.findOne({
          companyId,
          gstin: gstin.trim().toUpperCase()
        });
        if (existing) {
          return next(new AppError(`Party with GSTIN '${gstin}' already exists in your organization.`, 409));
        }
      }

      const party = await CustomerParty.create({
        companyId,
        name: name.trim(),
        code: code ? code.trim().toUpperCase() : '',
        partyType: partyType || 'CUSTOMER',
        gstin: gstin ? gstin.trim().toUpperCase() : undefined,
        pan: pan ? pan.trim().toUpperCase() : undefined,
        primaryContact,
        billingAddress,
        deliveryAddresses,
        paymentTermsDays: paymentTermsDays || 30,
        creditLimitPaise: creditLimitPaise || 0,
        isActive: true
      });

      await auditLogService.logAction({
        companyId,
        actorId: req.user._id,
        module: 'CUSTOMERS',
        action: AuditAction.CREATE,
        entityId: party._id,
        newValues: party.toObject(),
        ipAddress: req.ip
      });

      res.status(201).json({
        success: true,
        statusCode: 201,
        message: 'Customer party created successfully.',
        data: party
      });
    } catch (err) {
      if (err.code === 11000) {
        return next(new AppError('Duplicate record constraint violated.', 409));
      }
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const companyId = req.tenant.companyId;

      const party = await CustomerParty.findOne({ _id: id, companyId });
      if (!party) {
        return next(new AppError('Customer party not found.', 404));
      }

      const oldValues = party.toObject();

      const allowedFields = [
        'name',
        'code',
        'partyType',
        'gstin',
        'pan',
        'primaryContact',
        'billingAddress',
        'deliveryAddresses',
        'paymentTermsDays',
        'creditLimitPaise',
        'isActive'
      ];

      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          party[field] = req.body[field];
        }
      });

      await party.save();

      await auditLogService.logAction({
        companyId,
        actorId: req.user._id,
        module: 'CUSTOMERS',
        action: AuditAction.UPDATE,
        entityId: party._id,
        oldValues,
        newValues: party.toObject(),
        ipAddress: req.ip
      });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Customer party updated successfully.',
        data: party
      });
    } catch (err) {
      if (err.code === 11000) {
        return next(new AppError('Duplicate GSTIN or identifier constraint violated.', 409));
      }
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const { id } = req.params;
      const companyId = req.tenant.companyId;

      const party = await CustomerParty.findOne({ _id: id, companyId });
      if (!party) {
        return next(new AppError('Customer party not found.', 404));
      }

      party.isActive = false;
      await party.save();

      await auditLogService.logAction({
        companyId,
        actorId: req.user._id,
        module: 'CUSTOMERS',
        action: AuditAction.DELETE,
        entityId: party._id,
        oldValues: { isActive: true },
        newValues: { isActive: false },
        ipAddress: req.ip
      });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Customer party deactivated successfully.'
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new CustomerController();
