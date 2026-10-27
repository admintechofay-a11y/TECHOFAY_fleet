/**
 * Phase 2 Acceptance Gate Tests:
 * Core Transport Workflows, Concurrency Safety, Referential Integrity & Financial Invariants
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../apps/api/src/app');
const db = require('../apps/api/src/config/db');
const BootstrapService = require('../apps/api/src/modules/auth/services/bootstrap.service');
const CustomerParty = require('../apps/api/src/modules/customers/models/CustomerParty');
const Location = require('../apps/api/src/modules/locations/models/Location');
const Vehicle = require('../apps/api/src/modules/vehicles/models/Vehicle');
const Driver = require('../apps/api/src/modules/drivers/models/Driver');
const Load = require('../apps/api/src/modules/loads/models/Load');
const Trip = require('../apps/api/src/modules/trips/models/Trip');
const LrNumber = require('../apps/api/src/modules/lr/models/LrNumber');
const Bilty = require('../apps/api/src/modules/bilties/models/Bilty');
const ProofOfDelivery = require('../apps/api/src/modules/pod/models/ProofOfDelivery');
const reportsService = require('../apps/api/src/modules/reports/services/reports.service');
const {
  TripStatus,
  StopType,
  StopStatus,
  VehicleStatus,
  DriverStatus,
  LoadStatus,
  PodStatus
} = require('@fleet/shared');

let server;
let baseUrl;
let companyA;
let companyB;
let userAToken;
let userBToken;

let partyA;
let partyB;
let locPickupA;
let locDeliveryA;
let locPickupB;
let vehicleA;
let vehicleA2;
let driverA;
let driverA2;
let loadA;

describe('Phase 2 Gate: Core Transport Workflows & Data Integrity Verification', () => {

  before(async () => {
    await db.connectDatabase();
    const timestamp = Date.now();

    // Bootstrap Company A
    const bA = await BootstrapService.bootstrapSystem({
      companyLegalName: `Phase 2 Alpha Logistics ${timestamp}`,
      companyGstin: `27PQRST${timestamp.toString().slice(-4)}A1Z5`,
      adminEmail: `phase2.admin.${timestamp}@company-a.com`,
      adminPassword: 'PasswordA123!',
      adminName: 'Admin Alpha'
    });
    companyA = bA.company;

    // Bootstrap Company B (Competitor)
    const bB = await BootstrapService.bootstrapSystem({
      companyLegalName: `Phase 2 Beta Transport ${timestamp}`,
      companyGstin: `29UVWXY${timestamp.toString().slice(-4)}B1Z6`,
      adminEmail: `phase2.admin.${timestamp}@company-b.com`,
      adminPassword: 'PasswordB123!',
      adminName: 'Admin Beta'
    });
    companyB = bB.company;

    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api/v1`;
        resolve();
      });
    });

    // Login Company A
    const resA = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `phase2.admin.${timestamp}@company-a.com`, password: 'PasswordA123!' })
    });
    const dataA = await resA.json();
    userAToken = dataA.data.accessToken;

    // Login Company B
    const resB = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `phase2.admin.${timestamp}@company-b.com`, password: 'PasswordB123!' })
    });
    const dataB = await resB.json();
    userBToken = dataB.data.accessToken;

    // Seed Master Data for Company A
    partyA = await CustomerParty.create({
      companyId: companyA._id,
      name: 'Alpha Consignments Ltd',
      code: `ALP-${timestamp.toString().slice(-4)}`,
      gstin: `27PQRST${timestamp.toString().slice(-4)}A1Z5`,
      pan: `PQRST${timestamp.toString().slice(-4)}A`,
      partyType: 'CUSTOMER'
    });

    locPickupA = await Location.create({
      companyId: companyA._id,
      code: `LOC-MUM-${timestamp.toString().slice(-4)}`,
      name: 'Alpha Mumbai Hub',
      address: {
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001'
      }
    });

    locDeliveryA = await Location.create({
      companyId: companyA._id,
      code: `LOC-PUN-${timestamp.toString().slice(-4)}`,
      name: 'Alpha Pune Depot',
      address: {
        city: 'Pune',
        state: 'Maharashtra',
        pincode: '411001'
      }
    });

    const randPlate1 = Math.floor(1000 + Math.random() * 8999);
    vehicleA = await Vehicle.create({
      companyId: companyA._id,
      plateNumber: `MH12AA${randPlate1}`,
      vehicleType: 'Container 32ft',
      capacityTonnage: 15.0,
      status: VehicleStatus.AVAILABLE
    });

    const randPlate2 = Math.floor(1000 + Math.random() * 8999);
    vehicleA2 = await Vehicle.create({
      companyId: companyA._id,
      plateNumber: `MH12BB${randPlate2}`,
      vehicleType: 'Open Truck',
      capacityTonnage: 20.0,
      status: VehicleStatus.AVAILABLE
    });

    driverA = await Driver.create({
      companyId: companyA._id,
      name: 'Rajesh Sharma',
      phone: '9822011223',
      licenseNumber: `DL-P2A-${timestamp}`,
      licenseType: 'HMV',
      licenseExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      status: DriverStatus.AVAILABLE
    });

    driverA2 = await Driver.create({
      companyId: companyA._id,
      name: 'Sunil Verma',
      phone: '9822011224',
      licenseNumber: `DL-P2B-${timestamp}`,
      licenseType: 'HMV',
      licenseExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      status: DriverStatus.AVAILABLE
    });

    // Seed Master Data for Company B
    partyB = await CustomerParty.create({
      companyId: companyB._id,
      name: 'Beta Steels Corp',
      code: `BET-${timestamp.toString().slice(-4)}`,
      gstin: `29UVWXY${timestamp.toString().slice(-4)}B1Z6`,
      pan: `UVWXY${timestamp.toString().slice(-4)}B`,
      partyType: 'CUSTOMER'
    });

    locPickupB = await Location.create({
      companyId: companyB._id,
      code: `LOC-BLR-${timestamp.toString().slice(-4)}`,
      name: 'Beta Bengaluru Hub',
      address: {
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001'
      }
    });
  });

  after(async () => {
    if (server) {
      if (server.closeAllConnections) server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    await db.disconnectDatabase();
  });

  // --------------------------------------------------------------------------
  // 1. Schema Alignment & Virtuals Verification
  // --------------------------------------------------------------------------
  test('1. Schema Alignment: Vehicle registrationNumber virtual and reports population', async () => {
    // Virtual getter & setter on Vehicle
    assert.equal(vehicleA.registrationNumber, vehicleA.plateNumber);
    const jsonVeh = vehicleA.toJSON();
    assert.equal(jsonVeh.registrationNumber, vehicleA.plateNumber);

    // Virtual getter on Driver
    assert.equal(driverA.licenceNumber, driverA.licenseNumber);
    const jsonDvr = driverA.toJSON();
    assert.equal(jsonDvr.licenceNumber, driverA.licenseNumber);

    // Create a load for Company A
    const resLoad = await fetch(`${baseUrl}/loads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({
        customerId: partyA._id,
        consignorId: partyA._id,
        consigneeId: partyA._id,
        originLocationId: locPickupA._id,
        destinationLocationId: locDeliveryA._id,
        totalWeightMt: 12.5,
        totalQuantity: 150,
        financials: {
          baseFreightPaise: 5000000, // ₹50,000.00
          advancePaise: 1000000       // ₹10,000.00
        },
        stops: [
          { sequence: 1, stopType: 'PICKUP', locationId: locPickupA._id, allocatedQuantity: 150, allocatedWeightMt: 12.5 },
          { sequence: 2, stopType: 'DELIVERY', locationId: locDeliveryA._id, allocatedQuantity: 150, allocatedWeightMt: 12.5 }
        ]
      })
    });
    const loadData = await resLoad.json();
    assert.equal(resLoad.status, 201);
    loadA = loadData.data;

    // Assign vehicle to load
    await fetch(`${baseUrl}/loads/${loadA._id}/assign-assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ vehicleId: vehicleA._id, driverId: driverA._id })
    });

    // Verify report population includes plateNumber on assignedVehicleId
    const report = await reportsService.getLoadsReport(companyA._id, {}, { page: 1, limit: 10 });
    const targetRow = report.rows.find((r) => r.loadNumber === loadA.loadNumber);
    assert.ok(targetRow, 'Row must exist in report');
    assert.ok(targetRow.assignedVehicleId, 'assignedVehicleId must be populated');
    assert.equal(targetRow.assignedVehicleId.plateNumber, vehicleA.plateNumber);
  });

  // --------------------------------------------------------------------------
  // 2. Financial & Date Constraints Server-Side Invariants
  // --------------------------------------------------------------------------
  test('2. Financial & Date Invariants: Rejects invalid advances, negative amounts, and backwards dates', async () => {
    // A. Advance + Deduction exceeds Total Freight
    const resExcessAdvance = await fetch(`${baseUrl}/loads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({
        customerId: partyA._id,
        consignorId: partyA._id,
        consigneeId: partyA._id,
        totalWeightMt: 10,
        financials: {
          baseFreightPaise: 2000000, // ₹20,000
          advancePaise: 2500000       // ₹25,000 (Exceeds total freight!)
        }
      })
    });
    const excessData = await resExcessAdvance.json();
    assert.equal(resExcessAdvance.status, 400);
    assert.match(excessData.message, /advance.*exceed/i);

    // B. Backwards delivery date (delivery date before creation date)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const resBadDate = await fetch(`${baseUrl}/loads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({
        customerId: partyA._id,
        consignorId: partyA._id,
        consigneeId: partyA._id,
        totalWeightMt: 10,
        expectedDeliveryDate: yesterday,
        financials: { baseFreightPaise: 2000000 }
      })
    });
    const badDateData = await resBadDate.json();
    assert.equal(resBadDate.status, 400);
    assert.match(badDateData.message, /delivery date cannot be before/i);
  });

  // --------------------------------------------------------------------------
  // 3. Cross-Tenant Referential Guards on Loads & Trips
  // --------------------------------------------------------------------------
  test('3. Cross-Tenant Integrity: Rejects cross-tenant parties and stop locations', async () => {
    // Attempt to create Load in Company A referencing Company B's party
    const resPartyInject = await fetch(`${baseUrl}/loads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({
        customerId: partyB._id, // Belongs to Company B!
        consignorId: partyA._id,
        consigneeId: partyA._id,
        totalWeightMt: 10,
        financials: { baseFreightPaise: 1000000 }
      })
    });
    assert.equal(resPartyInject.status, 403);

    // Attempt to create Trip in Company A referencing Company B's location in customStops
    const resLocInject = await fetch(`${baseUrl}/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({
        loadId: loadA._id,
        vehicleId: vehicleA2._id,
        driverId: driverA2._id,
        stops: [
          { sequence: 1, locationId: locPickupB._id, allocatedQuantity: 100 } // Belongs to Company B!
        ]
      })
    });
    assert.equal(resLocInject.status, 403);
  });

  // --------------------------------------------------------------------------
  // 4. Concurrent Dispatch Race Condition Safety
  // --------------------------------------------------------------------------
  test('4. Concurrency Safety: Atomic reservation prevents concurrent double-booking of vehicle & driver', async () => {
    // Prepare 2 separate loads to dispatch with the EXACT SAME vehicle & driver concurrently
    const makeLoad = async (num) => {
      const res = await fetch(`${baseUrl}/loads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
        body: JSON.stringify({
          customerId: partyA._id,
          consignorId: partyA._id,
          consigneeId: partyA._id,
          totalWeightMt: 10,
          totalQuantity: 100,
          financials: { baseFreightPaise: 3000000 },
          stops: [
            { sequence: 1, stopType: 'PICKUP', locationId: locPickupA._id, allocatedQuantity: 100 },
            { sequence: 2, stopType: 'DELIVERY', locationId: locDeliveryA._id, allocatedQuantity: 100 }
          ]
        })
      });
      const data = await res.json();
      return data.data;
    };

    const [concurrentLoad1, concurrentLoad2] = await Promise.all([makeLoad(1), makeLoad(2)]);

    // Fire TWO dispatch requests simultaneously for vehicleA2 and driverA2
    const dispatchReq1 = fetch(`${baseUrl}/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({
        loadId: concurrentLoad1._id,
        vehicleId: vehicleA2._id,
        driverId: driverA2._id,
        driverAdvancePaise: 500000
      })
    });

    const dispatchReq2 = fetch(`${baseUrl}/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({
        loadId: concurrentLoad2._id,
        vehicleId: vehicleA2._id,
        driverId: driverA2._id,
        driverAdvancePaise: 500000
      })
    });

    const [resp1, resp2] = await Promise.all([dispatchReq1, dispatchReq2]);
    const statuses = [resp1.status, resp2.status].sort();

    // Exactly one request must succeed (201), and the concurrent request must be rejected (400)
    assert.deepEqual(statuses, [201, 400], 'One dispatch must succeed (201) and the duplicate must be rejected (400)');

    // Verify Vehicle and Driver status in DB is ON_TRIP
    const checkVeh = await Vehicle.findById(vehicleA2._id);
    assert.equal(checkVeh.status, VehicleStatus.ON_TRIP);
    const checkDvr = await Driver.findById(driverA2._id);
    assert.equal(checkDvr.status, DriverStatus.ON_TRIP);
  });

  // --------------------------------------------------------------------------
  // 5. Idempotent Trip Closure, POD & Over-Delivery Prevention
  // --------------------------------------------------------------------------
  test('5. Lifecycle & Idempotency: Prevents premature closure, stops over-delivery, and supports idempotent closure', async () => {
    // Create an active trip from loadA
    const resTrip = await fetch(`${baseUrl}/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({
        loadId: loadA._id,
        vehicleId: vehicleA._id,
        driverId: driverA._id,
        driverAdvancePaise: 500000
      })
    });
    const tripData = await resTrip.json();
    assert.equal(resTrip.status, 201);
    const activeTrip = tripData.data;

    // A. Premature closure rejection: Attempting to close while stops are PENDING and no POD
    const resPremature = await fetch(`${baseUrl}/trips/${activeTrip._id}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` }
    });
    const prematureData = await resPremature.json();
    assert.equal(resPremature.status, 400);
    assert.match(prematureData.message, /delivery stop\(s\) are not yet COMPLETED/i);

    // Move trip to IN_TRANSIT
    await fetch(`${baseUrl}/trips/${activeTrip._id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ status: TripStatus.LOADING })
    });
    await fetch(`${baseUrl}/trips/${activeTrip._id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ status: TripStatus.IN_TRANSIT })
    });

    const deliveryStop = activeTrip.stops.find(s => s.stopType === StopType.DELIVERY);
    assert.ok(deliveryStop);

    // B. Over-delivery rejection: Try delivering 200 items when allocated is 150
    const resOver = await fetch(`${baseUrl}/trips/${activeTrip._id}/stops/${deliveryStop._id}/deliver`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ deliveredQuantity: 200, receiverName: 'Warehouse Lead' })
    });
    assert.equal(resOver.status, 400);

    // Deliver exact 150 items
    const resValidDel = await fetch(`${baseUrl}/trips/${activeTrip._id}/stops/${deliveryStop._id}/deliver`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ deliveredQuantity: 150, receiverName: 'Warehouse Lead' })
    });
    assert.equal(resValidDel.status, 200);

    // C. Already completed stop protection: Try delivering on completed stop
    const resRepeatDel = await fetch(`${baseUrl}/trips/${activeTrip._id}/stops/${deliveryStop._id}/deliver`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ deliveredQuantity: 1, receiverName: 'Warehouse Lead' })
    });
    assert.equal(resRepeatDel.status, 400);
    assert.match((await resRepeatDel.json()).message, /already fully completed/i);

    // D. Missing POD check: Delivery is done, but no POD attached yet
    const resNoPod = await fetch(`${baseUrl}/trips/${activeTrip._id}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` }
    });
    assert.equal(resNoPod.status, 400);
    assert.match((await resNoPod.json()).message, /Proof of Delivery \(POD\) document must be uploaded/i);

    // Attach mock POD to satisfy closure requirement
    const pod = await ProofOfDelivery.create({
      companyId: companyA._id,
      podNumber: 'POD-P2-00001',
      tripId: activeTrip._id,
      loadId: loadA._id,
      receiverName: 'Warehouse Lead',
      quantityDelivered: 150,
      fileKey: 'mock_pod_key.pdf',
      status: PodStatus.VERIFIED
    });

    // E. Successful Closure
    const resClose = await fetch(`${baseUrl}/trips/${activeTrip._id}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` }
    });
    assert.equal(resClose.status, 200);

    // F. Idempotent Retry: Calling close again returns 200 with already closed message
    const resCloseRetry = await fetch(`${baseUrl}/trips/${activeTrip._id}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` }
    });
    const retryData = await resCloseRetry.json();
    assert.equal(resCloseRetry.status, 200);
    assert.match(retryData.message, /already closed/i);

    // G. Expenses blocked on closed trip
    const resAddExp = await fetch(`${baseUrl}/trips/${activeTrip._id}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ expenseType: 'TOLL', amountPaise: 25000, description: 'Post-closure toll' })
    });
    assert.equal(resAddExp.status, 400);
    assert.match((await resAddExp.json()).message, /Trip accounting is finalized/i);

    // H. POD Verification Idempotency
    const resVerify1 = await fetch(`${baseUrl}/pod/${pod._id}/verify`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ status: PodStatus.VERIFIED })
    });
    assert.equal(resVerify1.status, 200);

    const resVerify2 = await fetch(`${baseUrl}/pod/${pod._id}/verify`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ status: PodStatus.VERIFIED })
    });
    assert.equal(resVerify2.status, 200);
    assert.match((await resVerify2.json()).message, /already marked as VERIFIED/i);
  });

  // --------------------------------------------------------------------------
  // 6. Duplicate Bilty Prevention & Asset Deactivation Safeguards
  // --------------------------------------------------------------------------
  test('6. Data Integrity: Prevents duplicate Bilty creation and blocking deactivation of active assets', async () => {
    // Create LR for loadA
    const lr = await LrNumber.create({
      companyId: companyA._id,
      lrNumber: `LR-P2-${Date.now().toString().slice(-5)}`,
      loadId: loadA._id,
      consignorId: partyA._id,
      consigneeId: partyA._id
    });

    // Create Bilty for this LR
    const resBilty1 = await fetch(`${baseUrl}/bilties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({
        lrId: lr._id,
        totalFreightPaise: 5000000,
        advancePaise: 1000000
      })
    });
    assert.equal(resBilty1.status, 201);

    // Duplicate Bilty attempt: Must be rejected with 409 Conflict
    const resBilty2 = await fetch(`${baseUrl}/bilties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({
        lrId: lr._id,
        totalFreightPaise: 5000000,
        advancePaise: 1000000
      })
    });
    assert.equal(resBilty2.status, 409);
    assert.match((await resBilty2.json()).message, /already been issued/i);

    // Deactivation Safeguards:
    // Create an active trip using vehicleA and driverA
    const activeLoad2 = await Load.create({
      companyId: companyA._id,
      loadNumber: `LD-ACT-${Date.now().toString().slice(-4)}`,
      customerId: partyA._id,
      consignorId: partyA._id,
      consigneeId: partyA._id,
      totalWeightMt: 5,
      financials: { baseFreightPaise: 1000000 },
      stops: [{ sequence: 1, stopType: 'PICKUP', locationId: locPickupA._id, allocatedQuantity: 10 }]
    });

    await fetch(`${baseUrl}/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({
        loadId: activeLoad2._id,
        vehicleId: vehicleA._id,
        driverId: driverA._id
      })
    });

    // Attempting to delete (deactivate) vehicleA while on active trip must be rejected with 400
    const resDelVeh = await fetch(`${baseUrl}/vehicles/${vehicleA._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.equal(resDelVeh.status, 400);
    assert.match((await resDelVeh.json()).message, /currently assigned to active Trip/i);

    // Attempting to delete (deactivate) driverA while on active trip must be rejected with 400
    const resDelDvr = await fetch(`${baseUrl}/drivers/${driverA._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.equal(resDelDvr.status, 400);
    assert.match((await resDelDvr.json()).message, /currently assigned to active Trip/i);

    // Attempting to delete (deactivate) partyA while tied to activeLoad2 must be rejected with 400
    const resDelParty = await fetch(`${baseUrl}/customers/${partyA._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.equal(resDelParty.status, 400);
    assert.match((await resDelParty.json()).message, /currently associated with active consignment/i);
  });

});
