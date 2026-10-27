/**
 * Trip Controller
 * Manages Trip Dispatch, Waypoint Progress, Delivery Reconciliation,
 * Route Expenses (in integer Paise), Trip Closure, and PDF Streaming.
 */

const Trip = require('../models/Trip');
const Load = require('../../loads/models/Load');
const Vehicle = require('../../vehicles/models/Vehicle');
const Driver = require('../../drivers/models/Driver');
const ProofOfDelivery = require('../../pod/models/ProofOfDelivery');
const Location = require('../../locations/models/Location');
const tripStatusService = require('../services/tripStatus.service');
const sequenceService = require('../../sequences/services/sequence.service');
const auditLogService = require('../../audit/services/auditLog.service');
const pdfService = require('../../../services/pdf.service');
const eventBus = require('../../../services/eventBus.service');
const {
  AuditAction,
  SystemModule,
  TripStatus,
  StopStatus,
  StopType,
  VehicleStatus,
  DriverStatus,
  LoadStatus
} = require('../../../shared');
const { AppError } = require('../../../middleware/errorHandler');

class TripController {
  /**
   * 1. List Trips with Filtering, Search, and Pagination
   */
  async list(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const {
        page = 1,
        limit = 20,
        search = '',
        status = '',
        vehicleId = '',
        driverId = '',
        loadId = ''
      } = req.query;

      const filter = { companyId, isActive: true };

      if (status) filter.status = status;
      if (vehicleId) filter.vehicleId = vehicleId;
      if (driverId) filter.driverId = driverId;
      if (loadId) filter.loadId = loadId;

      if (search) {
        const regex = new RegExp(search.trim(), 'i');
        filter.$or = [
          { tripNumber: regex },
          { remarks: regex }
        ];
      }

      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
      const skip = (pageNum - 1) * limitNum;

      const [trips, total] = await Promise.all([
        Trip.find(filter)
          .populate('loadId', 'loadNumber totalWeightMt totalQuantity originLocationId destinationLocationId status')
          .populate('vehicleId', 'plateNumber vehicleType capacityTonnage status')
          .populate('driverId', 'name phone licenseNumber status')
          .populate('stops.locationId', 'name city state locationType')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum),
        Trip.countDocuments(filter)
      ]);

