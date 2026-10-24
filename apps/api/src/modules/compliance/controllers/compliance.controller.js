/**
 * Compliance & Notification Controller
 */

const complianceService = require('../services/compliance.service');
const InAppNotification = require('../models/InAppNotification');
const { AppError } = require('../../../middleware/errorHandler');

class ComplianceController {
  async getOverview(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const overview = await complianceService.getComplianceOverview(companyId);

      res.status(200).json({
        success: true,
        statusCode: 200,
        data: overview
      });
    } catch (err) {
      next(err);
    }
  }

  async triggerScan(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const result = await complianceService.runTenantComplianceCheck(companyId);

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Compliance scan completed successfully.',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async listNotifications(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const { isRead = '', page = 1, limit = 20 } = req.query;

      const filter = { companyId };
      if (isRead !== '') filter.isRead = isRead === 'true';

      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
      const skip = (pageNum - 1) * limitNum;

      const [notifications, total] = await Promise.all([
        InAppNotification.find(filter)
          .sort({ isRead: 1, createdAt: -1 })
          .skip(skip)
          .limit(limitNum),
        InAppNotification.countDocuments(filter)
      ]);

      res.status(200).json({
        success: true,
        statusCode: 200,
        data: {
          items: notifications,
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

  async markAsRead(req, res, next) {
    try {
      const { id } = req.params;
      const companyId = req.tenant.companyId;

      const notification = await InAppNotification.findOne({ _id: id, companyId });
      if (!notification) {
        return next(new AppError('Notification not found.', 404));
      }

      notification.isRead = true;
      notification.readAt = new Date();
      await notification.save();

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Notification marked as read.'
      });
    } catch (err) {
      next(err);
    }
  }

  async markAllAsRead(req, res, next) {
    try {
      const companyId = req.tenant.companyId;

      await InAppNotification.updateMany(
        { companyId, isRead: false },
        { isRead: true, readAt: new Date() }
      );

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'All notifications marked as read.'
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ComplianceController();
