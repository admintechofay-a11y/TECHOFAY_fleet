/**
 * Telematics GPS Service
 * Manages physical GPS telematics hardware abstraction, device ping ingestion,
 * coordinate boundaries, replay/out-of-order defenses, and location resolution.
 */

const crypto = require('crypto');
const Vehicle = require('../../vehicles/models/Vehicle');
const Trip = require('../../trips/models/Trip');
const { resolveCoordinates } = require('../../tracking/services/geoCoordinates');
const eventBus = require('../../../services/eventBus.service');
const { AppError } = require('../../../middleware/errorHandler');

class GpsService {
  /**
   * Returns honest hardware status for GPS providers
   * @returns {Object}
   */
  static getHardwareStatus() {
    const isConfigured = Boolean(
      (process.env.AIS140_API_KEY && process.env.AIS140_API_URL) ||
      (process.env.TRACCAR_API_URL && process.env.TRACCAR_TOKEN)
    );

    const provider = process.env.GPS_PROVIDER || (isConfigured ? 'AIS140' : 'NONE');

    return {
      isConfigured,
      provider,
      status: isConfigured ? 'CONFIGURED' : 'UNAVAILABLE',
      supportedProtocols: ['AIS-140', 'TELTONIKA', 'TRACCAR', 'REST_PING'],
      dependencyMessage: isConfigured
        ? `Telematics hardware provider (${provider}) is active and listening for telemetry pings.`
        : 'Hardware/credential dependency: No physical AIS-140/Teltonika/Traccar telematics gateway is currently configured. Vehicles without configured telemetry devices will report fallback geocoded hub positions.'
    };
  }

  /**
   * Ingests and validates a telematics ping from a hardware tracking unit or gateway
   * @param {Object} payload Telemetry ping payload
   * @param {Object} options Configuration and security options
   * @returns {Promise<Object>}
   */
  static async ingestPing(payload, options = {}) {
    const {
      deviceId,
      latitude,
      longitude,
      speedKmph = 0,
      headingDegrees = 0,
      altitudeMeters = 0,
      accuracyMeters = 5,
      ignition = false,
      batteryPercent = 100,
      timestamp
    } = payload || {};

    const { companyHint = null, signature = null, secret = process.env.TELEMATICS_WEBHOOK_SECRET } = options;

    // 1. Device Identity Validation
    if (!deviceId || typeof deviceId !== 'string' || !deviceId.trim()) {
      throw new AppError('Telematics ping requires a valid deviceId.', 400);
    }
    const cleanDeviceId = deviceId.trim();

    // 2. Signature Verification (if secret configured or signature provided)
    if (secret && signature) {
      const rawPayload = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const expected = crypto.createHmac('sha256', secret).update(rawPayload).digest('hex');
      const sigBuf = Buffer.from(signature, 'utf8');
      const expBuf = Buffer.from(expected, 'utf8');
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        throw new AppError('Invalid telematics webhook signature.', 401);
      }
    }

    // 3. Coordinate Range Validation
    const lat = Number(latitude);
    const lng = Number(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      throw new AppError('Latitude and longitude must be valid numbers.', 400);
    }
    if (lat < -90 || lat > 90) {
      throw new AppError(`Latitude (${lat}) is out of permissible range [-90, 90].`, 400);
    }
    if (lng < -180 || lng > 180) {
      throw new AppError(`Longitude (${lng}) is out of permissible range [-180, 180].`, 400);
    }
    // Reject Null Island failure mode
    if (lat === 0 && lng === 0) {
      throw new AppError('Null Island GPS coordinates (0, 0) are invalid.', 400);
    }

    // 4. Timestamp Validation & Replay/Clock Skew Defense
    if (!timestamp) {
      throw new AppError('Telematics ping requires a valid timestamp.', 400);
    }
    const pingDate = new Date(timestamp);
    if (isNaN(pingDate.getTime())) {
      throw new AppError('Invalid telematics ping timestamp format.', 400);
    }

    const now = Date.now();
    const pingTime = pingDate.getTime();
    const oneHourMs = 60 * 60 * 1000;
    const fiveMinutesMs = 5 * 60 * 1000;

    // Reject pings older than 1 hour (replay defense)
    if (now - pingTime > oneHourMs) {
      throw new AppError('Telematics ping timestamp is older than allowed window (1 hour). Replay rejected.', 400);
    }
    // Reject future pings with clock skew > 5 minutes
    if (pingTime - now > fiveMinutesMs) {
      throw new AppError('Telematics ping timestamp is in the future. Clock skew detected.', 400);
    }

    // 5. Tenant and Vehicle Mapping
    const vehicleQuery = {
      'telematics.deviceId': cleanDeviceId,
      isActive: true
    };
    if (companyHint) {
      vehicleQuery.companyId = companyHint;
    }

    const vehicle = await Vehicle.findOne(vehicleQuery);
    if (!vehicle) {
      throw new AppError(`Unregistered or inactive telematics device: ${cleanDeviceId}`, 404);
    }

