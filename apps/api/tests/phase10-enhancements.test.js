/**
 * Phase 10 Integration Test Suite: Optional Client-Approved Enhancements
 * Tests:
 *  1. Customer Self-Service Tracking Portal (Unauthenticated, Rate-limited, PII-redacted)
 *  2. Interactive Route & Hub Map Coordinates Resolution
 *  3. Trip Operator Route Map API
 *  4. Fleet Preventative Maintenance & Service Scheduling
 *  5. Automated Vehicle Lifecycle Synchronization (UNDER_MAINTENANCE -> AVAILABLE)
 *  6. Maintenance KPI Statistics Aggregation
 *  7. Multi-Tenant Scoping for Maintenance Records
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const app = require('../src/app');
const db = require('../src/config/db');
const Company = require('../src/modules/auth/models/Company');
const User = require('../src/modules/auth/models/User');
const Vehicle = require('../src/modules/vehicles/models/Vehicle');
const Driver = require('../src/modules/drivers/models/Driver');
const Location = require('../src/modules/locations/models/Location');
const CustomerParty = require('../src/modules/customers/models/CustomerParty');
const Load = require('../src/modules/loads/models/Load');
const LrNumber = require('../src/modules/lr/models/LrNumber');
const Trip = require('../src/modules/trips/models/Trip');
const VehicleMaintenance = require('../src/modules/maintenance/models/VehicleMaintenance');
const BootstrapService = require('../src/modules/auth/services/bootstrap.service');

describe('Phase 10 Integration Test Suite: Enhancements Suite', () => {
  let server;
  let baseUrl;
  let companyAId;
  let companyBId;
  let tokenCompanyA;
  let tokenCompanyB;
  let testVehicleA;
  let testLoadA;
  let testLrA;
  let testTripA;

  before(async () => {
    try {
      await db.connectDatabase();
      const timestamp = Date.now();

      // 1. Bootstrap Company A
      const bootA = await BootstrapService.bootstrapSystem({
        companyLegalName: `Phase 10 Logistics A ${timestamp}`,
        companyGstin: `27AABCT${timestamp.toString().slice(-4)}M1Z8`,
        adminEmail: `phase10.admin.${timestamp}@company-a.com`,
        adminPassword: 'PasswordA123!',
        adminName: 'Alpha Super Admin'
      });
      companyAId = bootA.company._id.toString();

      // 2. Bootstrap Company B (Competitor)
      const bootB = await BootstrapService.bootstrapSystem({
        companyLegalName: `Phase 10 Express B ${timestamp}`,
        companyGstin: `29BCDEF${timestamp.toString().slice(-4)}B1Z9`,
        adminEmail: `phase10.admin.${timestamp}@company-b.com`,
        adminPassword: 'PasswordB123!',
        adminName: 'Beta Super Admin'
      });
      companyBId = bootB.company._id.toString();

      // 3. Start Test HTTP Server
      server = app.listen(0);
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api/v1`;

      // 4. Authenticate Company A
      const resLoginA = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `phase10.admin.${timestamp}@company-a.com`,
          password: 'PasswordA123!'
        })
      });
      const dataLoginA = await resLoginA.json();
      tokenCompanyA = dataLoginA.data.accessToken;

      // 5. Authenticate Company B
      const resLoginB = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `phase10.admin.${timestamp}@company-b.com`,
          password: 'PasswordB123!'
        })
      });
      const dataLoginB = await resLoginB.json();
      tokenCompanyB = dataLoginB.data.accessToken;

      // 6. Pre-seed operational entities for Company A
      const plateNum = `MH31AB${String(timestamp % 9000 + 1000)}`;
      testVehicleA = await Vehicle.create({
        companyId: companyAId,
        plateNumber: plateNum,
        vehicleType: 'Heavy Commercial Vehicle',
        capacityTonnage: 25.0,
        make: 'Tata Motors',
        model: 'Signa 4825.TK',
        status: 'AVAILABLE'
      });

      const testDriverA = await Driver.create({
        companyId: companyAId,
        name: 'Rajesh Sharma',
        phone: '9876543210',
        licenseNumber: `MH31${timestamp.toString().slice(-6)}`,
        licenseType: 'HMV',
        licenseExpiryDate: new Date('2028-12-31'),
        status: 'AVAILABLE'
      });

      const customerA = await CustomerParty.create({
        companyId: companyAId,
        name: 'Adani Industrial Logistics Ltd',
        gstin: `27AABCU${timestamp.toString().slice(-4)}M1Z5`,
        partyType: 'CUSTOMER'
      });

      const locOrigin = await Location.create({
        companyId: companyAId,
        name: 'JNPT Port Logistics Hub',
        address: { street: 'Docks Road', city: 'Mumbai', state: 'Maharashtra', pincode: '400707' },
        coordinates: { lat: 18.9499, lng: 72.9515 }
      });

      const locDestination = await Location.create({
        companyId: companyAId,
        name: 'Delhi NCR Freight Terminal',
        address: { street: 'NH 48 Hub', city: 'Delhi', state: 'Delhi', pincode: '110037' },
        coordinates: { lat: 28.6139, lng: 77.2090 }
      });

      testLoadA = await Load.create({
        companyId: companyAId,
        loadNumber: `LD-2026-P10-${timestamp.toString().slice(-4)}`,
        customerId: customerA._id,
        consignorId: customerA._id,
        consigneeId: customerA._id,
        assignedVehicleId: testVehicleA._id,
        assignedDriverId: testDriverA._id,
        materialType: 'Steel Coils',
        totalQuantity: 200,
        totalWeightMt: 24.5,
        status: 'IN_TRANSIT',
        stops: [
          {
            sequence: 1,
            stopType: 'PICKUP',
            locationId: locOrigin._id,
            allocatedQuantity: 200,
            status: 'COMPLETED'
          },
          {
            sequence: 2,
            stopType: 'DELIVERY',
            locationId: locDestination._id,
            allocatedQuantity: 200,
            status: 'PENDING'
          }
        ],
        freightAmountPaise: 15000000 // ₹1,50,000 (Sensitive commercial rate)
      });

      testLrA = await LrNumber.create({
        companyId: companyAId,
        lrNumber: `LR-2026-P10-${timestamp.toString().slice(-4)}`,
        loadId: testLoadA._id,
        vehicleId: testVehicleA._id,
        driverId: testDriverA._id,
        consignorId: customerA._id,
        consigneeId: customerA._id,
        fromLocationId: locOrigin._id,
        toLocationId: locDestination._id,
        status: 'IN_TRANSIT'
      });

      testTripA = await Trip.create({
        companyId: companyAId,
        tripNumber: `TRIP-2026-P10-${timestamp.toString().slice(-4)}`,
        loadId: testLoadA._id,
        vehicleId: testVehicleA._id,
        driverId: testDriverA._id,
        status: 'IN_TRANSIT',
        stops: [
          { sequence: 1, stopType: 'PICKUP', locationId: locOrigin._id, status: 'COMPLETED' },
          { sequence: 2, stopType: 'DELIVERY', locationId: locDestination._id, status: 'PENDING' }
        ]
      });
    } catch (err) {
      console.error('Phase 10 Test Setup Failed:', err);
      throw err;
    }
  });

  after(async () => {
    if (server) await new Promise(r => server.close(r));
    await mongoose.disconnect();
  });

  test('1. Customer Tracking: Public unauthenticated lookup by LR Number with privacy redaction', async () => {
    // Crucial: No Authorization header passed!
    const res = await fetch(`${baseUrl}/public/track/${testLrA.lrNumber}`);
    assert.equal(res.status, 200, 'Public tracking must be accessible without login');

    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.lrNumber, testLrA.lrNumber);
    assert.equal(json.data.loadNumber, testLoadA.loadNumber);
    assert.equal(json.data.currentStatus, 'IN_TRANSIT');

    // Security & Privacy Verification:
    // 1. Commercial freight amounts must NOT be exposed
    assert.equal(json.data.freightAmountPaise, undefined, 'Freight amount paise must not be leaked');
    assert.equal(json.data.freightAmount, undefined, 'Freight amount must not be leaked');
    // 2. Driver personal mobile number must NOT be exposed
    assert.equal(json.data.driverMobile, undefined, 'Driver phone must not be leaked');
    // 3. Vehicle plate number must be masked (e.g. MH31••••)
    assert.match(json.data.vehicle.maskedPlateNumber, /•/, 'Vehicle plate should be masked for public privacy');

    // Milestones Verification:
    assert.equal(json.data.milestones.length, 5, 'Should generate 5 progressive milestone steps');
    assert.equal(json.data.milestones[0].status, 'COMPLETED', 'Milestone 1 (Booked) must be completed');
    assert.equal(json.data.milestones[1].status, 'COMPLETED', 'Milestone 2 (Vehicle Assigned) must be completed');
  });

  test('2. Customer Tracking: Query param lookup by Load Number (GET /public/track?q=...)', async () => {
    const res = await fetch(`${baseUrl}/public/track?q=${testLoadA.loadNumber}`);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.data.loadNumber, testLoadA.loadNumber);
    assert.equal(json.data.materialType, 'Steel Coils');
    assert.equal(json.data.parties.consignor, 'Adani Industrial Logistics Ltd');
  });

  test('3. Route Mapping: Waypoint coordinates are resolved accurately for Indian hubs', async () => {
    const res = await fetch(`${baseUrl}/public/track/${testLrA.lrNumber}`);
    const json = await res.json();

    const waypoints = json.data.waypoints;
    assert.equal(waypoints.length, 2, 'Should have 2 route waypoints');

    // Origin: Mumbai JNPT
    assert.equal(typeof waypoints[0].coordinates.lat, 'number');
    assert.equal(typeof waypoints[0].coordinates.lng, 'number');
    assert.ok(waypoints[0].coordinates.lat > 18.0 && waypoints[0].coordinates.lat < 20.0, 'Mumbai lat coordinate valid');

    // Destination: Delhi
    assert.equal(typeof waypoints[1].coordinates.lat, 'number');
    assert.equal(typeof waypoints[1].coordinates.lng, 'number');
    assert.ok(waypoints[1].coordinates.lat > 27.0 && waypoints[1].coordinates.lat < 30.0, 'Delhi lat coordinate valid');
  });

  test('4. Route Mapping: Trip operator route map endpoint (GET /trips/:id/route-map)', async () => {
    const res = await fetch(`${baseUrl}/trips/${testTripA._id}/route-map`, {
      headers: { Authorization: `Bearer ${tokenCompanyA}` }
    });
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.data.tripNumber, testTripA.tripNumber);
    assert.equal(json.data.stops.length, 2);
    assert.equal(json.data.stops[0].coordinates.source, 'EXPLICIT_RECORD');

    // Multi-tenant check: Competitor Company B cannot access Company A trip map
    const resCompB = await fetch(`${baseUrl}/trips/${testTripA._id}/route-map`, {
      headers: { Authorization: `Bearer ${tokenCompanyB}` }
    });
    assert.equal(resCompB.status, 404, 'Competitor must not view other company trip route maps');
  });

  test('5. Tracking 404 Guard: Non-existent tracking ID returns clean 404', async () => {
    const res = await fetch(`${baseUrl}/public/track/LR-INVALID-NOT-EXIST-9999`);
    assert.equal(res.status, 404);

    const json = await res.json();
    assert.equal(json.success, false);
    assert.match(json.message, /No consignment found/);
  });

  let createdMaintenanceId;
  let maintenanceNumber;

  test('6. Fleet Maintenance: Schedule preventative service with atomic sequence (MNT-YYYY-XXXX)', async () => {
    const res = await fetch(`${baseUrl}/maintenance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCompanyA}`
      },
      body: JSON.stringify({
        vehicleId: testVehicleA._id.toString(),
        serviceType: 'BRAKE_OVERHAUL',
        priority: 'HIGH',
        scheduledDate: new Date('2026-11-15'),
        odometerReadingKm: 48500,
        serviceCenter: {
          name: 'Ashok Leyland Authorized Garage',
          city: 'Nagpur',
          contactPhone: '9822012345'
        },
        costPaise: 850000, // ₹8,500
        technicianRemarks: 'Brake pads replacement and hydraulic oil check'
      })
    });

    assert.equal(res.status, 201, 'Maintenance scheduling should return 201 Created');
    const json = await res.json();
    assert.equal(json.success, true);
    assert.match(json.data.maintenanceNumber, /^MNT-\d{4}-\d{4}$/, 'Should allocate atomic MNT sequence');
    assert.equal(json.data.serviceType, 'BRAKE_OVERHAUL');
    assert.equal(json.data.status, 'SCHEDULED');

    createdMaintenanceId = json.data._id;
    maintenanceNumber = json.data.maintenanceNumber;
  });

  test('7. Fleet Maintenance: Status transition updates vehicle status to UNDER_MAINTENANCE and back to AVAILABLE', async () => {
    // Step A: Advance maintenance status to IN_PROGRESS
    const resStart = await fetch(`${baseUrl}/maintenance/${createdMaintenanceId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCompanyA}`
      },
      body: JSON.stringify({ status: 'IN_PROGRESS' })
    });
    assert.equal(resStart.status, 200);

    // Verify Vehicle model status automatically transitioned to UNDER_MAINTENANCE
    const vehicleInService = await Vehicle.findById(testVehicleA._id);
    assert.equal(vehicleInService.status, 'UNDER_MAINTENANCE', 'Vehicle must be marked UNDER_MAINTENANCE during service');

    // Step B: Certify maintenance completion
    const resComplete = await fetch(`${baseUrl}/maintenance/${createdMaintenanceId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCompanyA}`
      },
      body: JSON.stringify({
        status: 'COMPLETED',
        costPaise: 890000,
        invoiceNumber: 'INV-AL-2026-99',
        technicianRemarks: 'Replaced front and rear brake shoes, road tested OK'
      })
    });
    assert.equal(resComplete.status, 200);

    // Verify Vehicle model status returned automatically to AVAILABLE
    const vehicleReleased = await Vehicle.findById(testVehicleA._id);
    assert.equal(vehicleReleased.status, 'AVAILABLE', 'Vehicle must return to AVAILABLE status on maintenance completion');
  });

  test('8. Fleet Maintenance: Statistics aggregation and Multi-Tenant Isolation', async () => {
    // Stats for Company A
    const resStats = await fetch(`${baseUrl}/maintenance/stats`, {
      headers: { Authorization: `Bearer ${tokenCompanyA}` }
    });
    assert.equal(resStats.status, 200);
    const jsonStats = await resStats.json();
    assert.ok(jsonStats.data.completedThisMonth >= 1, 'Should record at least 1 completed service this month');
    assert.ok(jsonStats.data.totalCostThisMonthRupees >= 8900, 'Cost should aggregate paise correctly to rupees');

    // Multi-tenant check: Company B cannot view Company A maintenance record
    const resCompB = await fetch(`${baseUrl}/maintenance/${createdMaintenanceId}`, {
      headers: { Authorization: `Bearer ${tokenCompanyB}` }
    });
    assert.equal(resCompB.status, 404, 'Competitor must not be able to read Company A maintenance logs');
  });
});
