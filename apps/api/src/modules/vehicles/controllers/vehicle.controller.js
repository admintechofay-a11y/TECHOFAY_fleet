/**
 * Vehicle Controller
 * Manages Fleet Vehicles and Document Compliance uploads.
 */

const Vehicle = require('../models/Vehicle');
const VehicleDocument = require('../models/VehicleDocument');
const storageService = require('../../../services/storage.service');
const auditLogService = require('../../audit/services/auditLog.service');
const { AuditAction, VehicleStatus, VehicleDocumentType } = require('@fleet/shared');
const { AppError } = require('../../../middleware/errorHandler');

class VehicleController {
  async list(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const {
        page = 1,
        limit = 20,
        search = '',
        status = '',
        category = '',
        isActive = ''
      } = req.query;

      const filter = { companyId };

      if (status) filter.status = status;
      if (category) filter.category = category;
      if (isActive !== '') filter.isActive = isActive === 'true';

      if (search) {
        const cleanSearch = search.trim().replace(/\s+/g, '');
        const regex = new RegExp(cleanSearch, 'i');
        filter.$or = [
          { plateNumber: regex },
          { make: new RegExp(search.trim(), 'i') },
          { model: new RegExp(search.trim(), 'i') },
          { ownerName: new RegExp(search.trim(), 'i') },
          { chassisNumber: regex }
        ];
      }

      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
      const skip = (pageNum - 1) * limitNum;

      const [vehicles, total] = await Promise.all([
        Vehicle.find(filter)
          .sort({ plateNumber: 1 })
          .skip(skip)
          .limit(limitNum),
        Vehicle.countDocuments(filter)
      ]);

      res.status(200).json({
        success: true,
        statusCode: 200,
        data: {
          items: vehicles,
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

      const vehicle = await Vehicle.findOne({ _id: id, companyId });
      if (!vehicle) {
        return next(new AppError('Vehicle not found.', 404));
      }

      const documents = await VehicleDocument.find({
        vehicleId: id,
        companyId,
        isActive: true
      }).sort({ expiryDate: 1 });

      // Refresh compliance statuses
      const now = new Date();
      documents.forEach(doc => doc.calculateComplianceStatus(now));

      res.status(200).json({
        success: true,
        statusCode: 200,
        data: {
          ...vehicle.toObject(),
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
        plateNumber,
        vehicleType,
        category,
        make,
        model,
        yearOfManufacture,
        capacityTonnage,
        chassisNumber,
        engineNumber,
        ownerName,
        ownerPhone,
        status
      } = req.body;

      if (!plateNumber || !plateNumber.trim()) {
        return next(new AppError('Vehicle registration plate number is required.', 400));
      }

      const cleanPlate = plateNumber.trim().toUpperCase().replace(/\s+/g, '');

      // Duplicate check within company
      const existing = await Vehicle.findOne({ companyId, plateNumber: cleanPlate });
      if (existing) {
        return next(new AppError(`Vehicle with plate number '${cleanPlate}' already exists in your fleet.`, 409));
      }

      const vehicle = await Vehicle.create({
        companyId,
        plateNumber: cleanPlate,
        vehicleType: vehicleType ? vehicleType.trim() : 'Open Truck',
        category: category || 'OWNED',
        make: make ? make.trim() : '',
        model: model ? model.trim() : '',
        yearOfManufacture: yearOfManufacture || undefined,
        capacityTonnage: capacityTonnage || 10,
        chassisNumber: chassisNumber ? chassisNumber.trim().toUpperCase() : '',
        engineNumber: engineNumber ? engineNumber.trim().toUpperCase() : '',
        ownerName: ownerName ? ownerName.trim() : '',
        ownerPhone: ownerPhone ? ownerPhone.trim() : '',
        status: status || VehicleStatus.AVAILABLE,
        isActive: true
      });

      await auditLogService.logAction({
        companyId,
        actorId: req.user._id,
        module: 'VEHICLES',
        action: AuditAction.CREATE,
        entityId: vehicle._id,
        newValues: vehicle.toObject(),
        ipAddress: req.ip
      });

      res.status(201).json({
        success: true,
        statusCode: 201,
        message: 'Vehicle added to fleet successfully.',
        data: vehicle
      });
    } catch (err) {
      if (err.code === 11000) {
        return next(new AppError('Duplicate vehicle plate number constraint violated.', 409));
      }
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const companyId = req.tenant.companyId;

      const vehicle = await Vehicle.findOne({ _id: id, companyId });
      if (!vehicle) {
        return next(new AppError('Vehicle not found.', 404));
      }

      const oldValues = vehicle.toObject();

      const allowedFields = [
        'vehicleType',
        'category',
        'make',
        'model',
        'yearOfManufacture',
        'capacityTonnage',
        'chassisNumber',
        'engineNumber',
        'ownerName',
        'ownerPhone',
        'status',
        'isActive'
      ];

      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          vehicle[field] = req.body[field];
        }
      });

      if (req.body.plateNumber) {
        const cleanPlate = req.body.plateNumber.trim().toUpperCase().replace(/\s+/g, '');
        if (cleanPlate !== vehicle.plateNumber) {
          const duplicate = await Vehicle.findOne({ companyId, plateNumber: cleanPlate });
          if (duplicate) {
            return next(new AppError(`Vehicle plate '${cleanPlate}' already in use.`, 409));
          }
          vehicle.plateNumber = cleanPlate;
        }
      }

      await vehicle.save();

      await auditLogService.logAction({
        companyId,
        actorId: req.user._id,
        module: 'VEHICLES',
        action: AuditAction.UPDATE,
        entityId: vehicle._id,
        oldValues,
        newValues: vehicle.toObject(),
        ipAddress: req.ip
      });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Vehicle updated successfully.',
        data: vehicle
      });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const { id } = req.params;
      const companyId = req.tenant.companyId;

      const vehicle = await Vehicle.findOne({ _id: id, companyId });
      if (!vehicle) {
        return next(new AppError('Vehicle not found.', 404));
      }

      vehicle.isActive = false;
      vehicle.status = VehicleStatus.INACTIVE;
      await vehicle.save();

      await auditLogService.logAction({
        companyId,
        actorId: req.user._id,
        module: 'VEHICLES',
        action: AuditAction.DELETE,
        entityId: vehicle._id,
        oldValues: { isActive: true },
        newValues: { isActive: false, status: VehicleStatus.INACTIVE },
        ipAddress: req.ip
      });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Vehicle deactivated from active fleet.'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Upload & attach a regulatory document to vehicle
   */
  async uploadDocument(req, res, next) {
    try {
      const { id } = req.params;
      const companyId = req.tenant.companyId;

      const vehicle = await Vehicle.findOne({ _id: id, companyId });
      if (!vehicle) {
        return next(new AppError('Vehicle not found.', 404));
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

      if (!documentType || !Object.values(VehicleDocumentType).includes(documentType)) {
        return next(new AppError(`Invalid document type. Allowed: ${Object.values(VehicleDocumentType).join(', ')}`, 400));
      }

      if (!expiryDate) {
        return next(new AppError('Document expiry date is mandatory.', 400));
      }

      // Save file into private tenant storage
      const storageResult = await storageService.saveFile({
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        companyId,
        module: 'vehicles'
      });

      const vehicleDoc = new VehicleDocument({
        companyId,
        vehicleId: vehicle._id,
        documentType,
        documentNumber: documentNumber ? documentNumber.trim().toUpperCase() : '',
        issueDate: issueDate ? new Date(issueDate) : null,
        expiryDate: new Date(expiryDate),
        fileKey: storageResult.fileKey,
        originalFileName: storageResult.originalFileName,
        mimeType: storageResult.mimeType,
        fileSize: storageResult.fileSize,
        notes: notes || '',
        isActive: true
      });

      vehicleDoc.calculateComplianceStatus();
      await vehicleDoc.save();

      await auditLogService.logAction({
        companyId,
        actorId: req.user._id,
        module: 'VEHICLE_DOCS',
        action: AuditAction.CREATE,
        entityId: vehicleDoc._id,
        newValues: {
          vehicleId: vehicle._id,
          plateNumber: vehicle.plateNumber,
          documentType,
          expiryDate: vehicleDoc.expiryDate
        },
        ipAddress: req.ip
      });

      res.status(201).json({
        success: true,
        statusCode: 201,
        message: `${documentType} document uploaded successfully.`,
        data: vehicleDoc
      });
    } catch (err) {
      next(err);
    }
  }

  async listDocuments(req, res, next) {
    try {
      const { id } = req.params;
      const companyId = req.tenant.companyId;

      const docs = await VehicleDocument.find({
        vehicleId: id,
        companyId,
        isActive: true
      }).sort({ expiryDate: 1 });

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

      const doc = await VehicleDocument.findOne({ _id: docId, companyId });
      if (!doc) {
        return next(new AppError('Document not found.', 404));
      }

      doc.isActive = false;
      await doc.save();

      await auditLogService.logAction({
        companyId,
        actorId: req.user._id,
        module: 'VEHICLE_DOCS',
        action: AuditAction.DELETE,
        entityId: doc._id,
        oldValues: { documentType: doc.documentType, vehicleId: doc.vehicleId },
        newValues: { isActive: false },
        ipAddress: req.ip
      });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Vehicle document deactivated.'
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new VehicleController();
