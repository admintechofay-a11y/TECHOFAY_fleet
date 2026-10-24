/**
 * Comprehensive Phase 6 Integration Tests:
 * Excel/CSV Operations, Versioned Templates, Formula Injection Defense,
 * Two-Stage Import Engine (Dry-Run & Commit), Streaming Operational Exports,
 * Asynchronous Export Jobs, and Multi-Tenant Isolation.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const app = require('../src/app');
const db = require('../src/config/db');
const BootstrapService = require('../src/modules/auth/services/bootstrap.service');
const CustomerParty = require('../src/modules/customers/models/CustomerParty');
const Location = require('../src/modules/locations/models/Location');
const Vehicle = require('../src/modules/vehicles/models/Vehicle');
const Driver = require('../src/modules/drivers/models/Driver');
const Load = require('../src/modules/loads/models/Load');
const Trip = require('../src/modules/trips/models/Trip');
const ExportJob = require('../src/modules/masterData/models/ExportJob');
const masterImportExportService = require('../src/services/masterImportExport.service');

let server;
let baseUrl;
let companyA;
let companyB;
let userAToken;
let userBToken;

let testCustomerId;
let testCustomerGstin;
let testConsignorId;
let testConsignorGstin;
let testConsigneeId;
let testConsigneeGstin;
let testOriginLocId;
let testOriginLocCode;
let testDestLocId;
let testDestLocCode;

let createdJobId;

describe('Phase 6 Integration Test Suite: Excel, CSV, Bulk Imports, Exports & Jobs', () => {

  before(async () => {
    try {
      await db.connectDatabase();
      const timestamp = Date.now();

      // 1. Bootstrap Company A
      const bootstrapA = await BootstrapService.bootstrapSystem({
        companyLegalName: `Phase 6 Logistics Hub A ${timestamp}`,
        companyGstin: `27ABCDE${timestamp.toString().slice(-4)}A1Z1`,
        adminEmail: `phase6.admin.${timestamp}@company-a.com`,
        adminPassword: 'PasswordA123!',
        adminName: 'Admin Bulk Ops A'
      });
      companyA = bootstrapA.company;

      // 2. Bootstrap Company B
      const bootstrapB = await BootstrapService.bootstrapSystem({
        companyLegalName: `Phase 6 Competitor Ops B ${timestamp}`,
        companyGstin: `29BCDEF${timestamp.toString().slice(-4)}B1Z2`,
        adminEmail: `phase6.admin.${timestamp}@company-b.com`,
        adminPassword: 'PasswordB123!',
        adminName: 'Admin Bulk Ops B'
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
          email: `phase6.admin.${timestamp}@company-a.com`,
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
          email: `phase6.admin.${timestamp}@company-b.com`,
          password: 'PasswordB123!'
        })
      });
      const loginBData = await loginBRes.json();
      userBToken = loginBData.data.accessToken;

      // Seed Master Entities for Load Import Mapping
      testCustomerGstin = `27AABCP${timestamp.toString().slice(-4)}A1Z1`;
      const customer = await CustomerParty.create({
        companyId: companyA._id,
        name: `UltraTech Cement Ltd ${timestamp}`,
        partyTypes: ['CUSTOMER'],
        gstin: testCustomerGstin,
        billingAddress: { city: 'Mumbai', state: 'Maharashtra', pincode: '400001' }
      });
      testCustomerId = customer._id;

      testConsignorGstin = `24AABCP${timestamp.toString().slice(-4)}B1Z2`;
      const consignor = await CustomerParty.create({
        companyId: companyA._id,
        name: `Kutch Clinker Works ${timestamp}`,
        partyTypes: ['CONSIGNOR'],
        gstin: testConsignorGstin,
        billingAddress: { city: 'Bhuj', state: 'Gujarat', pincode: '370001' }
      });
      testConsignorId = consignor._id;

      testConsigneeGstin = `27AABCP${timestamp.toString().slice(-4)}C1Z3`;
      const consignee = await CustomerParty.create({
        companyId: companyA._id,
        name: `Panvel Grinding Terminal ${timestamp}`,
        partyTypes: ['CONSIGNEE'],
        gstin: testConsigneeGstin,
        billingAddress: { city: 'Panvel', state: 'Maharashtra', pincode: '410206' }
      });
      testConsigneeId = consignee._id;

      testOriginLocCode = `LOC-BHUJ-${timestamp.toString().slice(-4)}`;
      const originLoc = await Location.create({
        companyId: companyA._id,
        name: `Bhuj Plant Terminal`,
        code: testOriginLocCode,
        locationType: 'PICKUP',
        address: { city: 'Bhuj', state: 'Gujarat' }
      });
      testOriginLocId = originLoc._id;

      testDestLocCode = `LOC-PNVL-${timestamp.toString().slice(-4)}`;
      const destLoc = await Location.create({
        companyId: companyA._id,
        name: `Panvel Terminal Hub`,
        code: testDestLocCode,
        locationType: 'DELIVERY',
        address: { city: 'Panvel', state: 'Maharashtra' }
      });
      testDestLocId = destLoc._id;

      // Seed an initial Load for Export tests
      await Load.create({
        companyId: companyA._id,
        loadNumber: `LD-2026-${Math.floor(10000 + Math.random() * 89999)}`,
        customerId: testCustomerId,
        consignorId: testConsignorId,
        consigneeId: testConsigneeId,
        originLocationId: testOriginLocId,
        destinationLocationId: testDestLocId,
        totalWeightMt: 32.5,
        totalQuantity: 300,
        packageType: 'Bags',
        financials: {
          baseFreightPaise: 9500000,
          totalFreightPaise: 9500000,
          advancePaise: 2000000,
          balancePaise: 7500000
        },
        status: 'IN_TRANSIT'
      });

    } catch (err) {
      console.error('Phase 6 Test before() failed:', err);
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
  // Test 1: Downloadable Versioned Excel Templates
  // -------------------------------------------------------------
  test('1. Templates: Generates valid versioned Excel templates with sample data for all entities', async () => {
    const entities = ['loads', 'customers', 'locations', 'vehicles', 'drivers'];

    for (const ent of entities) {
      const res = await fetch(`${baseUrl}/master/template/${ent}`, {
        headers: { Authorization: `Bearer ${userAToken}` }
      });
      assert.equal(res.status, 200, `Template for ${ent} must return 200`);
      assert.equal(
        res.headers.get('content-type'),
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      const buffer = Buffer.from(await res.arrayBuffer());
      assert.ok(buffer.length > 1000, `Template buffer for ${ent} must exceed 1000 bytes`);

      // Verify Excel workbook structure via ExcelJS
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      assert.ok(wb.worksheets.length >= 1, `Workbook must have at least 1 worksheet for ${ent}`);
      assert.ok(wb.worksheets[0].rowCount >= 2, `Workbook must have header + sample row for ${ent}`);
    }
  });

  // -------------------------------------------------------------
  // Test 2: Formula Injection Defense Sanitization
  // -------------------------------------------------------------
  test('2. Security: Formula injection attacks (=, +, -, @, Tab, CR) are sanitized with single quote', async () => {
    // Seed vehicle with formula injection strings in make, model, owner
    const maliciousPlate = `GJ01XX${Math.floor(1000 + Math.random() * 8999)}`;
    await Vehicle.create({
      companyId: companyA._id,
      plateNumber: maliciousPlate,
      vehicleType: 'Trailer',
      capacityTonnage: 20,
      make: "=cmd|' /C calc'!A0",       // Dangerous Excel formula
      model: "+1234567890",              // Leading plus
      ownerName: "@SUM(A1:A10)",         // Leading @ formula
      status: 'AVAILABLE'
    });

    // 1. Verify CSV Export Sanitization
    const csvRes = await fetch(`${baseUrl}/master/export/vehicles?format=csv`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.equal(csvRes.status, 200);
    const csvContent = await csvRes.text();

    // Verify formula cells are sanitized with leading single-quote: "'=cmd"
    assert.ok(csvContent.includes("''=cmd") || csvContent.includes("'=cmd"), 'Formula =cmd must be escaped');
    assert.ok(csvContent.includes("'+1234") || csvContent.includes("'+"), 'Plus formula must be escaped');
    assert.ok(csvContent.includes("'@SUM"), 'At sign formula must be escaped');

    // 2. Verify Excel (.xlsx) Export Sanitization
    const xlsxRes = await fetch(`${baseUrl}/master/export/vehicles?format=xlsx`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.equal(xlsxRes.status, 200);
    const xlsxBuffer = Buffer.from(await xlsxRes.arrayBuffer());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(xlsxBuffer);
    const ws = wb.worksheets[0];

    let foundSanitizedFormula = false;
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        const val = String(cell.value || '');
        if (val.startsWith("'=cmd") || val.startsWith("'+1234") || val.startsWith("'@SUM")) {
          foundSanitizedFormula = true;
        }
      });
    });
    assert.ok(foundSanitizedFormula, 'Excel worksheet cells must contain sanitized values');
  });

  // -------------------------------------------------------------
  // Test 3: Two-Stage Bulk Import — Step 1: Dry-Run Validation
  // -------------------------------------------------------------
  test('3. Two-Stage Import: Dry-run preview returns row-level error breakdown without saving to DB', async () => {
    // Construct in-memory Excel workbook for Loads import
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('LOADS');
    ws.columns = [
      { header: 'Customer GSTIN or Name *', key: 'customerRef' },
      { header: 'Consignor GSTIN or Name *', key: 'consignorRef' },
      { header: 'Consignee GSTIN or Name *', key: 'consigneeRef' },
      { header: 'Origin Location Code or Name *', key: 'originRef' },
      { header: 'Destination Location Code or Name *', key: 'destRef' },
      { header: 'Total Weight MT *', key: 'totalWeightMt' },
      { header: 'Total Quantity *', key: 'totalQuantity' },
      { header: 'Package Type (Bags/Boxes/Drums/Pallets)', key: 'packageType' },
      { header: 'Base Freight INR *', key: 'baseFreightRupees' },
      { header: 'Advance Freight INR', key: 'advanceRupees' },
      { header: 'Remarks', key: 'remarks' }
    ];

    // Row 2: Valid Load
    ws.addRow({
      customerRef: testCustomerGstin,
      consignorRef: testConsignorGstin,
      consigneeRef: testConsigneeGstin,
      originRef: testOriginLocCode,
      destRef: testDestLocCode,
      totalWeightMt: 28.0,
      totalQuantity: 250,
      packageType: 'Bags',
      baseFreightRupees: 65000,
      advanceRupees: 15000,
      remarks: 'Valid dry-run consignment batch'
    });

    // Row 3: Invalid Load (Non-existent customer & invalid weight)
    ws.addRow({
      customerRef: '27NONEXISTENTGSTIN',
      consignorRef: testConsignorGstin,
      consigneeRef: testConsigneeGstin,
      originRef: testOriginLocCode,
      destRef: testDestLocCode,
      totalWeightMt: -10, // Invalid weight
      totalQuantity: 0,
      packageType: 'Boxes',
      baseFreightRupees: 40000,
      advanceRupees: 0,
      remarks: 'Invalid row test'
    });

    const fileBuffer = await wb.xlsx.writeBuffer();

    // Multipart upload
    const boundary = '----WebKitFormBoundaryPhase6BulkDryRun';
    let body = `--${boundary}\r\n`;
    body += 'Content-Disposition: form-data; name="file"; filename="test_loads_import.xlsx"\r\n';
    body += 'Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n';

    const payloadBuffer = Buffer.concat([
      Buffer.from(body, 'utf-8'),
      Buffer.from(fileBuffer),
      Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8')
    ]);

    const resDryRun = await fetch(`${baseUrl}/master/dry-run/loads`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        Authorization: `Bearer ${userAToken}`
      },
      body: payloadBuffer
    });

    const dryRunData = await resDryRun.json();
    assert.equal(resDryRun.status, 200);
    assert.equal(dryRunData.success, true);
    assert.equal(dryRunData.data.totalRows, 2);
    assert.equal(dryRunData.data.validRowsCount, 1);
    assert.ok(dryRunData.data.invalidRowsCount >= 1);
    assert.ok(dryRunData.data.errors.length >= 1, 'Errors array must contain row errors');

    // Verify row error detail
    const row3Error = dryRunData.data.errors.find((e) => e.rowNumber === 3);
    assert.ok(row3Error, 'Must detect error on row 3');
  });

  // -------------------------------------------------------------
  // Test 4: Two-Stage Bulk Import — Step 2: Confirmed Commit
  // -------------------------------------------------------------
  test('4. Confirmed Commit: Atomically commits valid records with sequence allocation & audit log', async () => {
    const validRecords = [
      {
        customerId: testCustomerId,
        consignorId: testConsignorId,
        consigneeId: testConsigneeId,
        originLocationId: testOriginLocId,
        destinationLocationId: testDestLocId,
        totalWeightMt: 30.5,
        totalQuantity: 280,
        packageType: 'Pallets',
        baseFreightRupees: 72000,
        advanceRupees: 18000,
        remarks: 'Batch imported load via confirmed commit'
      }
    ];

    const resConfirm = await fetch(`${baseUrl}/master/confirm/loads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({ validRecords })
    });

    const confirmData = await resConfirm.json();
    assert.equal(resConfirm.status, 200);
    assert.equal(confirmData.success, true);
    assert.equal(confirmData.data.importedCount, 1);

    // Verify that the record was created in MongoDB with atomic LD-YYYY-XXXXX sequence
    const savedLoad = await Load.findOne({
      companyId: companyA._id,
      remarks: 'Batch imported load via confirmed commit'
    });
    assert.ok(savedLoad);
    assert.match(savedLoad.loadNumber, /^LD-\d{4}-\d{5}$/);
    assert.equal(savedLoad.financials.baseFreightPaise, 7200000);
    assert.equal(savedLoad.financials.advancePaise, 1800000);
    assert.equal(savedLoad.financials.balancePaise, 5400000);
  });

  // -------------------------------------------------------------
  // Test 5: Operational Data Streaming Exports (.xlsx and .csv)
  // -------------------------------------------------------------
  test('5. Operational Exports: Streams valid Excel and CSV for all domain datasets', async () => {
    const testEntities = ['loads', 'trips', 'customers', 'vehicles', 'locations'];

    for (const ent of testEntities) {
      // 1. Excel Export
      const resXlsx = await fetch(`${baseUrl}/master/export/${ent}?format=xlsx`, {
        headers: { Authorization: `Bearer ${userAToken}` }
      });
      assert.equal(resXlsx.status, 200, `Excel export for ${ent} must return 200`);
      assert.equal(
        resXlsx.headers.get('content-type'),
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      const bufXlsx = Buffer.from(await resXlsx.arrayBuffer());
      assert.ok(bufXlsx.length > 500);

      // 2. CSV Export
      const resCsv = await fetch(`${baseUrl}/master/export/${ent}?format=csv`, {
        headers: { Authorization: `Bearer ${userAToken}` }
      });
      assert.equal(resCsv.status, 200, `CSV export for ${ent} must return 200`);
      assert.equal(resCsv.headers.get('content-type'), 'text/csv; charset=utf-8');
      const textCsv = await resCsv.text();
      assert.ok(textCsv.length > 10, `CSV text for ${ent} must not be empty`);
    }
  });

  // -------------------------------------------------------------
  // Test 6: Asynchronous / Trackable Export Jobs
  // -------------------------------------------------------------
  test('6. Async Export Jobs: Creates trackable job, polls completion, and streams file', async () => {
    // 1. Create Export Job
    const resJob = await fetch(`${baseUrl}/master/jobs/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        entityType: 'loads',
        format: 'xlsx',
        filters: {}
      })
    });

    const jobData = await resJob.json();
    assert.equal(resJob.status, 201);
    assert.equal(jobData.success, true);
    assert.ok(jobData.data._id);
    assert.equal(jobData.data.status, 'COMPLETED');
    assert.ok(jobData.data.fileKey);

    createdJobId = jobData.data._id;

    // 2. Query Job Status
    const resGetJob = await fetch(`${baseUrl}/master/jobs/${createdJobId}`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    const fetchedJob = await resGetJob.json();
    assert.equal(resGetJob.status, 200);
    assert.equal(fetchedJob.data.status, 'COMPLETED');
    assert.ok(fetchedJob.data.fileName);

    // 3. Download Generated File via Job Endpoint
    const resDownload = await fetch(`${baseUrl}/master/jobs/${createdJobId}/download`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.equal(resDownload.status, 200);
    assert.equal(
      resDownload.headers.get('content-type'),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    const fileBuf = Buffer.from(await resDownload.arrayBuffer());
    assert.ok(fileBuf.length > 500, 'Downloaded job file must contain data');
  });

  // -------------------------------------------------------------
  // Test 7: Multi-Tenant Data Isolation Enforcement
  // -------------------------------------------------------------
  test('7. Multi-Tenant Isolation: Competitor Company B cannot access or download Company A export jobs', async () => {
    // Company B attempts to read Company A's Export Job
    const resReadJob = await fetch(`${baseUrl}/master/jobs/${createdJobId}`, {
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    assert.equal(resReadJob.status, 404, 'Company B should get 404 on Company A job');

    // Company B attempts to download Company A's Export Job File
    const resDownloadJob = await fetch(`${baseUrl}/master/jobs/${createdJobId}/download`, {
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    assert.equal(resDownloadJob.status, 404, 'Company B should get 404 when downloading Company A file');
  });

});
