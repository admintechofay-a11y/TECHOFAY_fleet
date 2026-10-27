/**
 * Load & Consignment State Machine Service
 * Validates allowed status transitions and preserves immutable status history.
 */

const { LoadStatus, LrStatus } = require('../../../shared');
const { AppError } = require('../../../middleware/errorHandler');

const ALLOWED_LOAD_TRANSITIONS = {
  [LoadStatus.CREATED]: [LoadStatus.ASSIGNED, LoadStatus.CANCELLED],
  [LoadStatus.ASSIGNED]: [LoadStatus.LOADING, LoadStatus.CREATED, LoadStatus.CANCELLED],
  [LoadStatus.LOADING]: [LoadStatus.IN_TRANSIT, LoadStatus.ASSIGNED, LoadStatus.CANCELLED],
  [LoadStatus.IN_TRANSIT]: [LoadStatus.PARTIALLY_DELIVERED, LoadStatus.DELIVERED],
  [LoadStatus.PARTIALLY_DELIVERED]: [LoadStatus.DELIVERED, LoadStatus.IN_TRANSIT],
  [LoadStatus.DELIVERED]: [LoadStatus.CLOSED],
  [LoadStatus.CLOSED]: [],
  [LoadStatus.CANCELLED]: []
};

const ALLOWED_LR_TRANSITIONS = {
  [LrStatus.BOOKED]: [LrStatus.LOADED, LrStatus.CANCELLED],
  [LrStatus.LOADED]: [LrStatus.IN_TRANSIT, LrStatus.CANCELLED],
  [LrStatus.IN_TRANSIT]: [LrStatus.PARTIALLY_DELIVERED, LrStatus.DELIVERED, LrStatus.CANCELLED],
  [LrStatus.PARTIALLY_DELIVERED]: [LrStatus.DELIVERED],
  [LrStatus.DELIVERED]: [LrStatus.POD_CLOSED],
  [LrStatus.POD_CLOSED]: [],
  [LrStatus.CANCELLED]: []
};

class LoadStatusService {
  /**
   * Validate if transition from current to target is permitted
   */
  validateLoadTransition(currentStatus, targetStatus) {
    if (currentStatus === targetStatus) return true;

    const allowed = ALLOWED_LOAD_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      throw new AppError(
        `Invalid status transition: Cannot change Load from '${currentStatus}' to '${targetStatus}'. Allowed: [${allowed.join(', ') || 'None - Terminal state'}]`,
        400
      );
    }
    return true;
  }

  validateLrTransition(currentStatus, targetStatus) {
    if (currentStatus === targetStatus) return true;

    const allowed = ALLOWED_LR_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      throw new AppError(
        `Invalid status transition: Cannot change LR from '${currentStatus}' to '${targetStatus}'. Allowed: [${allowed.join(', ') || 'None - Terminal state'}]`,
        400
      );
    }
    return true;
  }
}

module.exports = new LoadStatusService();
