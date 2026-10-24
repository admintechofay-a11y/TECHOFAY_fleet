/**
 * Trip State Machine Service
 * Validates allowed transitions for the 8-stage trip execution lifecycle.
 */

const { TripStatus } = require('@fleet/shared');
const { AppError } = require('../../../middleware/errorHandler');

const ALLOWED_TRIP_TRANSITIONS = {
  [TripStatus.CREATED]: [TripStatus.VEHICLE_ASSIGNED, TripStatus.CANCELLED],
  [TripStatus.VEHICLE_ASSIGNED]: [TripStatus.LOADING, TripStatus.CREATED, TripStatus.CANCELLED],
  [TripStatus.LOADING]: [TripStatus.IN_TRANSIT, TripStatus.VEHICLE_ASSIGNED, TripStatus.CANCELLED],
  [TripStatus.IN_TRANSIT]: [TripStatus.PARTIALLY_DELIVERED, TripStatus.DELIVERED],
  [TripStatus.PARTIALLY_DELIVERED]: [TripStatus.DELIVERED, TripStatus.IN_TRANSIT],
  [TripStatus.DELIVERED]: [TripStatus.CLOSED],
  [TripStatus.CLOSED]: [],
  [TripStatus.CANCELLED]: []
};

class TripStatusService {
  validateTransition(currentStatus, targetStatus) {
    if (currentStatus === targetStatus) return true;

    const allowed = ALLOWED_TRIP_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      throw new AppError(
        `Invalid status transition: Cannot change Trip from '${currentStatus}' to '${targetStatus}'. Allowed transitions: [${allowed.join(', ') || 'None - Terminal state'}]`,
        400
      );
    }
    return true;
  }
}

module.exports = new TripStatusService();
