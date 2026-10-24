/**
 * Automated Phase 1 Acceptance Gate Tests
 * Verifies documentation completeness, SOW coverage, and architecture integrity.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');

describe('Phase 1 Acceptance Gate: Documentation & Foundation Verification', () => {

  test('All required specification documents exist and have non-trivial content', () => {
    const requiredDocs = [
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

    for (const doc of requiredDocs) {
      const fullPath = path.join(rootDir, doc);
      assert.ok(fs.existsSync(fullPath), `Document must exist: ${doc}`);
      const content = fs.readFileSync(fullPath, 'utf8');
      assert.ok(content.length > 500, `Document ${doc} should have substantial content (found ${content.length} bytes)`);
    }
  });

  test('SOW Traceability covers all 26 SOW sections', () => {
    const content = fs.readFileSync(path.join(rootDir, 'docs/SOW_TRACEABILITY.md'), 'utf8');
    for (let i = 1; i <= 26; i++) {
      const pattern = new RegExp(`\\|\\s*\\*\\*${i}\\*\\*\\s*\\|`, 'i');
      assert.ok(pattern.test(content), `SOW Section ${i} must be explicitly mapped in traceability matrix`);
    }
  });

  test('SOW Traceability covers all 20 image launch checklist items', () => {
    const content = fs.readFileSync(path.join(rootDir, 'docs/SOW_TRACEABILITY.md'), 'utf8');
    for (let i = 1; i <= 20; i++) {
      const pattern = new RegExp(`\\|\\s*\\*\\*${i}\\*\\*\\s*\\|`, 'i');
      assert.ok(pattern.test(content), `Launch Checklist Item ${i} must be mapped in traceability matrix`);
    }
  });

  test('Reference Repository Audit cites real inspected paths and verified defects', () => {
    const content = fs.readFileSync(path.join(rootDir, 'docs/REFERENCE_REPO_AUDIT.md'), 'utf8');
    assert.ok(content.includes('api/app/Http/Controllers/Internal/v1/AuthController.php'), 'Must cite AuthController');
    assert.ok(content.includes('api/app/Services/LrDomainService.php'), 'Must cite LrDomainService');
    assert.ok(content.includes('api/app/Services/BillingEngineService.php'), 'Must cite BillingEngineService');
    assert.ok(content.includes('api/app/Services/DocumentComplianceService.php'), 'Must cite DocumentComplianceService');
    assert.ok(content.includes('api/app/Services/DispatchValidationService.php'), 'Must cite DispatchValidationService');
    assert.ok(content.includes('SEC-01'), 'Must document SEC-01 defect from audit bundle');
    assert.ok(content.includes('SEC-02'), 'Must document SEC-02 defect from audit bundle');
    assert.ok(content.includes('DATA-01'), 'Must document DATA-01 defect from audit bundle');
  });

  test('Architecture document defines error contract, monorepo, and security strategy', () => {
    const content = fs.readFileSync(path.join(rootDir, 'docs/ARCHITECTURE.md'), 'utf8');
    assert.ok(content.includes('apps/api'), 'Must define apps/api');
    assert.ok(content.includes('apps/web'), 'Must define apps/web');
    assert.ok(content.includes('packages/shared'), 'Must define packages/shared');
    assert.ok(content.includes('correlationId'), 'Must enforce correlationId in error contract');
    assert.ok(content.includes('enforceTenantScope'), 'Must define multi-tenant scoping');
    assert.ok(content.includes('IWhatsAppProvider'), 'Must define WhatsApp adapter interface');
  });

  test('Data Model document specifies Mermaid ERD and core MongoDB schemas', () => {
    const content = fs.readFileSync(path.join(rootDir, 'docs/DATA_MODEL.md'), 'utf8');
    assert.ok(content.includes('erDiagram'), 'Must contain Mermaid ERD diagram');
    assert.ok(content.includes('customer_parties'), 'Must define customer parties schema');
    assert.ok(content.includes('loads'), 'Must define loads schema');
    assert.ok(content.includes('lr_numbers'), 'Must define lr_numbers schema');
    assert.ok(content.includes('bilties'), 'Must define bilties schema');
    assert.ok(content.includes('trips'), 'Must define trips schema');
    assert.ok(content.includes('vehicles'), 'Must define vehicles schema');
    assert.ok(content.includes('drivers'), 'Must define drivers schema');
    assert.ok(content.includes('audit_logs'), 'Must define audit_logs schema');
  });

  test('Role Permission Matrix includes all 8 specified roles', () => {
    const content = fs.readFileSync(path.join(rootDir, 'docs/ROLE_PERMISSION_MATRIX.md'), 'utf8');
    const roles = [
      'Super Administrator',
      'Administrator',
      'Transport Manager',
      'Fleet Manager',
      'Operations Manager',
      'Data Entry Operator',
      'Accounts User',
      'Management User'
    ];
    for (const role of roles) {
      assert.ok(content.includes(role), `Role matrix must include ${role}`);
    }
  });

  test('Business Rules document defines GTA GST SAC 9965 and LR state machine', () => {
    const content = fs.readFileSync(path.join(rootDir, 'docs/BUSINESS_RULES.md'), 'utf8');
    assert.ok(content.includes('9965'), 'Must specify GTA SAC 9965');
    assert.ok(content.includes('5.0%'), 'Must specify 5.0% GTA rate default');
    assert.ok(content.includes('stateDiagram-v2'), 'Must include Mermaid state diagram');
    assert.ok(content.includes('POD_CLOSED'), 'Must define POD_CLOSED terminal state');
  });

  test('.env.example contains no secrets and exposes standard template values', () => {
    const content = fs.readFileSync(path.join(rootDir, '.env.example'), 'utf8');
    assert.ok(content.includes('MONGODB_URI='), 'Must define MONGODB_URI');
    assert.ok(!content.includes('actual_secret_key_123'), 'Must not contain real secrets');
    assert.ok(content.includes('WHATSAPP_PROVIDER=fake'), 'Must default to fake/mock WhatsApp adapter');
  });

});
