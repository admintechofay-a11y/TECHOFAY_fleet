/**
 * Comprehensive Phase 3 Integration Tests: Master Data, Compliance & Excel Workflows
 * - Customers & Parties CRUD, GSTIN validation & duplicates
 * - Locations CRUD, coordinates & customer mapping
 * - Vehicles CRUD, plate formatting & duplicate rejection
 * - Vehicle documents upload, private storage & expiry calculation
 * - Drivers CRUD, licence validation & duplicate rejection
 * - Private document download security & cross-tenant denial
 * - Compliance audit scanner & deduplicated in-app notifications
 * - Master Excel templates, dry-run row errors, confirmed import, and formula injection safe export
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const app = require('../src/app');
const db = require('../src/config/db');
const Company = require('../src/modules/auth/models/Company');
const User = require('../src/modules/auth/models/User');
const BootstrapService = require('../src/modules/auth/services/bootstrap.service');
const CustomerParty = require('../src/modules/customers/models/CustomerParty');
const Location = require('../src/modules/locations/models/Location');
const Vehicle = require('../src/modules/vehicles/models/Vehicle');
const VehicleDocument = require('../src/modules/vehicles/models/VehicleDocument');
const Driver = require('../src/modules/drivers/models/Driver');
const DriverDocument = require('../src/modules/drivers/models/DriverDocument');
const InAppNotification = require('../src/modules/compliance/models/InAppNotification');
const ExcelJS = require('exceljs');

let server;
let baseUrl;
let companyA;
let companyB;
let userAToken;
let userBToken;
let testVehicleId;
let testVehicleDocId;
let testDriverId;

describe('Phase 3 Integration Test Suite: Core Master Data, Compliance & Excel', () => {

  before(async () => {
    await db.connectDatabase();

    const timestamp = Date.now();

    // 1. Bootstrap Primary Company A
    const bootstrapA = await BootstrapService.bootstrapSystem({
      companyLegalName: `Phase 3 Logistics Co A ${timestamp}`,
      companyGstin: `24ABCDE${timestamp.toString().slice(-4)}A1Z${Math.floor(Math.random() * 9)}`,
      adminEmail: `phase3.admin.${timestamp}@company-a.com`,
      adminPassword: 'PasswordA123!',
      adminName: 'Admin Company A'
    });
    companyA = bootstrapA.company;

    // 2. Bootstrap Secondary Company B for Cross-Tenant verification
    const bootstrapB = await BootstrapService.bootstrapSystem({
      companyLegalName: `Phase 3 Competitor Co B ${timestamp}`,
      companyGstin: `27BCDEF${timestamp.toString().slice(-4)}B1Z${Math.floor(Math.random() * 9)}`,
      adminEmail: `phase3.admin.${timestamp}@company-b.com`,
      adminPassword: 'PasswordB123!',
      adminName: 'Admin Company B'
    });
    companyB = bootstrapB.company;

    // Start ephemeral server
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api/v1`;
        resolve();
      });
    });

    // Login Admin A
    const loginResA = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `phase3.admin.${timestamp}@company-a.com`,
        password: 'PasswordA123!'
      })
    });
    const loginDataA = await loginResA.json();
    userAToken = loginDataA.data.accessToken;

    // Login Admin B
    const loginResB = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `phase3.admin.${timestamp}@company-b.com`,
        password: 'PasswordB123!'
      })
    });
    const loginDataB = await loginResB.json();
    userBToken = loginDataB.data.accessToken;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // =========================================================================
  // 1. CUSTOMER / PARTY MASTER TESTS
  // =========================================================================

  test('POST /customers - creates customer party with valid GSTIN and addresses', async () => {
    const res = await fetch(`${baseUrl}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        name: 'Reliance Industries Hazira',
        code: 'CUST-RIL-01',
        partyType: 'CUSTOMER',
        gstin: '24AAACR5055K1Z7',
        primaryContact: {
          name: 'Vikram Mehta',
          phone: '9825000001',
          email: 'vikram.mehta@ril.example.com'
        },
        billingAddress: {
          street: 'Hazira Manufacturing Div',
          city: 'Surat',
          state: 'Gujarat',
          pincode: '394510'
        },
        paymentTermsDays: 45
      })
    });

    const body = await res.json();
    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.name, 'Reliance Industries Hazira');
    assert.equal(body.data.gstin, '24AAACR5055K1Z7');
  });

  test('POST /customers - rejects duplicate GSTIN within the same organization', async () => {
    const res = await fetch(`${baseUrl}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        name: 'Reliance Hazira Unit 2',
        gstin: '24AAACR5055K1Z7' // Duplicate GSTIN
      })
    });

    const body = await res.json();
    assert.equal(res.status, 409);
    assert.equal(body.success, false);
    assert.match(body.message, /already exists in your organization/i);
  });

  test('GET /customers - returns paginated parties with search filter', async () => {
    const res = await fetch(`${baseUrl}/customers?search=Hazira`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.items.length, 1);
    assert.equal(body.data.items[0].name, 'Reliance Industries Hazira');
  });

  // =========================================================================
  // 2. LOCATION MASTER TESTS
  // =========================================================================

  test('POST /locations - creates location with address, coordinates & customer link', async () => {
    const res = await fetch(`${baseUrl}/locations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        name: 'Hazira Terminal Gate 3',
        code: 'LOC-HZR-03',
        locationType: 'PICKUP',
        address: {
          street: 'ONGC Road, Mora',
          city: 'Surat',
          state: 'Gujarat',
          pincode: '394510'
        },
        coordinates: { lat: 21.1123, lng: 72.6512 },
        contactPerson: 'Ramesh Supervisor',
        contactPhone: '9825111111'
      })
    });

    const body = await res.json();
    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.name, 'Hazira Terminal Gate 3');
    assert.equal(body.data.locationType, 'PICKUP');
  });

  test('GET /locations - returns tenant-scoped location records', async () => {
    const res = await fetch(`${baseUrl}/locations`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    assert.ok(body.data.items.length >= 1);
  });

  // =========================================================================
  // 3. VEHICLE MASTER & DOCUMENT UPLOAD TESTS
  // =========================================================================

  test('POST /vehicles - creates vehicle with plate number and capacity', async () => {
    const res = await fetch(`${baseUrl}/vehicles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        plateNumber: 'GJ01AB1234',
        vehicleType: 'Trailer 40ft',
        category: 'OWNED',
        make: 'Tata Motors',
        model: 'Signa 4825.TK',
        capacityTonnage: 35.5,
        yearOfManufacture: 2023,
        ownerName: 'Company Fleet Logistics',
        ownerPhone: '9898012345'
      })
    });

    const body = await res.json();
    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.plateNumber, 'GJ01AB1234');
    assert.equal(body.data.status, 'AVAILABLE');
    testVehicleId = body.data._id;
  });

  test('POST /vehicles - rejects duplicate vehicle plate number in same tenant', async () => {
    const res = await fetch(`${baseUrl}/vehicles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        plateNumber: 'GJ01 AB 1234', // Same plate with spaces
        vehicleType: 'Open Truck',
        capacityTonnage: 20
      })
    });

    const body = await res.json();
    assert.equal(res.status, 409);
    assert.equal(body.success, false);
    assert.match(body.message, /already exists/i);
  });

  test('POST /vehicles/:id/documents - uploads regulatory document and saves to private storage', async () => {
    const formData = new FormData();
    const pdfBlob = new Blob(['%PDF-1.4 Mock Insurance Document Content for Test Vehicle'], {
      type: 'application/pdf'
    });

    formData.append('file', pdfBlob, 'GJ01AB1234_Insurance.pdf');
    formData.append('documentType', 'INSURANCE');
    formData.append('documentNumber', 'POL-INS-2026-999');
    formData.append('issueDate', '2025-01-01');

    // Set expiry 10 days in the future to trigger EXPIRING_SOON
    const expiringSoonDate = new Date();
    expiringSoonDate.setDate(expiringSoonDate.getDate() + 10);
    formData.append('expiryDate', expiringSoonDate.toISOString().split('T')[0]);

    const res = await fetch(`${baseUrl}/vehicles/${testVehicleId}/documents`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userAToken}`
      },
      body: formData
    });

    const body = await res.json();
    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.documentType, 'INSURANCE');
    assert.equal(body.data.complianceStatus, 'EXPIRING_SOON');
    assert.ok(body.data.fileKey.includes('tenants'));

    testVehicleDocId = body.data._id;
  });

  // =========================================================================
  // 4. DRIVER MASTER & LICENCE VALIDATION TESTS
  // =========================================================================

  test('POST /drivers - creates driver with licence number and expiry date', async () => {
    const futureExpiry = new Date();
    futureExpiry.setFullYear(futureExpiry.getFullYear() + 2);

    const res = await fetch(`${baseUrl}/drivers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        name: 'Sunil Kumar Sharma',
        phone: '9876543210',
        alternatePhone: '9876543211',
        licenseNumber: 'GJ0120180054321',
        licenseType: 'HMV',
        licenseExpiryDate: futureExpiry.toISOString().split('T')[0],
        address: 'Narol, Ahmedabad',
        emergencyContact: {
          name: 'Pooja Sharma (Wife)',
          phone: '9876599999'
        }
      })
    });

    const body = await res.json();
    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.name, 'Sunil Kumar Sharma');
    assert.equal(body.data.licenseNumber, 'GJ0120180054321');
    testDriverId = body.data._id;
  });

  test('POST /drivers - rejects duplicate driving licence number', async () => {
    const res = await fetch(`${baseUrl}/drivers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        name: 'Another Driver',
        phone: '9876500000',
        licenseNumber: 'GJ0120180054321', // Duplicate
        licenseExpiryDate: '2028-01-01'
      })
    });

    const body = await res.json();
    assert.equal(res.status, 409);
    assert.equal(body.success, false);
    assert.match(body.message, /already exists/i);
  });

  // =========================================================================
  // 5. PRIVATE FILE STORAGE & CROSS-TENANT SECURITY TESTS
  // =========================================================================

  test('GET /documents/:id/download - authorized tenant downloads private document stream', async () => {
    const res = await fetch(`${baseUrl}/documents/${testVehicleDocId}/download?type=vehicle`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/pdf');
    const text = await res.text();
    assert.ok(text.includes('Mock Insurance Document Content'));
  });

  test('GET /documents/:id/download - rejects cross-tenant download attempt with 404/403', async () => {
    // Competitor User B attempts to access Company A's private document
    const res = await fetch(`${baseUrl}/documents/${testVehicleDocId}/download?type=vehicle`, {
      headers: { Authorization: `Bearer ${userBToken}` }
    });

    assert.equal(res.status, 404); // Scoped query does not find doc in tenant B
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /access denied|not found/i);
  });

  test('GET /documents/:id/download - rejects unauthenticated download with 401', async () => {
    const res = await fetch(`${baseUrl}/documents/${testVehicleDocId}/download?type=vehicle`);
    assert.equal(res.status, 401);
  });

  // =========================================================================
  // 6. COMPLIANCE SCANNER & DEDUPLICATED IN-APP NOTIFICATIONS
  // =========================================================================

  test('POST /compliance/scan - detects expiring document and generates deduplicated alert', async () => {
    // 1. First Scan
    const res1 = await fetch(`${baseUrl}/compliance/scan`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` }
    });

    const body1 = await res1.json();
    assert.equal(res1.status, 200);
    assert.equal(body1.success, true);
    assert.ok(body1.data.notificationsCreated >= 1);

    // 2. Second Scan on same day (deduplication check)
    const res2 = await fetch(`${baseUrl}/compliance/scan`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` }
    });

    const body2 = await res2.json();
    assert.equal(res2.status, 200);
    // Deduplication should ensure no duplicate notifications are generated
    assert.equal(body2.data.notificationsCreated, 0);

    // 3. Verify in-app notifications endpoint
    const notifRes = await fetch(`${baseUrl}/compliance/notifications`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    const notifBody = await notifRes.json();
    assert.equal(notifRes.status, 200);
    assert.ok(notifBody.data.items.length >= 1);
    assert.equal(notifBody.data.items[0].category, 'DOCUMENT_EXPIRY');

    // Mark as read
    const alertId = notifBody.data.items[0]._id;
    const readRes = await fetch(`${baseUrl}/compliance/notifications/${alertId}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    const readBody = await readRes.json();
    assert.equal(readRes.status, 200);
    assert.equal(readBody.success, true);
  });

  // =========================================================================
  // 7. EXCEL MASTER DATA: TEMPLATES, DRY-RUN PREVIEW & CONFIRMED IMPORT
  // =========================================================================

  test('GET /master/template/:entityType - downloads valid Excel template workbook', async () => {
    const res = await fetch(`${baseUrl}/master/template/vehicles`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });

    assert.equal(res.status, 200);
    assert.equal(
      res.headers.get('content-type'),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    const arrayBuffer = await res.arrayBuffer();
    assert.ok(arrayBuffer.byteLength > 1000);

    // Verify it is a valid Excel workbook with sheets
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(arrayBuffer));
    assert.equal(workbook.worksheets.length, 1);
    assert.equal(workbook.worksheets[0].name, 'VEHICLES_TEMPLATE');
  });

  test('POST /master/dry-run/:entityType - dry-run reports row-level errors without DB write', async () => {
    // Create workbook with 1 valid row and 2 invalid rows
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('VEHICLES');
    ws.columns = [
      { header: 'Plate Number *', key: 'plateNumber' },
      { header: 'Vehicle Type *', key: 'vehicleType' },
      { header: 'Category (OWNED/ATTACHED/MARKET) *', key: 'category' },
      { header: 'Capacity Tonnage (MT) *', key: 'capacityTonnage' }
    ];

    // Row 2: Valid
    ws.addRow({
      plateNumber: 'MH12DE9999',
      vehicleType: 'Container 32ft',
      category: 'OWNED',
      capacityTonnage: 18.5
    });

    // Row 3: Invalid plate number format
    ws.addRow({
      plateNumber: 'INVALID_PLATE',
      vehicleType: 'Trailer',
      category: 'OWNED',
      capacityTonnage: 25
    });

    // Row 4: Duplicate plate (already exists in DB: GJ01AB1234)
    ws.addRow({
      plateNumber: 'GJ01AB1234',
      vehicleType: 'Open Truck',
      category: 'MARKET',
      capacityTonnage: 15
    });

    const fileBuf = await wb.xlsx.writeBuffer();

    const fd = new FormData();
    fd.append('file', new Blob([fileBuf]), 'vehicles_import.xlsx');

    const res = await fetch(`${baseUrl}/master/dry-run/vehicles`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: fd
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.totalRows, 3);
    assert.equal(body.data.validCount, 1);
    assert.equal(body.data.invalidCount, 2);
    assert.ok(body.data.errors.length >= 2);

    // Verify database was NOT written during dry-run
    const dbCheck = await Vehicle.findOne({ companyId: companyA._id, plateNumber: 'MH12DE9999' });
    assert.equal(dbCheck, null);
  });

  test('POST /master/confirm/:entityType - commits valid records and logs audit trail', async () => {
    const validRecords = [
      {
        plateNumber: 'MH12DE9999',
        vehicleType: 'Container 32ft',
        category: 'OWNED',
        capacityTonnage: 18.5,
        make: 'BharatBenz',
        model: '2823R'
      }
    ];

    const res = await fetch(`${baseUrl}/master/confirm/vehicles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({ validRecords })
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.importedCount, 1);

    // Verify record is now in database
    const dbRecord = await Vehicle.findOne({
      companyId: companyA._id,
      plateNumber: 'MH12DE9999'
    });
    assert.ok(dbRecord);
    assert.equal(dbRecord.make, 'BharatBenz');
  });

  test('GET /master/export/:entityType - exports sanitized dataset against formula injection', async () => {
    // First, insert a vehicle with potential formula injection string to test sanitizer
    await Vehicle.create({
      companyId: companyA._id,
      plateNumber: 'GJ01EX9999',
      vehicleType: '=cmd|"/C calc"!A0', // Dangerous formula injection attempt
      capacityTonnage: 10,
      isActive: true
    });

    // 1. Test CSV Export
    const csvRes = await fetch(`${baseUrl}/master/export/vehicles?format=csv`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.equal(csvRes.status, 200);
    assert.equal(csvRes.headers.get('content-type'), 'text/csv; charset=utf-8');
    const csvText = await csvRes.text();
    // Verify formula was escaped with single-quote: "'=cmd"
    assert.ok(csvText.includes("''=cmd") || csvText.includes("'=cmd"));

    // 2. Test XLSX Export
    const xlsxRes = await fetch(`${baseUrl}/master/export/vehicles?format=xlsx`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.equal(xlsxRes.status, 200);
    assert.equal(
      xlsxRes.headers.get('content-type'),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    const xlsxBuffer = await xlsxRes.arrayBuffer();
    assert.ok(xlsxBuffer.byteLength > 1000);
  });

});
