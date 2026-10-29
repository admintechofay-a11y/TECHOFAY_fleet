/**
 * Comprehensive In-Memory Express Router
 * Serves all Fleet Management REST endpoints seamlessly when running in Standalone / Demo mode
 * without requiring any external MongoDB instance.
 */

const express = require('express');
const crypto = require('node:crypto');
const mockStore = require('../services/mockDataStore');
const TokenService = require('../modules/auth/services/token.service');

const router = express.Router();

// Helper: standard success envelope
const ok = (res, data, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    statusCode,
    message,
    data
  });
};

// Helper: paginated response envelope
const paginated = (res, result, message = 'Success') => {
  return res.status(200).json({
    success: true,
    statusCode: 200,
    message,
    data: result.data,
    pagination: result.pagination
  });
};

// URL Prefix Normalizer for /api/v1, /api, /v1
router.use((req, res, next) => {
  if (req.url.startsWith('/api/v1')) {
    req.url = req.url.slice(7) || '/';
  } else if (req.url.startsWith('/api')) {
    req.url = req.url.slice(4) || '/';
  } else if (req.url.startsWith('/v1')) {
    req.url = req.url.slice(3) || '/';
  }
  next();
});

// ==========================================
// 1. AUTHENTICATION
// ==========================================
router.post('/auth/register', (req, res) => {
  const result = mockStore.registerOrganization(req.body || {});
  TokenService.setAuthCookies(res, result.accessToken, result.rawRefreshToken);
  return ok(res, {
    accessToken: result.accessToken,
    user: result.user,
    tenant: result.tenant
  }, 'Organization and administrator account registered successfully (Live Demo Mode)', 201);
});

router.post('/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const result = mockStore.loginUser(email, password);
  TokenService.setAuthCookies(res, result.accessToken, result.rawRefreshToken);
  return ok(res, {
    accessToken: result.accessToken,
    user: result.user,
    tenant: result.tenant
  }, 'Authentication successful (Fleet OS Live Mode)');
});

router.get('/auth/me', (req, res) => {
  const user = mockStore.users[0];
  return ok(res, {
    user: typeof user.toSafeObject === 'function' ? user.toSafeObject() : user,
    tenant: mockStore.tenant
  }, 'Current user profile retrieved');
});

router.post('/auth/refresh', (req, res) => {
  const user = mockStore.users[0];
  const accessToken = TokenService.generateAccessToken(user);
  return ok(res, { accessToken, user }, 'Session refreshed');
});

router.post('/auth/logout', (req, res) => {
  TokenService.clearAuthCookies(res);
  return ok(res, null, 'Logged out successfully');
});

router.post('/auth/forgot-password', (req, res) => {
  return ok(res, { resetToken: 'demo_reset_token_2026' }, 'Password reset instructions sent');
});

router.post('/auth/reset-password', (req, res) => {
  return ok(res, null, 'Password reset successful');
});

// ==========================================
// 2. DASHBOARD & TELEMATICS
// ==========================================
router.get('/dashboard/metrics', (req, res) => {
  const rawMetrics = mockStore.getMetrics();
  // Provide full compatibility aliases for all dashboard frontend widgets
  const metrics = {
    ...rawMetrics,
    financials: {
      freightBilled: rawMetrics.financials.totalFreightBilled,
      totalFreightBilled: rawMetrics.financials.totalFreightBilled,
      advanceReceived: rawMetrics.financials.totalAdvanceReceived,
      totalAdvanceReceived: rawMetrics.financials.totalAdvanceReceived,
      balanceOutstanding: rawMetrics.financials.totalBalanceDue,
      totalBalanceDue: rawMetrics.financials.totalBalanceDue,
      tripExpenses: rawMetrics.financials.totalExpenses,
      totalExpenses: rawMetrics.financials.totalExpenses,
      netOperationalProfit: rawMetrics.financials.grossMargin
    },
    pod: {
      total: mockStore.pods.length,
      pending: rawMetrics.pod.pendingSubmission,
      verified: rawMetrics.pod.verified,
      rejected: 0,
      ...rawMetrics.pod
    },
    whatsapp: {
      total: 48,
      success: 47,
      failed: 1,
      deliveryRate: 98,
      ...rawMetrics.whatsapp
    }
  };
  return ok(res, metrics, 'Dashboard KPI metrics loaded');
});

