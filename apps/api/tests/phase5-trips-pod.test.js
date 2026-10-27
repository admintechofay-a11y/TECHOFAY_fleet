/**
 * Comprehensive Phase 5 Integration Tests:
 * Trip Dispatch, Conflict & Compliance Engine, Waypoint Progress,
 * Over-Delivery Prevention, Proof of Delivery (POD) & Verification,
 * Route Expenses, Settlement Accounting, and PDF Generation.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const db = require('../src/config/db');
const BootstrapService = require('../src/modules/auth/services/bootstrap.service');
const CustomerParty = require('../src/modules/customers/models/CustomerParty');
const Location = require('../src/modules/locations/models/Location');
const Vehicle = require('../src/modules/vehicles/models/Vehicle');
const Driver = require('../src/modules/drivers/models/Driver');
const Load = require('../src/modules/loads/models/Load');
const Trip = require('../src/modules/trips/models/Trip');
const ProofOfDelivery = require('../src/modules/pod/models/ProofOfDelivery');
const {
  TripStatus,
  StopType,
  StopStatus,
  VehicleStatus,
  DriverStatus,
  LoadStatus,
  PodStatus,
  TripExpenseType
} = require('@fleet/shared');

let server;
let baseUrl;
let companyA;
let companyB;
let userAToken;
let userBToken;

let testLoadId;
let testVehicleId;
let testMaintVehicleId;
let testDriverId;
let testExpiredDriverId;
let testPickupLocationId;
let testDeliveryLocationId;

let createdTripId;
let createdTripNumber;
let deliveryStopId;
let createdPodId;
let createdPodNumber;

describe('Phase 5 Integration Test Suite: Trips, POD, Freight Settlement & Delivery Engine', () => {

  before(async () => {
    try {
      await db.connectDatabase();
      const timestamp = Date.now();

      // 1. Bootstrap Company A
      const bootstrapA = await BootstrapService.bootstrapSystem({
        companyLegalName: `Phase 5 Express Logistics A ${timestamp}`,
        companyGstin: `27PQRST${timestamp.toString().slice(-4)}A1Z5`,
        adminEmail: `phase5.admin.${timestamp}@company-a.com`,
        adminPassword: 'PasswordA123!',
        adminName: 'Admin Fleet A'
      });
      companyA = bootstrapA.company;

      // 2. Bootstrap Company B
      const bootstrapB = await BootstrapService.bootstrapSystem({
        companyLegalName: `Phase 5 Competitor Haulage B ${timestamp}`,
        companyGstin: `29UVWXY${timestamp.toString().slice(-4)}B1Z6`,
        adminEmail: `phase5.admin.${timestamp}@company-b.com`,
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
          email: `phase5.admin.${timestamp}@company-a.com`,
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
          email: `phase5.admin.${timestamp}@company-b.com`,
          password: 'PasswordB123!'
        })
      });
      const loginBData = await loginBRes.json();
      userBToken = loginBData.data.accessToken;

      // Create Locations for Company A
      const pickupLoc = await Location.create({
        companyId: companyA._id,
        code: `HUB-DEL-${timestamp}`,
        name: 'Delhi Logistics Central Hub',
        locationType: 'HUB',
        address: {
          city: 'Delhi',
          state: 'Delhi',
          pincode: '110001'
        }
      });
      testPickupLocationId = pickupLoc._id;

      const dropLoc = await Location.create({
        companyId: companyA._id,
        code: `WH-MUM-${timestamp}`,
        name: 'Mumbai Nhava Sheva Depot',
        locationType: 'DELIVERY',
        address: {
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001'
        }
      });
      testDeliveryLocationId = dropLoc._id;

      // Create Customer Party, Consignor, and Consignee
      const customer = await CustomerParty.create({
        companyId: companyA._id,
        name: `Tata Consumer Products ${timestamp}`,
        partyTypes: ['CUSTOMER'],
        gstin: `27AABCT${timestamp.toString().slice(-4)}A1Z1`,
        contactPerson: { name: 'Rajesh Sharma', phone: '9876543210' },
        billingAddress: { city: 'Mumbai', state: 'Maharashtra', pincode: '400001' }
      });

      const consignor = await CustomerParty.create({
        companyId: companyA._id,
        name: `Delhi Distribution Depot ${timestamp}`,
        partyTypes: ['CONSIGNOR'],
        gstin: `07AABCT${timestamp.toString().slice(-4)}B1Z2`,
        billingAddress: { city: 'Delhi', state: 'Delhi', pincode: '110001' }
      });

      const consignee = await CustomerParty.create({
        companyId: companyA._id,
        name: `Mumbai Retail Logistics ${timestamp}`,
        partyTypes: ['CONSIGNEE'],
        gstin: `27AABCT${timestamp.toString().slice(-4)}C1Z3`,
        billingAddress: { city: 'Mumbai', state: 'Maharashtra', pincode: '400001' }
      });

      // Create Vehicles
      const randPlate = Math.floor(1000 + Math.random() * 8999);
      const vehicle = await Vehicle.create({
        companyId: companyA._id,
        plateNumber: `MH12AB${randPlate}`,
        vehicleType: 'Trailer 40ft',
        capacityTonnage: 25.0,
        status: VehicleStatus.AVAILABLE
      });
      testVehicleId = vehicle._id;

      const maintVehicle = await Vehicle.create({
        companyId: companyA._id,
        plateNumber: `MH12CD${randPlate}`,
        vehicleType: 'Container 32ft',
        capacityTonnage: 15.0,
        status: VehicleStatus.UNDER_MAINTENANCE
      });
      testMaintVehicleId = maintVehicle._id;

      // Create Drivers
      const driver = await Driver.create({
        companyId: companyA._id,
        name: 'Karamjit Singh',
        phone: '9822011223',
        licenseNumber: `DL-P5-${timestamp}`,
        licenseType: 'HMV',
        licenseExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Valid for 1 year
        status: DriverStatus.AVAILABLE
      });
      testDriverId = driver._id;

      const expiredDriver = await Driver.create({
        companyId: companyA._id,
        name: 'Sardar Baldev',
        phone: '9822099887',
        licenseNumber: `DL-EXP-${timestamp}`,
        licenseType: 'HMV',
        licenseExpiryDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Expired 30 days ago
        status: DriverStatus.AVAILABLE
      });
      testExpiredDriverId = expiredDriver._id;

      // Create Consignment Load
      const load = await Load.create({
        companyId: companyA._id,
        loadNumber: `LD-2026-${Math.floor(10000 + Math.random() * 89999)}`,
        customerId: customer._id,
        consignorId: consignor._id,
        consigneeId: consignee._id,
        originLocationId: testPickupLocationId,
        destinationLocationId: testDeliveryLocationId,
        totalWeightMt: 22.5,
        totalQuantity: 200,
        packageType: 'Boxes',
        financials: {
          baseFreightPaise: 12500000, // ₹125,000.00
          totalFreightPaise: 12500000,
          advancePaise: 2500000,       // ₹25,000.00
          balancePaise: 10000000
        },
        stops: [
          {
            sequence: 1,
            stopType: StopType.PICKUP,
            locationId: testPickupLocationId,
            allocatedQuantity: 200,
            deliveredQuantity: 0,
            pendingQuantity: 200,
            status: StopStatus.COMPLETED
          },
          {
            sequence: 2,
            stopType: StopType.DELIVERY,
            locationId: testDeliveryLocationId,
            allocatedQuantity: 200,
            deliveredQuantity: 0,
            pendingQuantity: 200,
            status: StopStatus.PENDING
          }
        ],
        status: LoadStatus.CREATED
      });
      testLoadId = load._id;

    } catch (err) {
      console.error('Phase 5 Test before() failed:', err);
      throw err;
    }
  });

  after(async () => {
    if (server) {
      if (server.closeAllConnections) server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    await db.disconnectDatabase();
  });

  // -------------------------------------------------------------
  // Test 1: Trip Dispatch & Atomic Sequence Allocation
  // -------------------------------------------------------------
  test('1. Trip Dispatch: Allocates atomic TR-YYYY-XXXXX sequence and sets assets to ON_TRIP', async () => {
    const res = await fetch(`${baseUrl}/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        loadId: testLoadId,
        vehicleId: testVehicleId,
        driverId: testDriverId,
        driverAdvancePaise: 3000000, // ₹30,000.00
        remarks: 'Handle with extreme care. Keep transit speed under 60km/h.'
      })
    });

    const data = await res.json();
    assert.equal(res.status, 201);
    assert.equal(data.success, true);
    assert.ok(data.data._id);
    assert.match(data.data.tripNumber, /^TR-\d{4}-\d{5}$/, 'Trip number must match TR-YYYY-XXXXX');

    createdTripId = data.data._id;
    createdTripNumber = data.data.tripNumber;

    // Check financial initialization in integer Paise
    assert.equal(data.data.financials.grossFreightPaise, 12500000);
    assert.equal(data.data.financials.driverAdvancePaise, 3000000);
    assert.equal(data.data.financials.totalExpensesPaise, 0);
    assert.equal(data.data.financials.netSettlementPaise, 9500000); // 125,000 - 30,000

    // Capture delivery stop ID
    const delStop = data.data.stops.find((s) => s.stopType === StopType.DELIVERY);
    assert.ok(delStop, 'Must have a delivery stop copied from Load');
    deliveryStopId = delStop._id;

    // Verify Vehicle and Driver status in DB transitioned to ON_TRIP
    const updatedVehicle = await Vehicle.findById(testVehicleId);
    assert.equal(updatedVehicle.status, VehicleStatus.ON_TRIP);

    const updatedDriver = await Driver.findById(testDriverId);
    assert.equal(updatedDriver.status, DriverStatus.ON_TRIP);

    // Verify Load transitioned to ASSIGNED
    const updatedLoad = await Load.findById(testLoadId);
    assert.equal(updatedLoad.status, LoadStatus.ASSIGNED);
  });

  // -------------------------------------------------------------
  // Test 2: Asset Conflict & Compliance Blockers
  // -------------------------------------------------------------
  test('2. Asset Conflict & Compliance: Rejects double-booking and non-compliant assets', async () => {
    // A. Vehicle Conflict Check: Attempting to assign vehicle already on active trip
    const resVehConflict = await fetch(`${baseUrl}/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        loadId: testLoadId,
        vehicleId: testVehicleId, // Already on createdTrip
        driverId: testDriverId,
        driverAdvancePaise: 1000000
      })
    });
    const vehConflictData = await resVehConflict.json();
    assert.equal(resVehConflict.status, 400);
    assert.match(vehConflictData.message, /already assigned to active Trip/i);

    // B. Maintenance Vehicle Blocker: Attempting to assign vehicle UNDER_MAINTENANCE
    const resMaint = await fetch(`${baseUrl}/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        loadId: testLoadId,
        vehicleId: testMaintVehicleId,
        driverId: testDriverId,
        driverAdvancePaise: 1000000
      })
    });
    const maintData = await resMaint.json();
    assert.equal(resMaint.status, 400);
    assert.match(maintData.message, /UNDER_MAINTENANCE/i);

    // C. Expired Licence Blocker: Attempting to assign driver with expired licence
    const randPlate2 = Math.floor(1000 + Math.random() * 8999);
    const freshVehicle = await Vehicle.create({
      companyId: companyA._id,
      plateNumber: `MH14EE${randPlate2}`,
      vehicleType: 'Truck 20ft',
      capacityTonnage: 10.0,
      status: VehicleStatus.AVAILABLE
    });

    const resExpiredDriver = await fetch(`${baseUrl}/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        loadId: testLoadId,
        vehicleId: freshVehicle._id,
        driverId: testExpiredDriverId, // Licence expired
        driverAdvancePaise: 1000000
      })
    });
    const expiredDriverData = await resExpiredDriver.json();
    assert.equal(resExpiredDriver.status, 400);
    assert.match(expiredDriverData.message, /expired/i);
  });

  // -------------------------------------------------------------
  // Test 3: Trip State Machine Lifecycle Transitions
  // -------------------------------------------------------------
  test('3. State Machine: Enforces valid progression and rejects invalid transitions', async () => {
    // Current status is VEHICLE_ASSIGNED.
    // Invalid transition: Jump directly from VEHICLE_ASSIGNED to CLOSED
    const resInvalid = await fetch(`${baseUrl}/trips/${createdTripId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({ status: TripStatus.CLOSED })
    });
    const invalidData = await resInvalid.json();
    assert.equal(resInvalid.status, 400);
    assert.match(invalidData.message, /Invalid status transition/i);

    // Valid transition 1: VEHICLE_ASSIGNED -> LOADING
    const resLoading = await fetch(`${baseUrl}/trips/${createdTripId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({ status: TripStatus.LOADING, reason: 'Commencing warehouse loading' })
    });
    assert.equal(resLoading.status, 200);

    // Valid transition 2: LOADING -> IN_TRANSIT
    const resInTransit = await fetch(`${baseUrl}/trips/${createdTripId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({ status: TripStatus.IN_TRANSIT, reason: 'Vehicle dispatched on national highway' })
    });
    const inTransitData = await resInTransit.json();
    assert.equal(resInTransit.status, 200);
    assert.equal(inTransitData.data.status, TripStatus.IN_TRANSIT);

    // Underlying Load should now also be IN_TRANSIT
    const loadCheck = await Load.findById(testLoadId);
    assert.equal(loadCheck.status, LoadStatus.IN_TRANSIT);
  });

  // -------------------------------------------------------------
  // Test 4: Waypoint Delivery Recording & Strict Over-Delivery Prevention
  // -------------------------------------------------------------
  test('4. Waypoint Delivery: Prevents over-delivery and reconciles pending quantities', async () => {
    // Total allocated at delivery stop is 200 Pkgs.
    // A. Over-delivery attempt: Try delivering 250 Pkgs
    const resOver = await fetch(`${baseUrl}/trips/${createdTripId}/stops/${deliveryStopId}/deliver`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        deliveredQuantity: 250,
        receiverName: 'Ramesh Store Keeper'
      })
    });
    const overData = await resOver.json();
    assert.equal(resOver.status, 400);
    assert.match(overData.message, /exceeds pending quantity/i);

    // B. Partial delivery: Deliver 80 Pkgs
    const resPartial = await fetch(`${baseUrl}/trips/${createdTripId}/stops/${deliveryStopId}/deliver`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        deliveredQuantity: 80,
        receiverName: 'Ramesh Store Keeper',
        receiverPhone: '9876543210',
        remarks: 'Partially unloaded batch 1'
      })
    });
    const partialData = await resPartial.json();
    assert.equal(resPartial.status, 200);
    const stopPartial = partialData.data.stops.find((s) => s._id === deliveryStopId);
    assert.equal(stopPartial.deliveredQuantity, 80);
    assert.equal(stopPartial.pendingQuantity, 120);
    assert.equal(partialData.data.status, TripStatus.PARTIALLY_DELIVERED);

    // C. Complete delivery: Deliver remaining 120 Pkgs
    const resComplete = await fetch(`${baseUrl}/trips/${createdTripId}/stops/${deliveryStopId}/deliver`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        deliveredQuantity: 120,
        receiverName: 'Ramesh Store Keeper',
        receiverPhone: '9876543210',
        remarks: 'Complete consignment received in sound condition'
      })
    });
    const completeData = await resComplete.json();
    assert.equal(resComplete.status, 200);
    const stopCompleted = completeData.data.stops.find((s) => s._id === deliveryStopId);
    assert.equal(stopCompleted.deliveredQuantity, 200);
    assert.equal(stopCompleted.pendingQuantity, 0);
    assert.equal(stopCompleted.status, StopStatus.COMPLETED);
    assert.equal(completeData.data.status, TripStatus.DELIVERED);
  });

  // -------------------------------------------------------------
  // Test 5: Proof of Delivery (POD) Upload, Streaming & Supervisor Verification
  // -------------------------------------------------------------
  test('5. Proof of Delivery: Secure upload, authenticated download, and supervisor sign-off', async () => {
    // Create a mock POD image buffer with authentic JPEG magic bytes
    const mockFileBuffer = Buffer.concat([
      Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00]),
      Buffer.from('POD_CONSIGNMENT_RECEIPT_IMAGE_DATA_BYTES_12345')
    ]);
    const boundary = '----WebKitFormBoundaryPhase5PodTest';

    let body = `--${boundary}\r\n`;
    body += 'Content-Disposition: form-data; name="tripId"\r\n\r\n';
    body += `${createdTripId}\r\n`;

    body += `--${boundary}\r\n`;
    body += 'Content-Disposition: form-data; name="receiverName"\r\n\r\n';
    body += 'Ramesh Store Keeper\r\n';

    body += `--${boundary}\r\n`;
    body += 'Content-Disposition: form-data; name="receiverPhone"\r\n\r\n';
    body += '9876543210\r\n';

    body += `--${boundary}\r\n`;
    body += 'Content-Disposition: form-data; name="quantityDelivered"\r\n\r\n';
    body += '200\r\n';

    body += `--${boundary}\r\n`;
    body += 'Content-Disposition: form-data; name="remarks"\r\n\r\n';
    body += 'Signed with official warehouse rubber stamp\r\n';

    body += `--${boundary}\r\n`;
    body += 'Content-Disposition: form-data; name="file"; filename="signed_pod_receipt.jpg"\r\n';
    body += 'Content-Type: image/jpeg\r\n\r\n';

    const payloadBuffer = Buffer.concat([
      Buffer.from(body, 'utf-8'),
      mockFileBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8')
    ]);

    // A. Upload POD via Multipart Form
    const resUpload = await fetch(`${baseUrl}/pod`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        Authorization: `Bearer ${userAToken}`
      },
      body: payloadBuffer
    });

    const uploadData = await resUpload.json();
    assert.equal(resUpload.status, 201);
    assert.equal(uploadData.success, true);
    assert.ok(uploadData.data._id);
    assert.match(uploadData.data.podNumber, /^POD-\d{4}-\d{5}$/, 'POD number format must be POD-YYYY-XXXXX');
    assert.equal(uploadData.data.status, PodStatus.PENDING_VERIFICATION);

    createdPodId = uploadData.data._id;
    createdPodNumber = uploadData.data.podNumber;

    // B. Authenticated stream retrieval of POD document
    const resDownload = await fetch(`${baseUrl}/pod/${createdPodId}/download`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.equal(resDownload.status, 200);
    assert.equal(resDownload.headers.get('content-type'), 'image/jpeg');
    const downloadedBuffer = Buffer.from(await resDownload.arrayBuffer());
    assert.deepEqual(downloadedBuffer, mockFileBuffer);

    // C. Supervisor Verification Sign-Off
    const resVerify = await fetch(`${baseUrl}/pod/${createdPodId}/verify`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        status: PodStatus.VERIFIED,
        remarks: 'Physical stamp verified against consignee signature record'
      })
    });
    const verifyData = await resVerify.json();
    assert.equal(resVerify.status, 200);
    assert.equal(verifyData.data.status, PodStatus.VERIFIED);
    assert.ok(verifyData.data.verifiedBySupervisor);
    assert.ok(verifyData.data.verifiedAt);
  });

  // -------------------------------------------------------------
  // Test 6: Route Expenses Tracking & Financial Settlement Accounting
  // -------------------------------------------------------------
  test('6. Route Expenses & Settlement: Records line-item expenses and computes net balance', async () => {
    // Add Diesel Expense: ₹12,000.00 (1,200,000 Paise)
    const resDiesel = await fetch(`${baseUrl}/trips/${createdTripId}/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        expenseType: TripExpenseType.DIESEL,
        amountPaise: 1200000,
        description: 'IOCL Jaipur Highway Fuel',
        paidBy: 'DRIVER'
      })
    });
    assert.equal(resDiesel.status, 201);

    // Add FASTag Toll Expense: ₹3,500.00 (350,000 Paise)
    const resToll = await fetch(`${baseUrl}/trips/${createdTripId}/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        expenseType: TripExpenseType.TOLL,
        amountPaise: 350000,
        description: 'Jaipur-Udaipur FASTag Toll Plazas',
        paidBy: 'COMPANY'
      })
    });
    assert.equal(resToll.status, 201);

    // Add Driver Bhatta: ₹2,000.00 (200,000 Paise)
    const resBhatta = await fetch(`${baseUrl}/trips/${createdTripId}/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        expenseType: TripExpenseType.DRIVER_BHATTA,
        amountPaise: 200000,
        description: 'Driver route food allowance',
        paidBy: 'DRIVER'
      })
    });
    const bhattaData = await resBhatta.json();
    assert.equal(resBhatta.status, 201);

    // Check financial totals in Paise:
    // Gross: 12,500,000
    // Driver Advance: 3,000,000
    // Total Expenses: 1,200,000 + 350,000 + 200,000 = 1,750,000
    // Net Settlement: 12,500,000 - 3,000,000 - 1,750,000 = 7,750,000
    assert.equal(bhattaData.data.financials.totalExpensesPaise, 1750000);
    assert.equal(bhattaData.data.financials.netSettlementPaise, 7750000);
  });

  // -------------------------------------------------------------
  // Test 7: Strict Trip Closure Gate & Asset Release
  // -------------------------------------------------------------
  test('7. Trip Closure: Requires completed stops + verified POD; releases assets to AVAILABLE', async () => {
    // Attempt closure on valid trip
    const resClose = await fetch(`${baseUrl}/trips/${createdTripId}/close`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userAToken}`
      }
    });

    const closeData = await resClose.json();
    assert.equal(resClose.status, 200);
    assert.equal(closeData.data.status, TripStatus.CLOSED);
    assert.ok(closeData.data.actualEndDateTime);

    // Verify Vehicle returned to AVAILABLE
    const releasedVehicle = await Vehicle.findById(testVehicleId);
    assert.equal(releasedVehicle.status, VehicleStatus.AVAILABLE);

    // Verify Driver returned to AVAILABLE
    const releasedDriver = await Driver.findById(testDriverId);
    assert.equal(releasedDriver.status, DriverStatus.AVAILABLE);

    // Verify Load transitioned to CLOSED
    const closedLoad = await Load.findById(testLoadId);
    assert.equal(closedLoad.status, LoadStatus.CLOSED);
  });

  // -------------------------------------------------------------
  // Test 8: Server-Side PDF Streaming (Trip Sheet & Financial Settlement)
  // -------------------------------------------------------------
  test('8. PDF Generation: Streams valid Trip Sheet and Financial Settlement PDFs (>2KB, %PDF header)', async () => {
    // 1. Trip Sheet PDF
    const resTripSheet = await fetch(`${baseUrl}/trips/${createdTripId}/tripsheet`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.equal(resTripSheet.status, 200);
    assert.equal(resTripSheet.headers.get('content-type'), 'application/pdf');
    const tripSheetBuffer = Buffer.from(await resTripSheet.arrayBuffer());
    assert.ok(tripSheetBuffer.length > 2000, 'Trip Sheet PDF must exceed 2000 bytes');
    assert.equal(tripSheetBuffer.subarray(0, 4).toString(), '%PDF', 'Must start with %PDF magic header');

    // 2. Settlement Statement PDF
    const resSettlement = await fetch(`${baseUrl}/trips/${createdTripId}/settlement`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.equal(resSettlement.status, 200);
    assert.equal(resSettlement.headers.get('content-type'), 'application/pdf');
    const settlementBuffer = Buffer.from(await resSettlement.arrayBuffer());
    assert.ok(settlementBuffer.length > 2000, 'Settlement PDF must exceed 2000 bytes');
    assert.equal(settlementBuffer.subarray(0, 4).toString(), '%PDF', 'Must start with %PDF magic header');
  });

  // -------------------------------------------------------------
  // Test 9: Multi-Tenant Data Isolation Enforcement
  // -------------------------------------------------------------
  test('9. Multi-tenant isolation: Competitor Company B cannot read or alter Company A trips or PODs', async () => {
    // Company B attempts to read Company A's Trip
    const resReadTrip = await fetch(`${baseUrl}/trips/${createdTripId}`, {
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    assert.equal(resReadTrip.status, 404, 'Company B should get 404 on Company A trip');

    // Company B attempts to close Company A's Trip
    const resCloseTrip = await fetch(`${baseUrl}/trips/${createdTripId}/close`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    assert.equal(resCloseTrip.status, 404, 'Company B should get 404 when attempting to close Company A trip');

    // Company B attempts to download Company A's POD
    const resReadPod = await fetch(`${baseUrl}/pod/${createdPodId}/download`, {
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    assert.equal(resReadPod.status, 404, 'Company B should get 404 on Company A POD document');
  });

});
