/**
 * Sequence Service
 * Provides atomic, race-condition-safe sequential identifier allocation per tenant.
 */

const Counter = require('../models/Counter');
const { AppError } = require('../../../middleware/errorHandler');

class SequenceService {
  /**
   * Allocate the next atomic sequence number
   * e.g. LD-2026-00001, LR-2026-00001, BL-2026-00001
   */
  async getNextSequence(companyId, entityType, prefix = 'NUM', padding = 5) {
    if (!companyId) {
      throw new AppError('Tenant company ID is required for sequence allocation.', 400);
    }

    const year = new Date().getFullYear();

    const counter = await Counter.findOneAndUpdate(
      { companyId, entityType: entityType.toUpperCase(), year },
      { $inc: { seq: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const paddedSeq = String(counter.seq).padStart(padding, '0');
    return `${prefix.toUpperCase()}-${year}-${paddedSeq}`;
  }
}

module.exports = new SequenceService();
