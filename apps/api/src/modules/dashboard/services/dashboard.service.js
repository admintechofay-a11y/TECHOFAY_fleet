/**
 * Dashboard Service
 * Real-time MongoDB aggregation pipelines for Fleet & Transport operations.
 * Scoped strictly by tenant companyId.
 */

const mongoose = require('mongoose');
const Load = require('../../loads/models/Load');
const Trip = require('../../trips/models/Trip');
const Vehicle = require('../../vehicles/models/Vehicle');
const Driver = require('../../drivers/models/Driver');
const VehicleDocument = require('../../vehicles/models/VehicleDocument');
const DriverDocument = require('../../drivers/models/DriverDocument');
const ProofOfDelivery = require('../../pod/models/ProofOfDelivery');
const MessageLog = require('../../whatsapp/models/MessageLog');

class DashboardService {
  /**
   * Retrieves all KPI metrics via parallel MongoDB aggregations
   * @param {string|ObjectId} companyId
   * @returns {Promise<Object>}
   */
  static async getMetrics(companyId) {
    const tenantObjectId = new mongoose.Types.ObjectId(companyId);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      loadStats,
      todayLoadCount,
      tripStats,
      vehicleStats,
      driverStats,
      docExpiryStats,
      podStats,
      whatsappStats
    ] = await Promise.all([
      // 1. Loads aggregation: counts by status, sum of charges, sum of weight
      Load.aggregate([
        { $match: { companyId: tenantObjectId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalFreight: {
              $sum: {
                $cond: [
                  { $gt: [{ $ifNull: ['$financials.totalFreightPaise', 0] }, 0] },
                  { $divide: ['$financials.totalFreightPaise', 100] },
                  { $ifNull: ['$charges.totalAmount', 0] }
                ]
              }
            },
            totalAdvance: {
              $sum: {
                $cond: [
                  { $gt: [{ $ifNull: ['$financials.advancePaise', 0] }, 0] },
                  { $divide: ['$financials.advancePaise', 100] },
                  { $ifNull: ['$charges.advanceAmount', 0] }
                ]
              }
            },
            totalBalance: {
              $sum: {
                $cond: [
                  { $gt: [{ $ifNull: ['$financials.balancePaise', 0] }, 0] },
                  { $divide: ['$financials.balancePaise', 100] },
                  { $ifNull: ['$charges.balanceAmount', 0] }
                ]
              }
            },
            totalWeightMt: { $sum: { $ifNull: ['$totalWeightMt', 0] } }
          }
        }
      ]),

      // 2. Today's loads count
      Load.countDocuments({
        companyId: tenantObjectId,
        createdAt: { $gte: startOfToday }
      }),

      // 3. Trips aggregation: counts by status, total expenses
      Trip.aggregate([
        { $match: { companyId: tenantObjectId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalFreight: {
              $sum: {
                $cond: [
                  { $gt: [{ $ifNull: ['$financials.grossFreightPaise', 0] }, 0] },
                  { $divide: ['$financials.grossFreightPaise', 100] },
                  { $ifNull: ['$freightAmount', 0] }
                ]
              }
            },
            totalAdvance: {
              $sum: {
                $cond: [
                  { $gt: [{ $ifNull: ['$financials.driverAdvancePaise', 0] }, 0] },
                  { $divide: ['$financials.driverAdvancePaise', 100] },
                  { $ifNull: ['$advanceAmount', 0] }
                ]
              }
            },
            totalExpenses: {
              $sum: {
                $cond: [
                  { $gt: [{ $ifNull: ['$financials.totalExpensesPaise', 0] }, 0] },
                  { $divide: ['$financials.totalExpensesPaise', 100] },
                  {
                    $reduce: {
                      input: {
                        $cond: [
                          { $gt: [{ $size: { $ifNull: ['$expenses', []] } }, 0] },
                          '$expenses',
                          { $ifNull: ['$tripExpenses', []] }
                        ]
                      },
                      initialValue: 0,
                      in: {
                        $add: [
                          '$$value',
                          {
                            $cond: [
                              { $gt: [{ $ifNull: ['$$this.amountPaise', 0] }, 0] },
                              { $divide: ['$$this.amountPaise', 100] },
                              { $ifNull: ['$$this.amount', 0] }
                            ]
                          }
                        ]
                      }
                    }
                  }
                ]
              }
            }
          }
        }
      ]),

      // 4. Vehicles aggregation: counts by status
      Vehicle.aggregate([
        { $match: { companyId: tenantObjectId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),

      // 5. Drivers aggregation: counts by status
      Driver.aggregate([
        { $match: { companyId: tenantObjectId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),

      // 6. Document Expiries: vehicle + driver documents
      this.getComplianceCounts(tenantObjectId),

      // 7. POD Statistics
      ProofOfDelivery.aggregate([
        { $match: { companyId: tenantObjectId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),

      // 8. WhatsApp Messaging Stats
      MessageLog.aggregate([
        { $match: { companyId: tenantObjectId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    // Format Loads Summary
    const loadByStatus = {
      CREATED: 0,
      VEHICLE_ASSIGNED: 0,
      IN_TRANSIT: 0,
      DELIVERED: 0,
      CANCELLED: 0
    };
    let totalLoads = 0;
    let totalFreightBilled = 0;
    let totalAdvanceReceived = 0;
    let totalBalanceDue = 0;
    let totalWeightMt = 0;

    loadStats.forEach((item) => {
      if (item._id && loadByStatus[item._id] !== undefined) {
        loadByStatus[item._id] = item.count;
      }
      totalLoads += item.count;
      totalFreightBilled += item.totalFreight;
      totalAdvanceReceived += item.totalAdvance;
      totalBalanceDue += item.totalBalance;
      totalWeightMt += item.totalWeightMt;
    });

    // Format Trips Summary
    const tripByStatus = {
      CREATED: 0,
      VEHICLE_ASSIGNED: 0,
      LOADING: 0,
      IN_TRANSIT: 0,
      AT_WAYPOINT: 0,
      DELIVERED: 0,
      CLOSED: 0,
      CANCELLED: 0
    };
    let totalTrips = 0;
    let activeTripsCount = 0;
    let totalTripExpenses = 0;

    tripStats.forEach((item) => {
      if (item._id && tripByStatus[item._id] !== undefined) {
        tripByStatus[item._id] = item.count;
      }
      totalTrips += item.count;
      totalTripExpenses += item.totalExpenses;
      if (['VEHICLE_ASSIGNED', 'LOADING', 'IN_TRANSIT', 'AT_WAYPOINT'].includes(item._id)) {
        activeTripsCount += item.count;
      }
    });

    // Format Vehicles Summary
    const vehiclesByStatus = {
      AVAILABLE: 0,
      ON_TRIP: 0,
      UNDER_MAINTENANCE: 0,
      DECOMMISSIONED: 0
    };
    let totalVehicles = 0;
    vehicleStats.forEach((item) => {
      if (item._id && vehiclesByStatus[item._id] !== undefined) {
        vehiclesByStatus[item._id] = item.count;
      }
      totalVehicles += item.count;
    });

    // Format Drivers Summary
    const driversByStatus = {
      AVAILABLE: 0,
      ON_TRIP: 0,
      ON_LEAVE: 0,
      INACTIVE: 0
    };
    let totalDrivers = 0;
    driverStats.forEach((item) => {
      if (item._id && driversByStatus[item._id] !== undefined) {
        driversByStatus[item._id] = item.count;
      }
      totalDrivers += item.count;
    });

    // Format POD Summary
    const podByStatus = {
      PENDING: 0,
      VERIFIED: 0,
      REJECTED: 0
    };
    let totalPods = 0;
    podStats.forEach((item) => {
      if (item._id === 'PENDING' || item._id === 'PENDING_VERIFICATION') {
        podByStatus.PENDING += item.count;
      } else if (item._id === 'VERIFIED') {
        podByStatus.VERIFIED += item.count;
      } else if (item._id === 'REJECTED') {
        podByStatus.REJECTED += item.count;
      }
      totalPods += item.count;
    });

    // Format WhatsApp Summary
    let totalMessages = 0;
    let successfulMessages = 0;
    let failedMessages = 0;
    whatsappStats.forEach((item) => {
      totalMessages += item.count;
      if (['DELIVERED', 'READ', 'MOCK_DELIVERED'].includes(item._id)) {
        successfulMessages += item.count;
      }
      if (item._id === 'FAILED') {
        failedMessages += item.count;
      }
    });

    const deliverySuccessRate = totalMessages > 0
      ? Math.round((successfulMessages / totalMessages) * 100)
      : 100;

    return {
      loads: {
        total: totalLoads,
        today: todayLoadCount,
        byStatus: loadByStatus,
        totalWeightMt: Math.round(totalWeightMt * 100) / 100
      },
      trips: {
        total: totalTrips,
        active: activeTripsCount,
        closed: tripByStatus.CLOSED || 0,
        byStatus: tripByStatus,
        totalExpenses: totalTripExpenses
      },
      fleet: {
        vehicles: {
          total: totalVehicles,
          available: vehiclesByStatus.AVAILABLE,
          onTrip: vehiclesByStatus.ON_TRIP,
          maintenance: vehiclesByStatus.UNDER_MAINTENANCE,
          byStatus: vehiclesByStatus
        },
        drivers: {
          total: totalDrivers,
          available: driversByStatus.AVAILABLE,
          onTrip: driversByStatus.ON_TRIP,
          onLeave: driversByStatus.ON_LEAVE,
          byStatus: driversByStatus
        }
      },
      financials: {
        freightBilled: totalFreightBilled,
        advanceReceived: totalAdvanceReceived,
        balanceOutstanding: totalBalanceDue,
        tripExpenses: totalTripExpenses,
        netOperationalProfit: totalFreightBilled - totalTripExpenses
      },
      compliance: docExpiryStats,
      pod: {
        total: totalPods,
        pending: podByStatus.PENDING,
        verified: podByStatus.VERIFIED,
        rejected: podByStatus.REJECTED
      },
      whatsapp: {
        total: totalMessages,
        success: successfulMessages,
        failed: failedMessages,
        deliveryRate: deliverySuccessRate
      }
    };
  }

  /**
   * Aggregates document expiry metrics across vehicles and drivers
   * @param {ObjectId} tenantObjectId
   */
  static async getComplianceCounts(tenantObjectId) {
    const now = new Date();
    const in15Days = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [vExpired, vExpiring15, vExpiring30, dExpired, dExpiring15, dExpiring30] = await Promise.all([
      VehicleDocument.countDocuments({ companyId: tenantObjectId, expiryDate: { $lt: now } }),
      VehicleDocument.countDocuments({ companyId: tenantObjectId, expiryDate: { $gte: now, $lte: in15Days } }),
      VehicleDocument.countDocuments({ companyId: tenantObjectId, expiryDate: { $gt: in15Days, $lte: in30Days } }),
      DriverDocument.countDocuments({ companyId: tenantObjectId, expiryDate: { $lt: now } }),
      DriverDocument.countDocuments({ companyId: tenantObjectId, expiryDate: { $gte: now, $lte: in15Days } }),
      DriverDocument.countDocuments({ companyId: tenantObjectId, expiryDate: { $gt: in15Days, $lte: in30Days } })
    ]);

    return {
      expired: vExpired + dExpired,
      expiring15Days: vExpiring15 + dExpiring15,
      expiring30Days: vExpiring30 + dExpiring30,
      vehicles: { expired: vExpired, expiring15: vExpiring15, expiring30: vExpiring30 },
      drivers: { expired: dExpired, expiring15: dExpiring15, expiring30: dExpiring30 }
    };
  }

  /**
   * Returns daily volume and revenue trends for the last N days
   * @param {string|ObjectId} companyId
   * @param {number} days
   */
  static async getTrends(companyId, days = 7) {
    const tenantObjectId = new mongoose.Types.ObjectId(companyId);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const [loadTrends, tripTrends] = await Promise.all([
      Load.aggregate([
        {
          $match: {
            companyId: tenantObjectId,
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            loadCount: { $sum: 1 },
            freight: {
              $sum: {
                $cond: [
                  { $gt: [{ $ifNull: ['$financials.totalFreightPaise', 0] }, 0] },
                  { $divide: ['$financials.totalFreightPaise', 100] },
                  { $ifNull: ['$charges.totalAmount', 0] }
                ]
              }
            },
            weightMt: { $sum: { $ifNull: ['$totalWeightMt', 0] } }
          }
        },
        { $sort: { _id: 1 } }
      ]),

      Trip.aggregate([
        {
          $match: {
            companyId: tenantObjectId,
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            tripCount: { $sum: 1 },
            expenses: {
              $sum: {
                $cond: [
                  { $gt: [{ $ifNull: ['$financials.totalExpensesPaise', 0] }, 0] },
                  { $divide: ['$financials.totalExpensesPaise', 100] },
                  {
                    $reduce: {
                      input: {
                        $cond: [
                          { $gt: [{ $size: { $ifNull: ['$expenses', []] } }, 0] },
                          '$expenses',
                          { $ifNull: ['$tripExpenses', []] }
                        ]
                      },
                      initialValue: 0,
                      in: {
                        $add: [
                          '$$value',
                          {
                            $cond: [
                              { $gt: [{ $ifNull: ['$$this.amountPaise', 0] }, 0] },
                              { $divide: ['$$this.amountPaise', 100] },
                              { $ifNull: ['$$this.amount', 0] }
                            ]
                          }
                        ]
                      }
                    }
                  }
                ]
              }
            }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    // Build day-by-day continuous timeline
    const dateMap = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split('T')[0];
      dateMap[key] = {
        date: key,
        loadCount: 0,
        freight: 0,
        weightMt: 0,
        tripCount: 0,
        expenses: 0
      };
    }

    loadTrends.forEach((item) => {
      if (dateMap[item._id]) {
        dateMap[item._id].loadCount = item.loadCount;
        dateMap[item._id].freight = item.freight;
        dateMap[item._id].weightMt = Math.round(item.weightMt * 100) / 100;
      }
    });

    tripTrends.forEach((item) => {
      if (dateMap[item._id]) {
        dateMap[item._id].tripCount = item.tripCount;
        dateMap[item._id].expenses = item.expenses;
      }
    });

    return Object.values(dateMap);
  }

  /**
   * Aggregates prioritized, actionable operational alerts
   * @param {string|ObjectId} companyId
   */
  static async getAlerts(companyId) {
    const tenantObjectId = new mongoose.Types.ObjectId(companyId);
    const now = new Date();
    const in15Days = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

    const [vDocs, dDocs, pendingPods, failedMessages] = await Promise.all([
      VehicleDocument.find({
        companyId: tenantObjectId,
        expiryDate: { $lte: in15Days }
      })
        .populate('vehicleId', 'plateNumber registrationNumber make model')
        .sort({ expiryDate: 1 })
        .limit(10)
        .lean(),

      DriverDocument.find({
        companyId: tenantObjectId,
        expiryDate: { $lte: in15Days }
      })
        .populate('driverId', 'name licenseNumber licenceNumber phone')
        .sort({ expiryDate: 1 })
        .limit(10)
        .lean(),

      ProofOfDelivery.find({
        companyId: tenantObjectId,
        status: { $in: ['PENDING', 'PENDING_VERIFICATION'] }
      })
        .populate('tripId', 'tripNumber')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),

      MessageLog.find({
        companyId: tenantObjectId,
        status: 'FAILED',
        retryCount: { $lt: 3 }
      })
        .sort({ updatedAt: -1 })
        .limit(5)
        .lean()
    ]);

    const alerts = [];

    // Vehicle Document alerts
    vDocs.forEach((doc) => {
      const isExpired = new Date(doc.expiryDate) < now;
      const daysLeft = Math.ceil((new Date(doc.expiryDate) - now) / (1000 * 60 * 60 * 24));
      const vehId = doc.vehicleId?.plateNumber || doc.vehicleId?.registrationNumber || 'Vehicle';
      alerts.push({
        id: `vdoc_${doc._id}`,
        severity: isExpired ? 'CRITICAL' : 'WARNING',
        type: 'COMPLIANCE',
        title: isExpired
          ? `Vehicle ${vehId} ${doc.documentType} EXPIRED`
          : `Vehicle ${vehId} ${doc.documentType} Expiring in ${daysLeft} days`,
        message: `Document #${doc.documentNumber} expires on ${new Date(doc.expiryDate).toLocaleDateString('en-IN')}. Renew immediately to prevent impoundment.`,
        entityType: 'VEHICLE',
        entityId: doc.vehicleId?._id || doc._id,
        link: '/app/compliance'
      });
    });

    // Driver Document alerts
    dDocs.forEach((doc) => {
      const isExpired = new Date(doc.expiryDate) < now;
      const daysLeft = Math.ceil((new Date(doc.expiryDate) - now) / (1000 * 60 * 60 * 24));
      alerts.push({
        id: `ddoc_${doc._id}`,
        severity: isExpired ? 'CRITICAL' : 'WARNING',
        type: 'COMPLIANCE',
        title: isExpired
          ? `Driver ${doc.driverId?.name || 'Driver'} Licence EXPIRED`
          : `Driver ${doc.driverId?.name || 'Driver'} Licence Expiring in ${daysLeft} days`,
        message: `Licence #${doc.documentNumber} expired or expiring on ${new Date(doc.expiryDate).toLocaleDateString('en-IN')}. Driver cannot be dispatched.`,
        entityType: 'DRIVER',
        entityId: doc.driverId?._id || doc._id,
        link: '/app/compliance'
      });
    });

    // Pending POD alerts
    pendingPods.forEach((pod) => {
      alerts.push({
        id: `pod_${pod._id}`,
        severity: 'INFO',
        type: 'POD_VERIFICATION',
        title: `POD Pending Sign-off for Trip ${pod.tripId?.tripNumber || 'Trip'}`,
        message: `Consignee ${pod.receiverName || 'Receiver'} uploaded proof of delivery. Supervisor approval required.`,
        entityType: 'TRIP',
        entityId: pod.tripId?._id || pod._id,
        link: '/app/deliveries'
      });
    });

    // Failed WhatsApp message alerts
    failedMessages.forEach((msg) => {
      alerts.push({
        id: `msg_${msg._id}`,
        severity: 'WARNING',
        type: 'MESSAGING_FAILURE',
        title: `WhatsApp Delivery Failed to ${msg.recipientPhone}`,
        message: `Template ${msg.templateName} failed (${msg.errorMessage || 'Unknown error'}). Retry attempt available.`,
        entityType: 'WHATSAPP',
        entityId: msg._id,
        link: '/app/whatsapp'
      });
    });

    return alerts;
  }
}

module.exports = DashboardService;
