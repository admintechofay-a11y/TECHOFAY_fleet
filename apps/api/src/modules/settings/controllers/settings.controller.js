/**
 * Settings Controller
 * Administrative endpoints for organization details, operational parameters, and branding.
 */

const SettingsService = require('../services/settings.service');

class SettingsController {
  /**
   * GET /api/v1/admin/settings
   */
  static async getSettings(req, res, next) {
    try {
      const companyId = req.companyId || req.tenant?.companyId;
      const settings = await SettingsService.getSettings(companyId);

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Organization settings retrieved successfully',
        data: settings
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/admin/settings
   */
  static async updateSettings(req, res, next) {
    try {
      const companyId = req.companyId || req.tenant?.companyId;
      const actorId = req.user?._id;
      const ipAddress = req.ip || req.connection?.remoteAddress || '';

      const updated = await SettingsService.updateSettings(companyId, req.body, actorId, ipAddress);

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Organization settings updated successfully',
        data: updated
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = SettingsController;
