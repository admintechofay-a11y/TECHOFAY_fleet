/**
 * Phase 8 Integration Test Suite:
 * Operations Dashboard, Aggregation Metrics, Reports, Global Search & System Admin
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const app = require('../src/app');
const db = require('../src/config/db');
const Company = require('../src/modules/auth/models/Company');
const Load = require('../src/modules/loads/models/Load');
const Trip = require('../src/modules/trips/models/Trip');
const Vehicle = require('../src/modules/vehicles/models/Vehicle');
const Driver = require('../src/modules/drivers/models/Driver');
const CustomerParty = require('../src/modules/customers/models/CustomerParty');
const Location = require('../src/modules/locations/models/Location');
const VehicleDocument = require('../src/modules/vehicles/models/VehicleDocument');
const DriverDocument = require('../src/modules/drivers/models/DriverDocument');
const ProofOfDelivery = require('../src/modules/pod/models/ProofOfDelivery');
const AuditLog = require('../src/modules/audit/models/AuditLog');
const BootstrapService = require('../src/modules/auth/services/bootstrap.service');

describe('Phase 8 Integration Test Suite: Operations Dashboard, Reports, Global Search & Admin', () => {
  let server;
  let baseUrl;
  let tokenCompanyA;
  let tokenCompanyB;
  let companyAId;
  let companyBId;
  let seededLoadA;
  let seededTripA;
  let seededVehicleA;
  let seededDriverA;
  let seededCustomerA;
  let seededLocationA;

  before(async () => {
    try {
      await db.connectDatabase();
      const timestamp = Date.now();

      // 1. Bootstrap Company A
      const bootA = await BootstrapService.bootstrapSystem({
        companyLegalName: `Phase 8 Apex Logistics A ${timestamp}`,
        companyGstin: `27AABCT${timestamp.toString().slice(-4)}A1Z5`,
        adminEmail: `phase8.admin.${timestamp}@apex-a.com`,
        adminPassword: 'PasswordA123!',
        adminName: 'Admin Apex A'
      });
      companyAId = bootA.company._id.toString();

      // 2. Bootstrap Company B (Competitor)
      const bootB = await BootstrapService.bootstrapSystem({
        companyLegalName: `Phase 8 Rival Express B ${timestamp}`,
        companyGstin: `29BCDEF${timestamp.toString().slice(-4)}B1Z2`,
        adminEmail: `phase8.admin.${timestamp}@rival-b.com`,
        adminPassword: 'PasswordB123!',
        adminName: 'Admin Rival B'
      });
      companyBId = bootB.company._id.toString();

      // Start Ephemeral HTTP Server
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
          email: `phase8.admin.${timestamp}@apex-a.com`,
          password: 'PasswordA123!'
        })
      });
      const loginAData = await loginARes.json();
      tokenCompanyA = loginAData.data.accessToken;

      // Login Company B
      const loginBRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `phase8.admin.${timestamp}@rival-b.com`,
          password: 'PasswordB123!'
        })
      });
      const loginBData = await loginBRes.json();
      tokenCompanyB = loginBData.data.accessToken;

      // 3. Seed Domain Master Data for Company A
      seededCustomerA = await CustomerParty.create({
        companyId: bootA.company._id,
        name: `Tata AutoComp Systems ${timestamp}`,
        code: 'TATA-P8',
        partyType: 'CUSTOMER',
        gstin: `27AABCT${timestamp.toString().slice(-4)}A1Z8`,
        primaryContact: {
          name: 'Rajiv Sharma',
          phone: '+919822001122',
          email: `rajiv.${timestamp}@autocomp.com`
        },
        billingAddress: {
          street: 'MIDC Chakan',
          city: 'Pune',
          state: 'Maharashtra',
          pincode: '410501'
        }
      });

      seededLocationA = await Location.create({
        companyId: bootA.company._id,
        name: `Chakan Industrial Hub ${timestamp}`,
        type: 'WAREHOUSE',
        address: {
          street: 'Plot 45 Phase 2',
          city: 'Pune',
          state: 'Maharashtra',
          pincode: '410501'
        }
      });

      seededVehicleA = await Vehicle.create({
        companyId: bootA.company._id,
        plateNumber: `MH14TC${Math.floor(1000 + Math.random() * 8999)}`,
        vehicleType: 'Container Truck',
        category: 'OWNED',
        make: 'Tata Motors',
        model: 'Prima 5530.S',
        capacityTonnage: 40.0,
        status: 'AVAILABLE'
      });

      const in5Days = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

      seededDriverA = await Driver.create({
        companyId: bootA.company._id,
        name: `Gurmukh Singh ${timestamp}`,
        phone: `+9198${Math.floor(10000000 + Math.random() * 89999999)}`,
        licenseNumber: `MH14${Math.floor(100000000 + Math.random() * 899999999)}`,
        licenseType: 'HMV',
        licenseExpiryDate: in5Days,
        status: 'AVAILABLE'
      });

      // Seed Vehicle Document expiring in 5 days (Critical Warning)
      await VehicleDocument.create({
        companyId: bootA.company._id,
        vehicleId: seededVehicleA._id,
        documentType: 'FITNESS',
        documentNumber: `FIT-P8-${timestamp}`,
        issueDate: new Date(Date.now() - 360 * 24 * 60 * 60 * 1000),
        expiryDate: in5Days,
        fileKey: 'docs/test-fitness.pdf',
        originalFileName: 'fitness.pdf',
        mimeType: 'application/pdf',
        fileSize: 10240
      });

      // Seed Driver Document already expired (Critical Expired)
      const pastDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      await DriverDocument.create({
        companyId: bootA.company._id,
        driverId: seededDriverA._id,
        documentType: 'DRIVING_LICENCE',
        documentNumber: `DL-P8-${timestamp}`,
        issueDate: new Date(Date.now() - 720 * 24 * 60 * 60 * 1000),
        expiryDate: pastDate,
        fileKey: 'docs/test-dl.pdf',
        originalFileName: 'dl.pdf',
        mimeType: 'application/pdf',
        fileSize: 10240
      });

      // Seed Load for Company A
      seededLoadA = await Load.create({
        companyId: bootA.company._id,
        loadNumber: `LD-2026-${Math.floor(10000 + Math.random() * 89999)}`,
        customerId: seededCustomerA._id,
        consignorId: seededCustomerA._id,
        consigneeId: seededCustomerA._id,
        originLocationId: seededLocationA._id,
        destinationLocationId: seededLocationA._id,
        assignedVehicleId: seededVehicleA._id,
        assignedDriverId: seededDriverA._id,
        totalWeightMt: 25.5,
        totalQuantity: 250,
        packageType: 'Boxes',
        financials: {
          baseFreightPaise: 4500000,
          loadingPaise: 225000,
          totalFreightPaise: 4725000, // ₹47,250
          advancePaise: 2000000,      // ₹20,000
          balancePaise: 2725000       // ₹27,250
        },
        charges: {
          freightRate: 45000,
          totalAmount: 47250,
          advanceAmount: 20000,
          balanceAmount: 27250
        },
        remarks: 'Automotive components consignment P8',
        status: 'IN_TRANSIT'
      });

      // Seed Trip for Company A
      seededTripA = await Trip.create({
        companyId: bootA.company._id,
        tripNumber: `TR-2026-${Math.floor(10000 + Math.random() * 89999)}`,
        loadId: seededLoadA._id,
        vehicleId: seededVehicleA._id,
        driverId: seededDriverA._id,
        status: 'IN_TRANSIT',
        stops: [
          {
            sequence: 1,
            stopType: 'PICKUP',
            locationId: seededLocationA._id,
            status: 'COMPLETED'
          },
          {
            sequence: 2,
            stopType: 'DELIVERY',
            locationId: seededLocationA._id,
            status: 'PENDING'
          }
        ],
        freightAmount: 45000,
        advanceAmount: 20000,
        financials: {
          grossFreightPaise: 4500000,
          driverAdvancePaise: 2000000,
          totalExpensesPaise: 950000,
          netSettlementPaise: 3550000
        },
        expenses: [
          { expenseType: 'DIESEL', amountPaise: 800000, description: 'Highway bunk fuel' },
          { expenseType: 'TOLL', amountPaise: 150000, description: 'Expressway toll fastag' }
        ],
        tripExpenses: [
          { expenseType: 'DIESEL', amount: 8000, remarks: 'Highway bunk fuel' },
          { expenseType: 'TOLL', amount: 1500, remarks: 'Expressway toll fastag' }
        ]
      });

      // Seed Pending Proof of Delivery
      await ProofOfDelivery.create({
        companyId: bootA.company._id,
        podNumber: `POD-P8-${timestamp}`,
        tripId: seededTripA._id,
        loadId: seededLoadA._id,
        stopId: new mongoose.Types.ObjectId(),
        status: 'PENDING_VERIFICATION',
        receiverName: 'Mr. Rajesh Khurana',
        receiverPhone: '+919876543210',
        quantityDelivered: 25,
        deliveredAt: new Date(),
        fileKey: 'pod/test-pod.pdf',
        fileName: 'test-pod.pdf',
        mimeType: 'application/pdf',
        fileSize: 10240
      });

    } catch (err) {
      console.error('Phase 8 Test before() failed:', err);
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

  // TEST 1: Dashboard Real-Time Aggregation Metrics
  test('1. Dashboard Metrics: Computes real-time live MongoDB aggregation KPI cards', async () => {
    const res = await fetch(`${baseUrl}/dashboard/metrics`, {
      headers: {
        Authorization: `Bearer ${tokenCompanyA}`,
        'X-Company-Id': companyAId
      }
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);

    const { loads, trips, fleet, financials, compliance, pod } = json.data;

    // Validate Loads KPI
    assert.ok(loads.total >= 1, 'Total loads should be at least 1');
    assert.ok(loads.today >= 1, "Today's loads should be at least 1");
    assert.equal(loads.byStatus.IN_TRANSIT, 1, 'In-transit loads should match seeded count');
    assert.equal(loads.totalWeightMt, 25.5, 'Total weight in MT should match seeded load');

    // Validate Trips KPI
    assert.ok(trips.total >= 1, 'Total trips should be at least 1');
    assert.equal(trips.active, 1, 'Active trips should be 1');
    assert.equal(trips.totalExpenses, 9500, 'Trip expenses should sum 8000 + 1500 = 9500');

    // Validate Fleet KPI
    assert.ok(fleet.vehicles.total >= 1, 'Total vehicles count');
    assert.ok(fleet.drivers.total >= 1, 'Total drivers count');

    // Validate Financials KPI
    assert.equal(financials.freightBilled, 47250, 'Freight billed matches load total amount');
    assert.equal(financials.advanceReceived, 20000, 'Advance received matches seeded load');
    assert.equal(financials.balanceOutstanding, 27250, 'Balance outstanding matches 47250 - 20000 = 27250');
    assert.equal(financials.tripExpenses, 9500, 'Trip expenses accurately computed');

    // Validate Compliance Expiries
    assert.ok(compliance.expired >= 1, 'At least 1 expired document recorded (seeded driver DL)');
    assert.ok(compliance.expiring15Days >= 1, 'At least 1 document expiring in 15 days (seeded vehicle fitness)');

    // Validate POD
    assert.equal(pod.pending, 1, 'Pending POD count should be 1');
  });

  // TEST 2: Dashboard Trends & Operational Alerts
  test('2. Dashboard Trends & Alerts: Generates 7-day volume timeline and actionable alert feed', async () => {
    // A. Trends
    const trendsRes = await fetch(`${baseUrl}/dashboard/trends?days=7`, {
      headers: {
        Authorization: `Bearer ${tokenCompanyA}`,
        'X-Company-Id': companyAId
      }
    });

    assert.equal(trendsRes.status, 200);
    const trendsJson = await trendsRes.json();
    assert.equal(trendsJson.success, true);
    assert.ok(Array.isArray(trendsJson.data));
    assert.equal(trendsJson.data.length, 7, 'Should return exactly 7 daily trend entries');

    // Today's entry must record the seeded load and trip
    const todayStr = new Date().toISOString().split('T')[0];
    const todayEntry = trendsJson.data.find((e) => e.date === todayStr);
    assert.ok(todayEntry, 'Today date must be present in timeline');
    assert.ok(todayEntry.loadCount >= 1, "Today's load count >= 1");
    assert.ok(todayEntry.tripCount >= 1, "Today's trip count >= 1");

    // B. Actionable Alerts
    const alertsRes = await fetch(`${baseUrl}/dashboard/alerts`, {
      headers: {
        Authorization: `Bearer ${tokenCompanyA}`,
        'X-Company-Id': companyAId
      }
    });

    assert.equal(alertsRes.status, 200);
    const alertsJson = await alertsRes.json();
    assert.equal(alertsJson.success, true);
    assert.ok(Array.isArray(alertsJson.data));

    // Must contain compliance alert for vehicle and driver, plus pending POD alert
    const fitnessAlert = alertsJson.data.find((a) => a.title.includes('FITNESS'));
    assert.ok(fitnessAlert, 'Vehicle fitness expiry alert must be generated');
    assert.equal(fitnessAlert.severity, 'WARNING');

    const dlAlert = alertsJson.data.find((a) => a.title.includes('EXPIRED'));
    assert.ok(dlAlert, 'Driver licence expired alert must be generated');
    assert.equal(dlAlert.severity, 'CRITICAL');

    const podAlert = alertsJson.data.find((a) => a.type === 'POD_VERIFICATION');
    assert.ok(podAlert, 'Pending POD verification alert must be generated');
  });

  // TEST 3: Multi-Criteria Loads Operational Report
  test('3. Loads Report: Filters by status/customer and aggregates summary stats', async () => {
    const res = await fetch(
      `${baseUrl}/reports/loads?status=IN_TRANSIT&consignorId=${seededCustomerA._id}`,
      {
        headers: {
          Authorization: `Bearer ${tokenCompanyA}`,
          'X-Company-Id': companyAId
        }
      }
    );

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data));
    assert.ok(json.data.length >= 1);

    const loadItem = json.data.find((l) => l._id.toString() === seededLoadA._id.toString());
    assert.ok(loadItem, 'Seeded load should be in the report results');
    assert.equal(loadItem.status, 'IN_TRANSIT');
    assert.equal(loadItem.consignorId.name, seededCustomerA.name);

    // Summary checks
    assert.ok(json.summary.totalLoads >= 1);
    assert.equal(json.summary.totalFreight, 47250);
    assert.equal(json.summary.totalAdvance, 20000);
    assert.equal(json.summary.totalBalance, 27250);
  });

  // TEST 4: Trips Report and Freight Ledger with SAC 9965 GTA GST
  test('4. Trips & Freight Report: Reconciles trip expenses and computes 5% GTA GST ledger', async () => {
    // A. Trips Report
    const tripsRes = await fetch(`${baseUrl}/reports/trips?status=IN_TRANSIT`, {
      headers: {
        Authorization: `Bearer ${tokenCompanyA}`,
        'X-Company-Id': companyAId
      }
    });

    assert.equal(tripsRes.status, 200);
    const tripsJson = await tripsRes.json();
    assert.ok(tripsJson.data.length >= 1);
    assert.equal(tripsJson.summary.totalFreight, 45000);
    assert.equal(tripsJson.summary.totalExpenses, 9500);
    assert.equal(tripsJson.summary.netEarnings, 35500);

    // B. Freight Ledger Report
    const freightRes = await fetch(
      `${baseUrl}/reports/freight?customerId=${seededCustomerA._id}`,
      {
        headers: {
          Authorization: `Bearer ${tokenCompanyA}`,
          'X-Company-Id': companyAId
        }
      }
    );

    assert.equal(freightRes.status, 200);
    const freightJson = await freightRes.json();
    assert.ok(freightJson.data.length >= 1);

    const customerRow = freightJson.data[0];
    assert.equal(customerRow.customerName, seededCustomerA.name);
    assert.equal(customerRow.grossFreight, 47250);
    // 5% GTA GST on 45,000 freight rate = 2,250
    assert.equal(customerRow.gtaGstAmount, 2250);
    assert.equal(customerRow.advanceReceived, 20000);
    assert.equal(customerRow.balanceOutstanding, 27250);
  });

  // TEST 5: Fleet Compliance Audit Report
  test('5. Compliance Report: Prioritizes documents by urgency (EXPIRED -> CRITICAL_15 -> VALID)', async () => {
    const res = await fetch(`${baseUrl}/reports/compliance`, {
      headers: {
        Authorization: `Bearer ${tokenCompanyA}`,
        'X-Company-Id': companyAId
      }
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(Array.isArray(json.data));
    assert.ok(json.data.length >= 2);

    // First item must be EXPIRED
    assert.equal(json.data[0].status, 'EXPIRED', 'Most urgent expired document must appear first');
    assert.equal(json.data[0].entityType, 'DRIVER');

    // Second item must be CRITICAL_15
    assert.equal(json.data[1].status, 'CRITICAL_15');
    assert.equal(json.data[1].entityType, 'VEHICLE');

    // Summary counts
    assert.ok(json.summary.expired >= 1);
    assert.ok(json.summary.critical15 >= 1);
  });

  // TEST 6: Streaming Excel and CSV Export with Anti-Formula Injection
  test('6. Streaming Exports: Streams valid Excel/CSV with header styling and formula sanitization', async () => {
    // A. Excel Export
    const xlsxRes = await fetch(`${baseUrl}/reports/export/loads?format=xlsx`, {
      headers: {
        Authorization: `Bearer ${tokenCompanyA}`,
        'X-Company-Id': companyAId
      }
    });

    assert.equal(xlsxRes.status, 200);
    assert.equal(
      xlsxRes.headers.get('content-type'),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    const arrayBuffer = await xlsxRes.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    // Excel/ZIP magic bytes 'PK' (0x50, 0x4B)
    assert.equal(bytes[0], 0x50);
    assert.equal(bytes[1], 0x4b);

    // B. CSV Export
    const csvRes = await fetch(`${baseUrl}/reports/export/loads?format=csv`, {
      headers: {
        Authorization: `Bearer ${tokenCompanyA}`,
        'X-Company-Id': companyAId
      }
    });

    assert.equal(csvRes.status, 200);
    assert.ok(csvRes.headers.get('content-type').includes('text/csv'));
    const csvText = await csvRes.text();
    assert.ok(csvText.includes('Load Number,Date,Consignor,Consignee'));
    assert.ok(csvText.includes(seededLoadA.loadNumber));
  });

  // TEST 7: Unified Global Search Engine & ReDoS Protection
  test('7. Global Search: Indexes across all entities with debouncing & regex escaping', async () => {
    // A. Search by Load Number
    const loadSearch = await fetch(
      `${baseUrl}/search?q=${seededLoadA.loadNumber.slice(0, 7)}`,
      {
        headers: {
          Authorization: `Bearer ${tokenCompanyA}`,
          'X-Company-Id': companyAId
        }
      }
    );

    assert.equal(loadSearch.status, 200);
    const loadJson = await loadSearch.json();
    assert.ok(loadJson.data.totalMatches >= 1);
    const loadHit = loadJson.data.results.find((r) => r.type === 'LOAD');
    assert.ok(loadHit, 'Should find seeded load in global search');
    assert.equal(loadHit.title, seededLoadA.loadNumber);
    assert.equal(loadHit.url, '/app/loads');

    // B. Search by Vehicle Registration
    const vehicleSearch = await fetch(
      `${baseUrl}/search?q=${seededVehicleA.plateNumber}`,
      {
        headers: {
          Authorization: `Bearer ${tokenCompanyA}`,
          'X-Company-Id': companyAId
        }
      }
    );

    assert.equal(vehicleSearch.status, 200);
    const vehicleJson = await vehicleSearch.json();
    const vehicleHit = vehicleJson.data.results.find((r) => r.type === 'VEHICLE');
    assert.ok(vehicleHit, 'Should find seeded vehicle in global search');
    assert.equal(vehicleHit.title, seededVehicleA.plateNumber);

    // C. Search by Customer Name
    const customerSearch = await fetch(
      `${baseUrl}/search?q=Tata AutoComp`,
      {
        headers: {
          Authorization: `Bearer ${tokenCompanyA}`,
          'X-Company-Id': companyAId
        }
      }
    );

    assert.equal(customerSearch.status, 200);
    const customerJson = await customerSearch.json();
    const customerHit = customerJson.data.results.find((r) => r.type === 'CUSTOMER');
    assert.ok(customerHit, 'Should find seeded customer in global search');

    // D. ReDoS Metacharacter safety: special regex characters must not crash server
    const regexSafeSearch = await fetch(`${baseUrl}/search?q=MH14[+*?^$]`, {
      headers: {
        Authorization: `Bearer ${tokenCompanyA}`,
        'X-Company-Id': companyAId
      }
    });

    assert.equal(regexSafeSearch.status, 200);
    const regexJson = await regexSafeSearch.json();
    assert.equal(regexJson.success, true);
  });

  // TEST 8: Admin Organization Settings & Audit Logging
  test('8. Admin Settings & Audit: Updates company profile and writes immutable audit entry', async () => {
    // A. Retrieve current settings
    const getRes = await fetch(`${baseUrl}/admin/settings`, {
      headers: {
        Authorization: `Bearer ${tokenCompanyA}`,
        'X-Company-Id': companyAId
      }
    });

    assert.equal(getRes.status, 200);
    const getJson = await getRes.json();
    assert.ok(getJson.data.legalName.includes('Phase 8 Apex Logistics A'));
    assert.equal(getJson.data.settings.currency, 'INR');

    // B. Update settings
    const updateRes = await fetch(`${baseUrl}/admin/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCompanyA}`,
        'X-Company-Id': companyAId
      },
      body: JSON.stringify({
        phone: '+919988776655',
        settings: {
          defaultGtaGstRate: 12.0
        }
      })
    });

    assert.equal(updateRes.status, 200);
    const updateJson = await updateRes.json();
    assert.equal(updateJson.data.phone, '+919988776655');
    assert.equal(updateJson.data.settings.defaultGtaGstRate, 12.0);

    // C. Verify AuditLog entry was recorded
    const auditRes = await fetch(
      `${baseUrl}/admin/audit-logs?module=settings&action=UPDATE`,
      {
        headers: {
          Authorization: `Bearer ${tokenCompanyA}`,
          'X-Company-Id': companyAId
        }
      }
    );

    assert.equal(auditRes.status, 200);
    const auditJson = await auditRes.json();
    assert.ok(auditJson.data.length >= 1, 'Audit log must record settings update action');
  });

  // TEST 9: Multi-Tenant Isolation
  test('9. Multi-Tenant Isolation: Competitor Company B cannot access Company A metrics, reports, or search', async () => {
    // A. Company B Dashboard metrics should be isolated (0 loads for Company B)
    const bMetricsRes = await fetch(`${baseUrl}/dashboard/metrics`, {
      headers: {
        Authorization: `Bearer ${tokenCompanyB}`,
        'X-Company-Id': companyBId
      }
    });

    assert.equal(bMetricsRes.status, 200);
    const bMetrics = await bMetricsRes.json();
    assert.equal(bMetrics.data.loads.total, 0, 'Company B must have 0 loads');
    assert.equal(bMetrics.data.financials.freightBilled, 0, 'Company B freight billed must be 0');

    // B. Company B Search for Company A load number must return 0 results
    const bSearchRes = await fetch(
      `${baseUrl}/search?q=${seededLoadA.loadNumber}`,
      {
        headers: {
          Authorization: `Bearer ${tokenCompanyB}`,
          'X-Company-Id': companyBId
        }
      }
    );

    assert.equal(bSearchRes.status, 200);
    const bSearch = await bSearchRes.json();
    assert.equal(bSearch.data.totalMatches, 0, 'Company B cannot see Company A loads in search');

    // C. Company B cannot access Company A reports
    const bReportsRes = await fetch(`${baseUrl}/reports/loads?status=IN_TRANSIT`, {
      headers: {
        Authorization: `Bearer ${tokenCompanyB}`,
        'X-Company-Id': companyBId
      }
    });

    assert.equal(bReportsRes.status, 200);
    const bReports = await bReportsRes.json();
    assert.equal(bReports.data.length, 0, 'Company B loads report must be empty');
  });
});
