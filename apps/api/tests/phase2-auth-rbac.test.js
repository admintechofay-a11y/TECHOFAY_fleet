/**
 * Comprehensive Phase 2 Integration Tests: Auth, Sessions, RBAC, Multi-Tenancy & Audit
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const db = require('../src/config/db');
const Company = require('../src/modules/auth/models/Company');
const Role = require('../src/modules/auth/models/Role');
const User = require('../src/modules/auth/models/User');
const UserSession = require('../src/modules/auth/models/UserSession');
const AuditLog = require('../src/modules/audit/models/AuditLog');
const BootstrapService = require('../src/modules/auth/services/bootstrap.service');
const { UserRole, SystemModule } = require('@fleet/shared');

let server;
let baseUrl;
let testCompany;
let superAdminToken;
let transportManagerToken;
let superAdminUser;
let transportManagerUser;

describe('Phase 2 Integration Test Suite: Auth, IAM, RBAC & Multi-Tenancy', () => {

  before(async () => {
    // Connect to test database
    await db.connectDatabase();

    // Bootstrap test organization and system roles
    const bootstrap = await BootstrapService.bootstrapSystem({
      companyLegalName: 'Phase 2 Test Logistics Ltd',
      companyGstin: '24TEST1234A1Z9',
      adminEmail: 'phase2.admin@technofay.com',
      adminPassword: 'SuperSecretAdminPassword2026!',
      adminName: 'Phase 2 Super Admin'
    });
    testCompany = bootstrap.company;
    superAdminUser = bootstrap.superAdmin;

    // Create a Transport Manager user
    const tmRole = bootstrap.roles[UserRole.TRANSPORT_MANAGER];
    let tmUser = await User.findOne({ companyId: testCompany._id, email: 'tm.test@technofay.com' });
    if (!tmUser) {
      tmUser = await User.create({
        companyId: testCompany._id,
        name: 'Test Transport Manager',
        email: 'tm.test@technofay.com',
        passwordHash: 'TransportManagerPass2026!',
        roleId: tmRole._id,
        isActive: true
      });
    }
    transportManagerUser = tmUser;

    // Start ephemeral server on random port
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api/v1`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      await new Promise((resolve) => server.close(resolve));
    }
    await db.disconnectDatabase();
  });

  // 1. Health & Readiness Probes
  test('GET /health returns operational status', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.statusCode, 200);
    assert.ok(body.data.uptime >= 0);
  });

  test('GET /ready returns database connected status', async () => {
    const res = await fetch(`${baseUrl}/ready`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.database, 'connected');
  });

  // 2. Authentication: Password Policy & Generic Errors
  test('POST /auth/login rejects password shorter than 8 characters', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'phase2.admin@technofay.com', password: 'short' })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.message.includes('at least 8 characters'));
  });

  test('POST /auth/login rejects invalid password without leaking user existence', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'phase2.admin@technofay.com', password: 'WrongPassword123!' })
    });
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.message, 'Invalid email or password');
  });

  // 3. Successful Login & Cookie Issuance
  test('POST /auth/login succeeds with valid credentials and sets cookies', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'phase2.admin@technofay.com',
        password: 'SuperSecretAdminPassword2026!'
      })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.accessToken);
    assert.strictEqual(body.data.user.email, 'phase2.admin@technofay.com');
    assert.strictEqual(body.data.user.passwordHash, undefined, 'Must not return passwordHash');

    superAdminToken = body.data.accessToken;

    // Verify Set-Cookie header contains refreshToken
    const cookies = res.headers.get('set-cookie');
    assert.ok(cookies, 'Must issue cookies');
    assert.ok(cookies.includes('refreshToken='), 'Must set refreshToken cookie');
  });

  // 4. Transport Manager Login
  test('POST /auth/login succeeds for Transport Manager user', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'tm.test@technofay.com',
        password: 'TransportManagerPass2026!'
      })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    transportManagerToken = body.data.accessToken;
    assert.ok(transportManagerToken);
  });

  // 5. Protected Profile Access
  test('GET /auth/me returns current user profile with valid token', async () => {
    const res = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.user.email, 'phase2.admin@technofay.com');
    assert.strictEqual(body.data.tenant._id, testCompany._id.toString());
  });

  test('GET /auth/me rejects unauthorized request missing token', async () => {
    const res = await fetch(`${baseUrl}/auth/me`);
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.success, false);
  });

  // 6. RBAC Middleware Enforcement
  test('Super Admin can list users via /admin/users', async () => {
    const res = await fetch(`${baseUrl}/admin/users`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 2);
  });

  test('Transport Manager is FORBIDDEN (403) from accessing /admin/users', async () => {
    const res = await fetch(`${baseUrl}/admin/users`, {
      headers: { Authorization: `Bearer ${transportManagerToken}` }
    });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.message.includes('Access denied'));
  });

  // 7. Audit Log Verification
  test('Audit log records LOGIN_SUCCESS and is queryable by Super Admin', async () => {
    const res = await fetch(`${baseUrl}/admin/audit-logs?module=auth`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.length > 0);
    const loginLog = body.data.find((log) => log.action === 'LOGIN_SUCCESS');
    assert.ok(loginLog, 'Must contain a LOGIN_SUCCESS audit log entry');
  });

  // 8. User Creation & Duplicate Handling
  const testRunId = Date.now();
  const operatorEmail = `operator_${testRunId}@technofay.com`;
  const deactivatedEmail = `deactivated_${testRunId}@technofay.com`;

  test('POST /admin/users allows Super Admin to create a new user', async () => {
    const res = await fetch(`${baseUrl}/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({
        name: 'New Fleet Operator',
        email: operatorEmail,
        password: 'OperatorPass2026!',
        phone: '+91 99887 76655',
        roleId: transportManagerUser.roleId
      })
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.data.email, operatorEmail);
  });

  test('POST /admin/users rejects duplicate email in same company', async () => {
    const res = await fetch(`${baseUrl}/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({
        name: 'Duplicate Operator',
        email: operatorEmail,
        password: 'AnotherPass2026!',
        phone: '+91 99887 76655',
        roleId: transportManagerUser.roleId
      })
    });
    assert.strictEqual(res.status, 409);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.message.includes('already exists'));
  });

  // 9. Self-Lockout & Demotion Guard
  test('PATCH /admin/users/:id/status prevents deactivating the last active Super Admin', async () => {
    const res = await fetch(`${baseUrl}/admin/users/${superAdminUser._id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({ isActive: false })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.message.includes('Cannot deactivate the last active Super Administrator'));
  });

  // 10. Deactivated User Account Invalidation
  test('Deactivated user is rejected from login', async () => {
    // Create and immediately deactivate an account
    await User.create({
      companyId: testCompany._id,
      name: 'Deactivated Worker',
      email: deactivatedEmail,
      passwordHash: 'DeactivatedPass2026!',
      roleId: transportManagerUser.roleId,
      isActive: false
    });

    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: deactivatedEmail,
        password: 'DeactivatedPass2026!'
      })
    });
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.ok(body.message.includes('deactivated'));
  });

  // 11. Multi-Tenant Isolation
  test('Super Admin cannot view users from another tenant organization', async () => {
    // Create an isolated second company
    const randomSuffix = Math.floor(Math.random() * 89999 + 10000);
    const otherCompany = await Company.create({
      legalName: 'Alien Transporters Pvt Ltd',
      tradeName: 'Alien Cargo',
      gstin: `27ALN${randomSuffix}Z1`,
      email: `admin_${randomSuffix}@alien.com`,
      phone: '+91 99999 00000'
    });
    const alienEmail = `driver_${randomSuffix}@alien.com`;
    await User.create({
      companyId: otherCompany._id,
      name: 'Alien Driver',
      email: alienEmail,
      passwordHash: 'AlienPassword2026!',
      roleId: transportManagerUser.roleId,
      isActive: true
    });

    // Super Admin queries their own company's users
    const res = await fetch(`${baseUrl}/admin/users`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    const body = await res.json();
    const userEmails = body.data.map((u) => u.email);
    assert.ok(!userEmails.includes(alienEmail), 'Tenant isolation violated: User from other company appeared in query');
  });

  // 12. Token Refresh Lifecycle
  test('POST /auth/refresh successfully rotates refresh token', async () => {
    // Perform fresh login to get active session
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'phase2.admin@technofay.com',
        password: 'SuperSecretAdminPassword2026!'
      })
    });
    const loginCookies = loginRes.headers.get('set-cookie');
    const refreshCookieMatch = loginCookies.match(/refreshToken=([^;]+)/);
    assert.ok(refreshCookieMatch, 'Must capture refresh token cookie');
    const rawRefreshToken = refreshCookieMatch[1];

    // Call refresh
    const refreshRes = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `refreshToken=${rawRefreshToken}`
      }
    });
    assert.strictEqual(refreshRes.status, 200);
    const refreshBody = await refreshRes.json();
    assert.ok(refreshBody.data.accessToken);

    // Call refresh AGAIN with the old revoked token -> Must be 401
    const secondRefreshRes = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `refreshToken=${rawRefreshToken}`
      }
    });
    assert.strictEqual(secondRefreshRes.status, 401);
  });

  // 13. Logout Session Revocation
  test('POST /auth/logout revokes session and clears cookies', async () => {
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'phase2.admin@technofay.com',
        password: 'SuperSecretAdminPassword2026!'
      })
    });
    const loginBody = await loginRes.json();
    const token = loginBody.data.accessToken;

    const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.strictEqual(logoutRes.status, 200);
    const logoutCookies = logoutRes.headers.get('set-cookie');
    assert.ok(logoutCookies.includes('refreshToken=;'), 'Must clear refreshToken cookie');
  });

});
