/**
 * Proof of Delivery (POD) Controller
 * Handles POD document uploads, storage persistence, supervisor verification,
 * and authenticated document streaming.
 */

const fs = require('fs');
const ProofOfDelivery = require('../models/ProofOfDelivery');
const Trip = require('../../trips/models/Trip');
const Load = require('../../loads/models/Load');
const LrNumber = require('../../lr/models/LrNumber');
const sequenceService = require('../../sequences/services/sequence.service');
const storageService = require('../../../services/storage.service');
const auditLogService = require('../../audit/services/auditLog.service');
const { AuditAction, PodStatus, SystemModule } = require('@fleet/shared');
const { AppError } = require('../../../middleware/errorHandler');

class PodController {
  /**
   * 1. List POD Records with Filtering & Pagination
   */
  async list(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const {
        page = 1,
        limit = 20,
        search = '',
        status = '',
        tripId = '',
        loadId = ''
      } = req.query;

      const filter = { companyId, isActive: true };

      if (status) filter.status = status;
      if (tripId) filter.tripId = tripId;
      if (loadId) filter.loadId = loadId;

      if (search) {
        const regex = new RegExp(search.trim(), 'i');
        filter.$or = [
          { podNumber: regex },
          { receiverName: regex }
        ];
      }

      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
      const skip = (pageNum - 1) * limitNum;

      const [pods, total] = await Promise.all([
        ProofOfDelivery.find(filter)
          .populate('tripId', 'tripNumber status')
          .populate('loadId', 'loadNumber totalQuantity packageType')
          .populate('lrId', 'lrNumber eWayBillNumber')
          .populate('verifiedBySupervisor', 'name email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum),
        ProofOfDelivery.countDocuments(filter)
      ]);

      res.status(200).json({
        success: true,
        statusCode: 200,
        data: {
          items: pods,
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

  /**
   * 2. Get POD by ID
   */
  async getById(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const { id } = req.params;

      const pod = await ProofOfDelivery.findOne({ _id: id, companyId, isActive: true })
        .populate('tripId')
        .populate('loadId')
        .populate('lrId')
        .populate('verifiedBySupervisor', 'name email');

      if (!pod) {
        throw new AppError('Proof of Delivery record not found.', 404);
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        data: pod
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 3. Upload & Register Proof of Delivery
   */
  async upload(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const userId = req.user.id;

      if (!req.file) {
        throw new AppError('POD document file is required (PDF, JPG, PNG).', 400);
      }

      const {
        tripId,
        loadId,
        lrId = null,
        stopId = null,
        receiverName,
        receiverPhone = '',
        quantityDelivered,
        remarks = ''
      } = req.body;

      if (!tripId || !receiverName || !quantityDelivered) {
        throw new AppError('tripId, receiverName, and quantityDelivered are required.', 400);
      }

      const qty = parseInt(quantityDelivered, 10);
      if (isNaN(qty) || qty <= 0) {
        throw new AppError('quantityDelivered must be a positive integer.', 400);
      }

      // Validate Trip
      const trip = await Trip.findOne({ _id: tripId, companyId, isActive: true });
      if (!trip) {
        throw new AppError('Specified Trip does not exist.', 404);
      }

      // Cross-Tenant Validation on explicit loadId or lrId
      if (loadId) {
        const load = await Load.findOne({ _id: loadId, companyId, isActive: true });
        if (!load) throw new AppError('Specified Load does not exist or access denied.', 404);
      }
      if (lrId) {
        const lr = await LrNumber.findOne({ _id: lrId, companyId, isActive: true });
        if (!lr) throw new AppError('Specified LR does not exist or access denied.', 404);
      }

      // Check linked load
      const effectiveLoadId = loadId || trip.loadId;

      // Save file securely into tenant-isolated storage
      const saved = await storageService.saveFile({
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        companyId,
        module: 'pod'
      });

      // Allocate Atomic POD Number
      const podNumber = await sequenceService.getNextSequence(companyId, 'POD', 'POD');

      const pod = new ProofOfDelivery({
        companyId,
        podNumber,
        tripId,
        loadId: effectiveLoadId,
        lrId: lrId || null,
        stopId: stopId || null,
        receiverName: receiverName.trim(),
        receiverPhone: receiverPhone.trim(),
        quantityDelivered: qty,
        fileKey: saved.fileKey,
        fileName: saved.originalFileName,
        mimeType: saved.mimeType,
        fileSize: saved.fileSize,
        status: PodStatus.PENDING_VERIFICATION,
        verificationRemarks: remarks
      });

      await pod.save();

      // Audit Log
      await auditLogService.logAction({
        companyId,
        userId,
        module: SystemModule.POD,
        action: AuditAction.CREATE,
        entityId: pod._id,
        entityType: 'ProofOfDelivery',
        details: {
          podNumber,
          tripNumber: trip.tripNumber,
          receiverName,
          quantityDelivered: qty
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.status(201).json({
        success: true,
        statusCode: 201,
        message: `Proof of Delivery ${podNumber} uploaded and queued for supervisor verification.`,
        data: pod
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 4. Authenticated Stream of POD Document
   */
  async download(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const { id } = req.params;

      const pod = await ProofOfDelivery.findOne({ _id: id, companyId, isActive: true });
      if (!pod) {
        throw new AppError('Proof of Delivery record not found.', 404);
      }

      const filePath = storageService.getFilePath(pod.fileKey, companyId);

      res.setHeader('Content-Type', pod.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(pod.fileName || 'pod_document')}"`);
      res.setHeader('Content-Length', pod.fileSize);

      const stream = fs.createReadStream(filePath);
      stream.on('error', streamErr => next(streamErr));
      stream.pipe(res);
    } catch (err) {
      next(err);
    }
  }

  /**
   * 5. Supervisor Verification & Sign-off
   */
  async verify(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const userId = req.user.id;
      const { id } = req.params;
      const { status, remarks = '' } = req.body;

      if (!status || ![PodStatus.VERIFIED, PodStatus.REJECTED].includes(status)) {
        throw new AppError("Status must be either 'VERIFIED' or 'REJECTED'.", 400);
      }

      const pod = await ProofOfDelivery.findOne({ _id: id, companyId, isActive: true });
      if (!pod) {
        throw new AppError('Proof of Delivery record not found.', 404);
      }

      pod.status = status;
      pod.verifiedBySupervisor = userId;
      pod.verifiedAt = new Date();
      pod.verificationRemarks = remarks;

      await pod.save();

      // Audit Log
      await auditLogService.logAction({
        companyId,
        userId,
        module: SystemModule.POD,
        action: AuditAction.UPDATE,
        entityId: pod._id,
        entityType: 'ProofOfDelivery',
        details: {
          podNumber: pod.podNumber,
          verificationStatus: status,
          remarks
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: `POD ${pod.podNumber} successfully marked as ${status}.`,
        data: pod
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PodController();
