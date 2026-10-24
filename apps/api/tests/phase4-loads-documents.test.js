/**
 * Comprehensive Phase 4 Integration Tests: Loads, Multi-Stop Route Data, LR, Bilty & Generated Documents
 *
 * 1. Atomic collision-safe sequence numbering under high concurrency
 * 2. Consignment Load creation with multi-location ordered stops and integer Paise financials
 * 3. State machine transitions and invalid status rejection
 * 4. Fleet asset assignment with licence expiry and vehicle maintenance validation
 * 5. Lorry Receipt (LR) allocation, manual duplicate rejection, and E-Way bill linkage
 * 6. Bilty Consignment Note issuance, 5% GTA SAC 9965 compliance, and net balance calculation
 * 7. Server-side PDF generation engine (Loading Slip, LR, Bilty) with binary verification
 * 8. Multi-tenant isolation enforcement (cross-tenant access denial)
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const db = require('../src/config/db');
const sequenceService = require('../src/modules/sequences/services/sequence.service');
const Counter = require('../src/modules/sequences/models/Counter');
const BootstrapService = require('../src/modules/auth/services/bootstrap.service');
const CustomerParty = require('../src/modules/customers/models/CustomerParty');
const Location = require('../src/modules/locations/models/Location');
const Vehicle = require('../src/modules/vehicles/models/Vehicle');
const Driver = require('../src/modules/drivers/models/Driver');
const Load = require('../src/modules/loads/models/Load');
const LrNumber = require('../src/modules/lr/models/LrNumber');
const Bilty = require('../src/modules/bilties/models/Bilty');
const { LoadStatus, LrStatus, BiltyStatus } = require('@fleet/shared');

let server;
let baseUrl;
let companyA;
let companyB;
let userAToken;
let userBToken;

let testCustomerId;
let testConsignorId;
let testConsigneeId;
let testLocationPickupId;
let testLocationDropId;
let testVehicleId;
let testMaintVehicleId;
let testDriverId;
let testExpiredDriverId;

let createdLoadId;
let createdLoadNumber;
let createdLrId;
let createdLrNumber;
let createdBiltyId;

describe('Phase 4 Integration Test Suite: Loads, Multi-Stop Route Data, LR, Bilty & PDFs', () => {

  before(async () => {
    try {
      await db.connectDatabase();
      const timestamp = Date.now();
      const rand4 = Math.floor(1000 + Math.random() * 9000);

      // 1. Bootstrap Company A
      const bootstrapA = await BootstrapService.bootstrapSystem({
        companyLegalName: `Phase 4 Fleet Logistics A ${timestamp}`,
        companyGstin: `27ABCDE${timestamp.toString().slice(-4)}A1Z1`,
        adminEmail: `phase4.admin.${timestamp}@company-a.com`,
        adminPassword: 'PasswordA123!',
        adminName: 'Admin Fleet A'
      });
      companyA = bootstrapA.company;

      // 2. Bootstrap Company B
      const bootstrapB = await BootstrapService.bootstrapSystem({
        companyLegalName: `Phase 4 Fleet Competitor B ${timestamp}`,
        companyGstin: `29BCDEF${timestamp.toString().slice(-4)}B1Z2`,
        adminEmail: `phase4.admin.${timestamp}@company-b.com`,
        adminPassword: 'PasswordB123!',
        adminName: 'Admin Fleet B'
      });
      companyB = bootstrapB.company;

      // Ephemeral HTTP server
      await new Promise((resolve) => {
        server = app.listen(0, '127.0.0.1', () => {
          const port = server.address().port;
          baseUrl = `http://127.0.0.1:${port}/api/v1`;
          resolve();
        });
      });

      // Login Company A
      const loginARes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `phase4.admin.${timestamp}@company-a.com`,
          password: 'PasswordA123!'
        })
      });
      const loginAData = await loginARes.json();
      userAToken = loginAData.data.accessToken;

      // Login Company B
      const loginBRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `phase4.admin.${timestamp}@company-b.com`,
          password: 'PasswordB123!'
        })
      });
      const loginBData = await loginBRes.json();
      userBToken = loginBData.data.accessToken;

      // Seed Master Data for Company A
      const customer = await CustomerParty.create({
        companyId: companyA._id,
        name: `Tata Steel Limited ${timestamp}`,
        code: `TSL${rand4}`,
        partyType: 'CUSTOMER',
        gstin: `27AABCT${timestamp.toString().slice(-4)}A1Z5`,
        paymentTermsDays: 30
      });
      testCustomerId = customer._id;

      const consignor = await CustomerParty.create({
        companyId: companyA._id,
        name: `Jamshedpur Works Depot ${timestamp}`,
        code: `JSR${rand4}`,
        partyType: 'CONSIGNOR',
        gstin: `20AABCT${timestamp.toString().slice(-4)}A1Z7`,
        billingAddress: { city: 'Jamshedpur', state: 'Jharkhand' }
      });
      testConsignorId = consignor._id;

      const consignee = await CustomerParty.create({
        companyId: companyA._id,
        name: `Mumbai Central Warehouse ${timestamp}`,
        code: `MUM${rand4}`,
        partyType: 'CONSIGNEE',
        gstin: `27AABCT${timestamp.toString().slice(-4)}C1Z9`,
        billingAddress: { city: 'Mumbai', state: 'Maharashtra' }
      });
      testConsigneeId = consignee._id;

      const locPickup = await Location.create({
        companyId: companyA._id,
        name: `Jamshedpur Plant Gate 4 ${timestamp}`,
        code: `JG${rand4}`,
        type: 'PICKUP',
        address: {
          city: 'Jamshedpur',
          state: 'Jharkhand'
        }
      });
      testLocationPickupId = locPickup._id;

      const locDrop = await Location.create({
        companyId: companyA._id,
        name: `Bhiwandi Logistics Park ${timestamp}`,
        code: `BW${rand4}`,
        type: 'DELIVERY',
        address: {
          city: 'Bhiwandi',
          state: 'Maharashtra'
        }
      });
      testLocationDropId = locDrop._id;

      // Operational Vehicle
      const vehicle = await Vehicle.create({
        companyId: companyA._id,
        plateNumber: `MH12AB${rand4}`,
        vehicleType: 'Trailer 40ft',
        make: 'Tata Motors',
        model: 'Prima 4028',
        category: 'OWNED',
        capacityTonnage: 35,
        status: 'AVAILABLE'
      });
      testVehicleId = vehicle._id;

      // Under Maintenance Vehicle
      const maintVehicle = await Vehicle.create({
        companyId: companyA._id,
        plateNumber: `MH12CD${rand4}`,
        vehicleType: 'Open Truck',
        make: 'Ashok Leyland',
        category: 'OWNED',
        capacityTonnage: 25,
        status: 'UNDER_MAINTENANCE'
      });
      testMaintVehicleId = maintVehicle._id;

      // Valid Driver
      const driver = await Driver.create({
        companyId: companyA._id,
        name: 'Rajesh Kumar Yadav',
        phone: `98${timestamp.toString().slice(-8)}`,
        licenseNumber: `MH12${timestamp.toString().slice(-8)}`,
        licenseType: 'TRANS',
        licenseExpiryDate: new Date(Date.now() + 365 * 24 * 3600 * 1000), // Valid for 1 year
        status: 'AVAILABLE'
      });
      testDriverId = driver._id;

      // Expired Driver
      const expiredDriver = await Driver.create({
        companyId: companyA._id,
        name: 'Mohan Lal Verma',
        phone: `97${timestamp.toString().slice(-8)}`,
        licenseNumber: `MH14${timestamp.toString().slice(-8)}`,
        licenseType: 'TRANS',
        licenseExpiryDate: new Date('2023-01-01'), // Expired
        status: 'AVAILABLE'
      });
      testExpiredDriverId = expiredDriver._id;
    } catch (err) {
      console.error('FATAL BEFORE ERROR:', err);
      throw err;
    }
  });

  after(async () => {
    if (server) {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      await new Promise((resolve) => server.close(resolve));
    }
    await db.disconnectDatabase();
  });

  // -------------------------------------------------------------
  // Test 1: Atomic Collision-Free Sequence Allocation
  // -------------------------------------------------------------
  test('1. Concurrently generates 20 atomic sequence IDs with zero collisions', async () => {
    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(sequenceService.getNextSequence(companyA._id, 'CONCURRENCY_TEST', 'TST'));
    }

    const results = await Promise.all(promises);

    // Verify all 20 results are unique
    const uniqueSet = new Set(results);
    assert.equal(uniqueSet.size, 20, 'Every generated sequence ID must be unique');

    // Verify format and consecutive incrementing
    const currentYear = new Date().getFullYear();
    results.forEach((seq) => {
      assert.match(seq, new RegExp(`^TST-${currentYear}-\\d{5}$`), 'Must match pattern TST-YYYY-XXXXX');
    });

    // Check Counter document in MongoDB
    const counterDoc = await Counter.findOne({
      companyId: companyA._id,
      entityType: 'CONCURRENCY_TEST',
      year: currentYear
    });
    assert.equal(counterDoc.seq, 20, 'Counter seq must equal exactly 20');
  });

  // -------------------------------------------------------------
  // Test 2: Consignment Load Creation with Integer Paise Financials
  // -------------------------------------------------------------
  test('2. Successfully creates Consignment Load with multi-stop waypoints and integer Paise financials', async () => {
    const loadPayload = {
      customerId: testCustomerId,
      consignorId: testConsignorId,
      consigneeId: testConsigneeId,
      totalWeightMt: 28.5,
      totalQuantity: 500,
      packageType: 'Bags',
      expectedDeliveryDate: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
      remarks: 'Handle with high priority, industrial grade raw materials',
      stops: [
        {
          sequence: 1,
          stopType: 'PICKUP',
          locationId: testLocationPickupId,
          allocatedQuantity: 500,
          allocatedWeightMt: 28.5,
          contactPerson: 'Harish Babu',
          contactPhone: '9811223344'
        },
        {
          sequence: 2,
          stopType: 'DELIVERY',
          locationId: testLocationDropId,
          allocatedQuantity: 500,
          allocatedWeightMt: 28.5,
          contactPerson: 'Suresh Patil',
          contactPhone: '9822334455'
        }
      ],
      financials: {
        baseFreightPaise: 5500000, // ₹55,000.00
        loadingPaise: 150000,     // ₹1,500.00
        unloadingPaise: 150000,   // ₹1,500.00
        tollPaise: 300000,        // ₹3,000.00
        detentionPaise: 0,
        handlingPaise: 0,
        miscChargePaise: 100000,  // ₹1,000.00
        advancePaise: 2000000,    // ₹20,000.00
        deductionPaise: 0
      }
    };

    const res = await fetch(`${baseUrl}/loads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify(loadPayload)
    });

    const body = await res.json();
    assert.equal(res.status, 201, 'Should create load with status 201');
    assert.equal(body.success, true);
    assert.ok(body.data._id);
    assert.match(body.data.loadNumber, /^LD-\d{4}-\d{5}$/, 'Load number must follow LD-YYYY-XXXXX');

    createdLoadId = body.data._id;
    createdLoadNumber = body.data.loadNumber;

    // Verify server-side integer calculations
    // Total Freight = 55,000 + 1,500 + 1,500 + 3,000 + 1,000 = ₹62,000.00 (6,200,000 Paise)
    assert.equal(body.data.financials.totalFreightPaise, 6200000, 'Total freight must be exactly 6,200,000 Paise');
    // Balance = 62,000 - 20,000 = ₹42,000.00 (4,200,000 Paise)
    assert.equal(body.data.financials.balancePaise, 4200000, 'Balance must be exactly 4,200,000 Paise');

    // Verify stops initialization
    assert.equal(body.data.stops.length, 2);
    assert.equal(body.data.stops[0].pendingQuantity, 500);
    assert.equal(body.data.stops[0].deliveredQuantity, 0);
  });

  // -------------------------------------------------------------
  // Test 3: Fleet Asset Assignment & Validation Enforcement
  // -------------------------------------------------------------
  test('3. Asset assignment: rejects vehicle under maintenance or driver with expired licence', async () => {
    // Attempt 1: Assign vehicle under maintenance
    const resMaint = await fetch(`${baseUrl}/loads/${createdLoadId}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({ vehicleId: testMaintVehicleId })
    });
    assert.equal(resMaint.status, 400, 'Should reject vehicle under maintenance');
    const maintBody = await resMaint.json();
    assert.match(maintBody.message, /UNDER_MAINTENANCE/i);

    // Attempt 2: Assign driver with expired licence
    const resExpired = await fetch(`${baseUrl}/loads/${createdLoadId}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({ driverId: testExpiredDriverId })
    });
    assert.equal(resExpired.status, 400, 'Should reject driver with expired licence');
    const expiredBody = await resExpired.json();
    assert.match(expiredBody.message, /licence has expired/i);

    // Attempt 3: Assign valid operational vehicle and driver
    const resValid = await fetch(`${baseUrl}/loads/${createdLoadId}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        vehicleId: testVehicleId,
        driverId: testDriverId
      })
    });
    assert.equal(resValid.status, 200, 'Valid vehicle and driver assignment should succeed');
    const validBody = await resValid.json();
    assert.equal(validBody.data.status, LoadStatus.ASSIGNED, 'Load status should advance to ASSIGNED');
  });

  // -------------------------------------------------------------
  // Test 4: State Machine Lifecycle Progression & Invalid Transition Rejection
  // -------------------------------------------------------------
  test('4. State Machine: allows valid progression and rejects illegal status transitions', async () => {
    // Current state is ASSIGNED. Valid next state is LOADING.
    const resLoading = await fetch(`${baseUrl}/loads/${createdLoadId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({ status: LoadStatus.LOADING, reason: 'Commenced loading at Jamshedpur depot' })
    });
    assert.equal(resLoading.status, 200);
    const loadingBody = await resLoading.json();
    assert.equal(loadingBody.data.status, LoadStatus.LOADING);

    // Advance to IN_TRANSIT
    const resTransit = await fetch(`${baseUrl}/loads/${createdLoadId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({ status: LoadStatus.IN_TRANSIT, reason: 'Dispatched on highway NH48' })
    });
    assert.equal(resTransit.status, 200);

    // Advance to DELIVERED
    const resDelivered = await fetch(`${baseUrl}/loads/${createdLoadId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({ status: LoadStatus.DELIVERED, reason: 'Consignee received and stamped POD' })
    });
    assert.equal(resDelivered.status, 200);

    // ILLEGAL TRANSITION: Try to move from DELIVERED backwards to CREATED
    const resIllegal = await fetch(`${baseUrl}/loads/${createdLoadId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({ status: LoadStatus.CREATED, reason: 'Attempt unauthorized reset' })
    });
    assert.equal(resIllegal.status, 400, 'Must reject invalid status rollback');
    const illegalBody = await resIllegal.json();
    assert.match(illegalBody.message, /Invalid status transition/i);
  });

  // -------------------------------------------------------------
  // Test 5: Lorry Receipt (LR) Allocation & E-Way Bill Linkage
  // -------------------------------------------------------------
  test('5. Issues Lorry Receipt (LR) with atomic numbering and rejects duplicate manual numbers', async () => {
    // 1. Auto-generate sequential LR
    const resAuto = await fetch(`${baseUrl}/lr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        loadId: createdLoadId,
        isManualNumber: false,
        eWayBillNumber: '281098765432',
        eWayBillExpiry: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString(),
        remarks: 'Direct delivery consignment'
      })
    });

    assert.equal(resAuto.status, 201, 'Should create LR successfully');
    const autoBody = await resAuto.json();
    assert.match(autoBody.data.lrNumber, /^LR-\d{4}-\d{5}$/, 'LR number must follow LR-YYYY-XXXXX');
    assert.equal(autoBody.data.status, LrStatus.BOOKED);
    assert.equal(autoBody.data.eWayBillNumber, '281098765432');

    createdLrId = autoBody.data._id;
    createdLrNumber = autoBody.data.lrNumber;

    // 2. Create manual LR with custom number
    const customLrNumber = `MANUAL-LR-${Date.now().toString().slice(-4)}`;
    const resManual = await fetch(`${baseUrl}/lr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        loadId: createdLoadId,
        isManualNumber: true,
        lrNumber: customLrNumber,
        eWayBillNumber: '281098765433'
      })
    });
    assert.equal(resManual.status, 201, 'Manual LR should be accepted');

    // 3. Attempt duplicate manual LR number -> Must fail with 409
    const resDup = await fetch(`${baseUrl}/lr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        loadId: createdLoadId,
        isManualNumber: true,
        lrNumber: customLrNumber
      })
    });
    assert.equal(resDup.status, 409, 'Duplicate manual LR number must return 409 Conflict');
    const dupBody = await resDup.json();
    assert.match(dupBody.message, /already exists/i);
  });

  // -------------------------------------------------------------
  // Test 6: Bilty Consignment Note & 5% GTA SAC 9965 Compliance
  // -------------------------------------------------------------
  test('6. Issues Bilty Consignment Note with 5% GTA SAC 9965 terms and balance calculation', async () => {
    const resBilty = await fetch(`${baseUrl}/bilties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        lrId: createdLrId,
        paymentTerms: 'TO_PAY',
        totalFreightPaise: 6200000, // ₹62,000.00
        advancePaise: 2000000,      // ₹20,000.00
        remarks: 'Payment due on delivery presentation of stamped bilty'
      })
    });

    assert.equal(resBilty.status, 201, 'Should issue Bilty successfully');
    const biltyBody = await resBilty.json();
    assert.match(biltyBody.data.biltyNumber, /^BL-\d{4}-\d{5}$/, 'Bilty number must follow BL-YYYY-XXXXX');
    assert.equal(biltyBody.data.gstGtaRate, 5.0, 'GTA tax rate must default to 5.0%');
    assert.equal(biltyBody.data.gstGtaSac, '9965', 'SAC code must default to 9965');
    assert.equal(biltyBody.data.balancePaise, 4200000, 'Balance must equal 4,200,000 Paise (₹42,000.00)');
    assert.equal(biltyBody.data.status, BiltyStatus.ISSUED);

    createdBiltyId = biltyBody.data._id;

    // Attempt to issue a second Bilty for the same LR -> Must reject with 409
    const resDupBilty = await fetch(`${baseUrl}/bilties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({ lrId: createdLrId })
    });
    assert.equal(resDupBilty.status, 409, 'Second Bilty for the same LR must return 409');
  });

  // -------------------------------------------------------------
  // Test 7: Server-Side PDF Generation Streaming Verification
  // -------------------------------------------------------------
  test('7. Streamable PDF generation: Loading Slip, LR, and Bilty return valid PDF buffers > 2KB', async () => {
    // 1. Loading Slip PDF
    const resLoadingSlip = await fetch(`${baseUrl}/loads/${createdLoadId}/loading-slip`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.equal(resLoadingSlip.status, 200);
    assert.equal(resLoadingSlip.headers.get('content-type'), 'application/pdf');
    const loadingSlipBuffer = Buffer.from(await resLoadingSlip.arrayBuffer());
    assert.ok(loadingSlipBuffer.length > 2000, 'Loading slip PDF must exceed 2000 bytes');
    assert.equal(loadingSlipBuffer.subarray(0, 4).toString(), '%PDF', 'Must start with %PDF magic header');

    // 2. Official LR PDF
    const resLrPdf = await fetch(`${baseUrl}/lr/${createdLrId}/pdf`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.equal(resLrPdf.status, 200);
    assert.equal(resLrPdf.headers.get('content-type'), 'application/pdf');
    const lrBuffer = Buffer.from(await resLrPdf.arrayBuffer());
    assert.ok(lrBuffer.length > 2000, 'LR PDF must exceed 2000 bytes');
    assert.equal(lrBuffer.subarray(0, 4).toString(), '%PDF', 'Must start with %PDF magic header');

    // 3. Consignment Bilty PDF
    const resBiltyPdf = await fetch(`${baseUrl}/bilties/${createdBiltyId}/pdf`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.equal(resBiltyPdf.status, 200);
    assert.equal(resBiltyPdf.headers.get('content-type'), 'application/pdf');
    const biltyBuffer = Buffer.from(await resBiltyPdf.arrayBuffer());
    assert.ok(biltyBuffer.length > 2000, 'Bilty PDF must exceed 2000 bytes');
    assert.equal(biltyBuffer.subarray(0, 4).toString(), '%PDF', 'Must start with %PDF magic header');
  });

  // -------------------------------------------------------------
  // Test 8: Multi-Tenant Data Isolation Enforcement
  // -------------------------------------------------------------
  test('8. Multi-tenant isolation: Competitor Company B cannot read or alter Company A loads/documents', async () => {
    // Company B attempts to read Company A's Load
    const resReadLoad = await fetch(`${baseUrl}/loads/${createdLoadId}`, {
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    assert.equal(resReadLoad.status, 404, 'Company B should get 404 on Company A load');

    // Company B attempts to read Company A's LR
    const resReadLr = await fetch(`${baseUrl}/lr/${createdLrId}`, {
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    assert.equal(resReadLr.status, 404, 'Company B should get 404 on Company A LR');

    // Company B attempts to download Company A's Bilty PDF
    const resReadBilty = await fetch(`${baseUrl}/bilties/${createdBiltyId}/pdf`, {
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    assert.equal(resReadBilty.status, 404, 'Company B should get 404 on Company A Bilty PDF');
  });

});
