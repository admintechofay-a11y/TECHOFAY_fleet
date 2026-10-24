/**
 * Phase 9 Integration Test Suite: End-to-End Hardening & 20-Point Launch Checklist
 * Tests full lifecycle workflows, SEO files, public contact forms, redirects, and security boundaries.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const app = require('../src/app');
const db = require('../src/config/db');
const Company = require('../src/modules/auth/models/Company');
const User = require('../src/modules/auth/models/User');
const Role = require('../src/modules/auth/models/Role');
const Vehicle = require('../src/modules/vehicles/models/Vehicle');
const Driver = require('../src/modules/drivers/models/Driver');
const ProofOfDelivery = require('../src/modules/pod/models/ProofOfDelivery');
const BootstrapService = require('../src/modules/auth/services/bootstrap.service');
const ContactSubmission = require('../src/modules/contact/models/ContactSubmission');

describe('Phase 9 Integration Test Suite: End-to-End Hardening & Launch Checklist', () => {
  let server;
  let baseUrl;
  let rootUrl;
  let companyAId;
  let companyBId;
  let tokenCompanyA;
  let tokenCompanyB;
  let tokenOperatorA;

  before(async () => {
    try {
      await db.connectDatabase();
      const timestamp = Date.now();

      // 1. Bootstrap Company A
      const bootA = await BootstrapService.bootstrapSystem({
        companyLegalName: `Phase 9 Alpha Haulage A ${timestamp}`,
        companyGstin: `27AABCU${timestamp.toString().slice(-4)}M1ZM`,
        adminEmail: `phase9.admin.${timestamp}@alpha-a.com`,
        adminPassword: 'PasswordA123!',
        adminName: 'Alpha Super Admin'
      });
      companyAId = bootA.company._id.toString();

      // 2. Bootstrap Company B (Competitor)
      const bootB = await BootstrapService.bootstrapSystem({
        companyLegalName: `Phase 9 Beta Express B ${timestamp}`,
        companyGstin: `29BCDEF${timestamp.toString().slice(-4)}B1Z2`,
        adminEmail: `phase9.admin.${timestamp}@beta-b.com`,
        adminPassword: 'PasswordB123!',
        adminName: 'Beta Super Admin'
      });
      companyBId = bootB.company._id.toString();

      // 3. Create Data Entry Operator in Company A
      const operatorRole = await Role.findOne({ companyId: companyAId, name: 'Data Entry Operator' });
      const opUserA = await User.create({
        companyId: companyAId,
        name: 'Alpha Operator',
        email: `phase9.op.${timestamp}@alpha-a.com`,
        passwordHash: 'PasswordA123!',
        roleId: operatorRole._id,
        isActive: true
      });

      // Start Ephemeral HTTP Server
      await new Promise((resolve) => {
        server = app.listen(0, '127.0.0.1', () => {
          const port = server.address().port;
          rootUrl = `http://127.0.0.1:${port}`;
          baseUrl = `http://127.0.0.1:${port}/api/v1`;
          resolve();
        });
      });

      // Login Admin A
      const loginARes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `phase9.admin.${timestamp}@alpha-a.com`,
          password: 'PasswordA123!'
        })
      });
      const loginAData = await loginARes.json();
      tokenCompanyA = loginAData.data.accessToken;

      // Login Admin B
      const loginBRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `phase9.admin.${timestamp}@beta-b.com`,
          password: 'PasswordB123!'
        })
      });
      const loginBData = await loginBRes.json();
      tokenCompanyB = loginBData.data.accessToken;

      // Login Operator A
      const loginOpRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `phase9.op.${timestamp}@alpha-a.com`,
          password: 'PasswordA123!'
        })
      });
      const loginOpData = await loginOpRes.json();
      tokenOperatorA = loginOpData.data.accessToken;
    } catch (err) {
      console.error('Setup failed in Phase 9 tests:', err);
      throw err;
    }
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  // TEST 1: Full End-to-End Operational Lifecycle
  test('1. End-to-End Workflow: Customer -> Vehicle/Driver -> Load -> LR -> Trip -> POD -> Closure', async () => {
    const timestamp = Date.now();

    // Step A: Create Customer & Location
    const resCust = await fetch(`${baseUrl}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCompanyA}`
      },
      body: JSON.stringify({
        name: `E2E Customer ${timestamp}`,
        tradeName: 'E2E Logistics Party',
        gstin: '27AABCU9603R1ZM',
        pan: 'AABCU9603R',
        email: `party.${timestamp}@e2e.com`,
        phone: '+919876543201',
        billingAddress: {
          street: '10 Industrial Area',
          city: 'Nagpur',
          state: 'Maharashtra',
          pincode: '440008',
          country: 'IN'
        }
      })
    });
    const dataCust = await resCust.json();
    assert.equal(resCust.status, 201);
    const customerId = dataCust.data._id;

    const resLoc = await fetch(`${baseUrl}/locations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCompanyA}`
      },
      body: JSON.stringify({
        name: `E2E Hub ${timestamp}`,
        code: `HUB${timestamp.toString().slice(-4)}`,
        address: {
          street: 'Wadi Transport Nagar',
          city: 'Nagpur',
          state: 'Maharashtra',
          pincode: '440023'
        },
        locationType: 'HUB'
      })
    });
    const dataLoc = await resLoc.json();
    assert.equal(resLoc.status, 201);
    const locationId = dataLoc.data._id;

    // Step B: Create Vehicle and Driver
    const resVeh = await fetch(`${baseUrl}/vehicles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCompanyA}`
      },
      body: JSON.stringify({
        plateNumber: `MH31AB${String(timestamp % 9000 + 1000)}`,
        vehicleType: 'TRUCK_10_TYRE',
        category: 'OWNED',
        capacityTonnage: 30.0,
        make: 'Tata Motors',
        model: 'Signa 4825.TK'
      })
    });
    const dataVeh = await resVeh.json();
    assert.equal(resVeh.status, 201);
    const vehicleId = dataVeh.data._id;

    const resDriv = await fetch(`${baseUrl}/drivers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCompanyA}`
      },
      body: JSON.stringify({
        name: `E2E Driver ${timestamp}`,
        phone: `98765${timestamp.toString().slice(-5)}`,
        licenseNumber: `MH312020${timestamp.toString().slice(-7)}`,
        licenseExpiryDate: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString()
      })
    });
    const dataDriv = await resDriv.json();
    assert.equal(resDriv.status, 201);
    const driverId = dataDriv.data._id;

    // Step C: Create Load with Waypoints and Charges
    const resLoad = await fetch(`${baseUrl}/loads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCompanyA}`
      },
      body: JSON.stringify({
        customerId,
        consignorId: customerId,
        consigneeId: customerId,
        totalWeightMt: 25.5,
        totalQuantity: 100,
        packageType: 'Steel Rods',
        stops: [
          {
            sequence: 1,
            stopType: 'PICKUP',
            locationId,
            allocatedQuantity: 100,
            allocatedWeightMt: 25.5
          },
          {
            sequence: 2,
            stopType: 'DELIVERY',
            locationId,
            allocatedQuantity: 100,
            allocatedWeightMt: 25.5
          }
        ],
        financials: {
          baseFreightPaise: 5000000, // ₹50,000
          loadingPaise: 200000,
          unloadingPaise: 200000,
          advancePaise: 2000000 // ₹20,000
        }
      })
    });
    const dataLoad = await resLoad.json();
    assert.equal(resLoad.status, 201);
    const loadId = dataLoad.data._id;
    assert.ok(dataLoad.data.loadNumber);

    // Step D: Allocate LR & Stream Document PDF
    const resLr = await fetch(`${baseUrl}/lr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCompanyA}`
      },
      body: JSON.stringify({
        loadId,
        isManualNumber: false,
        eWayBillNumber: '281098765432'
      })
    });
    const dataLr = await resLr.json();
    assert.equal(resLr.status, 201);
    assert.ok(dataLr.data.lrNumber);
    const lrId = dataLr.data._id;

    const resPdf = await fetch(`${baseUrl}/lr/${lrId}/pdf`, {
      headers: { Authorization: `Bearer ${tokenCompanyA}` }
    });
    assert.equal(resPdf.status, 200);
    const pdfBuffer = Buffer.from(await resPdf.arrayBuffer());
    assert.ok(pdfBuffer.toString().startsWith('%PDF'));

    // Step E: Create and Dispatch Trip
    const resTrip = await fetch(`${baseUrl}/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCompanyA}`
      },
      body: JSON.stringify({
        loadId,
        vehicleId,
        driverId,
        driverAdvancePaise: 1000000,
        remarks: 'Phase 9 E2E Trip'
      })
    });
    const dataTrip = await resTrip.json();
    assert.equal(resTrip.status, 201);
    const tripId = dataTrip.data._id;
    const delStop = dataTrip.data.stops.find((s) => s.stopType === 'DELIVERY');
    assert.ok(delStop);

    // Step F: Complete Delivery Stop
    const resDeliver = await fetch(`${baseUrl}/trips/${tripId}/stops/${delStop._id}/deliver`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCompanyA}`
      },
      body: JSON.stringify({
        deliveredQuantity: 100,
        receiverName: 'Suresh Patil'
      })
    });
    assert.equal(resDeliver.status, 200);

    // Step G: Create & Verify Proof of Delivery (POD)
    const pod = await ProofOfDelivery.create({
      companyId: companyAId,
      loadId,
      tripId,
      podNumber: `POD-E2E-${timestamp.toString().slice(-4)}`,
      fileKey: 'uploads/pod_sample.pdf',
      originalFileName: 'pod_sample.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
      quantityDelivered: 100,
      receiverName: 'Suresh Patil',
      status: 'PENDING_VERIFICATION'
    });

    const resVerifyPod = await fetch(`${baseUrl}/pod/${pod._id}/verify`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCompanyA}`
      },
      body: JSON.stringify({
        status: 'VERIFIED',
        remarks: 'Stamped consignment received'
      })
    });
    assert.equal(resVerifyPod.status, 200);

    // Step H: Close Trip & Verify Asset Status Returns to AVAILABLE
    const resClose = await fetch(`${baseUrl}/trips/${tripId}/close`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCompanyA}`
      },
      body: JSON.stringify({
        remarks: 'Trip successfully completed and reconciled'
      })
    });
    assert.equal(resClose.status, 200);

    const checkVeh = await Vehicle.findById(vehicleId);
    assert.equal(checkVeh.status, 'AVAILABLE');

    const checkDriv = await Driver.findById(driverId);
    assert.equal(checkDriv.status, 'AVAILABLE');
  });

  // TEST 2: Launch Checklist #2 & #3 (robots.txt and sitemap.xml)
  test('2. SEO & Crawlers: Serves valid robots.txt and sitemap.xml with private path protection', async () => {
    // Check robots.txt
    const resRobots = await fetch(`${rootUrl}/robots.txt`);
    assert.equal(resRobots.status, 200);
    assert.ok(resRobots.headers.get('content-type').includes('text/plain'));
    const robotsText = await resRobots.text();
    assert.ok(robotsText.includes('Allow: /'));
    assert.ok(robotsText.includes('Disallow: /app/'));
    assert.ok(robotsText.includes('Disallow: /api/'));
    assert.ok(robotsText.includes('Disallow: /documents/'));
    assert.ok(robotsText.includes('Sitemap: https://transport.technofay.com/sitemap.xml'));

    // Check sitemap.xml
    const resSitemap = await fetch(`${rootUrl}/sitemap.xml`);
    assert.equal(resSitemap.status, 200);
    assert.ok(resSitemap.headers.get('content-type').includes('xml'));
    const sitemapText = await resSitemap.text();
    assert.ok(sitemapText.includes('<urlset'));
    assert.ok(sitemapText.includes('https://transport.technofay.com/contact'));
    assert.ok(sitemapText.includes('https://transport.technofay.com/privacy'));
    assert.ok(sitemapText.includes('https://transport.technofay.com/terms'));
    // Ensure zero private operational paths leaked in sitemap
    assert.ok(!sitemapText.includes('/app/'));
    assert.ok(!sitemapText.includes('/api/'));
  });

  // TEST 3: Launch Checklist #10 (301 Permanent Redirects)
  test('3. Redirects: Validates loop-free 301 permanent redirects for legacy paths', async () => {
    const resRedirect = await fetch(`${rootUrl}/dashboard`, { redirect: 'manual' });
    assert.equal(resRedirect.status, 301);
    assert.equal(resRedirect.headers.get('location'), '/app/dashboard');

    const resLoginRedirect = await fetch(`${rootUrl}/login.html`, { redirect: 'manual' });
    assert.equal(resLoginRedirect.status, 301);
    assert.equal(resLoginRedirect.headers.get('location'), '/login');
  });

  // TEST 4: Launch Checklist #20 (Working Contact Form & Anti-Spam)
  test('4. Contact Form: Validates server persistence, honeypot neutralization, and field checks', async () => {
    const timestamp = Date.now();

    // Legitimate Submission
    const resContact = await fetch(`${baseUrl}/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Operations Manager ${timestamp}`,
        email: `ops.${timestamp}@transporter.com`,
        phone: '+919876543299',
        company: 'Apex Haulage Logistics',
        subject: 'Fleet Platform Inquiry',
        message: 'Interested in configuring multi-stop logistics with WhatsApp dispatching.'
      })
    });
    const dataContact = await resContact.json();
    assert.equal(resContact.status, 201);
    assert.equal(dataContact.success, true);
    assert.ok(dataContact.data.id);

    // Verify record was persisted in MongoDB
    const savedDoc = await ContactSubmission.findById(dataContact.data.id);
    assert.ok(savedDoc);
    assert.equal(savedDoc.email, `ops.${timestamp}@transporter.com`);
    assert.equal(savedDoc.status, 'NEW');

    // Bot Spam Neutralization via Honeypot
    const resSpam = await fetch(`${baseUrl}/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Spam Bot',
        email: 'spammer@botnet.com',
        message: 'Buy cheap seo backlinks',
        honeypot: 'gotcha_bot' // Populated honeypot
      })
    });
    const dataSpam = await resSpam.json();
    assert.equal(resSpam.status, 200);
    // Verify spam was NOT saved to MongoDB
    const botDoc = await ContactSubmission.findOne({ email: 'spammer@botnet.com' });
    assert.equal(botDoc, null);

    // Validation Error on Missing Message
    const resInvalid = await fetch(`${baseUrl}/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Valid Name',
        email: 'valid@company.com',
        message: ''
      })
    });
    assert.equal(resInvalid.status, 400);
  });

  // TEST 5: Launch Checklist Status & Audit API
  test('5. Launch Checklist Status: GET /api/v1/system/seo-audit reports 20/20 criteria verified', async () => {
    const resAudit = await fetch(`${baseUrl}/system/seo-audit`);
    assert.equal(resAudit.status, 200);
    const dataAudit = await resAudit.json();
    assert.equal(dataAudit.success, true);
    assert.equal(dataAudit.data.checklistItemsVerified, 20);
    assert.equal(dataAudit.data.totalItems, 20);
    assert.equal(dataAudit.data.complianceRate, '100%');
  });

  // TEST 6: Security: Unauthenticated Requests Rejected (401)
  test('6. Security: Rejects protected API requests without authorization token (401)', async () => {
    const resNoAuth = await fetch(`${baseUrl}/customers`);
    assert.equal(resNoAuth.status, 401);

    const resInvalidAuth = await fetch(`${baseUrl}/loads`, {
      headers: { Authorization: 'Bearer invalid.token.payload' }
    });
    assert.equal(resInvalidAuth.status, 401);
  });

  // TEST 7: Security: Role-Based Access Control (RBAC 403)
  test('7. RBAC: Denies unauthorized roles from modifying admin settings or viewing contact inquiries (403)', async () => {
    // Data Entry Operator attempting to modify organization settings (requires settings:edit)
    const resOpSettings = await fetch(`${baseUrl}/admin/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOperatorA}`
      },
      body: JSON.stringify({
        legalName: 'Hacked Name'
      })
    });
    assert.equal(resOpSettings.status, 403);

    // Data Entry Operator attempting to view contact submissions (requires Super Admin)
    const resOpContact = await fetch(`${baseUrl}/contact`, {
      headers: { Authorization: `Bearer ${tokenOperatorA}` }
    });
    assert.equal(resOpContact.status, 403);
  });

  // TEST 8: Multi-Tenant Boundary Isolation
  test('8. Multi-Tenancy: Competitor Company B cannot read Company A loads or master records', async () => {
    // Attempt to access Company A's loads using Company B's admin token
    const resLoadsB = await fetch(`${baseUrl}/loads`, {
      headers: { Authorization: `Bearer ${tokenCompanyB}` }
    });
    const dataLoadsB = await resLoadsB.json();
    assert.equal(resLoadsB.status, 200);
    // Company B must see 0 loads since all loads belong to Company A
    assert.equal(dataLoadsB.data.items.length, 0);

    // Attempt to access Company A customers using Company B's admin token
    const resCustB = await fetch(`${baseUrl}/customers`, {
      headers: { Authorization: `Bearer ${tokenCompanyB}` }
    });
    const dataCustB = await resCustB.json();
    assert.equal(resCustB.status, 200);
    assert.equal(dataCustB.data.items.length, 0);
  });
});
