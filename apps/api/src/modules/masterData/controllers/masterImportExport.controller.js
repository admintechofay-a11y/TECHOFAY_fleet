/**
 * Master Data Import/Export Controller
 */

const masterImportExportService = require('../../../services/masterImportExport.service');
const { AppError } = require('../../../middleware/errorHandler');

class MasterImportExportController {
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
        companyId
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

  async confirmImport(req, res, next) {
    try {
      const { entityType } = req.params;
      const companyId = req.tenant.companyId;
      const { validRecords } = req.body;

      if (!validRecords || !Array.isArray(validRecords) || validRecords.length === 0) {
        return next(new AppError('No valid records supplied for confirmed import.', 400));
      }

      const result = await masterImportExportService.confirmImport({
        entityType,
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

  async exportData(req, res, next) {
    try {
      const { entityType } = req.params;
      const { format = 'xlsx' } = req.query;
      const companyId = req.tenant.companyId;

      const exportResult = await masterImportExportService.exportMasterData({
        entityType,
        companyId,
        format
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
}

module.exports = new MasterImportExportController();