router.get('/dashboard/trends', (req, res) => {
  const days = parseInt(req.query.days || '7', 10);
  const trends = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    trends.push({
      date: d.toISOString().split('T')[0],
      loadCount: Math.floor(4 + Math.random() * 5),
      freight: Math.floor(120000 + Math.random() * 80000),
      weightMt: Math.floor(90 + Math.random() * 60),
      tripCount: Math.floor(3 + Math.random() * 4),
      expenses: Math.floor(25000 + Math.random() * 15000)
    });
  }
  return ok(res, trends, 'Trend series loaded');
});

router.get('/dashboard/alerts', (req, res) => {
  const alerts = [
    {
      id: 'alt_1',
      severity: 'WARNING',
      type: 'COMPLIANCE',
      title: 'Vehicle Insurance Expiring Soon',
      message: 'Insurance for MH12CD5678 expires in 17 days. Renew to avoid transit penalties.',
      link: '/app/compliance'
    },
    {
      id: 'alt_2',
      severity: 'INFO',
      type: 'TRIP',
      title: 'Active High-Value Consignment',
      message: 'Trip TRP-2026-003 carrying Hot Rolled Steel Coils is currently passing Jaipur corridor.',
      link: '/app/trips'
    }
  ];
  return ok(res, alerts, 'Active operational alerts');
});

router.get('/telematics/status', (req, res) => {
  return ok(res, {
    isConfigured: true,
    provider: 'Technofay Virtual GPS Telematics Engine (AIS-140)',
    status: 'CONFIGURED',
    supportedProtocols: ['AIS-140', 'Teltonika FMB', 'Concox', 'OBD-II'],
    dependencyMessage: 'Virtual GPS telematics is running with high precision.'
  });
});

// ==========================================
// 3. VEHICLES
// ==========================================
router.get('/vehicles', (req, res) => {
  const { page, limit, search, status, category } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (category) filter.category = category;
  const result = mockStore.query(mockStore.vehicles, { filter, search, page, limit, sortField: 'plateNumber', sortOrder: 1 });
  return paginated(res, result);
});

router.get('/vehicles/:id', (req, res) => {
  const vehicle = mockStore.vehicles.find((v) => v._id === req.params.id);
  if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
  return ok(res, vehicle);
});

router.post('/vehicles', (req, res) => {
  const b = req.body || {};
  const newVehicle = {
    _id: 'veh_' + crypto.randomBytes(6).toString('hex'),
    companyId: mockStore.tenant._id,
    plateNumber: (b.plateNumber || 'GJ01XY9999').trim().toUpperCase(),
    vehicleType: b.vehicleType || 'Heavy Commercial Vehicle (HCV)',
    category: b.category || 'OWNED',
    make: b.make || 'Tata Motors',
    model: b.model || 'Signa',
    yearOfManufacture: parseInt(b.yearOfManufacture || '2024', 10),
    capacityTonnage: parseFloat(b.capacityTonnage || '35'),
    fuelType: b.fuelType || 'DIESEL',
    status: 'AVAILABLE',
    isActive: true,
    ownerName: b.ownerName || mockStore.tenant.legalName,
    ownerPhone: b.ownerPhone || mockStore.tenant.phone,
    documents: [],
    createdAt: new Date()
  };
  mockStore.vehicles.unshift(newVehicle);
  return ok(res, newVehicle, 'Vehicle registered successfully', 201);
});

