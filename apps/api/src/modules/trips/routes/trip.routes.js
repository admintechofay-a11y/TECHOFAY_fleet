/**
 * Trip Management Routes
 */

const express = require('express');
const tripController = require('../controllers/trip.controller');
const { authenticate, enforceTenantScope } = require('../../../middleware/auth.middleware');
const { requirePermission } = require('../../../middleware/rbac.middleware');
const { SystemModule, ActionPermission } = require('@fleet/shared');

const router = express.Router();

router.use(authenticate, enforceTenantScope);

router.get(
  '/',
  requirePermission(SystemModule.TRIPS, ActionPermission.VIEW),
  tripController.list
);

router.get(
  '/:id',
  requirePermission(SystemModule.TRIPS, ActionPermission.VIEW),
  tripController.getById
);

router.post(
  '/',
  requirePermission(SystemModule.TRIPS, ActionPermission.ADD),
  tripController.create
);

router.patch(
  '/:id/status',
  requirePermission(SystemModule.TRIPS, ActionPermission.EDIT),
  tripController.updateStatus
);

router.post(
  '/:id/stops/:stopId/deliver',
  requirePermission(SystemModule.TRIPS, ActionPermission.EDIT),
  tripController.recordStopDelivery
);

router.post(
  '/:id/expenses',
  requirePermission(SystemModule.TRIPS, ActionPermission.EDIT),
  tripController.addExpense
);

router.post(
  '/:id/close',
  requirePermission(SystemModule.TRIPS, ActionPermission.EDIT),
  tripController.closeTrip
);

router.get(
  '/:id/tripsheet',
  requirePermission(SystemModule.TRIPS, ActionPermission.VIEW),
  tripController.getTripSheetPdf
);

router.get(
  '/:id/route-map',
  requirePermission(SystemModule.TRIPS, ActionPermission.VIEW),
  require('../../tracking/controllers/publicTracking.controller').getTripRouteMap
);

router.get(
  '/:id/settlement',
  requirePermission(SystemModule.TRIPS, ActionPermission.VIEW),
  tripController.getSettlementPdf
);

module.exports = router;
