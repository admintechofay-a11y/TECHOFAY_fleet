/**
 * Telematics Controller
 * HTTP endpoints for physical GPS hardware status, ping ingestion,
 * and tenant vehicle location resolution.
 */

const GpsService = require('../services/gps.service');

class TelematicsController {
  /**
   * GET /api/v1/telematics/status
   * Honest hardware and provider configuration status
   */
  static getStatus(req, res, next) {
    try {
      const status = GpsService.getHardwareStatus();
      res.status(200).json({
        success: true,
        statusCode: 200,
        data: status
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/telematics/ping
   * Ingests hardware device telemetry ping with replay and out-of-order defenses
   */
  static async ingestPing(req, res, next) {
    try {
      const companyHint = req.tenant?.companyId || req.user?.companyId || null;
      const signature = req.headers['x-telematics-signature'] || null;

      const result = await GpsService.ingestPing(req.body, {
        companyHint,
        signature
      });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Telematics ping processed successfully.',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/telematics/vehicles/:id/location
   * Returns vehicle coordinates distinguishing live GPS from geocoded hub fallback
   */
  static async getVehicleLocation(req, res, next) {
    try {
      const companyId = req.companyId || req.tenant?.companyId || req.user?.companyId;
      const { id } = req.params;

      const location = await GpsService.getVehicleLocation(id, companyId);

      res.status(200).json({
        success: true,
        statusCode: 200,
        data: location
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = TelematicsController;