router.put('/vehicles/:id', (req, res) => {
  const idx = mockStore.vehicles.findIndex((v) => v._id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Vehicle not found' });
  mockStore.vehicles[idx] = { ...mockStore.vehicles[idx], ...req.body, updatedAt: new Date() };
  return ok(res, mockStore.vehicles[idx], 'Vehicle updated');
});

router.delete('/vehicles/:id', (req, res) => {
  mockStore.vehicles = mockStore.vehicles.filter((v) => v._id !== req.params.id);
  return ok(res, null, 'Vehicle deleted');
});

router.post('/vehicles/:id/documents', (req, res) => {
  const vehicle = mockStore.vehicles.find((v) => v._id === req.params.id);
  if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
  const newDoc = {
    _id: 'doc_' + crypto.randomBytes(6).toString('hex'),
    documentType: req.body?.documentType || 'RC',
    documentNumber: req.body?.documentNumber || 'DOC-' + Date.now(),
    expiryDate: req.body?.expiryDate || '2028-12-31',
    status: 'VERIFIED',
    createdAt: new Date()
  };
  if (!vehicle.documents) vehicle.documents = [];
  vehicle.documents.push(newDoc);
  return ok(res, newDoc, 'Document uploaded and verified', 201);
});

// ==========================================
// 4. DRIVERS
// ==========================================
router.get('/drivers', (req, res) => {
  const { page, limit, search, status } = req.query;
  const filter = {};
  if (status) filter.status = status;
  const result = mockStore.query(mockStore.drivers, { filter, search, page, limit, sortField: 'name', sortOrder: 1 });
  return paginated(res, result);
});

router.get('/drivers/:id', (req, res) => {
  const driver = mockStore.drivers.find((d) => d._id === req.params.id);
  if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });
  return ok(res, driver);
});

router.post('/drivers', (req, res) => {
  const b = req.body || {};
  const newDriver = {
    _id: 'drv_' + crypto.randomBytes(6).toString('hex'),
    companyId: mockStore.tenant._id,
    name: b.name || 'New Commercial Driver',
    phone: b.phone || '+91 98251 00000',
    licenseNumber: (b.licenseNumber || 'GJ01-2022-998877').trim().toUpperCase(),
    licenseExpiry: b.licenseExpiry || '2038-12-31',
    status: 'AVAILABLE',
    experienceYears: parseInt(b.experienceYears || '5', 10),
    bloodGroup: b.bloodGroup || 'B+',
    isActive: true,
    createdAt: new Date()
  };
  mockStore.drivers.unshift(newDriver);
  return ok(res, newDriver, 'Driver onboarded successfully', 201);
});

