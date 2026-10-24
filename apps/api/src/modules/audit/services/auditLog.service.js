/**
 * Audit Logging Service
 */

const AuditLog = require('../models/AuditLog');

class AuditLogService {
  /**
   * Record an immutable audit log entry
   */
  static async log({
    companyId,
    actorId = null,
    module,
    action,
    entityId = null,
    oldValues = null,
    newValues = null,
    ipAddress = '',
    userAgent = ''
  }) {
    try {
      if (!companyId) {
        return null;
      }
      return await AuditLog.create({
        companyId,
        actorId,
        module,
        action,
        entityId,
        oldValues,
        newValues,
        ipAddress,
        userAgent
      });
    } catch (err) {
      console.error('[AUDIT_ERROR] Failed to record audit log:', err.message);
      return null;
    }
  }

  /**
   * Retrieve audit logs with filtering and pagination
   */
  static async getLogs(companyId, filter = {}, { page = 1, limit = 50 } = {}) {
    const query = { companyId };
    if (filter.module) query.module = filter.module;
    if (filter.action) query.action = filter.action;
    if (filter.actorId) query.actorId = filter.actorId;

    const skip = (page - 1) * limit;
    const [logs, totalRecords] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('actorId', 'name email')
        .lean(),
      AuditLog.countDocuments(query)
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit) || 1
      }
    };
  }
}

module.exports = AuditLogService;
