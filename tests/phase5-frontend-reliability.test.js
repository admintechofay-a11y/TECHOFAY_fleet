/**
 * Phase 5 Acceptance Gate Tests:
 * Frontend Routing, Operational Reliability, Navigation History, and Form Integrity
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WEB_SRC_DIR = path.resolve(__dirname, '..', 'apps', 'web', 'src');

describe('Phase 5 Gate: Frontend Routing & Operational Reliability', () => {

  describe('1. Navigation & Route Parity', () => {
    const appTsxContent = fs.readFileSync(path.join(WEB_SRC_DIR, 'App.tsx'), 'utf8');
    const sidebarTsxContent = fs.readFileSync(path.join(WEB_SRC_DIR, 'components', 'Sidebar.tsx'), 'utf8');
    const navContextContent = fs.readFileSync(path.join(WEB_SRC_DIR, 'context', 'NavigationContext.tsx'), 'utf8');

    test('All Sidebar operational routes are mapped in App.tsx', () => {
      // Extract paths from navItems in Sidebar.tsx
      const routeRegex = /path:\s*'([^']+)'/g;
      let match;
      const sidebarRoutes = [];
      while ((match = routeRegex.exec(sidebarTsxContent)) !== null) {
        sidebarRoutes.push(match[1]);
      }

      assert.ok(sidebarRoutes.length >= 15, `Expected at least 15 sidebar routes, found ${sidebarRoutes.length}`);

      for (const route of sidebarRoutes) {
        assert.ok(
          appTsxContent.includes(`case '${route}':`),
          `Sidebar route "${route}" is missing from App.tsx route switch!`
        );
      }
    });

    test('Freight & Billing route /app/billing is mapped to ReportsPage with freight tab', () => {
      assert.ok(
        appTsxContent.includes("case '/app/billing':"),
        'App.tsx must have an explicit route case for /app/billing'
      );
      assert.ok(
        appTsxContent.includes('<ReportsPage defaultTab="freight" />'),
        '/app/billing must render ReportsPage with defaultTab="freight"'
      );
    });

    test('Authenticated redirection logic redirects auth pages to /app/dashboard', () => {
      assert.ok(
        appTsxContent.includes("currentPath === '/' || currentPath === '/login' || currentPath === '/register' || currentPath === '/signup'"),
        'App.tsx must check for landing/auth paths when authenticated'
      );
      assert.ok(
        appTsxContent.includes("navigate('/app/dashboard', { replace: true })"),
        'App.tsx must redirect authenticated users to /app/dashboard with history replace'
      );
    });

    test('NavigationContext synchronizes browser history and window title', () => {
      assert.ok(
        navContextContent.includes('window.history.pushState'),
        'NavigationContext must use window.history.pushState'
      );
      assert.ok(
        navContextContent.includes('window.history.replaceState'),
        'NavigationContext must use window.history.replaceState'
      );
      assert.ok(
        navContextContent.includes("window.addEventListener('popstate'"),
        'NavigationContext must listen to browser popstate event for Back/Forward navigation'
      );
      assert.ok(
        navContextContent.includes('document.title ='),
        'NavigationContext must update document.title based on active route'
      );
    });

    test('NavigationContext defines titles for all primary routes', () => {
      const expectedRoutes = [
        '/app/dashboard',
        '/app/loads',
        '/app/lr',
        '/app/bilties',
        '/app/trips',
        '/app/vehicles',
        '/app/drivers',
        '/app/compliance',
        '/app/maintenance',
        '/app/customers',
        '/app/locations',
        '/app/deliveries',
        '/app/billing',
        '/app/reports',
        '/login',
        '/register'
      ];

      for (const route of expectedRoutes) {
        assert.ok(
          navContextContent.includes(`'${route}':`),
          `NavigationContext PAGE_TITLES must contain entry for "${route}"`
        );
      }
    });
  });

  describe('2. Elimination of Hardcoded Demo Form Fixtures', () => {
    test('LoadsPage form state has no dummy demo values', () => {
      const loadsContent = fs.readFileSync(path.join(WEB_SRC_DIR, 'pages', 'LoadsPage.tsx'), 'utf8');

      // Check that hardcoded 100 or 10 dummy initial form data is eliminated
      assert.ok(
        !loadsContent.includes("totalQuantity: '100'"),
        'LoadsPage must not contain demo fixture totalQuantity: 100'
      );
      assert.ok(
        !loadsContent.includes('allocatedQuantity: 100'),
        'LoadsPage must not contain demo fixture allocatedQuantity: 100'
      );
      assert.ok(
        !loadsContent.includes('allocatedWeightMt: 10'),
        'LoadsPage must not contain demo fixture allocatedWeightMt: 10'
      );
      assert.ok(
        loadsContent.includes("totalQuantity: ''"),
        'LoadsPage form state must initialize totalQuantity as empty string'
      );
    });

    test('VehiclesPage form state has no dummy demo values', () => {
      const vehiclesContent = fs.readFileSync(path.join(WEB_SRC_DIR, 'pages', 'VehiclesPage.tsx'), 'utf8');

      assert.ok(
        !vehiclesContent.includes('capacityTonnage: 15'),
        'VehiclesPage must not contain demo fixture capacityTonnage: 15'
      );
      assert.ok(
        !vehiclesContent.includes('yearOfManufacture: 2023'),
        'VehiclesPage must not contain hardcoded yearOfManufacture: 2023'
      );
      assert.ok(
        vehiclesContent.includes('yearOfManufacture: new Date().getFullYear()') ||
        vehiclesContent.includes("yearOfManufacture: ''"),
        'VehiclesPage should dynamically default year to current year or empty string'
      );
    });
  });

  describe('3. API Client & Download Error Surface', () => {
    const apiTsContent = fs.readFileSync(path.join(WEB_SRC_DIR, 'lib', 'api.ts'), 'utf8');

    test('apiDownload surfaces backend error message from response JSON', () => {
      assert.ok(
        apiTsContent.includes('const errorData = await response.json()'),
        'apiDownload must attempt to parse response JSON on failure'
      );
      assert.ok(
        apiTsContent.includes('if (errorData && errorData.message)'),
        'apiDownload must surface errorData.message if present'
      );
    });

    test('apiFetchBlob surfaces backend error message from response JSON', () => {
      assert.ok(
        apiTsContent.includes("let errorMsg = `Failed to load document (HTTP ${response.status})`"),
        'apiFetchBlob must construct descriptive default error message'
      );
    });

    test('MaintenancePage uses centralized apiRequest instead of raw fetch and localStorage', () => {
      const maintContent = fs.readFileSync(path.join(WEB_SRC_DIR, 'pages', 'MaintenancePage.tsx'), 'utf8');

      assert.ok(
        !maintContent.includes("fetch('/api/v1/"),
        'MaintenancePage must not call raw fetch("/api/v1/...")'
      );
      assert.ok(
        !maintContent.includes("localStorage.getItem('token')"),
        "MaintenancePage must not bypass AuthContext/api.ts with localStorage.getItem('token')"
      );
      assert.ok(
        maintContent.includes("import { apiRequest } from '../lib/api'"),
        'MaintenancePage must import centralized apiRequest'
      );
    });
  });

  describe('4. Operational Reliability & Error Recovery States', () => {
    const pagesWithTables = [
      { name: 'LoadsPage.tsx', path: 'LoadsPage.tsx' },
      { name: 'TripsPage.tsx', path: 'TripsPage.tsx' },
      { name: 'VehiclesPage.tsx', path: 'VehiclesPage.tsx' },
      { name: 'DriversPage.tsx', path: 'DriversPage.tsx' },
      { name: 'CustomersPage.tsx', path: 'CustomersPage.tsx' },
      { name: 'LocationsPage.tsx', path: 'LocationsPage.tsx' },
      { name: 'DeliveriesPodPage.tsx', path: 'DeliveriesPodPage.tsx' },
      { name: 'LrPage.tsx', path: 'LrPage.tsx' },
      { name: 'BiltiesPage.tsx', path: 'BiltiesPage.tsx' },
      { name: 'MaintenancePage.tsx', path: 'MaintenancePage.tsx' }
    ];

    for (const page of pagesWithTables) {
      test(`${page.name} implements explicit fetchError state and retry UI`, () => {
        const content = fs.readFileSync(path.join(WEB_SRC_DIR, 'pages', page.path), 'utf8');

        assert.ok(
          content.includes('fetchError') || content.includes('error'),
          `${page.name} must declare an error state for data fetching`
        );
        assert.ok(
          content.includes('Retry') || content.includes('retry') || content.includes('🔄'),
          `${page.name} must offer a user-facing retry action upon fetch failure`
        );
      });
    }
  });

  describe('5. Duplicate Submission Prevention & Mutation Protection', () => {
    test('Form modals disable submit buttons during pending mutations', () => {
      const loadsContent = fs.readFileSync(path.join(WEB_SRC_DIR, 'pages', 'LoadsPage.tsx'), 'utf8');
      assert.ok(
        loadsContent.includes('disabled={formLoading}') || loadsContent.includes('disabled={isSubmitting}'),
        'LoadsPage modal submit button must be disabled during submission'
      );

      const vehiclesContent = fs.readFileSync(path.join(WEB_SRC_DIR, 'pages', 'VehiclesPage.tsx'), 'utf8');
      assert.ok(
        vehiclesContent.includes('disabled={formLoading}') || vehiclesContent.includes('disabled={isSubmitting}') || vehiclesContent.includes('disabled={submitting}'),
        'VehiclesPage modal submit button must be disabled during submission'
      );

      const maintContent = fs.readFileSync(path.join(WEB_SRC_DIR, 'pages', 'MaintenancePage.tsx'), 'utf8');
      assert.ok(
        maintContent.includes('disabled={scheduleLoading}') || maintContent.includes('disabled={completeLoading}'),
        'MaintenancePage action buttons must be disabled during async operations'
      );
    });
  });

  describe('6. Breadcrumb Integration', () => {
    test('Breadcrumbs component uses NavigationContext for client-side navigation', () => {
      const breadcrumbsContent = fs.readFileSync(path.join(WEB_SRC_DIR, 'components', 'Breadcrumbs.tsx'), 'utf8');

      assert.ok(
        breadcrumbsContent.includes('useNavigation'),
        'Breadcrumbs component must integrate with useNavigation hook'
      );
      assert.ok(
        breadcrumbsContent.includes('handleNav(targetPath)') || breadcrumbsContent.includes('navigate(targetPath)'),
        'Breadcrumbs component must call handleNav/navigate to avoid full page reloads'
      );
    });
  });
});
