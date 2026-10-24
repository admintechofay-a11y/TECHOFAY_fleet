/**
 * Dashboard Controller
 * HTTP endpoints for real-time KPI metrics, trends, and operational alerts.
 */

const DashboardService = require('../services/dashboard.service');

class DashboardController {
  /**
   * GET /api/v1/dashboard/metrics
   * Retrieves summary KPI metrics for the authenticated tenant
   */
  static async getMetrics(req, res, next) {
    try {
      const companyId = req.companyId || req.tenant?.companyId;
      const metrics = await DashboardService.getMetrics(companyId);

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Dashboard metrics retrieved successfully',
        data: metrics
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/dashboard/trends
   * Retrieves daily volume and revenue trends
   */
  static async getTrends(req, res, next) {
    try {
      const companyId = req.companyId || req.tenant?.companyId;
      const days = parseInt(req.query.days || '7', 10);
      const trends = await DashboardService.getTrends(companyId, days);

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Dashboard trends retrieved successfully',
        data: trends
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/dashboard/alerts
   * Retrieves actionable operational alerts
   */
  static async getAlerts(req, res, next) {
    try {
      const companyId = req.companyId || req.tenant?.companyId;
      const alerts = await DashboardService.getAlerts(companyId);

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Dashboard alerts retrieved successfully',
        data: alerts
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = DashboardController;
