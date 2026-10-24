/**
 * Master Test Suite Runner for All Phases (1 through 7)
 * Runs all suites sequentially with clean process exits.
 */

const { spawnSync } = require('child_process');
const path = require('path');

const suites = [
  { name: 'Phase 1: Baseline & Documentation Gate', path: 'tests/phase1-baseline.test.js' },
  { name: 'Phase 2: Auth, IAM, RBAC & Multi-Tenancy', path: 'apps/api/tests/phase2-auth-rbac.test.js' },
  { name: 'Phase 3: Core Master Data, Compliance & Excel', path: 'apps/api/tests/phase3-master-data.test.js' },
  { name: 'Phase 4: Loads, LR, Bilty & PDF Documents', path: 'apps/api/tests/phase4-loads-documents.test.js' },
  { name: 'Phase 5: Trips, POD, Freight Settlement & Delivery', path: 'apps/api/tests/phase5-trips-pod.test.js' },
  { name: 'Phase 6: Excel, CSV & Bulk Operations', path: 'apps/api/tests/phase6-excel-bulk.test.js' },
  { name: 'Phase 7: WhatsApp Messaging, Queue & Webhooks', path: 'apps/api/tests/phase7-whatsapp.test.js' },
  { name: 'Phase 8: Operations Dashboard, Reports Engine, Search & Settings', path: 'apps/api/tests/phase8-dashboard-reports.test.js' }
];

console.log('================================================================');
console.log('  TECHNOFAY FLEET MANAGEMENT PLATFORM — COMPREHENSIVE TEST RUN  ');
console.log('================================================================\n');

let totalPassed = 0;
let totalFailed = 0;
const results = [];

for (const suite of suites) {
  console.log(`\n▶ Starting Suite: ${suite.name}...`);
  const fullPath = path.resolve(__dirname, '..', suite.path);
  const start = Date.now();

  const proc = spawnSync('node', ['--test', fullPath], {
    stdio: 'inherit',
    env: process.env,
    cwd: path.resolve(__dirname, '..')
  });

  const durationMs = Date.now() - start;

  if (proc.status === 0) {
    console.log(`✔ [PASS] ${suite.name} (${durationMs}ms)`);
    results.push({ name: suite.name, status: 'PASS', durationMs });
  } else {
    console.error(`✖ [FAIL] ${suite.name} (exit code ${proc.status})`);
    results.push({ name: suite.name, status: 'FAIL', durationMs });
    process.exit(proc.status || 1);
  }
}

console.log('\n================================================================');
console.log('  ALL TEST SUITES PASSED CLEANLY ACROSS PHASES 1 THROUGH 8     ');
console.log('================================================================');
results.forEach((r) => {
  console.log(`  ✔ ${r.name.padEnd(52)} [${r.status}] (${r.durationMs}ms)`);
});
console.log('================================================================\n');
process.exit(0);
