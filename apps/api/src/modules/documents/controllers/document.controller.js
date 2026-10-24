/**
 * Private Document Stream Controller
 * Authenticated and tenant-scoped retrieval of stored vehicle and driver documents.
 */

const fs = require('fs');
const VehicleDocument = require('../../vehicles/models/VehicleDocument');
const DriverDocument = require('../../drivers/models/DriverDocument');
const storageService = require('../../../services/storage.service');
const { AppError } = require('../../../middleware/errorHandler');

class DocumentController {
  async download(req, res, next) {
    try {
      const { id } = req.params;
      const { type = 'vehicle' } = req.query;
      const companyId = req.tenant.companyId;

      let doc = null;
      if (type === 'driver') {
        doc = await DriverDocument.findOne({ _id: id, companyId, isActive: true });
      } else {
        doc = await VehicleDocument.findOne({ _id: id, companyId, isActive: true });
      }

      if (!doc) {
        return next(new AppError('Document not found or access denied.', 404));
      }

      // Resolves path and strictly checks tenant folder isolation
      const absolutePath = storageService.getFilePath(doc.fileKey, companyId);

      res.setHeader('Content-Type', doc.mimeType);
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${encodeURIComponent(doc.originalFileName)}"`
      );
      res.setHeader('Content-Length', doc.fileSize);

      const stream = fs.createReadStream(absolutePath);
      stream.on('error', (streamErr) => next(streamErr));
      stream.pipe(res);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new DocumentController();
