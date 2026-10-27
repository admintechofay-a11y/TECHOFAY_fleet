/**
 * Driver Controller
 * Manages Driver Profiles, Licences, and Identity Documents.
 */

const Driver = require('../models/Driver');
const DriverDocument = require('../models/DriverDocument');
const storageService = require('../../../services/storage.service');
const auditLogService = require('../../audit/services/auditLog.service');
const { AuditAction, DriverStatus, DriverDocumentType } = require('../../../shared');
const { AppError } = require('../../../middleware/errorHandler');

class DriverController {
  async list(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const {
        page = 1,
        limit = 20,
        search = '',
        status = '',
        licenseType = '',
        isActive = ''
      } = req.query;

      const filter = { companyId };

      if (status) filter.status = status;
      if (licenseType) filter.licenseType = licenseType;
      if (isActive !== '') filter.isActive = isActive === 'true';

      if (search) {
        const regex = new RegExp(search.trim(), 'i');
        filter.$or = [
          { name: regex },
          { phone: regex },
          { alternatePhone: regex },
          { licenseNumber: regex }
        ];
      }

      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
      const skip = (pageNum - 1) * limitNum;

      const [drivers, total] = await Promise.all([
        Driver.find(filter)
          .sort({ name: 1 })
          .skip(skip)
          .limit(limitNum),
        Driver.countDocuments(filter)
      ]);

      res.status(200).json({
        success: true,
        statusCode: 200,
        data: {
          items: drivers,
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

      const driver = await Driver.findOne({ _id: id, companyId });
      if (!driver) {
        return next(new AppError('Driver not found.', 404));
      }

      const documents = await DriverDocument.find({
        driverId: id,
        companyId,
        isActive: true
      }).sort({ createdAt: -1 });

      const now = new Date();
      documents.forEach(doc => doc.calculateComplianceStatus(now));

      // Calculate licence expiry status
      const diffMs = new Date(driver.licenseExpiryDate).getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const licenceStatus = diffDays < 0 ? 'EXPIRED' : diffDays <= 30 ? 'EXPIRING_SOON' : 'VALID';

      res.status(200).json({
        success: true,
        statusCode: 200,
        data: {
          ...driver.toObject(),
          licenceComplianceStatus: licenceStatus,
          daysUntilLicenceExpiry: diffDays,
          documents
        }
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
        phone,
        alternatePhone,
        licenseNumber,
        licenseType,
        licenseExpiryDate,
        address,
        emergencyContact,
        status
      } = req.body;

      if (!name || !name.trim()) {
        return next(new AppError('Driver full name is required.', 400));
      }

      if (!phone || !phone.trim()) {
        return next(new AppError('Driver contact phone number is required.', 400));
      }

      if (!licenseNumber || !licenseNumber.trim()) {
        return next(new AppError('Driving licence number is required.', 400));
      }

      if (!licenseExpiryDate) {
        return next(new AppError('Driving licence expiry date is required.', 400));
      }

      const cleanLicense = licenseNumber.trim().toUpperCase();

      // Check duplicate licence within company
      const existing = await Driver.findOne({ companyId, licenseNumber: cleanLicense });
      if (existing) {
        return next(new AppError(`Driver with licence number '${cleanLicense}' already exists.`, 409));
      }

      const driver = await Driver.create({
        companyId,
        name: name.trim(),
        phone: phone.trim(),
        alternatePhone: alternatePhone ? alternatePhone.trim() : '',
        licenseNumber: cleanLicense,
        licenseType: licenseType || 'HMV',
        licenseExpiryDate: new Date(licenseExpiryDate),
        address: address ? address.trim() : '',
        emergencyContact,
        status: status || DriverStatus.AVAILABLE,
        isActive: true
      });

      await auditLogService.logAction({
        companyId,
        actorId: req.user._id,
        module: 'DRIVERS',
        action: AuditAction.CREATE,
        entityId: driver._id,
        newValues: driver.toObject(),
        ipAddress: req.ip
      });

      res.status(201).json({
        success: true,
        statusCode: 201,
        message: 'Driver profile created successfully.',
        data: driver
      });
    } catch (err) {
      if (err.code === 11000) {
        return next(new AppError('Duplicate licence number constraint violated.', 409));
      }
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const companyId = req.tenant.companyId;

      const driver = await Driver.findOne({ _id: id, companyId });
      if (!driver) {
        return next(new AppError('Driver not found.', 404));
      }

      const oldValues = driver.toObject();

      const allowedFields = [
        'name',
        'phone',
        'alternatePhone',
        'licenseType',
        'licenseExpiryDate',
        'address',
        'emergencyContact',
        'status',
        'isActive'
      ];

      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          if (field === 'licenseExpiryDate') {
            driver[field] = new Date(req.body[field]);
          } else {
            driver[field] = req.body[field];
          }
        }
      });

      if (req.body.licenseNumber) {
        const cleanLicense = req.body.licenseNumber.trim().toUpperCase();
        if (cleanLicense !== driver.licenseNumber) {
          const duplicate = await Driver.findOne({ companyId, licenseNumber: cleanLicense });
          if (duplicate) {
            return next(new AppError(`Driving licence '${cleanLicense}' already in use.`, 409));
          }
          driver.licenseNumber = cleanLicense;
        }
      }

      await driver.save();

      await auditLogService.logAction({
        companyId,
        actorId: req.user._id,
        module: 'DRIVERS',
        action: AuditAction.UPDATE,
        entityId: driver._id,
        oldValues,
        newValues: driver.toObject(),
        ipAddress: req.ip
      });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Driver profile updated successfully.',
        data: driver
      });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const { id } = req.params;
      const companyId = req.tenant.companyId;

