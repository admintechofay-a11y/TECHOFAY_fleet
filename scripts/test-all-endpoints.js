const express = require('express');
const http = require('node:http');
const mockRouter = require('../apps/api/src/routes/mockRouter');

const app = express();
app.use(express.json());
app.use('/api/v1', mockRouter);

const server = http.createServer(app);

function doRequest(server, method, path, body) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port: addr.port,
      path,
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, res => {
      let data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => {
        const buf = Buffer.concat(data);
        let parsed = null;
        try {
          parsed = JSON.parse(buf.toString());
        } catch (_) {}
        resolve({
          status: res.statusCode,
          header: res.headers,
          body: parsed || buf.toString(),
          rawBody: buf
        });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  const tests = [
    // Auth
    { method: 'get', url: '/api/v1/auth/me', check: res => res.status === 200 && res.body.data.user },
    { method: 'post', url: '/api/v1/auth/login', body: { email: 'barkattemposervice@gmail.com' }, check: res => res.status === 200 && res.body.data.accessToken },

    // Dashboard & Telematics
    { method: 'get', url: '/api/v1/dashboard/metrics', check: res => res.status === 200 && res.body.data.loads },
    { method: 'get', url: '/api/v1/dashboard/trends?days=7', check: res => res.status === 200 && Array.isArray(res.body.data) },
    { method: 'get', url: '/api/v1/dashboard/alerts', check: res => res.status === 200 && Array.isArray(res.body.data) },
    { method: 'get', url: '/api/v1/telematics/status', check: res => res.status === 200 && res.body.data.isConfigured },

    // Master Data
    { method: 'get', url: '/api/v1/vehicles', check: res => res.status === 200 && (res.body.data.items || []).length > 0 },
    { method: 'get', url: '/api/v1/drivers', check: res => res.status === 200 && (res.body.data.items || []).length > 0 },
    { method: 'get', url: '/api/v1/customers', check: res => res.status === 200 && (res.body.data.items || []).length > 0 },
    { method: 'get', url: '/api/v1/locations', check: res => res.status === 200 && (res.body.data.items || []).length > 0 },

    // Loads
    { method: 'get', url: '/api/v1/loads', check: res => res.status === 200 && (res.body.data.items || []).length > 0 },
    { method: 'get', url: '/api/v1/loads/LD-2026-0001', check: res => res.status === 200 && res.body.data.loadNumber === 'LD-2026-0001' },
    { method: 'patch', url: '/api/v1/loads/671e3b0f27d7a87e3cbb0050/status', body: { status: 'LOADING' }, check: res => res.status === 200 && res.body.data.status === 'LOADING' },
    { method: 'post', url: '/api/v1/loads/671e3b0f27d7a87e3cbb0054/assign', body: { vehicleId: '671e3b0f27d7a87e3cbb0010', driverId: '671e3b0f27d7a87e3cbb0020' }, check: res => res.status === 200 && res.body.data.status === 'VEHICLE_ASSIGNED' },
    { method: 'get', url: '/api/v1/loads/LD-2026-0001/pdf', check: res => res.status === 200 && res.header['content-type'].includes('pdf') },
    { method: 'get', url: '/api/v1/loads/LD-2026-0001/loading-slip', check: res => res.status === 200 && res.header['content-type'].includes('pdf') },

    // Bilties & LR
    { method: 'get', url: '/api/v1/bilties', check: res => res.status === 200 && (res.body.data.items || []).length > 0 },
    { method: 'get', url: '/api/v1/lr', check: res => res.status === 200 && (res.body.data.items || []).length > 0 },
    { method: 'post', url: '/api/v1/lr', body: { freightAmount: 50000, consignor: 'Party A' }, check: res => res.status === 201 && res.body.data.lrNumber },
    { method: 'patch', url: '/api/v1/lr/671e3b0f27d7a87e3cbb0060/status', body: { status: 'DELIVERED' }, check: res => res.status === 200 },
    { method: 'get', url: '/api/v1/lr/671e3b0f27d7a87e3cbb0060/pdf', check: res => res.status === 200 && res.header['content-type'].includes('pdf') },

    // Trips
    { method: 'get', url: '/api/v1/trips', check: res => res.status === 200 && (res.body.data.items || []).length > 0 },
    { method: 'get', url: '/api/v1/trips/671e3b0f27d7a87e3cbb0071', check: res => res.status === 200 && res.body.data.vehicleId && res.body.data.vehicleId.plateNumber },
    { method: 'patch', url: '/api/v1/trips/671e3b0f27d7a87e3cbb0071/status', body: { status: 'IN_TRANSIT' }, check: res => res.status === 200 },
    { method: 'post', url: '/api/v1/trips/671e3b0f27d7a87e3cbb0071/stops/trp_stp_2_2/deliver', body: { deliveredQuantity: 140 }, check: res => res.status === 200 },
    { method: 'post', url: '/api/v1/trips/671e3b0f27d7a87e3cbb0071/expenses', body: { amountRupees: 2500, expenseType: 'TOLL' }, check: res => res.status === 201 },
    { method: 'post', url: '/api/v1/trips/671e3b0f27d7a87e3cbb0071/close', check: res => res.status === 200 && res.body.data.status === 'CLOSED' },
    { method: 'get', url: '/api/v1/trips/671e3b0f27d7a87e3cbb0070/tripsheet', check: res => res.status === 200 && res.header['content-type'].includes('pdf') },

    // POD
    { method: 'get', url: '/api/v1/pod', check: res => res.status === 200 && (res.body.data.items || []).length > 0 },
    { method: 'post', url: '/api/v1/pod/671e3b0f27d7a87e3cbb0080/verify', body: { status: 'VERIFIED' }, check: res => res.status === 200 && res.body.data.status === 'VERIFIED' },
    { method: 'get', url: '/api/v1/pod/671e3b0f27d7a87e3cbb0080/download', check: res => res.status === 200 && res.header['content-type'].includes('pdf') },

    // Compliance
    { method: 'get', url: '/api/v1/compliance/overview', check: res => res.status === 200 && res.body.data.documents.total > 0 },
    { method: 'get', url: '/api/v1/compliance/notifications', check: res => res.status === 200 && (res.body.data.items || []).length > 0 },
    { method: 'post', url: '/api/v1/compliance/scan', check: res => res.status === 200 && res.body.data.scannedVehicleDocuments > 0 },

    // Maintenance
    { method: 'get', url: '/api/v1/maintenance/stats', check: res => res.status === 200 && res.body.data.totalCostThisMonthRupees > 0 },
    { method: 'get', url: '/api/v1/maintenance', check: res => res.status === 200 && (res.body.data.items || []).length > 0 },
    { method: 'patch', url: '/api/v1/maintenance/671e3b0f27d7a87e3cbb0090/status', body: { status: 'COMPLETED' }, check: res => res.status === 200 && res.body.data.status === 'COMPLETED' },
    { method: 'get', url: '/api/v1/maintenance/671e3b0f27d7a87e3cbb0090/job-card', check: res => res.status === 200 && res.header['content-type'].includes('pdf') },

    // WhatsApp
    { method: 'get', url: '/api/v1/whatsapp/config', check: res => res.status === 200 && res.body.data.isEnabled === true },
    { method: 'get', url: '/api/v1/whatsapp/messages', check: res => res.status === 200 && Array.isArray(res.body.data) && res.body.data.length > 0 },
    { method: 'post', url: '/api/v1/whatsapp/send', body: { toPhone: '+919377610333', templateName: 'LOAD_CREATED' }, check: res => res.status === 201 && res.body.data.status === 'DELIVERED' },

    // Master bulk
    { method: 'get', url: '/api/v1/master/jobs', check: res => res.status === 200 && Array.isArray(res.body.data) },
    { method: 'post', url: '/api/v1/master/dry-run/loads', check: res => res.status === 200 && res.body.data.validRowsCount > 0 },

    // Reports
    { method: 'get', url: '/api/v1/reports/loads', check: res => res.status === 200 && res.body.data.summary.totalLoads > 0 },
    { method: 'get', url: '/api/v1/reports/trips', check: res => res.status === 200 && res.body.data.summary.totalTrips > 0 },
    { method: 'get', url: '/api/v1/reports/freight', check: res => res.status === 200 && res.body.data.summary.totalBilledRupees > 0 },
    { method: 'get', url: '/api/v1/reports/compliance', check: res => res.status === 200 && res.body.data.summary.totalDocs > 0 },
    { method: 'get', url: '/api/v1/reports/export/loads?format=csv', check: res => res.status === 200 && res.header['content-type'].includes('csv') },

    // Admin & Settings
    { method: 'get', url: '/api/v1/admin/users', check: res => res.status === 200 && res.body.data.length > 0 },
    { method: 'get', url: '/api/v1/admin/roles', check: res => res.status === 200 && res.body.data.length > 0 },
    { method: 'get', url: '/api/v1/admin/audit-logs', check: res => res.status === 200 && (res.body.data.items || []).length > 0 },
    { method: 'get', url: '/api/v1/admin/settings', check: res => res.status === 200 && res.body.data.defaultCurrency === 'INR' },
    { method: 'patch', url: '/api/v1/admin/settings', body: { legalName: 'Barkat Tempo Service' }, check: res => res.status === 200 && res.body.data.legalName === 'Barkat Tempo Service' },

    // Public
    { method: 'get', url: '/api/v1/public/track/TRP-2026-003', check: res => res.status === 200 && res.body.data.trackingNumber === 'TRP-2026-003' },
    { method: 'get', url: '/api/v1/public/track?q=LD-2026-0002', check: res => res.status === 200 && res.body.data.trackingNumber === 'LD-2026-0002' },
    { method: 'post', url: '/api/v1/contact', body: { message: 'Inquiry' }, check: res => res.status === 200 },

    // Search, Export & Documents
    { method: 'get', url: '/api/v1/search?q=Ahmedabad', check: res => res.status === 200 && Array.isArray(res.body.data.results) && res.body.data.results.length > 0 },
    { method: 'get', url: '/api/v1/master/export/customers?format=csv', check: res => res.status === 200 && res.header['content-type'].includes('csv') },
    { method: 'get', url: '/api/v1/master/export/vehicles?format=csv', check: res => res.status === 200 && res.header['content-type'].includes('csv') },
    { method: 'get', url: '/api/v1/master/jobs/job_123/download', check: res => res.status === 200 && res.header['content-type'].includes('csv') },
    { method: 'get', url: '/api/v1/documents/doc_v1_rc/download', check: res => res.status === 200 && res.header['content-type'].includes('pdf') }
  ];

  let passed = 0;
  let failed = 0;

  await new Promise(r => server.listen(0, '127.0.0.1', r));

  for (const t of tests) {
    try {
      const res = await doRequest(server, t.method, t.url, t.body);
      const ok = t.check(res);
      if (ok) {
        passed++;
        console.log(`✅ [${t.method.toUpperCase()}] ${t.url} PASSED`);
      } else {
        failed++;
        console.error(`❌ [${t.method.toUpperCase()}] ${t.url} FAILED: status=${res.status}, body=${JSON.stringify(res.body).slice(0, 150)}`);
      }
    } catch (err) {
      failed++;
      console.error(`❌ [${t.method.toUpperCase()}] ${t.url} ERROR: ${err.message}`);
    }
  }

  server.close();

  console.log(`\n========================================`);
  console.log(`Total: ${tests.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests();