      res.status(200).json({
        success: true,
        statusCode: 200,
        data: {
          items: trips,
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

  /**
   * 2. Get Trip by ID
   */
  async getById(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const { id } = req.params;

      const trip = await Trip.findOne({ _id: id, companyId, isActive: true })
        .populate('loadId')
        .populate('vehicleId')
        .populate('driverId')
        .populate('stops.locationId')
        .populate('statusHistory.changedBy', 'name email');

      if (!trip) {
        throw new AppError('Trip record not found', 404);
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        data: trip
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 3. Create & Dispatch Trip
   * Validates Load, Vehicle compliance/conflicts, and Driver license/conflicts.
   */
  async create(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const userId = req.user.id;
      const {
        loadId,
        vehicleId,
        driverId,
        startDateTime,
        expectedDeliveryDateTime,
        driverAdvancePaise = 0,
        remarks = '',
        stops: customStops
      } = req.body;

      if (!loadId || !vehicleId || !driverId) {
        throw new AppError('loadId, vehicleId, and driverId are required.', 400);
      }

      // 1. Date Constraints
      const startDate = startDateTime ? new Date(startDateTime) : new Date();
      if (isNaN(startDate.getTime())) {
        throw new AppError('Invalid startDateTime provided.', 400);
      }
      let expectedDelivery = null;
      if (expectedDeliveryDateTime) {
        expectedDelivery = new Date(expectedDeliveryDateTime);
        if (isNaN(expectedDelivery.getTime())) {
          throw new AppError('Invalid expectedDeliveryDateTime provided.', 400);
        }
        if (expectedDelivery < startDate) {
          throw new AppError('Expected delivery date cannot be earlier than trip start date.', 400);
        }
      }

      const advancePaise = Math.max(0, parseInt(driverAdvancePaise, 10) || 0);

      // A. Verify Load Existence & State
      const load = await Load.findOne({ _id: loadId, companyId, isActive: true });
      if (!load) {
        throw new AppError('Specified load does not exist.', 404);
      }
      if (
        load.status === LoadStatus.CLOSED ||
        load.status === LoadStatus.CANCELLED ||
        load.status === LoadStatus.IN_TRANSIT ||
        load.status === LoadStatus.PARTIALLY_DELIVERED ||
        load.status === LoadStatus.DELIVERED
      ) {
        throw new AppError(`Cannot create trip for Load in ${load.status} status.`, 400);
      }

      // B. Verify Vehicle Compliance & Active Conflicts
      const vehicle = await Vehicle.findOne({ _id: vehicleId, companyId, isActive: true });
      if (!vehicle) {
        throw new AppError('Specified vehicle does not exist.', 404);
      }
      if (
        vehicle.status === VehicleStatus.UNDER_MAINTENANCE ||
        vehicle.status === VehicleStatus.OUT_OF_SERVICE ||
        vehicle.status === VehicleStatus.INACTIVE
      ) {
        throw new AppError(
          `Vehicle ${vehicle.plateNumber} is currently ${vehicle.status} and cannot be assigned to trips.`,
          400
        );
      }

      // Active conflict check: Vehicle must not be on an active trip
      const activeVehicleTrip = await Trip.findOne({
        companyId,
        vehicleId,
        status: {
          $in: [
            TripStatus.CREATED,
            TripStatus.VEHICLE_ASSIGNED,
            TripStatus.LOADING,
            TripStatus.IN_TRANSIT,
            TripStatus.PARTIALLY_DELIVERED
          ]
        },
        isActive: true
      });
      if (activeVehicleTrip) {
        throw new AppError(
          `Vehicle ${vehicle.plateNumber} is already assigned to active Trip ${activeVehicleTrip.tripNumber}.`,
          400
        );
      }

      // C. Verify Driver Compliance & Active Conflicts
      const driver = await Driver.findOne({ _id: driverId, companyId, isActive: true });
      if (!driver) {
        throw new AppError('Specified driver does not exist.', 404);
      }
      if (driver.status === DriverStatus.ON_LEAVE || driver.status === DriverStatus.INACTIVE) {
        throw new AppError(
          `Driver ${driver.name} is currently ${driver.status} and cannot be assigned.`,
          400
        );
      }

      // Licence expiry check
      if (driver.licenseExpiryDate && new Date(driver.licenseExpiryDate) < new Date()) {
        throw new AppError(
          `Driver ${driver.name}'s driving licence expired on ${new Date(driver.licenseExpiryDate).toLocaleDateString('en-IN')}. Cannot dispatch.`,
          400
        );
      }

      // Active conflict check: Driver must not be on an active trip
      const activeDriverTrip = await Trip.findOne({
        companyId,
        driverId,
        status: {
          $in: [
            TripStatus.CREATED,
            TripStatus.VEHICLE_ASSIGNED,
            TripStatus.LOADING,
            TripStatus.IN_TRANSIT,
            TripStatus.PARTIALLY_DELIVERED
          ]
        },
        isActive: true
      });
      if (activeDriverTrip) {
        throw new AppError(
          `Driver ${driver.name} is already assigned to active Trip ${activeDriverTrip.tripNumber}.`,
          400
        );
      }

      // Active conflict check: Load must not already be tied to an active trip
      const activeLoadTrip = await Trip.findOne({
        companyId,
        loadId,
        status: {
          $in: [
            TripStatus.CREATED,
            TripStatus.VEHICLE_ASSIGNED,
            TripStatus.LOADING,
            TripStatus.IN_TRANSIT,
            TripStatus.PARTIALLY_DELIVERED
          ]
        },
        isActive: true
      });
      if (activeLoadTrip) {
        throw new AppError(`Load ${load.loadNumber} is already assigned to active Trip ${activeLoadTrip.tripNumber}.`, 400);
      }

      // D. Build Trip Stops and validate cross-tenant locations
      let tripStops = [];
      if (Array.isArray(customStops) && customStops.length > 0) {
        const stopLocationIds = Array.from(new Set(customStops.map(s => s.locationId?.toString()).filter(Boolean)));
        if (stopLocationIds.length > 0) {
          const validLocationsCount = await Location.countDocuments({
            _id: { $in: stopLocationIds },
            companyId,
            isActive: true
          });
          if (validLocationsCount !== stopLocationIds.length) {
            throw new AppError('One or more referenced stop locations are invalid or belong to another organization.', 403);
          }
        }
        tripStops = customStops.map((s, idx) => ({
          sequence: s.sequence || idx + 1,
          stopType: s.stopType || StopType.PICKUP,
          locationId: s.locationId,
          loadStopId: s.loadStopId || null,
          allocatedQuantity: Math.max(0, parseInt(s.allocatedQuantity, 10) || 0),
          allocatedWeightMt: Math.max(0, parseFloat(s.allocatedWeightMt) || 0),
          deliveredQuantity: 0,
          pendingQuantity: Math.max(0, parseInt(s.allocatedQuantity, 10) || 0),
          status: StopStatus.PENDING,
          receiverName: s.receiverName || '',
          receiverPhone: s.receiverPhone || '',
          remarks: s.remarks || ''
        }));
      } else if (load.stops && load.stops.length > 0) {
        tripStops = load.stops.map(ls => ({
          sequence: ls.sequence,
          stopType: ls.stopType,
          locationId: ls.locationId,
          loadStopId: ls._id,
          allocatedQuantity: ls.allocatedQuantity || 0,
          allocatedWeightMt: ls.allocatedWeightMt || 0,
          deliveredQuantity: 0,
          pendingQuantity: ls.allocatedQuantity || 0,
          status: StopStatus.PENDING
        }));
      }

      // E. Concurrency-Safe Atomic Reservations with Compensation Rollback
      // 1. Atomic Vehicle Reservation
      const reservedVehicle = await Vehicle.findOneAndUpdate(
        {
          _id: vehicleId,
          companyId,
          isActive: true,
          status: { $nin: [VehicleStatus.ON_TRIP, VehicleStatus.UNDER_MAINTENANCE, VehicleStatus.OUT_OF_SERVICE, VehicleStatus.INACTIVE] }
        },
        { $set: { status: VehicleStatus.ON_TRIP } },
        { new: true }
      );
      if (!reservedVehicle) {
        const v = await Vehicle.findOne({ _id: vehicleId, companyId, isActive: true });
        if (!v) throw new AppError('Specified vehicle does not exist.', 404);
        throw new AppError(`Vehicle ${v.plateNumber} is currently ${v.status} and cannot be assigned to trips.`, 400);
      }

      // 2. Atomic Driver Reservation
      const reservedDriver = await Driver.findOneAndUpdate(
        {
          _id: driverId,
          companyId,
          isActive: true,
          status: { $nin: [DriverStatus.ON_TRIP, DriverStatus.ON_LEAVE, DriverStatus.INACTIVE] }
        },
        { $set: { status: DriverStatus.ON_TRIP } },
        { new: true }
      );
      if (!reservedDriver) {
        // Rollback Vehicle
        await Vehicle.findByIdAndUpdate(vehicleId, { status: vehicle.status || VehicleStatus.AVAILABLE });
        const d = await Driver.findOne({ _id: driverId, companyId, isActive: true });
        if (!d) throw new AppError('Specified driver does not exist.', 404);
        throw new AppError(`Driver ${d.name} is currently ${d.status} and cannot be assigned.`, 400);
      }

      // 3. Atomic Load Reservation
      const reservedLoad = await Load.findOneAndUpdate(
        {
          _id: loadId,
          companyId,
          isActive: true,
          status: { $in: [LoadStatus.CREATED, LoadStatus.ASSIGNED] }
        },
        { $set: { status: LoadStatus.ASSIGNED, assignedVehicleId: vehicleId, assignedDriverId: driverId } },
        { new: true }
      );
      if (!reservedLoad) {
        // Rollback Vehicle & Driver
        await Promise.allSettled([
          Vehicle.findByIdAndUpdate(vehicleId, { status: vehicle.status || VehicleStatus.AVAILABLE }),
          Driver.findByIdAndUpdate(driverId, { status: driver.status || DriverStatus.AVAILABLE })
        ]);
        const l = await Load.findOne({ _id: loadId, companyId, isActive: true });
        if (!l) throw new AppError('Specified load does not exist.', 404);
        throw new AppError(`Cannot create trip for Load in ${l.status} status.`, 400);
      }

      // F. Allocate Atomic Sequence & Persist Trip
      const tripNumber = await sequenceService.getNextSequence(companyId, 'TRIP', 'TR');
      const grossFreightPaise = load.financials?.totalFreightPaise || 0;

      const trip = new Trip({
        companyId,
        tripNumber,
        loadId,
        vehicleId,
        driverId,
        startDateTime: startDate,
        expectedDeliveryDateTime: expectedDelivery,
        status: TripStatus.VEHICLE_ASSIGNED,
        stops: tripStops,
        financials: {
          grossFreightPaise,
          driverAdvancePaise: advancePaise,
          totalExpensesPaise: 0,
          netSettlementPaise: grossFreightPaise - advancePaise
        },
        statusHistory: [
          {
            status: TripStatus.CREATED,
            changedBy: userId,
            reason: 'Trip created in system',
            timestamp: new Date()
          },
          {
            status: TripStatus.VEHICLE_ASSIGNED,
            changedBy: userId,
            reason: `Dispatched with Vehicle ${vehicle.plateNumber} and Driver ${driver.name}`,
            timestamp: new Date()
          }
        ],
        remarks
      });

      try {
        await trip.save();
        await Promise.all([
          Vehicle.findByIdAndUpdate(vehicleId, { currentTripId: trip._id }),
          Driver.findByIdAndUpdate(driverId, { currentTripId: trip._id }),
          Load.findByIdAndUpdate(loadId, { currentTripId: trip._id })
        ]);
      } catch (saveErr) {
        // Rollback all reservations on persistence error
        await Promise.allSettled([
          Vehicle.findByIdAndUpdate(vehicleId, { status: vehicle.status || VehicleStatus.AVAILABLE, currentTripId: null }),
          Driver.findByIdAndUpdate(driverId, { status: driver.status || DriverStatus.AVAILABLE, currentTripId: null }),
          Load.findByIdAndUpdate(loadId, {
            status: load.status || LoadStatus.CREATED,
            assignedVehicleId: load.assignedVehicleId,
            assignedDriverId: load.assignedDriverId,
            currentTripId: null
          })
        ]);
        throw saveErr;
      }

      // G. Operational Audit Log
      await auditLogService.logAction({
        companyId,
        userId,
        module: SystemModule.TRIPS,
        action: AuditAction.CREATE,
        entityId: trip._id,
        entityType: 'Trip',
        details: {
          tripNumber,
          vehiclePlate: vehicle.plateNumber,
          driverName: driver.name,
          grossFreightPaise,
          driverAdvancePaise: advancePaise
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Emit Real-Time Event upon Successful DB Dispatch
      eventBus.publish(companyId, 'TRIP_DISPATCHED', {
        tripId: trip._id,
        tripNumber,
        vehicleId,
        driverId,
        status: trip.status
      });

      res.status(201).json({
        success: true,
        statusCode: 201,
        message: `Trip ${tripNumber} successfully dispatched.`,
        data: trip
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 4. Update Trip Status (State Machine Enforced)
   */
  async updateStatus(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const userId = req.user.id;
      const { id } = req.params;
      const { status: targetStatus, reason = '' } = req.body;

      if (!targetStatus) {
        throw new AppError('Target status is required.', 400);
      }

      const trip = await Trip.findOne({ _id: id, companyId, isActive: true });
      if (!trip) {
        throw new AppError('Trip record not found', 404);
      }

      // Validate Transition
      tripStatusService.validateTransition(trip.status, targetStatus);

      if (targetStatus === TripStatus.CLOSED) {
        const deliveryStops = trip.stops.filter(s => s.stopType === StopType.DELIVERY);
        const incompleteStops = deliveryStops.filter(s => s.status !== StopStatus.COMPLETED);
        if (incompleteStops.length > 0) {
          throw new AppError(
            `Cannot close Trip: ${incompleteStops.length} delivery stop(s) are not yet COMPLETED.`,
            400
          );
        }
        const podCount = await ProofOfDelivery.countDocuments({
          companyId,
          tripId: trip._id,
          isActive: true
        });
        if (podCount === 0) {
          throw new AppError(
            'Cannot close Trip: At least one Proof of Delivery (POD) document must be uploaded and attached before final closure.',
            400
          );
        }
      }

      const oldStatus = trip.status;
      trip.status = targetStatus;
      trip.statusHistory.push({
        status: targetStatus,
        changedBy: userId,
        reason,
        timestamp: new Date()
      });

      // Synchronize vehicle, driver, and load states
      if (targetStatus === TripStatus.CANCELLED) {
        await Promise.all([
          Vehicle.findByIdAndUpdate(trip.vehicleId, { status: VehicleStatus.AVAILABLE, currentTripId: null }),
          Driver.findByIdAndUpdate(trip.driverId, { status: DriverStatus.AVAILABLE, currentTripId: null }),
          Load.findByIdAndUpdate(trip.loadId, { status: LoadStatus.CREATED, currentTripId: null })
        ]);
      } else if (targetStatus === TripStatus.IN_TRANSIT) {
        await Load.findByIdAndUpdate(trip.loadId, { status: LoadStatus.IN_TRANSIT });
      } else if (targetStatus === TripStatus.DELIVERED) {
        await Load.findByIdAndUpdate(trip.loadId, { status: LoadStatus.DELIVERED });
      } else if (targetStatus === TripStatus.CLOSED) {
        trip.actualEndDateTime = new Date();
        await Promise.all([
          Vehicle.findByIdAndUpdate(trip.vehicleId, { status: VehicleStatus.AVAILABLE, currentTripId: null }),
          Driver.findByIdAndUpdate(trip.driverId, { status: DriverStatus.AVAILABLE, currentTripId: null }),
          Load.findByIdAndUpdate(trip.loadId, { status: LoadStatus.CLOSED })
        ]);
      }

      await trip.save();

      // Audit Log
      await auditLogService.logAction({
        companyId,
        userId,
        module: SystemModule.TRIPS,
        action: AuditAction.STATUS_CHANGE,
        entityId: trip._id,
        entityType: 'Trip',
        details: { oldStatus, newStatus: targetStatus, reason },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Emit Real-Time Event upon Successful Status Mutation
      const eventName = targetStatus === TripStatus.CLOSED
        ? 'TRIP_CLOSED'
        : (targetStatus === TripStatus.DELIVERED ? 'TRIP_DELIVERED' : 'TRIP_STATUS_UPDATED');

      eventBus.publish(companyId, eventName, {
        tripId: trip._id,
        tripNumber: trip.tripNumber,
        oldStatus,
        newStatus: targetStatus,
        reason
      });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: `Trip status updated from '${oldStatus}' to '${targetStatus}'.`,
        data: trip
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 5. Record Stop Delivery with Strict Over-Delivery Prevention
   */
  async recordStopDelivery(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const userId = req.user.id;
      const { id, stopId } = req.params;
      const {
        deliveredQuantity,
        receiverName = '',
        receiverPhone = '',
        remarks = ''
      } = req.body;

      const qty = parseInt(deliveredQuantity, 10);
      if (isNaN(qty) || qty <= 0) {
        throw new AppError('Delivered quantity must be a positive integer.', 400);
      }

      const trip = await Trip.findOne({ _id: id, companyId, isActive: true });
      if (!trip) {
        throw new AppError('Trip record not found', 404);
      }

      const stop = trip.stops.id(stopId);
      if (!stop) {
        throw new AppError('Specified stop not found in trip itinerary.', 404);
      }

      if (stop.status === StopStatus.COMPLETED && stop.pendingQuantity === 0) {
        throw new AppError(`Stop sequence ${stop.sequence} is already fully completed. No pending quantity to deliver.`, 400);
      }

      // Strict over-delivery prevention rule:
      if (qty > stop.pendingQuantity) {
        throw new AppError(
          `Delivered quantity (${qty}) exceeds pending quantity (${stop.pendingQuantity}). Over-delivery is not permitted.`,
          400
        );
      }

      stop.deliveredQuantity = (stop.deliveredQuantity || 0) + qty;
      stop.pendingQuantity = Math.max(0, (stop.pendingQuantity || 0) - qty);
      if (receiverName) stop.receiverName = receiverName;
      if (receiverPhone) stop.receiverPhone = receiverPhone;
      if (remarks) stop.remarks = remarks;

      if (stop.pendingQuantity === 0) {
        stop.status = StopStatus.COMPLETED;
        stop.completedAt = new Date();
      } else {
        stop.status = StopStatus.UNLOADING;
      }

      // Check delivery progress of all DELIVERY stops
      const deliveryStops = trip.stops.filter(s => s.stopType === StopType.DELIVERY);
      const allCompleted = deliveryStops.length > 0 && deliveryStops.every(s => s.status === StopStatus.COMPLETED);
      const anyDelivered = deliveryStops.some(s => s.deliveredQuantity > 0);

      if (allCompleted) {
        trip.status = TripStatus.DELIVERED;
        trip.statusHistory.push({
          status: TripStatus.DELIVERED,
          changedBy: userId,
          reason: 'All delivery stops completed.',
          timestamp: new Date()
        });
        await Load.findByIdAndUpdate(trip.loadId, { status: LoadStatus.DELIVERED });
      } else if (anyDelivered && trip.status === TripStatus.IN_TRANSIT) {
        trip.status = TripStatus.PARTIALLY_DELIVERED;
        trip.statusHistory.push({
          status: TripStatus.PARTIALLY_DELIVERED,
          changedBy: userId,
          reason: `Partial delivery recorded at stop sequence ${stop.sequence}.`,
          timestamp: new Date()
        });
        await Load.findByIdAndUpdate(trip.loadId, { status: LoadStatus.PARTIALLY_DELIVERED });
      }

      await trip.save();

      // Audit Log
      await auditLogService.logAction({
        companyId,
        userId,
        module: SystemModule.TRIPS,
        action: AuditAction.UPDATE,
        entityId: trip._id,
        entityType: 'Trip',
        details: {
          stopId,
          sequence: stop.sequence,
          deliveredQuantity: qty,
          pendingQuantity: stop.pendingQuantity,
          status: stop.status
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Emit Real-Time Event upon Successful Stop Delivery
      eventBus.publish(companyId, 'STOP_DELIVERED', {
        tripId: trip._id,
        tripNumber: trip.tripNumber,
        stopId,
        sequence: stop.sequence,
        deliveredQuantity: qty,
        pendingQuantity: stop.pendingQuantity,
        stopStatus: stop.status,
        tripStatus: trip.status
      });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: `Delivery of ${qty} items successfully recorded for stop ${stop.sequence}.`,
        data: trip
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 6. Add Line-Item Route Expense (in integer Paise)
   */
  async addExpense(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const userId = req.user.id;
      const { id } = req.params;
      const {
        expenseType,
        amountPaise,
        description = '',
        paidBy = 'DRIVER',
        receiptFileKey = null
      } = req.body;

      const amount = parseInt(amountPaise, 10);
      if (isNaN(amount) || amount <= 0) {
        throw new AppError('Expense amount in Paise must be a positive integer.', 400);
      }

      if (!expenseType) {
        throw new AppError('expenseType is required.', 400);
      }

      const trip = await Trip.findOne({ _id: id, companyId, isActive: true });
      if (!trip) {
        throw new AppError('Trip record not found', 404);
      }

      if (trip.status === TripStatus.CLOSED || trip.status === TripStatus.CANCELLED) {
        throw new AppError(`Cannot add expense to Trip in ${trip.status} status. Trip accounting is finalized.`, 400);
      }

      trip.expenses.push({
        expenseType,
        amountPaise: amount,
        description,
        paidBy,
        receiptFileKey,
        recordedAt: new Date()
      });

      // Saving automatically recalculates totalExpensesPaise & netSettlementPaise in pre-save hook
      await trip.save();

      // Audit Log
      await auditLogService.logAction({
        companyId,
        userId,
        module: SystemModule.TRIPS,
        action: AuditAction.UPDATE,
        entityId: trip._id,
        entityType: 'Trip',
        details: {
          expenseType,
          amountPaise: amount,
          description,
          paidBy
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.status(201).json({
        success: true,
        statusCode: 201,
        message: 'Route expense successfully recorded.',
        data: trip
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 7. Close Trip (Requires all delivery stops completed and Proof of Delivery attached)
   */
  async closeTrip(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const userId = req.user.id;
      const { id } = req.params;

      const trip = await Trip.findOne({ _id: id, companyId, isActive: true });
      if (!trip) {
        throw new AppError('Trip record not found', 404);
      }

      // Idempotent: If already closed, return existing closed trip
      if (trip.status === TripStatus.CLOSED) {
        return res.status(200).json({
          success: true,
          statusCode: 200,
          message: `Trip ${trip.tripNumber} is already closed.`,
          data: trip
        });
      }

      // Check delivery stops completion
      const deliveryStops = trip.stops.filter(s => s.stopType === StopType.DELIVERY);
      const incompleteStops = deliveryStops.filter(s => s.status !== StopStatus.COMPLETED);
      if (incompleteStops.length > 0) {
        throw new AppError(
          `Cannot close Trip: ${incompleteStops.length} delivery stop(s) are not yet COMPLETED.`,
          400
        );
      }

      // Check Proof of Delivery presence
      const podCount = await ProofOfDelivery.countDocuments({
        companyId,
        tripId: trip._id,
        isActive: true
      });
      if (podCount === 0) {
        throw new AppError(
          'Cannot close Trip: At least one Proof of Delivery (POD) document must be uploaded and attached before final closure.',
          400
        );
      }

      trip.status = TripStatus.CLOSED;
      trip.actualEndDateTime = new Date();
      trip.statusHistory.push({
        status: TripStatus.CLOSED,
        changedBy: userId,
        reason: 'Trip successfully closed after delivery and POD verification.',
        timestamp: new Date()
      });

      await trip.save();

      // Release Vehicle and Driver back to AVAILABLE, and mark load as CLOSED
      await Promise.all([
        Vehicle.findByIdAndUpdate(trip.vehicleId, { status: VehicleStatus.AVAILABLE, currentTripId: null }),
        Driver.findByIdAndUpdate(trip.driverId, { status: DriverStatus.AVAILABLE, currentTripId: null }),
        Load.findByIdAndUpdate(trip.loadId, { status: LoadStatus.CLOSED })
      ]);

      // Audit Log
      await auditLogService.logAction({
        companyId,
        userId,
        module: SystemModule.TRIPS,
        action: AuditAction.STATUS_CHANGE,
        entityId: trip._id,
        entityType: 'Trip',
        details: {
          status: TripStatus.CLOSED,
          totalExpensesPaise: trip.financials.totalExpensesPaise,
          netSettlementPaise: trip.financials.netSettlementPaise
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: `Trip ${trip.tripNumber} successfully closed. Assets released to AVAILABLE.`,
        data: trip
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 8. Stream Trip Sheet PDF
   */
  async getTripSheetPdf(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const { id } = req.params;

      const trip = await Trip.findOne({ _id: id, companyId, isActive: true })
        .populate('loadId')
        .populate('vehicleId')
        .populate('driverId')
        .populate('stops.locationId');

      if (!trip) {
        throw new AppError('Trip record not found', 404);
      }

      const copy = req.query.copy || 'ORIGINAL';
      const pdfBuffer = await pdfService.generateTripSheetPdf(trip, req.tenant.company || {}, { copy });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="TripSheet-${trip.tripNumber}-${copy}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.status(200).send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  }

  /**
   * 9. Stream Settlement Statement PDF
   */
  async getSettlementPdf(req, res, next) {
    try {
      const companyId = req.tenant.companyId;
      const { id } = req.params;

      const trip = await Trip.findOne({ _id: id, companyId, isActive: true })
        .populate('loadId')
        .populate('vehicleId')
        .populate('driverId')
        .populate('stops.locationId');

      if (!trip) {
        throw new AppError('Trip record not found', 404);
      }

      const copy = req.query.copy || 'ORIGINAL';
      const pdfBuffer = await pdfService.generateSettlementPdf(trip, req.tenant.company || {}, { copy });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Settlement-${trip.tripNumber}-${copy}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.status(200).send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new TripController();
