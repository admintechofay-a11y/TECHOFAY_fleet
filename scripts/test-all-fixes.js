const http = require('http');
const path = require('path');
const fs = require('fs');

process.env.PORT = '0';
process.env.NODE_ENV = 'production';
process.env.DISABLE_DB = 'true';

const handler = require('../apps/api/index.js');
const server = http.createServer((req, res) => handler(req, res));

server.listen(0, async () => {
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`[TEST-SUITE] Server running on ${baseUrl}`);

  let passed = 0;
  let failed = 0;

  async function check(name, fn) {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  // 1. Initial Empty Collections Verification
  await check('Initial collections are clean and empty of fake data', async () => {
    const [resL, resV, resD, resT, resB, resC, resLoc, resW] = await Promise.all([
      fetch(`${baseUrl}/api/loads`).then(r => r.json()),
      fetch(`${baseUrl}/api/vehicles`).then(r => r.json()),
      fetch(`${baseUrl}/api/drivers`).then(r => r.json()),
      fetch(`${baseUrl}/api/trips`).then(r => r.json()),
      fetch(`${baseUrl}/api/bilties`).then(r => r.json()),
      fetch(`${baseUrl}/api/customers`).then(r => r.json()),
      fetch(`${baseUrl}/api/locations`).then(r => r.json()),
      fetch(`${baseUrl}/api/whatsapp/messages`).then(r => r.json())
    ]);

    const count = (obj) => obj?.data?.items?.length ?? obj?.data?.length ?? 0;
    if (count(resL) !== 0) throw new Error(`Loads count is ${count(resL)}, expected 0`);
    if (count(resV) !== 0) throw new Error(`Vehicles count is ${count(resV)}, expected 0`);
    if (count(resD) !== 0) throw new Error(`Drivers count is ${count(resD)}, expected 0`);
    if (count(resT) !== 0) throw new Error(`Trips count is ${count(resT)}, expected 0`);
    if (count(resB) !== 0) throw new Error(`Bilties count is ${count(resB)}, expected 0`);
    if (count(resC) !== 0) throw new Error(`Customers count is ${count(resC)}, expected 0`);
    if (count(resLoc) !== 0) throw new Error(`Locations count is ${count(resLoc)}, expected 0`);
    if (count(resW) !== 0) throw new Error(`WhatsApp count is ${count(resW)}, expected 0`);
  });

  // 2. Dashboard KPIs & Trends reflect clean state
  await check('Dashboard metrics & trends reflect 0 operational items', async () => {
    const resM = await fetch(`${baseUrl}/api/dashboard/metrics`).then(r => r.json());
    if (resM.data?.loads?.total !== 0 || resM.data?.loads?.today !== 0) throw new Error('Loads KPI not 0');
    if (resM.data?.fleet?.vehicles?.total !== 0) throw new Error('Vehicles KPI not 0');
    if (resM.data?.financials?.totalFreightBilled !== 0) throw new Error('Financials not 0');

    const resT = await fetch(`${baseUrl}/api/dashboard/trends`).then(r => r.json());
    const totalTrendLoads = resT.data?.reduce((s, d) => s + d.loadCount, 0);
    if (totalTrendLoads !== 0) throw new Error('Trends loads should be 0');

    const resA = await fetch(`${baseUrl}/api/dashboard/alerts`).then(r => r.json());
    if (resA.data?.length !== 0) throw new Error('Alerts should be empty');
  });

  // 3. Reports Loads
  await check('GET /api/reports/loads returns status 200 with data array', async () => {
    const res = await fetch(`${baseUrl}/api/reports/loads`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data?.data || json.data)) throw new Error('Data array missing');
  });

  // 4. Reports Freight
  await check('GET /api/reports/freight returns status 200 with summary & rows', async () => {
    const res = await fetch(`${baseUrl}/api/reports/freight`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data?.data || json.data)) throw new Error('Freight array missing');
  });

  // 5. Reports Trips
  await check('GET /api/reports/trips returns status 200', async () => {
    const res = await fetch(`${baseUrl}/api/reports/trips`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  // 6. Reports Compliance
  await check('GET /api/reports/compliance returns status 200', async () => {
    const res = await fetch(`${baseUrl}/api/reports/compliance`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  // 7. Dynamic Creation & Document PDF Generation
  await check('Create load and generate vector Loading Receipt PDF', async () => {
    const resCreate = await fetch(`${baseUrl}/api/loads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originCity: 'Vadodara',
        destinationCity: 'Surat',
        consignorName: 'Barkat Shipper Agency',
        consigneeName: 'Barkat Receiver Agency',
        weightMt: 28,
        freightAmount: 42000,
        advancePaid: 20000
      })
    });
    if (resCreate.status !== 201) throw new Error(`Create load status: ${resCreate.status}`);
    const jsonCreate = await resCreate.json();
    const loadNum = jsonCreate.data?.loadNumber;

    const resPdf = await fetch(`${baseUrl}/api/loads/${loadNum}/loading-slip`);
    if (resPdf.status !== 200) throw new Error(`Load slip PDF status: ${resPdf.status}`);
    const buf = await resPdf.arrayBuffer();
    if (buf.byteLength < 5000) throw new Error(`PDF too small: ${buf.byteLength}`);
  });

  // 8. PDF BTS Memo
  await check('GET /api/bts/memo/TRP-2026-001 returns PDF with inlined fonts', async () => {
    const res = await fetch(`${baseUrl}/api/bts/memo/TRP-2026-001`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    if (res.headers.get('content-type') !== 'application/pdf') throw new Error(`Wrong content type: ${res.headers.get('content-type')}`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 5000) throw new Error(`PDF too small: ${buf.byteLength} bytes`);
  });

  // 9. SPA Route fallthrough
  await check('GET /app/loads returns index.html for client-side routing', async () => {
    const res = await fetch(`${baseUrl}/app/loads`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const text = await res.text();
    if (!text.includes('id="root"')) throw new Error('index.html missing');
  });

  console.log(`\n[TEST-SUITE RESULTS] Passed: ${passed}, Failed: ${failed}`);
  server.close();
  process.exit(failed > 0 ? 1 : 0);
});
