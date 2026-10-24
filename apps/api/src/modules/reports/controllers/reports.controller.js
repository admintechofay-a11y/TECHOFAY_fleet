/**
 * Reports Controller
 * Endpoints for operational reports, financial ledgers, and streaming exports.
 */

const ReportsService = require('../services/reports.service');

class ReportsController {
  /**
   * GET /api/v1/reports/loads
   */
  static async getLoadsReport(req, res, next) {
    try {
      const companyId = req.companyId || req.tenant?.companyId;
      const { startDate, endDate, status, consignorId, consigneeId, vehicleId, driverId, page, limit } = req.query;

      const result = await ReportsService.getLoadsReport(
        companyId,
        { startDate, endDate, status, consignorId, consigneeId, vehicleId, driverId },
        { page, limit }
      );

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Loads report generated successfully',
        data: result.rows,
        summary: result.summary,
        meta: result.pagination
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/reports/trips
   */
  static async getTripsReport(req, res, next) {
    try {
      const companyId = req.companyId || req.tenant?.companyId;
      const { startDate, endDate, status, vehicleId, driverId, page, limit } = req.query;

      const result = await ReportsService.getTripsReport(
        companyId,
        { startDate, endDate, status, vehicleId, driverId },
        { page, limit }
      );

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Trips report generated successfully',
        data: result.rows,
        summary: result.summary,
        meta: result.pagination
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/reports/freight
   */
  static async getFreightReport(req, res, next) {
    try {
      const companyId = req.companyId || req.tenant?.companyId;
      const { customerId, startDate, endDate } = req.query;

      const result = await ReportsService.getFreightReport(companyId, { customerId, startDate, endDate });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Freight ledger report generated successfully',
        data: result.rows,
        summary: result.summary
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/reports/compliance
   */
  static async getComplianceReport(req, res, next) {
    try {
      const companyId = req.companyId || req.tenant?.companyId;
      const { status, entityType } = req.query;

      const result = await ReportsService.getComplianceReport(companyId, { status, entityType });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Compliance audit report generated successfully',
        data: result.rows,
        summary: result.summary
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/reports/export/:reportType
   * Streams sanitized Excel (.xlsx) or CSV file
   */
  static async exportReport(req, res, next) {
    try {
      const companyId = req.companyId || req.tenant?.companyId;
      const { reportType } = req.params;
      const format = (req.query.format || 'xlsx').toLowerCase();

      const buffer = await ReportsService.exportReport(companyId, reportType, req.query, format);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `${reportType}_report_${timestamp}.${format}`;

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
      } else {
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
      }
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ReportsController;
