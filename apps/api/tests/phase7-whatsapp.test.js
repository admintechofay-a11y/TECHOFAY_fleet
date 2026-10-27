/**
 * Comprehensive Phase 7 Integration Tests:
 * WhatsApp Messaging Engine, Provider Abstraction (Mock, Interakt, Twilio),
 * Template Registry, Document PDF Sharing, Webhook HMAC Signature Verification,
 * Idempotent Delivery Progression, Retries, and Multi-Tenant Isolation.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const app = require('../src/app');
const db = require('../src/config/db');
const BootstrapService = require('../src/modules/auth/services/bootstrap.service');
const CustomerParty = require('../src/modules/customers/models/CustomerParty');
const Location = require('../src/modules/locations/models/Location');
const Vehicle = require('../src/modules/vehicles/models/Vehicle');
const Driver = require('../src/modules/drivers/models/Driver');
const Load = require('../src/modules/loads/models/Load');
const LrNumber = require('../src/modules/lr/models/LrNumber');
const MessageLog = require('../src/modules/whatsapp/models/MessageLog');
const WhatsAppConfig = require('../src/modules/whatsapp/models/WhatsAppConfig');
const AuditLog = require('../src/modules/audit/models/AuditLog');
const eventBusService = require('../src/services/eventBus.service');

let server;
let baseUrl;
let companyA;
let companyB;
let userAToken;
let userBToken;

let testLoadId;
let testLrId;
let testLrNumber;
let testMessageId;
const testWebhookSecret = 'phase7_test_webhook_secret_key_999';

describe('Phase 7 Integration Test Suite: WhatsApp Messaging, Queue, Webhooks & Retries', () => {

  before(async () => {
    try {
      await db.connectDatabase();
      const timestamp = Date.now();

      // 1. Bootstrap Company A
      const bootstrapA = await BootstrapService.bootstrapSystem({
        companyLegalName: `Phase 7 Logistics Network A ${timestamp}`,
        companyGstin: `27ABCDE${timestamp.toString().slice(-4)}A1Z1`,
        adminEmail: `phase7.admin.${timestamp}@company-a.com`,
        adminPassword: 'PasswordA123!',
        adminName: 'Admin WhatsApp A'
      });
      companyA = bootstrapA.company;

      // 2. Bootstrap Company B
      const bootstrapB = await BootstrapService.bootstrapSystem({
        companyLegalName: `Phase 7 Competitor Express B ${timestamp}`,
        companyGstin: `29BCDEF${timestamp.toString().slice(-4)}B1Z2`,
        adminEmail: `phase7.admin.${timestamp}@company-b.com`,
        adminPassword: 'PasswordB123!',
        adminName: 'Admin WhatsApp B'
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
          email: `phase7.admin.${timestamp}@company-a.com`,
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
          email: `phase7.admin.${timestamp}@company-b.com`,
          password: 'PasswordB123!'
        })
      });
      const loginBData = await loginBRes.json();
      userBToken = loginBData.data.accessToken;

      // Seed Customer, Locations, Vehicle, Driver
      const consignor = await CustomerParty.create({
        companyId: companyA._id,
        name: `Tata Steel Jamshedpur ${timestamp}`,
        partyTypes: ['CONSIGNOR'],
        gstin: `20AABCT${timestamp.toString().slice(-4)}A1Z1`,
        billingAddress: { city: 'Jamshedpur', state: 'Jharkhand', pincode: '831001' }
      });

      const consignee = await CustomerParty.create({
        companyId: companyA._id,
        name: `Automotive Components Pune ${timestamp}`,
        partyTypes: ['CONSIGNEE'],
        gstin: `27AABCT${timestamp.toString().slice(-4)}B1Z2`,
        billingAddress: { city: 'Pune', state: 'Maharashtra', pincode: '411018' }
      });

      const originLoc = await Location.create({
        companyId: companyA._id,
        name: 'Jamshedpur Steel Yard',
        code: `LOC-JSR-${timestamp.toString().slice(-4)}`,
        locationType: 'PICKUP',
        address: { city: 'Jamshedpur', state: 'Jharkhand' }
      });

      const destLoc = await Location.create({
        companyId: companyA._id,
        name: 'Pune Industrial Hub',
        code: `LOC-PUN-${timestamp.toString().slice(-4)}`,
        locationType: 'DELIVERY',
        address: { city: 'Pune', state: 'Maharashtra' }
      });

      const vehicle = await Vehicle.create({
        companyId: companyA._id,
        plateNumber: `MH12WA${Math.floor(1000 + Math.random() * 8999)}`,
        vehicleType: 'Trailer 40ft',
        capacityTonnage: 35.0,
        status: 'AVAILABLE'
      });

      const driver = await Driver.create({
        companyId: companyA._id,
        name: 'Paramjit Singh',
        phone: '9822012345',
        licenseNumber: `MH122019${Math.floor(1000000 + Math.random() * 8999999)}`,
        licenseExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        status: 'AVAILABLE'
      });

      // Seed Load
      const load = await Load.create({
        companyId: companyA._id,
        loadNumber: `LD-2026-${Math.floor(10000 + Math.random() * 89999)}`,
        customerId: consignor._id,
        consignorId: consignor._id,
        consigneeId: consignee._id,
        originLocationId: originLoc._id,
        destinationLocationId: destLoc._id,
        assignedVehicleId: vehicle._id,
        assignedDriverId: driver._id,
        totalWeightMt: 32.0,
        totalQuantity: 400,
        packageType: 'Bundles',
        financials: {
          baseFreightPaise: 8800000,
          totalFreightPaise: 8800000,
          advancePaise: 2500000,
          balancePaise: 6300000
        },
        status: 'IN_TRANSIT'
      });
      testLoadId = load._id;

      // Seed Lorry Receipt (LR)
      testLrNumber = `LR-2026-${Math.floor(10000 + Math.random() * 89999)}`;
      const lr = await LrNumber.create({
        companyId: companyA._id,
        lrNumber: testLrNumber,
        loadId: load._id,
        customerId: consignor._id,
        consignorId: consignor._id,
        consigneeId: consignee._id,
        vehicleId: vehicle._id,
        driverId: driver._id,
        totalWeightMt: 32.0,
        totalPackages: 400,
        financials: {
          freightRatePaise: 8800000,
          totalFreightPaise: 8800000,
          advancePaidPaise: 2500000,
          balanceFreightPaise: 6300000
        },
        status: 'BOOKED'
      });
      testLrId = lr._id;

      // Configure Company A with Webhook Secret for testing HMAC
      await WhatsAppConfig.findOneAndUpdate(
        { companyId: companyA._id },
        {
          provider: 'MOCK',
          isEnabled: true,
          apiKey: 'interakt_live_key_998877665544',
          apiSecret: 'secret_live_tok_1122334455',
          webhookSecret: testWebhookSecret,
          senderNumber: '+919876543210'
        },
        { upsert: true }
      );

    } catch (err) {
      console.error('Phase 7 Test before() failed:', err);
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
  // Test 1: Phone Normalization & Validation
  // -------------------------------------------------------------
  test('1. Phone Validation: Normalizes Indian 10-digit mobile to E.164 and rejects invalid formats', async () => {
    // 1. Invalid phone number rejection
    const resInvalid = await fetch(`${baseUrl}/whatsapp/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        toPhone: '12345', // Too short
        templateName: 'LOAD_CREATED',
        variables: { loadNumber: 'LD-1', originCity: 'A', destCity: 'B', weightMt: '10' }
      })
    });
    assert.equal(resInvalid.status, 400);
    const dataInvalid = await resInvalid.json();
    assert.match(dataInvalid.message, /Invalid phone number/i);

    // 2. Standard 10-digit format normalization (e.g. 9822012345 -> +919822012345)
    const resValid = await fetch(`${baseUrl}/whatsapp/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        toPhone: '9822012345',
        recipientName: 'Consignee Receiver',
        templateName: 'LOAD_CREATED',
        variables: { loadNumber: 'LD-2026-0001', originCity: 'Mumbai', destCity: 'Pune', weightMt: '25' }
      })
    });
    assert.equal(resValid.status, 201);
    const dataValid = await resValid.json();
    assert.equal(dataValid.data.recipientPhone, '+919822012345');
  });

  // -------------------------------------------------------------
  // Test 2: Pre-Approved Template Dispatch & Audit Trail
  // -------------------------------------------------------------
  test('2. Template Dispatch: Sends pre-approved template with variable substitution & audit log', async () => {
    const res = await fetch(`${baseUrl}/whatsapp/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        toPhone: '+919876543210',
        recipientName: 'Dispatch Manager',
        templateName: 'VEHICLE_DISPATCHED',
        variables: {
          tripNumber: 'TR-2026-0088',
          loadNumber: 'LD-2026-0044',
          vehiclePlate: 'MH12WA1234',
          driverName: 'Paramjit Singh',
          driverPhone: '+91 98220 12345',
          originCity: 'Jamshedpur',
          destCity: 'Pune'
        },
        relatedEntity: {
          entityType: 'LOAD',
          entityId: testLoadId,
          referenceNumber: 'LD-2026-0044'
        }
      })
    });

    assert.equal(res.status, 201);
    const resData = await res.json();
    assert.equal(resData.success, true);
    assert.equal(resData.data.provider, 'MOCK');
    assert.equal(resData.data.status, 'MOCK_DELIVERED');
    assert.ok(resData.data.providerMessageId);
    assert.ok(resData.data.deliveredAt);
    assert.match(resData.data.renderedMessage, /Trip Dispatched - On The Move/);
    assert.match(resData.data.renderedMessage, /Paramjit Singh/);

    testMessageId = resData.data._id;

    // Verify audit log entry was written
    const audit = await AuditLog.findOne({
      companyId: companyA._id,
      module: 'whatsapp',
      action: 'CREATE',
      entityId: testMessageId
    });
    assert.ok(audit, 'Audit log must record WhatsApp dispatch action');
  });

  // -------------------------------------------------------------
  // Test 3: Document PDF Sharing via WhatsApp
  // -------------------------------------------------------------
  test('3. Document Sharing: Dispatches LR PDF document with authenticated stream URL and caption', async () => {
    const res = await fetch(`${baseUrl}/whatsapp/send-document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        toPhone: '+919876543210',
        recipientName: 'Tata Steel Logistics Desk',
        documentType: 'LR',
        documentId: testLrId,
        caption: `Consignment LR ${testLrNumber} issued for Jamshedpur-Pune route.`
      })
    });

    assert.equal(res.status, 201);
    const resData = await res.json();
    assert.equal(resData.success, true);
    assert.equal(resData.data.messageType, 'PDF');
    assert.equal(resData.data.status, 'MOCK_DELIVERED');
    assert.equal(resData.data.documentFileName, `LR_${testLrNumber}.pdf`);
    assert.ok(resData.data.documentUrl.includes(`/documents/lr/${testLrId}/pdf`));
  });

  // -------------------------------------------------------------
  // Test 4: Webhook HMAC Cryptographic Signature Verification
  // -------------------------------------------------------------
  test('4. Webhooks Security: Rejects forged signatures and accepts valid HMAC-SHA256 signature', async () => {
    // 1. Missing signature -> 401
    const resNoSig = await fetch(`${baseUrl}/whatsapp/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: 'mock_123', status: 'delivered' })
    });
    assert.equal(resNoSig.status, 401);

    // 2. Forged signature -> 401
    const resForged = await fetch(`${baseUrl}/whatsapp/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': 'sha256=0000000000000000000000000000000000000000000000000000000000000000'
      },
      body: JSON.stringify({
        providerMessageId: (await MessageLog.findById(testMessageId)).providerMessageId,
        status: 'delivered'
      })
    });
    assert.equal(resForged.status, 401);

    // 3. Valid HMAC-SHA256 signature -> 200
    const targetMsg = await MessageLog.findById(testMessageId);
    const webhookPayload = {
      providerMessageId: targetMsg.providerMessageId,
      status: 'delivered',
      timestamp: new Date().toISOString()
    };
    const rawPayload = JSON.stringify(webhookPayload);
    const validSignature = crypto
      .createHmac('sha256', testWebhookSecret)
      .update(rawPayload)
      .digest('hex');

    const resValid = await fetch(`${baseUrl}/whatsapp/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': `sha256=${validSignature}`
      },
      body: rawPayload
    });

    assert.equal(resValid.status, 200);
    const validData = await resValid.json();
    assert.equal(validData.success, true);
    assert.equal(validData.data.acknowledged, true);
    assert.equal(validData.data.processed, true);
  });

  // -------------------------------------------------------------
  // Test 5: Webhook Status Progression & Idempotency
  // -------------------------------------------------------------
  test('5. Idempotent Status Progression: Advances DELIVERED -> READ without status degradation', async () => {
    // 1. Advance to READ
    const targetMsg = await MessageLog.findById(testMessageId);
    const readPayload = JSON.stringify({
      providerMessageId: targetMsg.providerMessageId,
      status: 'read',
      timestamp: new Date().toISOString()
    });
    const readSig = crypto.createHmac('sha256', testWebhookSecret).update(readPayload).digest('hex');

    const resRead = await fetch(`${baseUrl}/whatsapp/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': `sha256=${readSig}`
      },
      body: readPayload
    });
    assert.equal(resRead.status, 200);

    const updatedAfterRead = await MessageLog.findById(testMessageId);
    assert.equal(updatedAfterRead.status, 'READ');
    assert.ok(updatedAfterRead.readAt);

    // 2. Late/Duplicate DELIVERED webhook should NOT degrade status from READ
    const dupDeliveredPayload = JSON.stringify({
      providerMessageId: targetMsg.providerMessageId,
      status: 'delivered',
      timestamp: new Date().toISOString()
    });
    const dupSig = crypto.createHmac('sha256', testWebhookSecret).update(dupDeliveredPayload).digest('hex');

    const resDup = await fetch(`${baseUrl}/whatsapp/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': `sha256=${dupSig}`
      },
      body: dupDeliveredPayload
    });
    assert.equal(resDup.status, 200);

    const checkStillRead = await MessageLog.findById(testMessageId);
    assert.equal(checkStillRead.status, 'READ', 'Status must remain READ and not degrade to DELIVERED');
  });

  // -------------------------------------------------------------
  // Test 6: Message Failure & Retry Mechanism
  // -------------------------------------------------------------
  test('6. Failures & Retries: Captures failed delivery and handles retry with backoff tracking', async () => {
    // 1. Dispatch to simulated failing number (ends with 999999)
    const resFail = await fetch(`${baseUrl}/whatsapp/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        toPhone: '+919999999999',
        recipientName: 'Failing Simulation Receiver',
        templateName: 'LOAD_CREATED',
        variables: { loadNumber: 'LD-FAIL-01', originCity: 'A', destCity: 'B', weightMt: '10' }
      })
    });

    assert.equal(resFail.status, 201);
    const failData = await resFail.json();
    assert.equal(failData.data.status, 'FAILED');
    assert.ok(failData.data.errorMessage);
    const failedMsgId = failData.data._id;

    // 2. Execute Retry via endpoint
    const resRetry = await fetch(`${baseUrl}/whatsapp/retry/${failedMsgId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.equal(resRetry.status, 200);
    const retryData = await resRetry.json();
    assert.equal(retryData.data.retryCount, 1);

    // 3. Reject retrying an already delivered message
    const resBadRetry = await fetch(`${baseUrl}/whatsapp/retry/${testMessageId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.equal(resBadRetry.status, 400);
    const badRetryData = await resBadRetry.json();
    assert.match(badRetryData.message, /Cannot retry message with status/i);
  });

  // -------------------------------------------------------------
  // Test 7: Multi-Tenant Data Isolation
  // -------------------------------------------------------------
  test('7. Multi-Tenant Isolation: Competitor Company B cannot view or retry Company A messages', async () => {
    // Company B attempts to read Company A's message log
    const resRead = await fetch(`${baseUrl}/whatsapp/messages/${testMessageId}`, {
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    assert.equal(resRead.status, 404, 'Competitor must receive 404 when querying another tenant message');

    // Company B attempts to retry Company A's message
    const resRetry = await fetch(`${baseUrl}/whatsapp/retry/${testMessageId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    assert.equal(resRetry.status, 404, 'Competitor must receive 404 when attempting cross-tenant retry');

    // Company B list messages returns 0 of Company A's messages
    const resListB = await fetch(`${baseUrl}/whatsapp/messages`, {
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    const listBData = await resListB.json();
    assert.equal(listBData.data.length, 0);
  });

  // -------------------------------------------------------------
  // Test 8: Admin Provider Configuration & Masked Credentials
  // -------------------------------------------------------------
  test('8. Configuration & Security: Masked credentials prevent raw secret leakage in admin settings', async () => {
    // 1. Get masked configuration
    const resGetConfig = await fetch(`${baseUrl}/whatsapp/config`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.equal(resGetConfig.status, 200);
    const configData = await resGetConfig.json();
    assert.equal(configData.data.provider, 'MOCK');
    assert.equal(configData.data.hasApiKey, true);
    assert.equal(configData.data.maskedApiKey, '••••••••5544');
    assert.equal(configData.data.hasApiSecret, true);
    assert.equal(configData.data.maskedApiSecret, '••••••••4455');
    assert.equal(configData.data.maskedWebhookSecret, '••••••••_999');

    // Verify raw keys are NOT present in JSON
    assert.equal(configData.data.apiKey, undefined);
    assert.equal(configData.data.apiSecret, undefined);
    assert.equal(configData.data.webhookSecret, undefined);

    // 2. Update Configuration
    const resUpdate = await fetch(`${baseUrl}/whatsapp/config`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        provider: 'MOCK',
        isEnabled: true,
        senderNumber: '+919988776655'
      })
    });
    assert.equal(resUpdate.status, 200);
    const updatedData = await resUpdate.json();
    assert.equal(updatedData.data.senderNumber, '+919988776655');
  });

  // -------------------------------------------------------------
  // Test 9: Outbound Batch Queue Dispatching
  // -------------------------------------------------------------
  test('9. Outbound Batch Dispatching: POST /whatsapp/send-batch queues and dispatches multiple messages returning aggregate metrics', async () => {
    const batchPayload = {
      messages: [
        {
          toPhone: '+919876543210',
          recipientName: 'Consignor Contact',
          templateName: 'LOAD_CREATED',
          variables: { loadNumber: 'LD-BATCH-01', originCity: 'Delhi', destCity: 'Jaipur', weightMt: '18' }
        },
        {
          toPhone: '+919876543211',
          recipientName: 'Consignee Contact',
          templateName: 'IN_TRANSIT',
          variables: { loadNumber: 'LD-BATCH-01', destCity: 'Jaipur' }
        },
        {
          toPhone: 'invalid-number',
          recipientName: 'Faulty Phone User',
          templateName: 'LOAD_CREATED',
          variables: { loadNumber: 'LD-BATCH-02', originCity: 'Delhi', destCity: 'Agra', weightMt: '10' }
        }
      ]
    };

    const resBatch = await fetch(`${baseUrl}/whatsapp/send-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify(batchPayload)
    });

    assert.equal(resBatch.status, 200);
    const batchData = await resBatch.json();
    assert.equal(batchData.success, true);
    assert.equal(batchData.data.total, 3);
    assert.equal(batchData.data.successful, 2);
    assert.equal(batchData.data.failed, 1);
    assert.equal(batchData.data.results.length, 3);
    assert.equal(batchData.data.results[2].success, false);
    assert.match(batchData.data.results[2].error, /Invalid phone number/i);
  });

  // -------------------------------------------------------------
  // Test 10: Webhook Replay Attack Defense
  // -------------------------------------------------------------
  test('10. Webhook Replay Defense: Suppresses duplicate webhook events when identical cryptographic signatures are submitted', async () => {
    // 1. Create a fresh test message
    const msg = await MessageLog.create({
      companyId: companyA._id,
      provider: 'MOCK',
      recipientPhone: '+919876543222',
      templateName: 'LOAD_CREATED',
      messageType: 'TEMPLATE',
      renderedMessage: 'Replay defense test',
      providerMessageId: `mock_replay_test_${Date.now()}`,
      status: 'DISPATCHED'
    });

    const webhookPayload = JSON.stringify({
      providerMessageId: msg.providerMessageId,
      status: 'delivered',
      timestamp: new Date().toISOString()
    });

    const sig = crypto.createHmac('sha256', testWebhookSecret).update(webhookPayload).digest('hex');

    // First delivery -> processed: true
    const resFirst = await fetch(`${baseUrl}/whatsapp/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': `sha256=${sig}`
      },
      body: webhookPayload
    });
    assert.equal(resFirst.status, 200);
    const dataFirst = await resFirst.json();
    assert.equal(dataFirst.data.acknowledged, true);
    assert.equal(dataFirst.data.processed, true);

    // Replay with identical signature -> suppressed by replay cache
    const resReplay = await fetch(`${baseUrl}/whatsapp/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': `sha256=${sig}`
      },
      body: webhookPayload
    });
    assert.equal(resReplay.status, 200);
    const dataReplay = await resReplay.json();
    assert.equal(dataReplay.data.acknowledged, true);
    assert.equal(dataReplay.data.processed, false);
    assert.match(dataReplay.data.reason, /Duplicate webhook signature suppressed/i);
  });

  // -------------------------------------------------------------
  // Test 11: Real-time Event Bus Push on Webhook Status Update
  // -------------------------------------------------------------
  test('11. Real-time Event Bus Push: Emits SSE event WHATSAPP_STATUS_UPDATED when status progresses via webhook', async () => {
    const sseMsg = await MessageLog.create({
      companyId: companyA._id,
      provider: 'MOCK',
      recipientPhone: '+919876543233',
      templateName: 'LOAD_CREATED',
      messageType: 'TEMPLATE',
      renderedMessage: 'Realtime SSE event test',
      providerMessageId: `mock_sse_test_${Date.now()}`,
      status: 'DISPATCHED'
    });

    let receivedEvent = null;
    const unsubscribe = eventBusService.subscribe(companyA._id.toString(), (event) => {
      if (event.eventType === 'WHATSAPP_STATUS_UPDATED' && event.payload?.providerMessageId === sseMsg.providerMessageId) {
        receivedEvent = event;
      }
    });

    try {
      const webhookPayload = JSON.stringify({
        providerMessageId: sseMsg.providerMessageId,
        status: 'delivered',
        timestamp: new Date().toISOString()
      });

      const sig = crypto.createHmac('sha256', testWebhookSecret).update(webhookPayload).digest('hex');

      const res = await fetch(`${baseUrl}/whatsapp/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': `sha256=${sig}`
        },
        body: webhookPayload
      });
      assert.equal(res.status, 200);

      // Verify that event was emitted through the SSE event bus
      assert.ok(receivedEvent, 'Event bus must receive WHATSAPP_STATUS_UPDATED event');
      assert.equal(receivedEvent.payload.status, 'DELIVERED');
      assert.equal(receivedEvent.payload.providerMessageId, sseMsg.providerMessageId);
    } finally {
      unsubscribe();
    }
  });

  // -------------------------------------------------------------
  // Test 12: Dual Webhook Routes & Meta Graph API Payload Format
  // -------------------------------------------------------------
  test('12. Dual Webhook Route & Meta Graph API Payload: Handles POST /whatsapp/webhook/:provider with nested entry[0].changes[0].value.statuses payload', async () => {
    const metaMsg = await MessageLog.create({
      companyId: companyA._id,
      provider: 'MOCK',
      recipientPhone: '+919876543244',
      templateName: 'LOAD_CREATED',
      messageType: 'TEMPLATE',
      renderedMessage: 'Meta payload test',
      providerMessageId: `wamid.HBgLMOTE5ODc2NTQzMjQ0FQIAEhgg${Date.now()}`,
      status: 'DISPATCHED'
    });

    const metaPayload = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'meta_waba_101',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                statuses: [
                  {
                    id: metaMsg.providerMessageId,
                    status: 'delivered',
                    timestamp: Math.floor(Date.now() / 1000).toString()
                  }
                ]
              }
            }
          ]
        }
      ]
    });

    const metaSig = crypto.createHmac('sha256', testWebhookSecret).update(metaPayload).digest('hex');

    // Post to parameterized endpoint: /whatsapp/webhook/meta
    const res = await fetch(`${baseUrl}/whatsapp/webhook/meta`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': `sha256=${metaSig}`
      },
      body: metaPayload
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.data.processed, true);

    const checkMsg = await MessageLog.findById(metaMsg._id);
    assert.equal(checkMsg.status, 'DELIVERED');
  });

  // -------------------------------------------------------------
  // Test 13: Outbound WhatsApp Rate Limiting Headers
  // -------------------------------------------------------------
  test('13. Outbound WhatsApp Rate Limiter: Enforces rate limiting headers X-WhatsApp-RateLimit-Limit & X-WhatsApp-RateLimit-Remaining', async () => {
    const res = await fetch(`${baseUrl}/whatsapp/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        toPhone: '+919876543299',
        templateName: 'LOAD_CREATED',
        variables: { loadNumber: 'LD-RATE-01', originCity: 'A', destCity: 'B', weightMt: '10' }
      })
    });

    assert.equal(res.status, 201);
    assert.ok(res.headers.has('x-whatsapp-ratelimit-limit'), 'Must include X-WhatsApp-RateLimit-Limit header');
    assert.ok(res.headers.has('x-whatsapp-ratelimit-remaining'), 'Must include X-WhatsApp-RateLimit-Remaining header');
    const limit = parseInt(res.headers.get('x-whatsapp-ratelimit-limit'), 10);
    assert.equal(limit, 60);
  });

});