      const driver = await Driver.findOne({ _id: id, companyId });
      if (!driver) {
        return next(new AppError('Driver not found.', 404));
      }

      // Referential Guard: Cannot deactivate driver if on an active trip
      const Trip = require('../../trips/models/Trip');
      const activeTrip = await Trip.findOne({
        companyId,
        driverId: driver._id,
        status: { $in: ['CREATED', 'VEHICLE_ASSIGNED', 'LOADING', 'IN_TRANSIT', 'PARTIALLY_DELIVERED'] },
        isActive: true
      });
      if (activeTrip) {
        return next(new AppError(`Cannot deactivate driver ${driver.name}: currently assigned to active Trip ${activeTrip.tripNumber}.`, 400));
      }

      driver.isActive = false;
      driver.status = DriverStatus.INACTIVE;
      await driver.save();

      await auditLogService.logAction({
        companyId,
        actorId: req.user._id,
        module: 'DRIVERS',
        action: AuditAction.DELETE,
        entityId: driver._id,
        oldValues: { isActive: true },
        newValues: { isActive: false, status: DriverStatus.INACTIVE },
        ipAddress: req.ip
      });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Driver profile deactivated.'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Upload & attach identity/licence document for driver
   */
  async uploadDocument(req, res, next) {
    try {
      const { id } = req.params;
      const companyId = req.tenant.companyId;

      const driver = await Driver.findOne({ _id: id, companyId });
      if (!driver) {
        return next(new AppError('Driver not found.', 404));
      }

      if (!req.file) {
        return next(new AppError('Document file is required (PDF, JPG, PNG).', 400));
      }

      const {
        documentType,
        documentNumber,
        issueDate,
        expiryDate,
        notes
      } = req.body;

      if (!documentType || !Object.values(DriverDocumentType).includes(documentType)) {
        return next(new AppError(`Invalid document type. Allowed: ${Object.values(DriverDocumentType).join(', ')}`, 400));
      }

      const storageResult = await storageService.saveFile({
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        companyId,
        module: 'drivers'
      });

      const driverDoc = new DriverDocument({
        companyId,
        driverId: driver._id,
        documentType,
        documentNumber: documentNumber ? documentNumber.trim().toUpperCase() : '',
        issueDate: issueDate ? new Date(issueDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        fileKey: storageResult.fileKey,
        originalFileName: storageResult.originalFileName,
        mimeType: storageResult.mimeType,
        fileSize: storageResult.fileSize,
        notes: notes || '',
        isActive: true
      });

      driverDoc.calculateComplianceStatus();
      await driverDoc.save();

      await auditLogService.logAction({
        companyId,
        actorId: req.user._id,
        module: 'DRIVER_DOCS',
        action: AuditAction.CREATE,
        entityId: driverDoc._id,
        newValues: {
          driverId: driver._id,
          driverName: driver.name,
          documentType
        },
        ipAddress: req.ip
      });

      res.status(201).json({
        success: true,
        statusCode: 201,
        message: `${documentType} uploaded successfully for ${driver.name}.`,
        data: driverDoc
      });
    } catch (err) {
      next(err);
    }
  }

  async listDocuments(req, res, next) {
    try {
      const { id } = req.params;
      const companyId = req.tenant.companyId;

      const docs = await DriverDocument.find({
        driverId: id,
        companyId,
        isActive: true
      }).sort({ createdAt: -1 });

      const now = new Date();
      docs.forEach(d => d.calculateComplianceStatus(now));

      res.status(200).json({
        success: true,
        statusCode: 200,
        data: docs
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteDocument(req, res, next) {
    try {
      const { docId } = req.params;
      const companyId = req.tenant.companyId;

      const doc = await DriverDocument.findOne({ _id: docId, companyId });
      if (!doc) {
        return next(new AppError('Document not found.', 404));
      }

      doc.isActive = false;
      await doc.save();

      await auditLogService.logAction({
        companyId,
        actorId: req.user._id,
        module: 'DRIVER_DOCS',
        action: AuditAction.DELETE,
        entityId: doc._id,
        oldValues: { documentType: doc.documentType, driverId: doc.driverId },
        newValues: { isActive: false },
        ipAddress: req.ip
      });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Driver document deactivated.'
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new DriverController();
