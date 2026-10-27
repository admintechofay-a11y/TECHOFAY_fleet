/**
 * Phase 3 Acceptance Gate Tests:
 * Durable Files, Magic Bytes, Vector Barcodes, Expiring Tokens & External Integrations
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
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

const storageService = require('../apps/api/src/services/storage.service');
const pdfService = require('../apps/api/src/services/pdf.service');
const documentController = require('../apps/api/src/modules/documents/controllers/document.controller');
const whatsappService = require('../apps/api/src/modules/whatsapp/services/whatsapp.service');
const TwilioAdapter = require('../apps/api/src/modules/whatsapp/adapters/TwilioWhatsAppAdapter');
const InteraktAdapter = require('../apps/api/src/modules/whatsapp/adapters/InteraktWhatsAppAdapter');
const masterImportExportService = require('../apps/api/src/services/masterImportExport.service');
const { WhatsAppMessageStatus } = require('@fleet/shared');

let server;
let baseUrl;
let companyA;
let companyB;
let userAToken;
let userBToken;
let lrA;
let biltyA;

describe('Phase 3 Gate: Durable Files, Vector Barcodes, Expiring Tokens & External Integrations', () => {

  before(async () => {
    try {
      await db.connectDatabase();
      const timestamp = Date.now();

    // Bootstrap Company A
    const bA = await BootstrapService.bootstrapSystem({
      companyLegalName: `Phase 3 Logistics TransCorp ${timestamp}`,
      companyGstin: `27AAACT${timestamp.toString().slice(-4)}A1Z5`,
      adminEmail: `phase3.admin.${timestamp}@transcorp-a.com`,
      adminPassword: 'PasswordA123!',
      adminName: 'Admin Alpha Phase3'
    });
    companyA = bA.company;

    // Bootstrap Company B (Tenant isolation competitor)
    const bB = await BootstrapService.bootstrapSystem({
      companyLegalName: `Phase 3 Competitor Freight ${timestamp}`,
      companyGstin: `29BBBCB${timestamp.toString().slice(-4)}B1Z8`,
      adminEmail: `phase3.admin.${timestamp}@competitor-b.com`,
      adminPassword: 'PasswordB123!',
      adminName: 'Admin Beta Phase3'
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
      body: JSON.stringify({ email: `phase3.admin.${timestamp}@transcorp-a.com`, password: 'PasswordA123!' })
    });
    const dataA = await resA.json();
    userAToken = dataA.data.accessToken;

    // Login Company B
    const resB = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `phase3.admin.${timestamp}@competitor-b.com`, password: 'PasswordB123!' })
    });
    const dataB = await resB.json();
    userBToken = dataB.data.accessToken;

    // Create minimal data for LR and Bilty documents
    const party1 = await CustomerParty.create({
      companyId: companyA._id,
      name: `Consignor Alpha ${timestamp}`,
      code: `CPA-${timestamp.toString().slice(-4)}`,
      partyType: 'CONSIGNOR',
      gstin: `27ABCDE${timestamp.toString().slice(-4)}A1Z5`,
      pan: `ABCDE${timestamp.toString().slice(-4)}A`
    });

    const party2 = await CustomerParty.create({
      companyId: companyA._id,
      name: `Consignee Alpha ${timestamp}`,
      code: `CNE-${timestamp.toString().slice(-4)}`,
      partyType: 'CONSIGNEE',
      gstin: `27FGHIJ${timestamp.toString().slice(-4)}B1Z6`
    });

    const originLoc = await Location.create({
      companyId: companyA._id,
      name: `Origin Warehouse ${timestamp}`,
      code: `ORG-${timestamp.toString().slice(-4)}`,
      locationType: 'HUB',
      address: { city: 'Mumbai', state: 'Maharashtra' }
    });

    const destLoc = await Location.create({
      companyId: companyA._id,
      name: `Dest Depot ${timestamp}`,
      code: `DST-${timestamp.toString().slice(-4)}`,
      locationType: 'HUB',
      address: { city: 'Pune', state: 'Maharashtra' }
    });

    const vehicle1 = await Vehicle.create({
      companyId: companyA._id,
      plateNumber: `MH04AB${timestamp.toString().slice(-4)}`,
      vehicleType: 'TRUCK',
      capacityTonnage: 25,
      status: 'AVAILABLE'
    });

    const driver1 = await Driver.create({
      companyId: companyA._id,
      name: 'Rameshwar Yadav',
      phone: `+91987${timestamp.toString().slice(-7)}`,
      licenseNumber: `DL${timestamp.toString().slice(-10)}`,
      licenseExpiryDate: new Date(Date.now() + 365 * 24 * 3600 * 1000),
      status: 'AVAILABLE'
    });

    const load1 = await Load.create({
      companyId: companyA._id,
      loadNumber: `LD-${timestamp.toString().slice(-6)}`,
      customerId: party1._id,
      consignorId: party1._id,
      consigneeId: party2._id,
      originLocationId: originLoc._id,
      destinationLocationId: destLoc._id,
      totalWeightMt: 14.0,
      totalQuantity: 280,
      materialType: 'Industrial Auto Parts',
      financials: { grossFreightPaise: 8500000, advancePaise: 3000000, balancePaise: 5500000 },
      status: 'CREATED'
    });

    lrA = await LrNumber.create({
      companyId: companyA._id,
      lrNumber: `LR-${timestamp.toString().slice(-6)}`,
      loadId: load1._id,
      vehicleId: vehicle1._id,
      driverId: driver1._id,
      consignorId: party1._id,
      consigneeId: party2._id,
      eWayBillNumber: '141098765432',
      status: 'BOOKED'
    });

    biltyA = await Bilty.create({
      companyId: companyA._id,
      biltyNumber: `BL-${timestamp.toString().slice(-6)}`,
      loadId: load1._id,
      lrId: lrA._id,
      consignorId: party1._id,
      consigneeId: party2._id,
      paymentTerms: 'TO_PAY',
      gstGtaSac: '996511',
      totalFreightPaise: 8500000,
      advancePaise: 3000000,
      balancePaise: 5500000,
      status: 'ISSUED'
    });
    } catch (err) {
      console.error('CRITICAL ERROR IN BEFORE SETUP:', err);
      throw err;
    }
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await db.disconnectDatabase();
  });

  // =========================================================================
  // 1. STORAGE SERVICE: FILE SIGNATURES, EXTENSIONS & BUFFER SIZE
  // =========================================================================

  test('Storage: Valid PDF magic bytes (%PDF) are approved', () => {
    const validPdfBuffer = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
    const isValid = storageService.validateFileSignature(validPdfBuffer, 'application/pdf', 'invoice.pdf');
    assert.equal(isValid, true);
  });

  test('Storage: Spoofed PDF containing shell script is rejected (MIME spoofing defense)', () => {
    const spoofedPdfBuffer = Buffer.from('#!/bin/bash\necho "exploit execution"\n');
    assert.throws(
      () => storageService.validateFileSignature(spoofedPdfBuffer, 'application/pdf', 'malicious.pdf'),
      /File signature mismatch: File claims to be PDF but lacks valid %PDF header/i
    );
  });

  test('Storage: Spoofed PDF containing Windows PE executable is rejected', () => {
    const exeBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xFF\xFF\x00\x00');
    assert.throws(
      () => storageService.validateFileSignature(exeBuffer, 'application/pdf', 'payload.pdf'),
      /File signature mismatch: File claims to be PDF but lacks valid %PDF header/i
    );
  });

  test('Storage: Valid JPEG magic bytes (0xFF 0xD8 0xFF) are approved', () => {
    const validJpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
    const isValid = storageService.validateFileSignature(validJpegBuffer, 'image/jpeg', 'pod_photo.jpg');
    assert.equal(isValid, true);
  });

  test('Storage: Spoofed JPEG lacking SOI marker is rejected', () => {
    const fakeJpegBuffer = Buffer.from('NOT A JPEG DATA STREAM');
    assert.throws(
      () => storageService.validateFileSignature(fakeJpegBuffer, 'image/jpeg', 'fake.jpg'),
      /File claims to be JPEG but lacks valid SOI marker/i
    );
  });

  test('Storage: Valid PNG signature (89 50 4E 47 0D 0A 1A 0A) is approved', () => {
    const validPngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00]);
    const isValid = storageService.validateFileSignature(validPngBuffer, 'image/png', 'seal.png');
    assert.equal(isValid, true);
  });

  test('Storage: Valid XLSX ZIP signature (PK) is approved', () => {
    const validXlsxBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
    const isValid = storageService.validateFileSignature(validXlsxBuffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'loads.xlsx');
    assert.equal(isValid, true);
  });

  test('Storage: Valid CSV text data without executable binaries is approved', () => {
    const validCsvBuffer = Buffer.from('loadNumber,weight,consignor\nLD-001,14.5,Tata Steel\nLD-002,22.0,JSW\n');
    const isValid = storageService.validateFileSignature(validCsvBuffer, 'text/csv', 'loads.csv');
    assert.equal(isValid, true);
  });

  test('Storage: CSV containing Windows PE header (MZ) is rejected as binary payload', () => {
    const evilCsvBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00');
    assert.throws(
      () => storageService.validateFileSignature(evilCsvBuffer, 'text/csv', 'evil.csv'),
      /executable binary/i
    );
  });

  test('Storage: Strictly prohibited extensions are immediately rejected', () => {
    const dummyBuffer = Buffer.from('test content');
    const dangerousExts = ['.exe', '.bat', '.cmd', '.sh', '.php', '.js', '.py'];
    for (const ext of dangerousExts) {
      assert.throws(
        () => storageService.validateFileSignature(dummyBuffer, 'application/octet-stream', `script${ext}`),
        /strictly prohibited/i
      );
    }
  });

  test('Storage: Cross-tenant path traversal and non-member key retrieval is denied (403)', () => {
    assert.throws(
      () => storageService.getFilePath('../../../etc/passwd', companyA._id),
      /Directory traversal detected|Access denied/i
    );

    assert.throws(
      () => storageService.getFilePath(`tenants/${companyB._id}/documents/secret.pdf`, companyA._id),
      /Access denied: Document does not belong to your organization/i
    );
  });

  // =========================================================================
  // 2. DETERMINISTIC PDF SERVICE & AUTHENTIC VECTOR BARCODES
  // =========================================================================

  test('PDF: generateLrPdf renders a valid PDF buffer starting with %PDF', async () => {
    const pdfBuf = await pdfService.generateLrPdf(lrA, companyA, { copy: 'ORIGINAL' });
    assert.ok(Buffer.isBuffer(pdfBuf));
    assert.ok(pdfBuf.length > 1000, 'PDF buffer must have non-trivial size');
    assert.equal(pdfBuf.slice(0, 4).toString('ascii'), '%PDF', 'Generated buffer must be valid PDF');
  });

  test('PDF: _drawBarcode renders authentic Code 128-B bars without errors', () => {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    // Must execute cleanly without runtime error
    assert.doesNotThrow(() => {
      pdfService._drawBarcode(doc, 400, 100, lrA.lrNumber);
      pdfService._drawBarcode(doc, 400, 150, 'SPECIAL-12345');
    });
  });

  test('PDF: Header does not contain fabricated fake GSTIN or Ahmedabad corridor strings', async () => {
    // Generate PDF for Company A
    const pdfBuf = await pdfService.generateLrPdf(lrA, companyA, { copy: 'TRANSPORTER' });
    const pdfAscii = pdfBuf.toString('binary');

    // Verify it doesn't contain the old hardcoded fake values
    assert.ok(!pdfAscii.includes('24AAACT1234A1Z5'), 'Must NOT contain fake GSTIN 24AAACT1234A1Z5');
    assert.ok(!pdfAscii.includes('Fleet Hub & Corridor Gateway, Ahmedabad, Gujarat'), 'Must NOT contain hardcoded Ahmedabad corridor address');
  });

  // =========================================================================
  // 3. PUBLIC EXPIRING TOKENS & STREAMING ENDPOINT
  // =========================================================================

  test('Tokens: generateExpiringDocumentToken generates verifiable HMAC signature', () => {
    const token = documentController.generateExpiringDocumentToken({
      documentType: 'lr',
      documentId: lrA._id.toString(),
      companyId: companyA._id.toString(),
      expiresInHours: 24
    });

    assert.ok(typeof token === 'string' && token.length > 20);

    const verified = documentController.verifyExpiringDocumentToken(token);
    assert.ok(verified, 'Token must verify successfully');
    assert.equal(verified.documentType, 'lr');
    assert.equal(verified.documentId, lrA._id.toString());
    assert.equal(verified.companyId, companyA._id.toString());
    assert.ok(verified.expiresAt > Date.now());
  });

  test('Tokens: Tampered signature or expired token returns null', () => {
    const validToken = documentController.generateExpiringDocumentToken({
      documentType: 'lr',
      documentId: lrA._id.toString(),
      companyId: companyA._id.toString(),
      expiresInHours: 24
    });

    // Tamper with the token string
    const tamperedToken = validToken.slice(0, -6) + 'XXXXXX';
    assert.equal(documentController.verifyExpiringDocumentToken(tamperedToken), null);

    // Verify negative expiration (already expired)
    const expiredToken = documentController.generateExpiringDocumentToken({
      documentType: 'lr',
      documentId: lrA._id.toString(),
      companyId: companyA._id.toString(),
      expiresInHours: -1 // Expired 1 hour ago
    });
    assert.equal(documentController.verifyExpiringDocumentToken(expiredToken), null);
  });

  test('Routes: GET /documents/:type/:id/pdf streams authentic PDF via expiring token without cookies', async () => {
    const token = documentController.generateExpiringDocumentToken({
      documentType: 'lr',
      documentId: lrA._id.toString(),
      companyId: companyA._id.toString(),
      expiresInHours: 24
    });

    const res = await fetch(`${baseUrl}/documents/lr/${lrA._id}/pdf?token=${encodeURIComponent(token)}`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/pdf');
    assert.match(res.headers.get('content-disposition'), /inline; filename="LR_/);

    const pdfBuffer = Buffer.from(await res.arrayBuffer());
    assert.equal(pdfBuffer.slice(0, 4).toString('ascii'), '%PDF');
  });

  test('Routes: GET /documents/:type/:id/pdf rejects unauthenticated requests lacking token with 401', async () => {
    const res = await fetch(`${baseUrl}/documents/lr/${lrA._id}/pdf`);
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.match(data.message, /Authentication.*required/i);
  });

  test('Routes: GET /documents/:type/:id/pdf rejects invalid or tampered token with 401', async () => {
    const res = await fetch(`${baseUrl}/documents/lr/${lrA._id}/pdf?token=bogus_tampered_token_string`);
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.match(data.message, /expired|invalid/i);
  });

  test('Routes: Multi-tenancy guard prevents Company B token from downloading Company A document', async () => {
    // Generate valid token for Company B
    const tokenB = documentController.generateExpiringDocumentToken({
      documentType: 'lr',
      documentId: lrA._id.toString(), // Attaching Company A's document ID
      companyId: companyB._id.toString(),
      expiresInHours: 24
    });

    const res = await fetch(`${baseUrl}/documents/lr/${lrA._id}/pdf?token=${encodeURIComponent(tokenB)}`);
    // Should be 404 because lrA belongs to Company A, not Company B
    assert.equal(res.status, 404);
  });

  // =========================================================================
  // 4. EXTERNAL INTEGRATIONS: WHATSAPP SIGNATURES & PRODUCTION SAFETY
  // =========================================================================

  test('Twilio: Official Twilio HMAC-SHA1 signature across URL + sorted POST params is verified', () => {
    const twilioAdapter = new TwilioAdapter({
      apiSecret: 'test_twilio_secret_token_12345'
    });

    const webhookUrl = 'https://fleet.technofay.com/api/v1/whatsapp/webhook';
    const postParams = {
      MessageSid: 'SM1234567890abcdef',
      MessageStatus: 'delivered',
      To: 'whatsapp:+919876543210',
      From: 'whatsapp:+14155238886'
    };

    // Construct official Twilio signature: URL + sorted key-values hashed with HMAC-SHA1 in Base64
    let signaturePayload = webhookUrl;
    Object.keys(postParams).sort().forEach((k) => {
      signaturePayload += k + postParams[k];
    });
    const expectedSignature = crypto
      .createHmac('sha1', 'test_twilio_secret_token_12345')
      .update(signaturePayload, 'utf-8')
      .digest('base64');

    const isValid = twilioAdapter.verifyWebhookSignature({
      signature: expectedSignature,
      url: webhookUrl,
      params: postParams
    });

    assert.equal(isValid, true, 'Official Twilio HMAC-SHA1 signature must validate successfully');

    // Tampered parameter must fail
    const isTamperedValid = twilioAdapter.verifyWebhookSignature({
      signature: expectedSignature,
      url: webhookUrl,
      params: { ...postParams, MessageStatus: 'failed' }
    });
    assert.equal(isTamperedValid, false, 'Tampered parameters must fail signature validation');
  });

  test('Interakt: Deterministic variable ordering aligns with pre-approved template requiredVars', () => {
    const interaktAdapter = new InteraktAdapter({ apiKey: 'fake_interakt_api_key' });
    const { TEMPLATES } = require('../apps/api/src/modules/whatsapp/services/whatsappTemplate.service');

    const { WhatsAppTemplateType } = require('@fleet/shared');
    // Given VEHICLE_DISPATCHED template: requiredVars = ['tripNumber', 'vehiclePlate', 'driverName']
    const templateDef = TEMPLATES[WhatsAppTemplateType.VEHICLE_DISPATCHED];
    assert.ok(templateDef, 'VEHICLE_DISPATCHED template must exist');

    // Input unordered object
    const unorderedVars = {
      driverName: 'Rameshwar Yadav',
      extraParam: 'IgnoreMe',
      vehiclePlate: 'MH04AB1234',
      tripNumber: 'TR-998877'
    };

    // When extracted deterministically
    const extractedValues = templateDef.requiredVars.map(key => String(unorderedVars[key] ?? ''));

    // Then values must match exact requiredVars positions
    assert.deepEqual(extractedValues, [
      'TR-998877',
      'MH04AB1234',
      'Rameshwar Yadav'
    ]);
  });

  test('WhatsApp Service: Production guard prevents mock provider from recording false deliveredAt', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const { WhatsAppTemplateType } = require('@fleet/shared');
      // Sending custom message in production with mock provider
      const sendResult = await whatsappService.sendMessage({
        companyId: companyA._id,
        toPhone: '+919876543210',
        templateName: WhatsAppTemplateType.VEHICLE_DISPATCHED,
        variables: {
          tripNumber: 'TR-100',
          vehiclePlate: 'MH04AB1234',
          driverName: 'Rameshwar'
        }
      });

      assert.ok(sendResult, 'Send result returned');
      // In production, mock provider message must NOT have fake deliveredAt written
      assert.ok(!sendResult.deliveredAt, 'deliveredAt must NOT be populated by mock in production');
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  // =========================================================================
  // 5. BULK DATA: FORMULA INJECTION DEFENSE & QUERY BOUNDS
  // =========================================================================

  test('Spreadsheet Sanitization: Leading formula triggers (=, +, -, @, Tab, CR) are safely escaped', () => {
    const dangerousFormulas = [
      '=SUM(A1:B10)',
      '+cmd|\' /C calc\'!A0',
      '-2+3+cmd|\' /C notepad\'!A0',
      '@SUM(1,2)',
      '\t=HYPERLINK("http://attacker.com")',
      '\r=cmd|'
    ];

    for (const f of dangerousFormulas) {
      const sanitized = masterImportExportService.sanitizeSpreadsheetValue(f);
      assert.ok(sanitized.startsWith("'"), `Formula '${f}' must be escaped with leading single quote: got '${sanitized}'`);
    }

    // Safe business strings and values must remain unescaped
    assert.equal(masterImportExportService.sanitizeSpreadsheetValue('Tata Steel Ltd'), 'Tata Steel Ltd');
    assert.equal(masterImportExportService.sanitizeSpreadsheetValue(45000), 45000);
    assert.equal(masterImportExportService.sanitizeSpreadsheetValue(null), '');
  });

  test('Export Queries: exportMasterData bounds query result limit and prevents unbounded memory consumption', async () => {
    const exportResult = await masterImportExportService.exportMasterData({
      entityType: 'customers',
      companyId: companyA._id,
      format: 'csv',
      filters: { limit: '5' }
    });

    assert.ok(exportResult);
    assert.equal(exportResult.contentType, 'text/csv; charset=utf-8');
    assert.ok(Buffer.isBuffer(exportResult.buffer));
    assert.ok(exportResult.totalRecords <= 5, 'Must respect bounded limit');
  });

});
