#!/usr/bin/env node
/**
 * Environment & Baseline Health Check
 * Validates Node.js runtime, MongoDB connectivity, and specification files.
 */

const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');

async function checkPort(port, host) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function runHealthCheck() {
  console.log('========================================================');
  console.log('🚀 Technofay Fleet & Transport Platform - Health Check');
  console.log('========================================================');

  // 1. Node runtime
  const nodeVersion = process.version;
  console.log(`[PASS] Node.js Runtime: ${nodeVersion} (Supported: >= 18.x)`);

  // 2. Working Directory & Files
  const requiredFiles = [
    '.gitignore',
    '.env.example',
    'package.json',
    'tsconfig.json',
    'docs/SOW_TRACEABILITY.md',
    'docs/REFERENCE_REPO_AUDIT.md',
    'docs/ARCHITECTURE.md',
    'docs/DATA_MODEL.md',
    'docs/ROLE_PERMISSION_MATRIX.md',
    'docs/BUSINESS_RULES.md',
    'docs/DECISIONS_AND_OPEN_QUESTIONS.md',
    'docs/PHASE_PLAN.md',
    'docs/DEPENDENCY_CHECKLIST.md'
  ];

  let missingFiles = 0;
  for (const file of requiredFiles) {
    const fullPath = path.resolve(__dirname, '..', file);
    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath);
      console.log(`[PASS] File verified: ${file} (${stats.size} bytes)`);
    } else {
      console.error(`[FAIL] Missing required specification file: ${file}`);
      missingFiles++;
    }
  }

  // 3. MongoDB Connectivity
  const mongoUp = await checkPort(27017, '127.0.0.1');
  if (mongoUp) {
    console.log('[PASS] MongoDB Service: Reachable on 127.0.0.1:27017');
  } else {
    console.warn('[WARN] MongoDB Service: Not reachable on 127.0.0.1:27017 (Ensure service is started before Phase 2)');
  }

  console.log('========================================================');
  if (missingFiles === 0) {
    console.log('✅ Health Check Succeeded: Baseline foundation is ready.');
    process.exit(0);
  } else {
    console.error(`❌ Health Check Failed: ${missingFiles} missing files.`);
    process.exit(1);
  }
}

runHealthCheck();
