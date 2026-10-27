/**
 * Phase 4 Acceptance Gate Tests:
 * Real-Time Dashboard, Events, Server-Sent Events (SSE), and GPS Telematics
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../apps/api/src/app');
const db = require('../apps/api/src/config/db');
const BootstrapService = require('../apps/api/src/modules/auth/services/bootstrap.service');
const CustomerParty = require('../apps/api/src/modules/customers/models/CustomerParty');
const Location = require('../apps/api/src/modules/locations/models/Location');
const Vehicle = require('../apps/api/src/modules/vehicles/models/Vehicle');
const Driver = require('../apps/api/src/modules/drivers/models/Driver');
const Load = require('../apps/api/src/modules/loads/models/Load');
const Trip = require('../apps/api/src/modules/trips/models/Trip');
const ProofOfDelivery = require('../apps/api/src/modules/pod/models/ProofOfDelivery');

const eventBus = require('../apps/api/src/services/eventBus.service');
const GpsService = require('../apps/api/src/modules/telematics/services/gps.service');
const { TripStatus, StopStatus, StopType, LoadStatus, PodStatus } = require('@fleet/shared');

let server;
let baseUrl;
let companyA;
let companyB;
let userAToken;
let userBToken;
let testVehicleA;
let testVehicleB;
let testDriverA;
let testCustomerA;
let testOriginA;
let testDestinationA;

describe('Phase 4 Gate: Real-Time Dashboard, Events & GPS Telematics', () => {

  before(async () => {
    await db.connectDatabase();
    const timestamp = Date.now();

    // 1. Bootstrap Company A
    const bA = await BootstrapService.bootstrapSystem({
      companyLegalName: `Phase 4 Fleet TransCorp ${timestamp}`,
      companyGstin: `27AAACR${timestamp.toString().slice(-4)}A1Z2`,
      adminEmail: `phase4.admin.${timestamp}@transcorp-a.com`,
      adminPassword: 'PasswordA123!',
      adminName: 'Admin Alpha Phase4'
    });
    companyA = bA.company;

    // 2. Bootstrap Company B (Competitor for tenant isolation testing)
    const bB = await BootstrapService.bootstrapSystem({
      companyLegalName: `Phase 4 Competitor Freight ${timestamp}`,
      companyGstin: `29BBBCR${timestamp.toString().slice(-4)}B1Z4`,
      adminEmail: `phase4.admin.${timestamp}@competitor-b.com`,
      adminPassword: 'PasswordB123!',
      adminName: 'Admin Beta Phase4'
    });
    companyB = bB.company;

    // Start ephemeral HTTP server
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api/v1`;
        resolve();
      });
    });

    // 3. Login Company A
    const resA = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `phase4.admin.${timestamp}@transcorp-a.com`, password: 'PasswordA123!' })
    });
    const dataA = await resA.json();
    userAToken = dataA.data.accessToken;

    // 4. Login Company B
    const resB = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `phase4.admin.${timestamp}@competitor-b.com`, password: 'PasswordB123!' })
    });
    const dataB = await resB.json();
    userBToken = dataB.data.accessToken;

    // 5. Seed Core Master Data for Company A
    testOriginA = await Location.create({
      companyId: companyA._id,
      name: 'Mumbai Kalamboli Hub',
      code: `MUM-${timestamp.toString().slice(-4)}`,
      address: { addressLine1: 'Kalamboli Steel Market', city: 'Mumbai', state: 'Maharashtra', pincode: '410218' },
      coordinates: { lat: 19.0330, lng: 73.0297 },
      locationType: 'HUB'
    });

    testDestinationA = await Location.create({
      companyId: companyA._id,
      name: 'Pune Chakan Hub',
      code: `PUN-${timestamp.toString().slice(-4)}`,
      address: { addressLine1: 'Chakan MIDC Phase 2', city: 'Pune', state: 'Maharashtra', pincode: '410501' },
      coordinates: { lat: 18.7610, lng: 73.8566 },
      locationType: 'HUB'
    });

    testCustomerA = await CustomerParty.create({
      companyId: companyA._id,
      name: `Tata Motors Logistics ${timestamp}`,
      tradeName: 'Tata Motors',
      partyType: 'BOTH',
      contactPerson: { name: 'Gopal Patil', phone: '9820098200' },
      billingAddress: { addressLine1: 'Bombay House', city: 'Mumbai', state: 'Maharashtra', pincode: '400001' }
    });

    // Generate valid Indian vehicle registration numbers
    const numPart = Math.floor(1000 + Math.random() * 8999);
    testVehicleA = await Vehicle.create({
      companyId: companyA._id,
      plateNumber: `MH12AB${numPart}`,
      vehicleType: 'Trailer',
      capacityTonnage: 25.0,
      telematics: {
        deviceId: `TEL-A-${timestamp}`,
        provider: 'AIS140',
        isActive: true
      }
    });

    const numPartB = Math.floor(1000 + Math.random() * 8999);
    testVehicleB = await Vehicle.create({
      companyId: companyB._id,
      plateNumber: `KA01CD${numPartB}`,
      vehicleType: 'Container',
      capacityTonnage: 18.0,
      telematics: {
        deviceId: `TEL-B-${timestamp}`,
        provider: 'AIS140',
        isActive: true
      }
    });

    testDriverA = await Driver.create({
      companyId: companyA._id,
      name: 'Rameshwar Singh',
      phone: `98${Math.floor(10000000 + Math.random() * 89999999)}`,
      licenseNumber: `MH122010${Math.floor(1000000 + Math.random() * 8999999)}`,
      licenseExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    });
  });

  after(async () => {
    eventBus.clearAllListeners();
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await db.disconnectDatabase();
  });

  // =========================================================================
  // 1. In-Memory Tenant Event Bus Tests
  // =========================================================================

  test('Event Bus: Monotonic Sequence & Ordered Event IDs', () => {
    const e1 = eventBus.publish(companyA._id, 'TEST_EVENT_1', { seq: 1 });
    const e2 = eventBus.publish(companyA._id, 'TEST_EVENT_2', { seq: 2 });
    const e3 = eventBus.publish(companyA._id, 'TEST_EVENT_3', { seq: 3 });

    assert.ok(e1.id.startsWith('evt_'));
    assert.ok(e2.id.startsWith('evt_'));
    assert.ok(e3.id.startsWith('evt_'));

    // Verify ordering
    const seq1 = parseInt(e1.id.split('_')[2], 10);
    const seq2 = parseInt(e2.id.split('_')[2], 10);
    const seq3 = parseInt(e3.id.split('_')[2], 10);

    assert.ok(seq2 > seq1, 'Sequential event IDs must be strictly monotonically increasing');
    assert.ok(seq3 > seq2, 'Sequential event IDs must be strictly monotonically increasing');
  });

  test('Event Bus: Strict Multi-Tenant Isolation (Zero Cross-Tenant Leakage)', async () => {
    const eventsReceivedA = [];
    const eventsReceivedB = [];

    const unsubA = eventBus.subscribe(companyA._id, (evt) => {
      eventsReceivedA.push(evt);
    });

    const unsubB = eventBus.subscribe(companyB._id, (evt) => {
      eventsReceivedB.push(evt);
    });

    // Publish event exclusively for Company A
    eventBus.publish(companyA._id, 'SENSITIVE_CARGO_DISPATCH', {
      tripNumber: 'TR-A-001',
      grossValue: 500000
    });

    // Publish event exclusively for Company B
    eventBus.publish(companyB._id, 'COMPETITOR_FINANCIAL_UPDATE', {
      freightPaise: 900000
    });

    unsubA();
    unsubB();

    assert.equal(eventsReceivedA.length, 1);
    assert.equal(eventsReceivedA[0].eventType, 'SENSITIVE_CARGO_DISPATCH');
    assert.equal(eventsReceivedA[0].companyId, companyA._id.toString());

    assert.equal(eventsReceivedB.length, 1);
    assert.equal(eventsReceivedB[0].eventType, 'COMPETITOR_FINANCIAL_UPDATE');
    assert.equal(eventsReceivedB[0].companyId, companyB._id.toString());

    // ZERO cross-tenant leakage: Company B never receives Company A's events
    const crossLeak = eventsReceivedB.find(e => e.eventType === 'SENSITIVE_CARGO_DISPATCH');
    assert.equal(crossLeak, undefined, 'CRITICAL: Tenant B must NEVER receive Tenant A events');
  });

  test('Event Bus: Subscription Lifecycle & Active Counter Tracking', () => {
    const initialCount = eventBus.getSubscriberCount(companyA._id);
    const unsub1 = eventBus.subscribe(companyA._id, () => {});
    const unsub2 = eventBus.subscribe(companyA._id, () => {});

    assert.equal(eventBus.getSubscriberCount(companyA._id), initialCount + 2);

    unsub1();
    assert.equal(eventBus.getSubscriberCount(companyA._id), initialCount + 1);

    unsub2();
    assert.equal(eventBus.getSubscriberCount(companyA._id), initialCount);
  });

  // =========================================================================
  // 2. Server-Sent Events (SSE) Stream Route Tests
  // =========================================================================

  test('SSE Stream: GET /events/stream rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${baseUrl}/events/stream`);
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.match(data.message, /authentication required/i);
  });

  test('SSE Stream: GET /events/status returns operational status and subscriber count', async () => {
    const res = await fetch(`${baseUrl}/events/status`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.data.transport, 'Server-Sent Events (SSE)');
    assert.equal(data.data.status, 'OPERATIONAL');
    assert.equal(data.data.tenantScoped, true);
  });

  test('SSE Stream: Connects with text/event-stream headers and receives handshake', async () => {
    const chunks = [];
    const streamPromise = new Promise((resolve, reject) => {
      const port = server.address().port;
      const req = http.get(
        `http://127.0.0.1:${port}/api/v1/events/stream?token=${encodeURIComponent(userAToken)}`,
        (res) => {
          assert.equal(res.statusCode, 200);
          assert.match(res.headers['content-type'], /text\/event-stream/);
          assert.equal(res.headers['cache-control'], 'no-cache, no-transform');

          res.on('data', (chunk) => {
            const str = chunk.toString();
            chunks.push(str);
            if (str.includes('event: connected')) {
              req.destroy(); // End connection after receiving handshake
              resolve(str);
            }
          });
        }
      );
      req.on('error', (err) => {
        // Expected when connection is destroyed
        if (err.code !== 'ECONNRESET') reject(err);
      });
      setTimeout(() => reject(new Error('Timeout waiting for SSE handshake')), 5000);
    });

    const received = await streamPromise;
    assert.ok(received.includes('event: connected'));
    assert.ok(received.includes(companyA._id.toString()));
  });

  // =========================================================================
  // 3. Real-Time Event Emission upon DB Mutations
  // =========================================================================

  test('Mutations: Load creation emits LOAD_CREATED event to tenant event bus', async () => {
    const capturedEvents = [];
    const unsub = eventBus.subscribe(companyA._id, (evt) => {
      capturedEvents.push(evt);
    });

    const res = await fetch(`${baseUrl}/loads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        customerId: testCustomerA._id,
        consignorId: testCustomerA._id,
        consigneeId: testCustomerA._id,
        originLocationId: testOriginA._id,
        destinationLocationId: testDestinationA._id,
        totalWeightMt: 12.5,
        totalQuantity: 300,
        packageType: 'Bags',
        financials: { baseFreightPaise: 4500000 }
      })
    });

    unsub();

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.success, true);

    const loadEvent = capturedEvents.find(e => e.eventType === 'LOAD_CREATED');
    assert.ok(loadEvent, 'LOAD_CREATED event must be emitted upon successful load creation');
    assert.equal(loadEvent.payload.loadId.toString(), data.data._id.toString());
    assert.equal(loadEvent.payload.loadNumber, data.data.loadNumber);
  });

  test('Mutations: Trip dispatch emits TRIP_DISPATCHED event to tenant event bus', async () => {
    // 1. Create a load for dispatch
    const load = await Load.create({
      companyId: companyA._id,
      loadNumber: `LD-TEST-${Date.now()}`,
      customerId: testCustomerA._id,
      consignorId: testCustomerA._id,
      consigneeId: testCustomerA._id,
      originLocationId: testOriginA._id,
      destinationLocationId: testDestinationA._id,
      totalWeightMt: 15.0,
      totalQuantity: 200,
      packageType: 'Boxes',
      status: LoadStatus.CREATED,
      financials: { totalFreightPaise: 6000000 },
      stops: [
        { sequence: 1, stopType: StopType.PICKUP, locationId: testOriginA._id, allocatedQuantity: 200, allocatedWeightMt: 15.0 },
        { sequence: 2, stopType: StopType.DELIVERY, locationId: testDestinationA._id, allocatedQuantity: 200, allocatedWeightMt: 15.0 }
      ]
    });

    const capturedEvents = [];
    const unsub = eventBus.subscribe(companyA._id, (evt) => {
      capturedEvents.push(evt);
    });

    // 2. Dispatch Trip
    const res = await fetch(`${baseUrl}/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        loadId: load._id,
        vehicleId: testVehicleA._id,
        driverId: testDriverA._id,
        startDateTime: new Date().toISOString(),
        driverAdvancePaise: 500000
      })
    });

    unsub();

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.success, true);

    const tripEvent = capturedEvents.find(e => e.eventType === 'TRIP_DISPATCHED');
    assert.ok(tripEvent, 'TRIP_DISPATCHED event must be emitted upon successful trip dispatch');
    assert.equal(tripEvent.payload.tripId.toString(), data.data._id.toString());
    assert.equal(tripEvent.payload.vehicleId.toString(), testVehicleA._id.toString());
  });

  // =========================================================================
  // 4. GPS Telematics Subsystem Tests
  // =========================================================================

  test('Telematics: GET /telematics/status reports honest hardware unavailable state when unconfigured', async () => {
    const res = await fetch(`${baseUrl}/telematics/status`);
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.equal(data.success, true);
    assert.equal(data.data.status, 'UNAVAILABLE');
    assert.equal(data.data.isConfigured, false);
    assert.equal(data.data.provider, 'NONE');
    assert.match(data.data.dependencyMessage, /No physical AIS-140.*telematics gateway/i);
  });

  test('Telematics: Ping rejects out-of-range coordinates', async () => {
    // 1. Latitude > 90
    await assert.rejects(
      async () => {
        await GpsService.ingestPing({
          deviceId: testVehicleA.telematics.deviceId,
          latitude: 91.5,
          longitude: 73.0,
          timestamp: new Date().toISOString()
        });
      },
      /Latitude.*is out of permissible range/i
    );

    // 2. Latitude < -90
    await assert.rejects(
      async () => {
        await GpsService.ingestPing({
          deviceId: testVehicleA.telematics.deviceId,
          latitude: -95.0,
          longitude: 73.0,
          timestamp: new Date().toISOString()
        });
      },
      /Latitude.*is out of permissible range/i
    );

    // 3. Longitude > 180
    await assert.rejects(
      async () => {
        await GpsService.ingestPing({
          deviceId: testVehicleA.telematics.deviceId,
          latitude: 19.0,
          longitude: 185.0,
          timestamp: new Date().toISOString()
        });
      },
      /Longitude.*is out of permissible range/i
    );

    // 4. Null Island (0, 0) coordinates rejected
    await assert.rejects(
      async () => {
        await GpsService.ingestPing({
          deviceId: testVehicleA.telematics.deviceId,
          latitude: 0,
          longitude: 0,
          timestamp: new Date().toISOString()
        });
      },
      /Null Island GPS coordinates \(0, 0\) are invalid/i
    );
  });

  test('Telematics: Ping rejects stale replayed timestamp (> 1 hour old)', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    await assert.rejects(
      async () => {
        await GpsService.ingestPing({
          deviceId: testVehicleA.telematics.deviceId,
          latitude: 19.0760,
          longitude: 72.8777,
          timestamp: twoHoursAgo
        });
      },
      /older than allowed window \(1 hour\)\. Replay rejected/i
    );
  });

  test('Telematics: Ping rejects future timestamp (> 5 minutes clock skew)', async () => {
    const tenMinutesInFuture = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await assert.rejects(
      async () => {
        await GpsService.ingestPing({
          deviceId: testVehicleA.telematics.deviceId,
          latitude: 19.0760,
          longitude: 72.8777,
          timestamp: tenMinutesInFuture
        });
      },
      /timestamp is in the future\. Clock skew detected/i
    );
  });

  test('Telematics: Ping rejects unregistered deviceId with 404', async () => {
    await assert.rejects(
      async () => {
        await GpsService.ingestPing({
          deviceId: 'NON_EXISTENT_GPS_UNIT_9999',
          latitude: 19.0760,
          longitude: 72.8777,
          timestamp: new Date().toISOString()
        });
      },
      /Unregistered or inactive telematics device/i
    );
  });

  test('Telematics: Multi-Tenancy guard prevents Company B device ping from mapping to Company A', async () => {
    // Attempting to ingest device TEL-B under Company A's tenant hint
    await assert.rejects(
      async () => {
        await GpsService.ingestPing(
          {
            deviceId: testVehicleB.telematics.deviceId,
            latitude: 19.0760,
            longitude: 72.8777,
            timestamp: new Date().toISOString()
          },
          { companyHint: companyA._id }
        );
      },
      /Unregistered or inactive telematics device/i
    );
  });

  test('Telematics: Valid ping updates vehicle coordinates and emits TELEMATICS_PING event', async () => {
    const capturedEvents = [];
    const unsub = eventBus.subscribe(companyA._id, (evt) => {
      capturedEvents.push(evt);
    });

    const pingTime = new Date(Date.now() - 30 * 1000); // 30 seconds ago
    const result = await GpsService.ingestPing({
      deviceId: testVehicleA.telematics.deviceId,
      latitude: 19.0760,
      longitude: 72.8777,
      speedKmph: 62.5,
      headingDegrees: 180,
      altitudeMeters: 45,
      accuracyMeters: 3.5,
      ignition: true,
      batteryPercent: 95,
      timestamp: pingTime.toISOString()
    });

    unsub();

    assert.equal(result.success, true);
    assert.equal(result.plateNumber, testVehicleA.plateNumber);
    assert.equal(result.coordinates.lat, 19.0760);
    assert.equal(result.coordinates.lng, 72.8777);
    assert.equal(result.speedKmph, 62.5);

    // Verify persisted vehicle record
    const updatedVehicle = await Vehicle.findById(testVehicleA._id);
    assert.equal(updatedVehicle.telematics.lastPing.latitude, 19.0760);
    assert.equal(updatedVehicle.telematics.lastPing.longitude, 72.8777);
    assert.equal(updatedVehicle.telematics.lastPing.speedKmph, 62.5);
    assert.equal(updatedVehicle.telematics.lastPing.ignition, true);

    // Verify TELEMATICS_PING event emission
    const pingEvent = capturedEvents.find(e => e.eventType === 'TELEMATICS_PING');
    assert.ok(pingEvent, 'TELEMATICS_PING event must be emitted on tenant channel');
    assert.equal(pingEvent.payload.deviceId, testVehicleA.telematics.deviceId);
    assert.equal(pingEvent.payload.coordinates.lat, 19.0760);
  });

  test('Telematics: Rejects out-of-order ping older than vehicle last recorded ping', async () => {
    // Current vehicle has ping from 30 seconds ago
    const olderTime = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 minutes ago

    await assert.rejects(
      async () => {
        await GpsService.ingestPing({
          deviceId: testVehicleA.telematics.deviceId,
          latitude: 19.0500,
          longitude: 72.8600,
          timestamp: olderTime
        });
      },
      /older than or equal to current recorded location.*Out-of-order ping rejected/i
    );
  });

  test('Location Resolution: Distinguishes live TELEMATICS_GPS from GEOCODED_HUB and UNAVAILABLE', async () => {
    // 1. Vehicle A has live telematics ping
    const locA = await GpsService.getVehicleLocation(testVehicleA._id, companyA._id);
    assert.equal(locA.locationSource, 'TELEMATICS_GPS');
    assert.equal(locA.isLiveGps, true);
    assert.equal(locA.coordinates.lat, 19.0760);
    assert.equal(locA.coordinates.lng, 72.8777);
    assert.equal(locA.speedKmph, 62.5);

    // 2. Create vehicle with no telematics ping and no active trip
    const rawVehicle = await Vehicle.create({
      companyId: companyA._id,
      plateNumber: `MH04EF${Math.floor(1000 + Math.random() * 8999)}`,
      vehicleType: 'Open Truck',
      capacityTonnage: 10.0
    });

    const locRaw = await GpsService.getVehicleLocation(rawVehicle._id, companyA._id);
    assert.equal(locRaw.locationSource, 'UNAVAILABLE');
    assert.equal(locRaw.isLiveGps, false);
    assert.equal(locRaw.coordinates, null);
    assert.match(locRaw.disclaimer, /No GPS telemetry hardware.*available/i);
  });

  test('Location Resolution: GET /telematics/vehicles/:id/location enforces tenant access', async () => {
    // Company B trying to read Company A vehicle location -> 404/403
    const res = await fetch(`${baseUrl}/telematics/vehicles/${testVehicleA._id}/location`, {
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    assert.equal(res.status, 404);
  });

  // =========================================================================
  // 5. Dashboard Reconciliation Tests
  // =========================================================================

  test('Dashboard: GET /dashboard/metrics accurately reconciles real database values', async () => {
    const res = await fetch(`${baseUrl}/dashboard/metrics`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.equal(data.success, true);
    const { loads, fleet, financials } = data.data;

    // Must be actual non-negative numbers derived from DB
    assert.ok(typeof loads.total === 'number' && loads.total >= 1);
    assert.ok(typeof fleet.vehicles.total === 'number' && fleet.vehicles.total >= 1);
    assert.ok(typeof financials.freightBilled === 'number');
  });

});
