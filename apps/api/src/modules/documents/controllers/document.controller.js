/**
 * Private Document Stream Controller
 * Authenticated and tenant-scoped retrieval of stored vehicle and driver documents.
 */

const fs = require('fs');
const crypto = require('crypto');
const VehicleDocument = require('../../vehicles/models/VehicleDocument');
const DriverDocument = require('../../drivers/models/DriverDocument');
const LrNumber = require('../../lr/models/LrNumber');
const Bilty = require('../../bilties/models/Bilty');
const Load = require('../../loads/models/Load');
const Trip = require('../../trips/models/Trip');
const Company = require('../../auth/models/Company');
const storageService = require('../../../services/storage.service');
const pdfService = require('../../../services/pdf.service');
const { AppError } = require('../../../middleware/errorHandler');

/**
 * Generate a cryptographically signed, expiring document access token
 */
function generateExpiringDocumentToken({ documentType, documentId, companyId, expiresInHours = 24 }) {
  const secret = process.env.JWT_SECRET || 'doc_signing_secret_fleet_2026';
  const expiresAt = Date.now() + expiresInHours * 60 * 60 * 1000;
  const payload = `${documentType.toLowerCase()}:${documentId}:${companyId}:${expiresAt}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(`${payload}:${signature}`).toString('base64url');
}

/**
 * Verify signed, expiring document access token
 */
function verifyExpiringDocumentToken(token) {
  if (!token) return null;
  try {
    const secret = process.env.JWT_SECRET || 'doc_signing_secret_fleet_2026';
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 5) return null;
    const [documentType, documentId, companyId, expiresAtStr, signature] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);
    if (isNaN(expiresAt) || Date.now() > expiresAt) return null;

    const payload = `${documentType}:${documentId}:${companyId}:${expiresAtStr}`;
    const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSig, 'hex'))) {
      return null;
    }

    return { documentType, documentId, companyId, expiresAt };
  } catch {
    return null;
  }
}

class DocumentController {
  /**
   * 1. Download Stored File (Vehicle/Driver Compliance Attachments)
   */
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

  /**
   * 2. Stream Document PDF (Supports Authenticated Session OR Signed Expiring Token for WhatsApp/Providers)
   */
  async streamDocumentPdf(req, res, next) {
    try {
      const { type, id } = req.params;
      const tokenQuery = req.query.token;
      const copy = req.query.copy || 'ORIGINAL';

      let resolvedCompanyId = req.tenant?.companyId;

      // If token provided, verify cryptographically
      if (tokenQuery) {
        const tokenData = verifyExpiringDocumentToken(tokenQuery);
        if (!tokenData) {
          throw new AppError('The document access link has expired or is invalid.', 401);
        }
        if (
          tokenData.documentType !== type.toLowerCase() ||
          tokenData.documentId.toString() !== id.toString()
        ) {
          throw new AppError('Document token mismatch for requested resource.', 403);
        }
        resolvedCompanyId = tokenData.companyId;
      }

      if (!resolvedCompanyId) {
        throw new AppError('Authentication or valid expiring document token required.', 401);
      }

      // Fetch Company profile for branding
      const company = await Company.findById(resolvedCompanyId);
      if (!company) {
        throw new AppError('Company organization not found.', 404);
      }

      const docTypeNorm = type.toLowerCase();
      let pdfBuffer = null;
      let filename = `${docTypeNorm}_${id}.pdf`;

      if (docTypeNorm === 'lr') {
        const lr = await LrNumber.findOne({ _id: id, companyId: resolvedCompanyId, isActive: true })
          .populate('loadId')
          .populate('vehicleId')
          .populate('driverId')
          .populate('consignorId')
          .populate('consigneeId')
          .populate('fromLocationId')
          .populate('toLocationId');

        if (!lr) throw new AppError('Lorry Receipt document not found.', 404);
        filename = `LR_${lr.lrNumber}_${copy}.pdf`;
        pdfBuffer = await pdfService.generateLrPdf(lr, company, { copy });
      } else if (docTypeNorm === 'bilty' || docTypeNorm === 'bilties') {
        const bilty = await Bilty.findOne({ _id: id, companyId: resolvedCompanyId, isActive: true })
          .populate('lrId')
          .populate('consignorId')
          .populate('consigneeId');

        if (!bilty) throw new AppError('Bilty consignment note not found.', 404);
        filename = `Bilty_${bilty.biltyNumber}_${copy}.pdf`;
        pdfBuffer = await pdfService.generateBiltyPdf(bilty, company, { copy });
      } else if (docTypeNorm === 'load' || docTypeNorm === 'loading-slip') {
        const load = await Load.findOne({ _id: id, companyId: resolvedCompanyId, isActive: true })
          .populate('customerId')
          .populate('consignorId')
          .populate('consigneeId')
          .populate('originLocationId')
          .populate('destinationLocationId')
          .populate('assignedVehicleId')
          .populate('assignedDriverId');

        if (!load) throw new AppError('Consignment load not found.', 404);
        filename = `LoadingSlip_${load.loadNumber}.pdf`;
        pdfBuffer = await pdfService.generateLoadingSlipPdf(load, company);
      } else if (docTypeNorm === 'trip' || docTypeNorm === 'trip-sheet') {
        const trip = await Trip.findOne({ _id: id, companyId: resolvedCompanyId, isActive: true })
          .populate('loadId')
          .populate('vehicleId')
          .populate('driverId')
          .populate('stops.locationId');

        if (!trip) throw new AppError('Trip record not found.', 404);
        filename = `TripSheet_${trip.tripNumber}_${copy}.pdf`;
        pdfBuffer = await pdfService.generateTripSheetPdf(trip, company, { copy });
      } else if (docTypeNorm === 'settlement') {
        const trip = await Trip.findOne({ _id: id, companyId: resolvedCompanyId, isActive: true })
          .populate('loadId')
          .populate('vehicleId')
          .populate('driverId');

        if (!trip) throw new AppError('Trip record not found.', 404);
        filename = `Settlement_${trip.tripNumber}_${copy}.pdf`;
        pdfBuffer = await pdfService.generateSettlementPdf(trip, company, { copy });
      } else {
        throw new AppError(`Unsupported document type '${type}'.`, 400);
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.status(200).send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  }
}

const controller = new DocumentController();
controller.generateExpiringDocumentToken = generateExpiringDocumentToken;
controller.verifyExpiringDocumentToken = verifyExpiringDocumentToken;

module.exports = controller;
