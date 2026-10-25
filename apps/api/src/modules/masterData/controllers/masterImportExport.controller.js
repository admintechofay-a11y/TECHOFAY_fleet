/**
 * Master Data & Operational Import/Export Controller
 * Handles Templates, Dry-Run Validation, Confirmed Batch Commits,
 * Streaming Exports, and Async Export Job Tracking.
 */

const fs = require('fs');
const mongoose = require('mongoose');
const masterImportExportService = require('../../../services/masterImportExport.service');
const ExportJob = require('../models/ExportJob');
const auditLogService = require('../../audit/services/auditLog.service');
const { SystemModule, AuditAction } = require('@fleet/shared');
const { AppError } = require('../../../middleware/errorHandler');

class MasterImportExportController {
  /**
   * 1. Download Blank/Sample Template
   */
  async downloadTemplate(req, res, next) {
    try {
      const { entityType } = req.params;
      const buffer = await masterImportExportService.generateTemplate(entityType);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${entityType}_template.xlsx"`
      );
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  }

  /**
   * 2. Dry-Run / Preview Validation
   */
  async dryRun(req, res, next) {
    try {
      const { entityType } = req.params;
      const companyId = req.tenant.companyId;

      if (!req.file) {
        return next(new AppError('Spreadsheet file is required (.xlsx).', 400));
      }

      const result = await masterImportExportService.dryRunValidate(
        entityType,
        req.file.buffer,
        companyId,
        req.user?._id
      );

      res.status(200).json({
        success: true,
        statusCode: 200,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 3. Confirm Import Batch Persistence
   */
  async confirmImport(req, res, next) {
    try {
      const { entityType } = req.params;
      const companyId = req.tenant.companyId;
      const { batchId, validRecords } = req.body;

      if (!batchId && (!validRecords || !Array.isArray(validRecords) || validRecords.length === 0)) {
        return next(new AppError('No import batchId or valid records supplied for confirmed import.', 400));
      }

      const result = await masterImportExportService.confirmImport({
        entityType,
        batchId,
        validRecords,
        companyId,
        actorId: req.user._id,
        ipAddress: req.ip
      });

      res.status(200).json({
        success: true,
        statusCode: 200,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 4. Synchronous Streaming Export
   */
  async exportData(req, res, next) {
    try {
      const { entityType } = req.params;
      const { format = 'xlsx', status, search } = req.query;
      const companyId = req.tenant.companyId;

      const exportResult = await masterImportExportService.exportMasterData({
        entityType,
        companyId,
        format,
        filters: { status, search }
      });

      // Audit Log for export action
      await auditLogService.logAction({
        companyId,
        actorId: req.user._id,
        module: SystemModule.IMPORT_EXPORT,
        action: AuditAction.EXPORT,
        entityId: null,
        oldValues: null,
        newValues: { entityType, format, recordCount: exportResult.totalRecords },
        ipAddress: req.ip
      });

      res.setHeader('Content-Type', exportResult.contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${exportResult.filename}"`
      );
      res.send(exportResult.buffer);
    } catch (err) {
      next(err);
    }
  }

  /**
   * 5. Initiate Asynchronous Export Job
   */
  async createJob(req, res, next) {
    try {
      const { entityType, format = 'xlsx', filters = {} } = req.body;
      const companyId = req.tenant.companyId;
      const userId = req.user._id;

      if (!entityType) {
        throw new AppError('entityType is required for export job.', 400);
      }

      const job = await masterImportExportService.createExportJob({
        companyId,
        userId,
        entityType,
        format,
        filters
      });

      res.status(201).json({
        success: true,
        statusCode: 201,
        message: `Export job initiated for ${entityType}.`,
        data: job
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 6. List Recent Export/Import Jobs
   */
  async listJobs(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const { limit = 20 } = req.query;

      const jobs = await ExportJob.find({ companyId })
        .populate('requestedBy', 'name email')
        .sort({ createdAt: -1 })
        .limit(Math.min(100, parseInt(limit, 10) || 20));

      res.status(200).json({
        success: true,
        statusCode: 200,
        data: jobs
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 7. Get Export Job by ID
   */
  async getJobById(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        throw new AppError('Job record not found.', 404);
      }

      const job = await ExportJob.findOne({ _id: id, companyId })
        .populate('requestedBy', 'name email');

      if (!job) {
        throw new AppError('Job record not found.', 404);
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        data: job
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 8. Download Asynchronous Export Job Output File
   */
  async downloadJobFile(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        throw new AppError('Export job not found or access denied.', 404);
      }

      const fileInfo = await masterImportExportService.getJobDownloadStream(id, companyId);

      res.setHeader('Content-Type', fileInfo.contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(fileInfo.fileName)}"`
      );
      res.setHeader('Content-Length', fileInfo.fileSize);

      const stream = fs.createReadStream(fileInfo.filePath);
      stream.on('error', streamErr => next(streamErr));
      stream.pipe(res);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new MasterImportExportController();