    // 6. Out-of-Order Ping Defense
    if (vehicle.telematics?.lastPing?.recordedAt) {
      const existingTime = new Date(vehicle.telematics.lastPing.recordedAt).getTime();
      if (pingTime <= existingTime) {
        throw new AppError(
          `Telematics ping timestamp (${pingDate.toISOString()}) is older than or equal to current recorded location (${new Date(existingTime).toISOString()}). Out-of-order ping rejected.`,
          409
        );
      }
    }

    // 7. Update Telematics State on Vehicle
    vehicle.telematics.lastPing = {
      latitude: lat,
      longitude: lng,
      speedKmph: Math.min(200, Math.max(0, Number(speedKmph) || 0)),
      headingDegrees: (Number(headingDegrees) || 0) % 360,
      altitudeMeters: Number(altitudeMeters) || 0,
      accuracyMeters: Math.max(1, Number(accuracyMeters) || 5),
      ignition: Boolean(ignition),
      batteryPercent: Math.min(100, Math.max(0, Number(batteryPercent) || 100)),
      recordedAt: pingDate,
      receivedAt: new Date(),
      rawPayload: typeof payload === 'object' ? payload : null
    };
    vehicle.telematics.lastGpsTimestamp = pingDate;
    vehicle.telematics.isActive = true;

    await vehicle.save();

    // 8. Emit Real-time Event to Tenant Event Bus
    eventBus.publish(vehicle.companyId, 'TELEMATICS_PING', {
      vehicleId: vehicle._id,
      plateNumber: vehicle.plateNumber,
      deviceId: cleanDeviceId,
      coordinates: { lat, lng },
      speedKmph: vehicle.telematics.lastPing.speedKmph,
      headingDegrees: vehicle.telematics.lastPing.headingDegrees,
      ignition: vehicle.telematics.lastPing.ignition,
      recordedAt: pingDate.toISOString()
    });

    return {
      success: true,
      deviceId: cleanDeviceId,
      vehicleId: vehicle._id,
      plateNumber: vehicle.plateNumber,
      coordinates: { lat, lng },
      recordedAt: pingDate.toISOString(),
      speedKmph: vehicle.telematics.lastPing.speedKmph
    };
  }

  /**
   * Resolves vehicle location distinguishing real GPS telematics from geocoded hub fallback
   * @param {string|ObjectId} vehicleId
   * @param {string|ObjectId} companyId
   * @returns {Promise<Object>}
   */
  static async getVehicleLocation(vehicleId, companyId) {
    const vehicle = await Vehicle.findOne({
      _id: vehicleId,
      companyId,
      isActive: true
    }).populate('currentTripId');

    if (!vehicle) {
      throw new AppError('Vehicle record not found.', 404);
    }

    // 1. Live Telematics GPS Data Present
    if (
      vehicle.telematics?.lastPing?.latitude !== null &&
      vehicle.telematics?.lastPing?.latitude !== undefined &&
      vehicle.telematics?.lastPing?.recordedAt
    ) {
      const pingAgeMs = Date.now() - new Date(vehicle.telematics.lastPing.recordedAt).getTime();
      const isStale = pingAgeMs > 15 * 60 * 1000; // > 15 minutes old

      return {
        vehicleId: vehicle._id,
        plateNumber: vehicle.plateNumber,
        locationSource: 'TELEMATICS_GPS',
        isLiveGps: true,
        isStale,
        coordinates: {
          lat: vehicle.telematics.lastPing.latitude,
          lng: vehicle.telematics.lastPing.longitude
        },
        speedKmph: vehicle.telematics.lastPing.speedKmph || 0,
        headingDegrees: vehicle.telematics.lastPing.headingDegrees || 0,
        ignition: vehicle.telematics.lastPing.ignition ?? false,
        accuracyMeters: vehicle.telematics.lastPing.accuracyMeters || 5,
        lastSeenAt: vehicle.telematics.lastPing.recordedAt,
        provider: vehicle.telematics.provider || 'AIS140'
      };
    }

    // 2. Active Trip Geocoded Hub Fallback
    if (vehicle.currentTripId) {
      const trip = await Trip.findOne({
        _id: vehicle.currentTripId,
        companyId,
        isActive: true
      }).populate('stops.locationId');

      if (trip && trip.stops && trip.stops.length > 0) {
        // Find current or latest stop
        const currentStop = trip.stops.find(s => s.status !== 'COMPLETED') || trip.stops[trip.stops.length - 1];
        const coords = resolveCoordinates(currentStop?.locationId);

        return {
          vehicleId: vehicle._id,
          plateNumber: vehicle.plateNumber,
          locationSource: 'GEOCODED_HUB',
          isLiveGps: false,
          isStale: false,
          coordinates: {
            lat: coords.lat,
            lng: coords.lng
          },
          lastSeenAt: null,
          disclaimer: 'Live GPS telematics hardware is not configured for this vehicle. Showing estimated waypoint hub position.'
        };
      }
    }

    // 3. Location Unavailable
    return {
      vehicleId: vehicle._id,
      plateNumber: vehicle.plateNumber,
      locationSource: 'UNAVAILABLE',
      isLiveGps: false,
      isStale: true,
      coordinates: null,
      lastSeenAt: null,
      disclaimer: 'No GPS telemetry hardware or active trip geocoded waypoint available.'
    };
  }
}

module.exports = GpsService;
