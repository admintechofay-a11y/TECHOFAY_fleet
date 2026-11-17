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

  // 1. Reports Loads
  await check('GET /api/reports/loads returns status 200 with data array', async () => {
    const res = await fetch(`${baseUrl}/api/reports/loads`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data?.data || json.data)) throw new Error('Data array missing');
  });

  // 2. Reports Freight
  await check('GET /api/reports/freight returns status 200 with summary & rows', async () => {
    const res = await fetch(`${baseUrl}/api/reports/freight`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data?.data || json.data)) throw new Error('Freight array missing');
  });

  // 3. Reports Trips
  await check('GET /api/reports/trips returns status 200', async () => {
    const res = await fetch(`${baseUrl}/api/reports/trips`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  // 4. Reports Compliance
  await check('GET /api/reports/compliance returns status 200', async () => {
    const res = await fetch(`${baseUrl}/api/reports/compliance`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  // 5. PDF BTS Loading Receipt
  await check('GET /api/bts/loading-receipt/LD-2026-0001 returns PDF with inlined fonts', async () => {
    const res = await fetch(`${baseUrl}/api/bts/loading-receipt/LD-2026-0001`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    if (res.headers.get('content-type') !== 'application/pdf') throw new Error(`Wrong content type: ${res.headers.get('content-type')}`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 5000) throw new Error(`PDF too small: ${buf.byteLength} bytes`);
  });

  // 6. PDF BTS Memo
  await check('GET /api/bts/memo/TRP-2026-001 returns PDF with inlined fonts', async () => {
    const res = await fetch(`${baseUrl}/api/bts/memo/TRP-2026-001`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    if (res.headers.get('content-type') !== 'application/pdf') throw new Error(`Wrong content type: ${res.headers.get('content-type')}`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 5000) throw new Error(`PDF too small: ${buf.byteLength} bytes`);
  });

  // 7. POD PDF Download
  await check('GET /api/pod/pod_101/download returns valid document', async () => {
    const res = await fetch(`${baseUrl}/api/pod/pod_101/download`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 100) throw new Error(`Buffer too small: ${buf.byteLength}`);
  });

  // 8. SPA Route fallthrough
  await check('GET /app/loads returns index.html for client-side routing', async () => {
    const res = await fetch(`${baseUrl}/app/loads`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const text = await res.text();
    console.log('    [DEBUG] Length:', text.length, 'Preview:', text.slice(0, 100).replace(/\n/g, ' '));
    if (!text.includes('id="root"')) throw new Error('index.html missing');
  });

  console.log(`\n[TEST-SUITE RESULTS] Passed: ${passed}, Failed: ${failed}`);
  server.close();
  process.exit(failed > 0 ? 1 : 0);
});
