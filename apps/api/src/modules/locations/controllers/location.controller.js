/**
 * Location Controller
 */

const Location = require('../models/Location');
const auditLogService = require('../../audit/services/auditLog.service');
const { AuditAction } = require('../../../shared');
const { AppError } = require('../../../middleware/errorHandler');

class LocationController {
  async list(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const {
        page = 1,
        limit = 20,
        search = '',
        locationType = '',
        customerId = '',
        isActive = ''
      } = req.query;

      const filter = { companyId };

      if (locationType) filter.locationType = locationType;
      if (customerId) filter.customerId = customerId;
      if (isActive !== '') filter.isActive = isActive === 'true';

      if (search) {
        const regex = new RegExp(search.trim(), 'i');
        filter.$or = [
          { name: regex },
          { code: regex },
          { 'address.city': regex },
          { 'address.state': regex },
          { contactPerson: regex }
        ];
      }

      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
      const skip = (pageNum - 1) * limitNum;

      const [locations, total] = await Promise.all([
        Location.find(filter)
          .populate('customerId', 'name code')
          .sort({ name: 1 })
          .skip(skip)
          .limit(limitNum),
        Location.countDocuments(filter)
      ]);

      res.status(200).json({
        success: true,
        statusCode: 200,
        data: {
          items: locations,
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
      const location = await Location.findOne({
        _id: id,
        companyId: req.tenant.companyId
      }).populate('customerId', 'name code');

      if (!location) {
        return next(new AppError('Location not found.', 404));
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        data: location
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
        locationType,
        address,
        coordinates,
        contactPerson,
        contactPhone,
        customerId
      } = req.body;

      if (!name || !name.trim()) {
        return next(new AppError('Location name is required.', 400));
      }

      if (!address || !address.city || !address.state) {
        return next(new AppError('Address with City and State is required.', 400));
      }

      const location = await Location.create({
        companyId,
        name: name.trim(),
        code: code ? code.trim().toUpperCase() : '',
        locationType: locationType || 'PICKUP',
        address,
        coordinates,
        contactPerson: contactPerson || '',
        contactPhone: contactPhone || '',
        customerId: customerId || null,
        isActive: true
      });

      await auditLogService.logAction({
        companyId,
        actorId: req.user._id,
        module: 'LOCATIONS',
        action: AuditAction.CREATE,
        entityId: location._id,
        newValues: location.toObject(),
        ipAddress: req.ip
      });

      res.status(201).json({
        success: true,
        statusCode: 201,
        message: 'Location created successfully.',
        data: location
      });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const companyId = req.tenant.companyId;

      const location = await Location.findOne({ _id: id, companyId });
      if (!location) {
        return next(new AppError('Location not found.', 404));
      }

      const oldValues = location.toObject();

      const allowedFields = [
        'name',
        'code',
        'locationType',
        'address',
        'coordinates',
        'contactPerson',
        'contactPhone',
        'customerId',
        'isActive'
      ];

      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          location[field] = req.body[field];
        }
      });

      await location.save();

      await auditLogService.logAction({
        companyId,
        actorId: req.user._id,
        module: 'LOCATIONS',
        action: AuditAction.UPDATE,
        entityId: location._id,
        oldValues,
        newValues: location.toObject(),
        ipAddress: req.ip
      });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Location updated successfully.',
        data: location
      });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const { id } = req.params;
      const companyId = req.tenant.companyId;

      const location = await Location.findOne({ _id: id, companyId });
      if (!location) {
        return next(new AppError('Location not found.', 404));
      }

      location.isActive = false;
      await location.save();

      await auditLogService.logAction({
        companyId,
        actorId: req.user._id,
        module: 'LOCATIONS',
        action: AuditAction.DELETE,
        entityId: location._id,
        oldValues: { isActive: true },
        newValues: { isActive: false },
        ipAddress: req.ip
      });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Location deactivated successfully.'
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new LocationController();
