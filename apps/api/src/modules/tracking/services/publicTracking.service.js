/**
 * Public Consignment Tracking Service
 * Provides unauthenticated, rate-limited, privacy-redacted tracking data for consignors and consignees.
 */

const mongoose = require('mongoose');
const Load = require('../../loads/models/Load');
const LrNumber = require('../../lr/models/LrNumber');
const Bilty = require('../../bilties/models/Bilty');
const Trip = require('../../trips/models/Trip');
const Vehicle = require('../../vehicles/models/Vehicle');
const Location = require('../../locations/models/Location');
const ProofOfDelivery = require('../../pod/models/ProofOfDelivery');
const { resolveCoordinates } = require('./geoCoordinates');
const { AppError } = require('../../../middleware/errorHandler');

class PublicTrackingService {
  /**
   * Track a consignment by LR number, Bilty number, or Load number
   * @param {string} rawIdentifier Query identifier (e.g. LR-2026-0001, BL-2026-0001, LD-2026-0001)
   */
  async trackConsignment(rawIdentifier) {
    if (!rawIdentifier || typeof rawIdentifier !== 'string' || !rawIdentifier.trim()) {
      throw new AppError('Tracking identifier (LR, Bilty, or Load number) is required.', 400);
    }

    const identifier = rawIdentifier.trim().toUpperCase();

    // 1. Try finding LR Number
    let lr = await LrNumber.findOne({ lrNumber: identifier, isActive: true })
      .populate('loadId')
      .populate('consignorId', 'name companyName')
      .populate('consigneeId', 'name companyName')
      .populate('fromLocationId')
      .populate('toLocationId');

    let loadId = lr?.loadId?._id || lr?.loadId;
    let bilty = null;

    // 2. If not LR, try finding Bilty
    if (!lr) {
      bilty = await Bilty.findOne({ biltyNumber: identifier, isActive: true })
        .populate('loadId')
        .populate('consignorId', 'name companyName')
        .populate('consigneeId', 'name companyName')
        .populate('fromLocationId')
        .populate('toLocationId');

      if (bilty) {
        loadId = bilty.loadId?._id || bilty.loadId;
      }
    }

    // 3. If neither, try finding Load directly
    let load = null;
    if (loadId) {
      load = await Load.findById(loadId)
        .populate('customerId', 'name companyName')
        .populate('consignorId', 'name companyName')
        .populate('consigneeId', 'name companyName')
        .populate('assignedVehicleId', 'plateNumber vehicleType make model')
        .populate('assignedDriverId', 'name')
        .populate('stops.locationId');
    } else {
      load = await Load.findOne({ loadNumber: identifier, isActive: true })
        .populate('customerId', 'name companyName')
        .populate('consignorId', 'name companyName')
        .populate('consigneeId', 'name companyName')
        .populate('assignedVehicleId', 'plateNumber vehicleType make model')
        .populate('assignedDriverId', 'name')
        .populate('stops.locationId');
    }

    if (!load) {
      throw new AppError(`No consignment found matching tracking number '${identifier}'.`, 404);
    }

    // If we started with Load, find associated LR and Bilty if available
    if (!lr) {
      lr = await LrNumber.findOne({ loadId: load._id, isActive: true });
    }
    if (!bilty) {
      bilty = await Bilty.findOne({ loadId: load._id, isActive: true });
    }

    // 4. Find Associated Active Trip
    const trip = await Trip.findOne({ loadId: load._id, isActive: true })
      .populate('vehicleId', 'plateNumber vehicleType')
      .populate('driverId', 'fullName')
      .populate('stops.locationId');

    // 5. Find Verified Proof of Delivery (if any)
    const pod = await ProofOfDelivery.findOne({
      loadId: load._id,
      status: 'VERIFIED',
      isActive: true
    }).select('podNumber deliveryTimestamp receiverName status');

    // 6. Build Waypoints with Geolocation Coordinates
    const waypoints = (load.stops || []).map((stop, idx) => {
      const loc = stop.locationId || {};
      const coords = resolveCoordinates(loc);

      return {
        sequence: stop.sequence || idx + 1,
        stopType: stop.stopType || 'WAYPOINT',
        locationName: loc.name || `Waypoint ${idx + 1}`,
        city: loc.address?.city || '',
        state: loc.address?.state || '',
        status: stop.status || 'PENDING',
        allocatedQuantity: stop.allocatedQuantity || 0,
        deliveredQuantity: stop.deliveredQuantity || 0,
        scheduledDate: stop.scheduledDate || null,
        completedAt: stop.completedAt || null,
        coordinates: coords
      };
    });

    // 7. Calculate Milestones Timeline
    const isBooked = true;
    const vehicleObj = load.assignedVehicleId || trip?.vehicleId || null;
    const isVehicleAssigned = !!vehicleObj;
    const isDispatched = trip ? ['IN_TRANSIT', 'DELIVERED', 'CLOSED'].includes(trip.status) : false;
    const hasAnyDelivery = waypoints.some(w => w.stopType === 'DELIVERY' && w.status === 'COMPLETED');
    const isFullyDelivered = ['DELIVERED', 'CLOSED'].includes(load.status) || (trip && ['DELIVERED', 'CLOSED'].includes(trip.status));

    const milestones = [
      {
        code: 'BOOKED',
        title: 'Consignment Booked',
        description: 'Order registered in the transport network',
        status: isBooked ? 'COMPLETED' : 'PENDING',
        timestamp: load.createdAt
      },
      {
        code: 'VEHICLE_ASSIGNED',
        title: 'Vehicle Assigned',
        description: isVehicleAssigned ? 'Dedicated transport asset allocated' : 'Awaiting fleet assignment',
        status: isVehicleAssigned ? 'COMPLETED' : 'PENDING',
        timestamp: trip?.assignedAt || load.updatedAt
      },
      {
        code: 'IN_TRANSIT',
        title: 'Dispatched & In Transit',
        description: isDispatched ? 'Consignment rolling on Indian freight corridor' : 'Loading and dispatch pending at origin hub',
        status: isDispatched ? (isFullyDelivered ? 'COMPLETED' : 'IN_PROGRESS') : 'PENDING',
        timestamp: trip?.startedAt || (isDispatched ? trip?.updatedAt : null)
      },
      {
        code: 'OUT_FOR_DELIVERY',
        title: 'Arrival at Destination Hub',
        description: hasAnyDelivery ? 'Arrived at destination hub for offloading' : 'Approaching destination checkpoint',
        status: hasAnyDelivery ? (isFullyDelivered ? 'COMPLETED' : 'IN_PROGRESS') : 'PENDING',
        timestamp: null
      },
      {
        code: 'DELIVERED',
        title: 'Delivered & POD Verified',
        description: isFullyDelivered ? 'Consignment delivered and verified with receiver signature' : 'Awaiting delivery completion',
        status: isFullyDelivered ? 'COMPLETED' : 'PENDING',
        timestamp: pod?.deliveryTimestamp || (isFullyDelivered ? load.updatedAt : null)
      }
    ];

    // Determine current high-level status
    let currentStatus = 'BOOKED';
    if (isFullyDelivered) currentStatus = 'DELIVERED';
    else if (hasAnyDelivery) currentStatus = 'PARTIALLY_DELIVERED';
    else if (isDispatched) currentStatus = 'IN_TRANSIT';
    else if (isVehicleAssigned) currentStatus = 'VEHICLE_ASSIGNED';

    // 8. Mask PII for public consumption
    const rawPlate = vehicleObj?.plateNumber || '';
    const maskedPlate = rawPlate.length > 4
      ? `${rawPlate.slice(0, 4)}••••${rawPlate.slice(-2)}`
      : 'ASSIGNED';

    const consignorName = load.consignorId?.name || load.consignorId?.companyName || 'Registered Consignor';
    const consigneeName = load.consigneeId?.name || load.consigneeId?.companyName || 'Registered Consignee';

    return {
      trackingNumber: identifier,
      lrNumber: lr?.lrNumber || null,
      biltyNumber: bilty?.biltyNumber || null,
      loadNumber: load.loadNumber,
      tripNumber: trip?.tripNumber || null,
      currentStatus,
      statusLabel: currentStatus.replace(/_/g, ' '),
      materialType: load.materialType || 'Industrial Freight',
      totalQuantity: load.totalQuantity || 0,
      totalWeightMt: load.totalWeightMt || 0,
      parties: {
        consignor: consignorName,
        consignee: consigneeName
      },
      vehicle: {
        type: vehicleObj?.vehicleType || 'Transport Commercial Vehicle',
        maskedPlateNumber: maskedPlate
      },
      pickupDate: load.pickupDate || null,
      expectedDeliveryDate: load.expectedDeliveryDate || trip?.expectedDeliveryDate || null,
      milestones,
      waypoints,
      podVerified: !!pod,
      podNumber: pod?.podNumber || null,
      podReceiver: pod?.receiverName || null,
      lastUpdated: new Date().toISOString()
    };
  }
}

module.exports = new PublicTrackingService();
