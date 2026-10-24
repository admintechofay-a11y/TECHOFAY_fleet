/**
 * Audit Log Routes
 */

const express = require('express');
const AuditLogService = require('../services/auditLog.service');
const { authenticate, enforceTenantScope } = require('../../../middleware/auth.middleware');
const { requirePermission } = require('../../../middleware/rbac.middleware');
const { SystemModule } = require('@fleet/shared');

const router = express.Router();

router.use(authenticate, enforceTenantScope);

router.get('/', requirePermission(SystemModule.AUDIT, 'view'), async (req, res, next) => {
  try {
    const companyId = req.tenant.companyId;
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '50', 10);
    const filter = {};
    if (req.query.module) filter.module = req.query.module;
    if (req.query.action) filter.action = req.query.action;
    if (req.query.actorId) filter.actorId = req.query.actorId;

    const result = await AuditLogService.getLogs(companyId, filter, { page, limit });

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Audit logs retrieved successfully',
      data: result.logs,
      meta: result.pagination
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
