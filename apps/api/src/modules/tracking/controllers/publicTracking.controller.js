/**
 * Public Consignment Tracking Controller
 */

const publicTrackingService = require('../services/publicTracking.service');
const Trip = require('../../trips/models/Trip');
const { resolveCoordinates } = require('../services/geoCoordinates');
const { AppError } = require('../../../middleware/errorHandler');

class PublicTrackingController {
  /**
   * Public Consignment Lookup
   * GET /api/v1/public/track/:identifier or GET /api/v1/public/track?q=...
   */
  async track(req, res, next) {
    try {
      const identifier = req.params.identifier || req.query.q || req.query.lr || req.query.load || req.query.token;
      const companyHint = req.query.companyId || req.query.tenant || null;
      const trackingData = await publicTrackingService.trackConsignment(identifier, companyHint, req.ip);

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: `Consignment tracking retrieved for ${identifier}`,
        data: trackingData
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Operator Route Map details for a Trip
   * GET /api/v1/trips/:id/route-map
   */
  async getTripRouteMap(req, res, next) {
    try {
      const { id } = req.params;
      const companyId = req.tenant.companyId;

      const trip = await Trip.findOne({ _id: id, companyId, isActive: true })
        .populate('loadId')
        .populate('vehicleId', 'plateNumber vehicleType make model')
        .populate('driverId', 'fullName mobileNumber')
        .populate('stops.locationId');

      if (!trip) {
        throw new AppError('Trip not found or access denied.', 404);
      }

      const stopsWithCoordinates = (trip.stops || []).map(s => {
        const loc = s.locationId || {};
        return {
          sequence: s.sequence,
          stopType: s.stopType,
          status: s.status,
          locationName: loc.name,
          city: loc.address?.city || '',
          state: loc.address?.state || '',
          allocatedQuantity: s.allocatedQuantity,
          deliveredQuantity: s.deliveredQuantity,
          coordinates: resolveCoordinates(loc),
          arrivedAt: s.arrivedAt,
          completedAt: s.completedAt
        };
      });

      res.status(200).json({
        success: true,
        statusCode: 200,
        data: {
          tripId: trip._id,
          tripNumber: trip.tripNumber,
          status: trip.status,
          vehicle: trip.vehicleId,
          driver: trip.driverId,
          stops: stopsWithCoordinates
        }
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PublicTrackingController();