router.put('/drivers/:id', (req, res) => {
  const idx = mockStore.drivers.findIndex((d) => d._id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Driver not found' });
  mockStore.drivers[idx] = { ...mockStore.drivers[idx], ...req.body, updatedAt: new Date() };
  return ok(res, mockStore.drivers[idx], 'Driver updated');
});

router.delete('/drivers/:id', (req, res) => {
  mockStore.drivers = mockStore.drivers.filter((d) => d._id !== req.params.id);
  return ok(res, null, 'Driver removed');
});

router.post('/drivers/:id/documents', (req, res) => {
  return ok(res, { _id: 'doc_drv_' + Date.now(), status: 'VERIFIED' }, 'Driver document attached', 201);
});

// ==========================================
// 5. CUSTOMERS (PARTIES)
// ==========================================
router.get('/customers', (req, res) => {
  const { page, limit, search, type } = req.query;
  const filter = {};
  if (type) filter.type = type;
  const result = mockStore.query(mockStore.customers, { filter, search, page, limit, sortField: 'legalName', sortOrder: 1 });
  return paginated(res, result);
});

router.get('/customers/:id', (req, res) => {
  const customer = mockStore.customers.find((c) => c._id === req.params.id);
  if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
  return ok(res, customer);
});

router.post('/customers', (req, res) => {
  const b = req.body || {};
  const newCustomer = {
    _id: 'cust_' + crypto.randomBytes(6).toString('hex'),
    companyId: mockStore.tenant._id,
    legalName: b.legalName || 'New Commercial Client Ltd',
    tradeName: b.tradeName || b.legalName || 'Commercial Client',
    gstin: (b.gstin || '24AAACT9999Z1Z5').trim().toUpperCase(),
    pan: b.pan || (b.gstin ? b.gstin.slice(2, 12) : 'AAACT9999Z'),
    type: b.type || 'CONSIGNOR',
    contactPerson: b.contactPerson || 'Dispatch Officer',
    email: b.email || 'dispatch@client.com',
    phone: b.phone || '+91 98250 00000',
    billingAddress: b.billingAddress || { street: 'Industrial Estate', city: 'Ahmedabad', state: 'Gujarat', pincode: '382405', country: 'IN' },
    creditPeriodDays: parseInt(b.creditPeriodDays || '30', 10),
    isActive: true,
    createdAt: new Date()
  };
  mockStore.customers.unshift(newCustomer);
  return ok(res, newCustomer, 'Party registered successfully', 201);
});

router.put('/customers/:id', (req, res) => {
  const idx = mockStore.customers.findIndex((c) => c._id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Customer not found' });
  mockStore.customers[idx] = { ...mockStore.customers[idx], ...req.body, updatedAt: new Date() };
  return ok(res, mockStore.customers[idx], 'Customer updated');
});

router.delete('/customers/:id', (req, res) => {
  mockStore.customers = mockStore.customers.filter((c) => c._id !== req.params.id);
  return ok(res, null, 'Customer removed');
});

// ==========================================
// 6. LOCATIONS
// ==========================================
router.get('/locations', (req, res) => {
  const { page, limit, search } = req.query;
  const result = mockStore.query(mockStore.locations, { search, page, limit, sortField: 'name', sortOrder: 1 });
  return paginated(res, result);
});

router.get('/locations/:id', (req, res) => {
  const location = mockStore.locations.find((l) => l._id === req.params.id);
  if (!location) return res.status(404).json({ success: false, message: 'Location not found' });
  return ok(res, location);
});

router.post('/locations', (req, res) => {
  const b = req.body || {};
  const newLoc = {
    _id: 'loc_' + crypto.randomBytes(6).toString('hex'),
    companyId: mockStore.tenant._id,
    name: b.name || 'New Logistics Terminal',
    code: b.code || 'LOC-' + Math.floor(100 + Math.random() * 900),
    city: b.city || 'Ahmedabad',
    state: b.state || 'Gujarat',
    address: b.address || 'National Highway 48',
    pincode: b.pincode || '382405',
    hubType: b.hubType || 'CENTRAL_HUB',
    coordinates: b.coordinates || { lat: 23.0225, lng: 72.5714 },
    isActive: true,
    createdAt: new Date()
  };
  mockStore.locations.unshift(newLoc);
  return ok(res, newLoc, 'Location registered', 201);
});

// ==========================================
// 7. LOADS (CONSIGNMENTS)
// ==========================================
router.get('/loads', (req, res) => {
  const { page, limit, search, status } = req.query;
  const filter = {};
  if (status) filter.status = status;
  const result = mockStore.query(mockStore.loads, { filter, search, page, limit, sortField: 'createdAt', sortOrder: -1 });
  return paginated(res, result);
});

router.get('/loads/:id', (req, res) => {
  const load = mockStore.loads.find((l) => l._id === req.params.id);
  if (!load) return res.status(404).json({ success: false, message: 'Load not found' });
  return ok(res, load);
});

router.post('/loads', (req, res) => {
  const b = req.body || {};
  const loadNum = 'LD-2026-' + String(mockStore.loads.length + 1).padStart(4, '0');
  const freight = parseFloat(b.freightAmount || '45000');
  const advance = parseFloat(b.advancePaid || '20000');
  const newLoad = {
    _id: 'ld_' + crypto.randomBytes(6).toString('hex'),
    companyId: mockStore.tenant._id,
    loadNumber: loadNum,
    customerId: b.customerId || mockStore.customers[0]._id,
    customer: mockStore.customers.find((c) => c._id === b.customerId) || mockStore.customers[0],
    consignorName: b.consignorName || 'Reliance Industries Limited',
    consigneeName: b.consigneeName || 'Asian Paints Limited',
    originCity: b.originCity || 'Ahmedabad, Gujarat',
    destinationCity: b.destinationCity || 'Mumbai, Maharashtra',
    cargoType: b.cargoType || 'Industrial Goods',
    packageType: b.packageType || 'PALLETS',
    weightMt: parseFloat(b.weightMt || '25.0'),
    freightAmount: freight,
    advancePaid: advance,
    balanceDue: Math.max(0, freight - advance),
    status: b.assignedVehicleId ? 'VEHICLE_ASSIGNED' : 'CREATED',
    assignedVehiclePlate: b.assignedVehiclePlate || '',
    assignedDriverName: b.assignedDriverName || '',
    gtaGstRate: 5.0,
    gtaGstAmount: Math.round(freight * 0.05),
    sacCode: '9965',
    createdAt: new Date()
  };
  mockStore.loads.unshift(newLoad);
  return ok(res, newLoad, 'Load order created successfully', 201);
});

router.put('/loads/:id', (req, res) => {
  const idx = mockStore.loads.findIndex((l) => l._id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Load not found' });
  mockStore.loads[idx] = { ...mockStore.loads[idx], ...req.body, updatedAt: new Date() };
  return ok(res, mockStore.loads[idx], 'Load updated');
});

router.post('/loads/:id/status', (req, res) => {
  const load = mockStore.loads.find((l) => l._id === req.params.id);
  if (!load) return res.status(404).json({ success: false, message: 'Load not found' });
  load.status = req.body?.status || load.status;
  return ok(res, load, `Load status transitioned to ${load.status}`);
});

router.get('/loads/:id/pdf', (req, res) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="Load-${req.params.id}.pdf"`);
  // Return small valid PDF stub
  const minimalPdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF\n');
  return res.send(minimalPdf);
});

// ==========================================
// 8. BILTIES & LR (LORRY RECEIPTS)
// ==========================================
router.get('/bilties', (req, res) => {
  const { page, limit, search } = req.query;
  const result = mockStore.query(mockStore.bilties, { search, page, limit, sortField: 'createdAt', sortOrder: -1 });
  return paginated(res, result);
});

router.get('/bilties/:id', (req, res) => {
  const bilty = mockStore.bilties.find((b) => b._id === req.params.id);
  if (!bilty) return res.status(404).json({ success: false, message: 'Bilty not found' });
  return ok(res, bilty);
});

router.post('/bilties', (req, res) => {
  const b = req.body || {};
  const num = 'BL-2026-' + String(mockStore.bilties.length + 101);
  const freight = parseFloat(b.freightAmount || '65000');
  const advance = parseFloat(b.advanceAmount || '30000');
  const newBilty = {
    _id: 'bl_' + crypto.randomBytes(6).toString('hex'),
    companyId: mockStore.tenant._id,
    biltyNumber: num,
    lrNumber: 'LR-2026-' + String(mockStore.bilties.length + 101),
    loadNumber: b.loadNumber || 'LD-2026-0001',
    vehiclePlate: b.vehiclePlate || 'GJ01AB1234',
    driverName: b.driverName || 'Ramesh Patel',
    consignor: b.consignor || 'Reliance Industries Limited',
    consignee: b.consignee || 'Asian Paints Limited',
    origin: b.origin || 'Ahmedabad Hub',
    destination: b.destination || 'Mumbai Nhava Sheva',
    goodsDescription: b.goodsDescription || 'Industrial Consignment',
    weightMt: parseFloat(b.weightMt || '28.0'),
    freightAmount: freight,
    advanceAmount: advance,
    balanceAmount: Math.max(0, freight - advance),
    gstRate: 5.0,
    gstAmount: Math.round(freight * 0.05),
    gstPayableBy: 'CONSIGNOR',
    status: 'IN_TRANSIT',
    createdAt: new Date()
  };
  mockStore.bilties.unshift(newBilty);
  return ok(res, newBilty, 'Bilty generated successfully', 201);
});

router.get('/lr', (req, res) => {
  // Mirror bilties as LR
  const { page, limit, search } = req.query;
  const result = mockStore.query(mockStore.bilties, { search, page, limit, sortField: 'createdAt', sortOrder: -1 });
  return paginated(res, result);
});

router.get('/bilties/:id/pdf', (req, res) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="Bilty-${req.params.id}.pdf"`);
  const minimalPdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF\n');
  return res.send(minimalPdf);
});

router.get('/lr/:id/pdf', (req, res) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="LR-${req.params.id}.pdf"`);
  const minimalPdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF\n');
  return res.send(minimalPdf);
});

// ==========================================
// 9. TRIPS
// ==========================================
router.get('/trips', (req, res) => {
  const { page, limit, search, status } = req.query;
  const filter = {};
  if (status) filter.status = status;
  const result = mockStore.query(mockStore.trips, { filter, search, page, limit, sortField: 'startedAt', sortOrder: -1 });
  return paginated(res, result);
});

router.get('/trips/:id', (req, res) => {
  const trip = mockStore.trips.find((t) => t._id === req.params.id);
  if (!trip) return res.status(404).json({ success: false, message: 'Trip not found' });
  return ok(res, trip);
});

router.post('/trips', (req, res) => {
  const b = req.body || {};
  const newTrip = {
    _id: 'trp_' + crypto.randomBytes(6).toString('hex'),
    companyId: mockStore.tenant._id,
    tripNumber: 'TRP-2026-' + String(mockStore.trips.length + 1).padStart(3, '0'),
    vehiclePlate: b.vehiclePlate || 'GJ01AB1234',
    driverName: b.driverName || 'Ramesh Patel',
    driverPhone: b.driverPhone || '+91 98251 11223',
    origin: b.origin || 'Ahmedabad, Gujarat',
    destination: b.destination || 'Mumbai, Maharashtra',
    status: 'IN_TRANSIT',
    odometerStart: parseInt(b.odometerStart || '140000', 10),
    totalExpenses: 0,
    expenses: [],
    startedAt: new Date()
  };
  mockStore.trips.unshift(newTrip);
  return ok(res, newTrip, 'Trip dispatched successfully', 201);
});

router.post('/trips/:id/expenses', (req, res) => {
  const trip = mockStore.trips.find((t) => t._id === req.params.id);
  if (!trip) return res.status(404).json({ success: false, message: 'Trip not found' });
  const newExpense = {
    _id: 'exp_' + Date.now(),
    category: req.body?.category || 'FUEL',
    amount: parseFloat(req.body?.amount || '5000'),
    notes: req.body?.notes || 'Highway expense'
  };
  if (!trip.expenses) trip.expenses = [];
  trip.expenses.push(newExpense);
  trip.totalExpenses = trip.expenses.reduce((s, e) => s + (e.amount || 0), 0);
  return ok(res, trip, 'Expense recorded', 201);
});

// ==========================================
// 10. PROOF OF DELIVERY (POD)
// ==========================================
router.get('/pod', (req, res) => {
  const { page, limit, search, status } = req.query;
  const filter = {};
  if (status) filter.status = status;
  const result = mockStore.query(mockStore.pods, { filter, search, page, limit, sortField: 'createdAt', sortOrder: -1 });
  return paginated(res, result);
});

router.post('/pod', (req, res) => {
  const b = req.body || {};
  const newPod = {
    _id: 'pod_' + crypto.randomBytes(6).toString('hex'),
    companyId: mockStore.tenant._id,
    podNumber: 'POD-2026-' + String(mockStore.pods.length + 1).padStart(4, '0'),
    loadNumber: b.loadNumber || 'LD-2026-0001',
    status: 'SUBMITTED',
    receivedBy: b.receivedBy || 'Consignee Gate In Charge',
    remarks: b.remarks || 'Signed consignment copy received',
    createdAt: new Date()
  };
  mockStore.pods.unshift(newPod);
  return ok(res, newPod, 'POD submitted', 201);
});

router.post('/pod/:id/verify', (req, res) => {
  const pod = mockStore.pods.find((p) => p._id === req.params.id);
  if (!pod) return res.status(404).json({ success: false, message: 'POD not found' });
  pod.status = 'VERIFIED';
  pod.verifiedAt = new Date();
  pod.verifiedBy = 'Lead System Administrator';
  return ok(res, pod, 'POD verified and confirmed');
});

// ==========================================
// 11. COMPLIANCE & MAINTENANCE
// ==========================================
router.get('/compliance', (req, res) => {
  return ok(res, {
    summary: { expired: 0, expiring15Days: 1, expiring30Days: 2 },
    documents: [
      { _id: 'cmp_1', type: 'VEHICLE', entityName: 'MH12CD5678', docType: 'INSURANCE', expiryDate: '2026-11-15', daysLeft: 17, status: 'EXPIRING_SOON' },
      { _id: 'cmp_2', type: 'VEHICLE', entityName: 'GJ01AB1234', docType: 'FITNESS', expiryDate: '2026-12-30', daysLeft: 62, status: 'VALID' }
    ]
  });
});

router.get('/maintenance', (req, res) => {
  const { page, limit, search } = req.query;
  const result = mockStore.query(mockStore.maintenance, { search, page, limit, sortField: 'createdAt', sortOrder: -1 });
  return paginated(res, result);
});

router.post('/maintenance', (req, res) => {
  const b = req.body || {};
  const newMaint = {
    _id: 'maint_' + crypto.randomBytes(6).toString('hex'),
    companyId: mockStore.tenant._id,
    maintenanceNumber: 'MAINT-2026-' + String(mockStore.maintenance.length + 1).padStart(3, '0'),
    vehiclePlate: b.vehiclePlate || 'GJ01AB1234',
    maintenanceType: b.maintenanceType || 'PREVENTIVE',
    serviceCenter: b.serviceCenter || 'Authorized Commercial Service Center',
    cost: parseFloat(b.cost || '10000'),
    status: 'IN_PROGRESS',
    description: b.description || 'General maintenance servicing',
    scheduledDate: b.scheduledDate || new Date().toISOString().split('T')[0],
    createdAt: new Date()
  };
  mockStore.maintenance.unshift(newMaint);
  return ok(res, newMaint, 'Maintenance record created', 201);
});

// ==========================================
// 12. ADMIN, USERS, ROLES & SETTINGS
// ==========================================
router.get('/admin/users', (req, res) => {
  const safeUsers = mockStore.users.map((u) => (typeof u.toSafeObject === 'function' ? u.toSafeObject() : u));
  return ok(res, safeUsers);
});

router.post('/admin/users', (req, res) => {
  const b = req.body || {};
  const newUser = {
    _id: 'usr_' + crypto.randomBytes(6).toString('hex'),
    name: b.name || 'Staff User',
    email: (b.email || 'staff@technofay.com').trim().toLowerCase(),
    phone: b.phone || '+91 98251 00000',
    role: b.role || 'TRANSPORT_MANAGER',
    roleId: mockStore.roles[1],
    companyId: mockStore.tenant,
    isActive: true,
    createdAt: new Date()
  };
  mockStore.users.push(newUser);
  return ok(res, newUser, 'User created', 201);
});

router.get('/admin/roles', (req, res) => {
  return ok(res, mockStore.roles);
});

router.get('/admin/audit-logs', (req, res) => {
  const sampleLogs = [
    { _id: 'aud_1', actorName: 'Vikramaditya Rao', action: 'ORGANIZATION_REGISTERED', module: 'AUTH', timestamp: new Date(Date.now() - 3600000).toISOString() },
    { _id: 'aud_2', actorName: 'Vikramaditya Rao', action: 'LOGIN_SUCCESS', module: 'AUTH', timestamp: new Date().toISOString() }
  ];
  return paginated(res, { data: sampleLogs, pagination: { page: 1, limit: 20, total: 2, totalPages: 1 } });
});

router.get('/admin/settings', (req, res) => {
  return ok(res, mockStore.settings);
});

router.put('/admin/settings', (req, res) => {
  mockStore.settings = { ...mockStore.settings, ...req.body };
  return ok(res, mockStore.settings, 'Settings updated');
});

// ==========================================
// 13. REPORTS & PUBLIC TRACKING
// ==========================================
router.get('/reports/loads', (req, res) => {
  return ok(res, {
    totalLoads: mockStore.loads.length,
    totalFreight: mockStore.loads.reduce((s, l) => s + (l.freightAmount || 0), 0),
    totalWeightMt: mockStore.loads.reduce((s, l) => s + (l.weightMt || 0), 0),
    items: mockStore.loads
  });
});

router.get('/reports/financials', (req, res) => {
  const m = mockStore.getMetrics();
  return ok(res, m.financials);
});

router.get('/reports/vehicles', (req, res) => {
  return ok(res, mockStore.vehicles);
});

router.get('/reports/trips', (req, res) => {
  return ok(res, mockStore.trips);
});

router.get('/public/track/:trackingId', (req, res) => {
  const tid = req.params.trackingId.toUpperCase();
  const trip = mockStore.trips[1]; // active trip
  return ok(res, {
    trackingNumber: tid,
    status: trip.status,
    origin: trip.origin,
    destination: trip.destination,
    currentLocation: trip.currentLocation,
    vehiclePlate: trip.vehiclePlate,
    startedAt: trip.startedAt,
    estimatedDelivery: new Date(Date.now() + 43200000).toISOString()
  });
});

router.post('/contact', (req, res) => {
  return ok(res, null, 'Thank you! Your logistics inquiry has been received.');
});

// Wildcard fallback for any missing sub-routes: return 200 with empty array/object
router.all('*', (req, res) => {
  if (req.method === 'GET') {
    return ok(res, [], 'Autonomous In-Memory Demo Mode');
  }
  return ok(res, { id: 'mock_' + Date.now(), ...req.body }, 'Action executed in Live Demo Mode', 200);
});

module.exports = router;
