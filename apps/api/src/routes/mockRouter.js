/**
 * Comprehensive In-Memory Express Router
 * Serves all Fleet Management REST endpoints seamlessly when running in Standalone / Demo mode
 * without requiring any external MongoDB instance.
 */

const express = require('express');
const crypto = require('node:crypto');
const mockStore = require('../services/mockDataStore');
const TokenService = require('../modules/auth/services/token.service');
const btsDocsService = require('../services/btsDocs.service');
const pdfService = require('../services/pdf.service');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

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

// Helper: paginated response envelope compatible with both res.data.items and res.data
const paginated = (res, result, message = 'Success') => {
  const items = Array.isArray(result) ? result : (result.data || []);
  const pagination = result.pagination || {
    page: 1,
    limit: items.length || 20,
    total: items.length,
    totalPages: 1
  };

  return res.status(200).json({
    success: true,
    statusCode: 200,
    message,
    data: {
      items,
      pagination
    },
    items,
    pagination
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

// In-Memory state for WhatsApp Messages and Compliance Notifications
if (!mockStore.whatsappMessages) {
  mockStore.whatsappMessages = [
    {
      _id: 'wa_msg_101',
      recipientPhone: '+91 98200 11990',
      recipientName: 'Gaurav Mehta (Asian Paints)',
      templateName: 'DELIVERY_COMPLETED',
      messageType: 'TEMPLATE',
      renderedMessage: '✅ Consignment Delivered Successfully. Load LD-2026-0001 has arrived at Mumbai JNPT. Proof of Delivery verified.',
      documentFileName: 'BTS-Loading-Receipt-LD-2026-0001.pdf',
      provider: 'META_WHATSAPP_CLOUD',
      providerMessageId: 'wamid.HBgMOTE5ODIwMDExOTkwFQIAERgSRjQ2OTg0M0IxMjM0NTY3OAA=',
      status: 'DELIVERED',
      retryCount: 0,
      maxRetries: 3,
      deliveredAt: new Date(Date.now() - 3600000).toISOString(),
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      relatedEntity: { entityType: 'LOAD', referenceNumber: 'LD-2026-0001' }
    },
    {
      _id: 'wa_msg_102',
      recipientPhone: '+91 98250 77662',
      recipientName: 'Ketan Trivedi (Adani Wilmar)',
      templateName: 'LOAD_DISPATCHED',
      messageType: 'TEMPLATE',
      renderedMessage: '🚚 Barkat Tempo Service: Consignment LD-2026-0002 dispatched via MH12CD5678. Driver: Vikram Singh.',
      provider: 'META_WHATSAPP_CLOUD',
      providerMessageId: 'wamid.HBgMOTE5ODIwMDExOTkwFQIAERgSRjQ2OTg0M0IxMjM0NTY3OUI=',
      status: 'DELIVERED',
      retryCount: 0,
      maxRetries: 3,
      deliveredAt: new Date(Date.now() - 7200000).toISOString(),
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      relatedEntity: { entityType: 'TRIP', referenceNumber: 'TRP-2026-002' }
    }
  ];
}

if (!mockStore.complianceNotifications) {
  mockStore.complianceNotifications = [
    {
      _id: 'notif_1',
      title: 'Vehicle Insurance Expiring Soon',
      message: 'Comprehensive Commercial Insurance for MH12CD5678 expires in 17 days (2026-11-15). Renew promptly to avoid transit penalties.',
      severity: 'WARNING',
      entityType: 'VEHICLE',
      referenceNumber: 'MH12CD5678',
      daysLeft: 17,
      isRead: false,
      createdAt: new Date().toISOString()
    },
    {
      _id: 'notif_2',
      title: 'Fitness Certificate Verification Valid',
      message: 'Fitness certification for GJ01AB1234 is verified and valid for 62 days.',
      severity: 'INFO',
      entityType: 'VEHICLE',
      referenceNumber: 'GJ01AB1234',
      daysLeft: 62,
      isRead: true,
      createdAt: new Date(Date.now() - 86400000).toISOString()
    }
  ];
}

if (!mockStore.bulkJobs) {
  mockStore.bulkJobs = [];
}

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
      total: mockStore.whatsappMessages.length,
      success: mockStore.whatsappMessages.filter((m) => m.status === 'DELIVERED').length,
      failed: 0,
      deliveryRate: 100,
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
      loadCount: Math.floor(4 + (i % 3)),
      freight: Math.floor(120000 + (i * 15000)),
      weightMt: Math.floor(90 + (i * 12)),
      tripCount: Math.floor(3 + (i % 2)),
      expenses: Math.floor(25000 + (i * 3000))
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
    provider: 'BTS Virtual GPS Telematics Engine (AIS-140)',
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
  const vehicle = mockStore.vehicles.find((v) => v._id === req.params.id || v.plateNumber === req.params.id);
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

router.put(['/vehicles/:id', '/vehicles/:id/status'], (req, res) => {
  const idx = mockStore.vehicles.findIndex((v) => v._id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Vehicle not found' });
  mockStore.vehicles[idx] = { ...mockStore.vehicles[idx], ...req.body, updatedAt: new Date() };
  return ok(res, mockStore.vehicles[idx], 'Vehicle updated');
});

router.patch(['/vehicles/:id', '/vehicles/:id/status'], (req, res) => {
  const idx = mockStore.vehicles.findIndex((v) => v._id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Vehicle not found' });
  mockStore.vehicles[idx] = { ...mockStore.vehicles[idx], ...req.body, updatedAt: new Date() };
  return ok(res, mockStore.vehicles[idx], 'Vehicle updated');
});

router.delete('/vehicles/:id', (req, res) => {
  mockStore.vehicles = mockStore.vehicles.filter((v) => v._id !== req.params.id);
  return ok(res, null, 'Vehicle deleted');
});

router.post('/vehicles/:id/documents', upload.single('file'), (req, res) => {
  const vehicle = mockStore.vehicles.find((v) => v._id === req.params.id);
  if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
  const b = req.body || {};
  const originalFileName = req.file ? req.file.originalname : (b.documentType || 'DOC') + '_file.pdf';
  const newDoc = {
    _id: 'doc_' + crypto.randomBytes(6).toString('hex'),
    documentType: b.documentType || 'RC',
    documentNumber: b.documentNumber || 'DOC-' + Date.now(),
    issueDate: b.issueDate || new Date().toISOString().split('T')[0],
    expiryDate: b.expiryDate || '2028-12-31',
    status: 'VERIFIED',
    originalFileName,
    fileSize: req.file ? req.file.size : 45000,
    notes: b.notes || '',
    createdAt: new Date()
  };
  if (!vehicle.documents) vehicle.documents = [];
  vehicle.documents.unshift(newDoc);
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
    phone: b.phone || '93776 10333',
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

router.patch('/drivers/:id', (req, res) => {
  const idx = mockStore.drivers.findIndex((d) => d._id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Driver not found' });
  mockStore.drivers[idx] = { ...mockStore.drivers[idx], ...req.body, updatedAt: new Date() };
  return ok(res, mockStore.drivers[idx], 'Driver updated');
});

router.delete('/drivers/:id', (req, res) => {
  mockStore.drivers = mockStore.drivers.filter((d) => d._id !== req.params.id);
  return ok(res, null, 'Driver removed');
});

router.post('/drivers/:id/documents', upload.single('file'), (req, res) => {
  const driver = mockStore.drivers.find((d) => d._id === req.params.id);
  if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });
  const b = req.body || {};
  const originalFileName = req.file ? req.file.originalname : (b.documentType || 'DOC') + '_file.pdf';
  const newDoc = {
    _id: 'doc_' + crypto.randomBytes(6).toString('hex'),
    documentType: b.documentType || 'DRIVING_LICENCE',
    documentNumber: b.documentNumber || 'DL-' + Date.now(),
    issueDate: b.issueDate || new Date().toISOString().split('T')[0],
    expiryDate: b.expiryDate || '2035-05-14',
    status: 'VERIFIED',
    originalFileName,
    fileSize: req.file ? req.file.size : 52000,
    notes: b.notes || '',
    createdAt: new Date()
  };
  if (!driver.documents) driver.documents = [];
  driver.documents.unshift(newDoc);
  return ok(res, newDoc, 'Driver document attached successfully', 201);
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
  const name = b.name || b.legalName || 'New Commercial Client Ltd';
  const newCustomer = {
    _id: 'cust_' + crypto.randomBytes(6).toString('hex'),
    companyId: mockStore.tenant._id,
    name,
    legalName: name,
    tradeName: b.tradeName || name,
    gstin: (b.gstin || '24AAACT9999Z1Z5').trim().toUpperCase(),
    pan: b.pan || (b.gstin ? b.gstin.slice(2, 12) : 'AAACT9999Z'),
    type: b.type || 'CONSIGNOR',
    contactPerson: b.contactPerson || 'Dispatch Officer',
    email: b.email || 'dispatch@client.com',
    phone: b.phone || '93776 10333',
    billingAddress: b.billingAddress || { street: 'Industrial Estate', city: 'Vadodara', state: 'Gujarat', pincode: '390022', country: 'IN' },
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
    city: b.city || 'Vadodara',
    state: b.state || 'Gujarat',
    address: b.address || 'National Highway 48, Golden Chokdi',
    pincode: b.pincode || '390022',
    hubType: b.hubType || 'CENTRAL_HUB',
    coordinates: b.coordinates || { lat: 22.3072, lng: 73.1812 },
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
  const load = mockStore.loads.find((l) => l._id === req.params.id || l.loadNumber === req.params.id);
  if (!load) return res.status(404).json({ success: false, message: 'Load not found' });
  return ok(res, load);
});

router.post('/loads', (req, res) => {
  const b = req.body || {};
  const loadNum = 'LD-2026-' + String(mockStore.loads.length + 1).padStart(4, '0');
  
  const customer = mockStore.customers.find((c) => c._id === b.customerId) || mockStore.customers[0];
  const consignor = mockStore.customers.find((c) => c._id === (b.consignorId || b.customerId)) || customer;
  const consignee = mockStore.customers.find((c) => c._id === (b.consigneeId || b.customerId)) || mockStore.customers[4] || customer;
  
  const f = b.financials || {};
  const basePaise = f.baseFreightPaise || Math.round((parseFloat(b.freightAmount) || 45000) * 100);
  const loadingPaise = f.loadingPaise || 0;
  const unloadingPaise = f.unloadingPaise || 0;
  const detentionPaise = f.detentionPaise || 0;
  const tollPaise = f.tollPaise || 0;
  const handlingPaise = f.handlingPaise || 0;
  const miscPaise = f.miscChargePaise || 0;
  const advancePaise = f.advancePaise || Math.round((parseFloat(b.advancePaid) || 20000) * 100);
  const deductionPaise = f.deductionPaise || 0;

  const totalPaise = basePaise + loadingPaise + unloadingPaise + detentionPaise + tollPaise + handlingPaise + miscPaise;
  const balancePaise = Math.max(0, totalPaise - advancePaise - deductionPaise);

  const weight = parseFloat(b.totalWeightMt || b.weightMt || '25.0');
  const qty = parseInt(b.totalQuantity || b.quantity || '50', 10);

  const stops = Array.isArray(b.stops) && b.stops.length > 0
    ? b.stops.map((s, idx) => {
        const loc = mockStore.locations.find((l) => l._id === s.locationId) || { name: s.locationName || 'Hub', city: 'Vadodara', address: 'NH-48' };
        return {
          _id: 'stp_' + Date.now() + '_' + idx,
          sequence: s.sequence || (idx + 1),
          stopType: s.stopType || (idx === 0 ? 'PICKUP' : 'DELIVERY'),
          locationId: loc,
          locationName: loc.name,
          allocatedQuantity: s.allocatedQuantity || qty,
          allocatedWeightMt: s.allocatedWeightMt || weight,
          status: 'PENDING'
        };
      })
    : [
        {
          _id: 'stp_' + Date.now() + '_1',
          sequence: 1,
          stopType: 'PICKUP',
          locationId: mockStore.locations[0],
          locationName: mockStore.locations[0]?.name || 'Vadodara Hub',
          allocatedQuantity: qty,
          allocatedWeightMt: weight,
          status: 'PENDING'
        },
        {
          _id: 'stp_' + Date.now() + '_2',
          sequence: 2,
          stopType: 'DELIVERY',
          locationId: mockStore.locations[2] || mockStore.locations[0],
          locationName: mockStore.locations[2]?.name || 'Mumbai Terminal',
          allocatedQuantity: qty,
          allocatedWeightMt: weight,
          status: 'PENDING'
        }
      ];

  const newLoad = {
    _id: 'ld_' + crypto.randomBytes(6).toString('hex'),
    companyId: mockStore.tenant._id,
    loadNumber: loadNum,
    orderDate: new Date().toISOString(),
    customerId: {
      _id: customer._id,
      name: customer.legalName,
      legalName: customer.legalName,
      phone: customer.phone
    },
    customer,
    consignorId: {
      _id: consignor._id,
      name: consignor.legalName,
      legalName: consignor.legalName,
      phone: consignor.phone
    },
    consigneeId: {
      _id: consignee._id,
      name: consignee.legalName,
      legalName: consignee.legalName,
      phone: consignee.phone
    },
    consignorName: consignor.legalName,
    consigneeName: consignee.legalName,
    originCity: b.originCity || stops[0]?.locationName || 'Vadodara, GJ',
    origin: b.originCity || stops[0]?.locationName || 'Vadodara, GJ',
    destinationCity: b.destinationCity || stops[stops.length - 1]?.locationName || 'Mumbai, MH',
    destination: b.destinationCity || stops[stops.length - 1]?.locationName || 'Mumbai, MH',
    cargoType: b.cargoType || 'Industrial Consignment Goods',
    packageType: b.packageType || 'PALLETS',
    totalWeightMt: weight,
    weightMt: weight,
    totalQuantity: qty,
    quantity: qty,
    unit: b.packageType || 'PALLETS',
    freightAmount: totalPaise / 100,
    advancePaid: advancePaise / 100,
    balanceDue: balancePaise / 100,
    financials: {
      baseFreightPaise: basePaise,
      totalFreightPaise: totalPaise,
      advancePaise: advancePaise,
      balancePaise: balancePaise,
      baseFreightRupees: basePaise / 100,
      totalFreightRupees: totalPaise / 100,
      advanceRupees: advancePaise / 100,
      balanceRupees: balancePaise / 100
    },
    status: b.assignedVehicleId ? 'VEHICLE_ASSIGNED' : 'CREATED',
    assignedVehiclePlate: b.assignedVehiclePlate || '',
    assignedDriverName: b.assignedDriverName || '',
    stops,
    gtaGstRate: 5.0,
    gtaGstAmount: Math.round((totalPaise / 100) * 0.05),
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

router.patch('/loads/:id', (req, res) => {
  const idx = mockStore.loads.findIndex((l) => l._id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Load not found' });
  mockStore.loads[idx] = { ...mockStore.loads[idx], ...req.body, updatedAt: new Date() };
  return ok(res, mockStore.loads[idx], 'Load updated');
});

router.delete('/loads/:id', (req, res) => {
  mockStore.loads = mockStore.loads.filter((l) => l._id !== req.params.id);
  return ok(res, null, 'Load deleted');
});

router.post(['/loads/:id/status', '/loads/:id/transition'], (req, res) => {
  const load = mockStore.loads.find((l) => l._id === req.params.id);
  if (!load) return res.status(404).json({ success: false, message: 'Load not found' });
  load.status = req.body?.status || load.status;
  return ok(res, load, `Load status transitioned to ${load.status}`);
});

router.patch('/loads/:id/status', (req, res) => {
  const load = mockStore.loads.find((l) => l._id === req.params.id);
  if (!load) return res.status(404).json({ success: false, message: 'Load not found' });
  load.status = req.body?.status || load.status;
  return ok(res, load, `Load status transitioned to ${load.status}`);
});

router.post('/loads/:id/assign', (req, res) => {
  const load = mockStore.loads.find((l) => l._id === req.params.id);
  if (!load) return res.status(404).json({ success: false, message: 'Load not found' });
  
  const { vehicleId, driverId } = req.body || {};
  const vehicle = mockStore.vehicles.find((v) => v._id === vehicleId);
  const driver = mockStore.drivers.find((d) => d._id === driverId);

  if (vehicle) {
    load.assignedVehicleId = {
      _id: vehicle._id,
      plateNumber: vehicle.plateNumber,
      vehicleType: vehicle.vehicleType,
      capacityTonnage: vehicle.capacityTonnage
    };
    load.assignedVehiclePlate = vehicle.plateNumber;
    load.vehiclePlate = vehicle.plateNumber;
    vehicle.status = 'ON_TRIP';
  }

  if (driver) {
    load.assignedDriverId = {
      _id: driver._id,
      name: driver.name,
      phone: driver.phone
    };
    load.assignedDriverName = driver.name;
    load.driverName = driver.name;
    driver.status = 'ON_TRIP';
  }

  load.status = 'VEHICLE_ASSIGNED';
  return ok(res, load, 'Vehicle and driver assigned to load');
});

router.get(['/loads/:id/pdf', '/loads/:id/loading-slip'], async (req, res) => {
  try {
    const load = mockStore.loads.find((l) => l._id === req.params.id || l.loadNumber === req.params.id) || {};
    const isMemo = req.query?.type === 'memo';
    const pdfBuffer = isMemo
      ? await btsDocsService.generateMemoPdf({
          memoNumber: load.loadNumber || req.params.id,
          date: load.createdAt,
          fromStation: load.origin || load.originCity,
          toStation: load.destination || load.destinationCity,
          vehicleNumber: load.vehiclePlate || load.assignedVehiclePlate,
          driverName: load.driverName || load.assignedDriverName
        })
      : await btsDocsService.generateLoadingReceiptPdf({
          lrNumber: load.loadNumber || req.params.id,
          date: load.createdAt,
          vehicleNumber: load.vehiclePlate || load.assignedVehiclePlate,
          toStation: load.destination || load.destinationCity,
          weight: load.totalWeightMt || load.weightMt ? `${load.totalWeightMt || load.weightMt} MT` : undefined,
          freightAmount: load.freightAmount,
          advanceAmount: load.advancePaid || load.advanceAmount,
          balanceAmount: load.balanceDue || load.balanceAmount,
          consignee: { name: load.consigneeName || load.customerName, city: load.destinationCity || load.destination },
          consignor: { name: load.consignorName, city: load.originCity || load.origin }
        });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="BTS-${isMemo ? 'Memo' : 'Loading-Receipt'}-${req.params.id}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('Error generating load PDF:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
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
  const bilty = mockStore.bilties.find((b) => b._id === req.params.id || b.biltyNumber === req.params.id);
  if (!bilty) return res.status(404).json({ success: false, message: 'Bilty not found' });
  return ok(res, bilty);
});

router.post('/bilties', (req, res) => {
  const b = req.body || {};
  const num = 'BL-2026-' + String(mockStore.bilties.length + 101);
  const lrNum = b.lrNumber || ('LR-2026-' + String(mockStore.bilties.length + 101));
  const freight = parseFloat(b.freightAmount || '65000');
  const advance = parseFloat(b.advanceAmount || '30000');
  
  const newBilty = {
    _id: 'bl_' + crypto.randomBytes(6).toString('hex'),
    companyId: mockStore.tenant._id,
    biltyNumber: num,
    lrNumber: lrNum,
    loadNumber: b.loadNumber || 'LD-2026-0001',
    loadId: { _id: 'ld_demo', loadNumber: b.loadNumber || 'LD-2026-0001' },
    lrId: { _id: 'lr_demo', lrNumber: lrNum },
    vehiclePlate: b.vehiclePlate || 'GJ01AB1234',
    vehicleId: { plateNumber: b.vehiclePlate || 'GJ01AB1234', vehicleType: 'Heavy Commercial Vehicle (HCV)' },
    driverName: b.driverName || 'Ramesh Patel',
    driverId: { name: b.driverName || 'Ramesh Patel', phone: '93776 10333' },
    consignor: b.consignor || 'Reliance Industries Limited',
    consignorId: { name: b.consignor || 'Reliance Industries Limited', phone: '93776 10333' },
    consignee: b.consignee || 'Asian Paints Limited',
    consigneeId: { name: b.consignee || 'Asian Paints Limited', phone: '93776 10333' },
    origin: b.origin || 'Ahmedabad Central Hub',
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

router.patch(['/bilties/:id/status', '/bilties/:id'], (req, res) => {
  const b = mockStore.bilties.find((item) => item._id === req.params.id);
  if (!b) return res.status(404).json({ success: false, message: 'Bilty not found' });
  if (req.body?.status) b.status = req.body.status;
  return ok(res, b, `Bilty status updated to ${b.status}`);
});

router.get('/lr', (req, res) => {
  const { page, limit, search } = req.query;
  const result = mockStore.query(mockStore.bilties, { search, page, limit, sortField: 'createdAt', sortOrder: -1 });
  return paginated(res, result);
});

router.get('/lr/:id', (req, res) => {
  const lr = mockStore.bilties.find((b) => b._id === req.params.id || b.lrNumber === req.params.id);
  if (!lr) return res.status(404).json({ success: false, message: 'LR not found' });
  return ok(res, lr);
});

router.post('/lr', (req, res) => {
  const b = req.body || {};
  const lrNum = b.lrNumber || ('LR-2026-' + String(mockStore.bilties.length + 101));
  const blNum = 'BL-2026-' + String(mockStore.bilties.length + 101);
  const freight = parseFloat(b.freightAmount || b.freightRate || '65000');
  const advance = parseFloat(b.advanceAmount || '30000');

  const newLr = {
    _id: 'lr_' + crypto.randomBytes(6).toString('hex'),
    companyId: mockStore.tenant._id,
    lrNumber: lrNum,
    biltyNumber: blNum,
    loadNumber: b.loadNumber || 'LD-2026-0001',
    loadId: { _id: 'ld_demo', loadNumber: b.loadNumber || 'LD-2026-0001' },
    lrId: { _id: 'lr_demo', lrNumber: lrNum },
    vehiclePlate: b.vehiclePlate || 'GJ01AB1234',
    vehicleId: { plateNumber: b.vehiclePlate || 'GJ01AB1234', vehicleType: 'Heavy Commercial Vehicle (HCV)' },
    driverName: b.driverName || 'Ramesh Patel',
    driverId: { name: b.driverName || 'Ramesh Patel', phone: '93776 10333' },
    consignor: b.consignor || 'Reliance Industries Limited',
    consignorId: { name: b.consignor || 'Reliance Industries Limited', phone: '93776 10333' },
    consignee: b.consignee || 'Asian Paints Limited',
    consigneeId: { name: b.consignee || 'Asian Paints Limited', phone: '93776 10333' },
    origin: b.origin || 'Vadodara Central Hub',
    destination: b.destination || 'Mumbai Nhava Sheva',
    goodsDescription: b.goodsDescription || 'Commercial Consignment',
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
  mockStore.bilties.unshift(newLr);
  return ok(res, newLr, 'LR created successfully', 201);
});

router.patch(['/lr/:id/status', '/lr/:id'], (req, res) => {
  const lr = mockStore.bilties.find((item) => item._id === req.params.id);
  if (!lr) return res.status(404).json({ success: false, message: 'LR not found' });
  if (req.body?.status) lr.status = req.body.status;
  return ok(res, lr, `LR status updated to ${lr.status}`);
});

router.get('/bilties/:id/pdf', async (req, res) => {
  try {
    const bilty = mockStore.bilties.find((b) => b._id === req.params.id || b.biltyNumber === req.params.id || b.lrNumber === req.params.id) || {};
    const isMemo = req.query?.type === 'memo';
    const pdfBuffer = isMemo
      ? await btsDocsService.generateMemoPdf({
          memoNumber: bilty.biltyNumber || bilty.lrNumber || req.params.id,
          date: bilty.createdAt,
          fromStation: bilty.origin,
          toStation: bilty.destination,
          vehicleNumber: bilty.vehiclePlate,
          driverName: bilty.driverName
        })
      : await btsDocsService.generateLoadingReceiptPdf({
          lrNumber: bilty.lrNumber || bilty.biltyNumber || req.params.id,
          date: bilty.createdAt,
          vehicleNumber: bilty.vehiclePlate,
          toStation: bilty.destination,
          weight: bilty.weightMt ? `${bilty.weightMt} MT` : undefined,
          freightAmount: bilty.freightAmount,
          advanceAmount: bilty.advanceAmount,
          balanceAmount: bilty.balanceAmount,
          consignee: { name: bilty.consignee, city: bilty.destination },
          consignor: { name: bilty.consignor, city: bilty.origin }
        });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="BTS-${isMemo ? 'Memo' : 'Bilty'}-${req.params.id}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('Error generating bilty PDF:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/lr/:id/pdf', async (req, res) => {
  try {
    const lr = mockStore.bilties.find((b) => b._id === req.params.id || b.lrNumber === req.params.id || b.biltyNumber === req.params.id) || {};
    const isMemo = req.query?.type === 'memo';
    const pdfBuffer = isMemo
      ? await btsDocsService.generateMemoPdf({
          memoNumber: lr.lrNumber || req.params.id,
          date: lr.createdAt,
          fromStation: lr.origin,
          toStation: lr.destination,
          vehicleNumber: lr.vehiclePlate,
          driverName: lr.driverName
        })
      : await btsDocsService.generateLoadingReceiptPdf({
          lrNumber: lr.lrNumber || req.params.id,
          date: lr.createdAt,
          vehicleNumber: lr.vehiclePlate,
          toStation: lr.destination,
          weight: lr.weightMt ? `${lr.weightMt} MT` : undefined,
          freightAmount: lr.freightAmount,
          advanceAmount: lr.advanceAmount,
          balanceAmount: lr.balanceAmount,
          consignee: { name: lr.consignee, city: lr.destination },
          consignor: { name: lr.consignor, city: lr.origin }
        });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="BTS-${isMemo ? 'Memo' : 'Loading-Receipt'}-${req.params.id}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('Error generating LR PDF:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
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
  const trip = mockStore.trips.find((t) => t._id === req.params.id || t.tripNumber === req.params.id);
  if (!trip) return res.status(404).json({ success: false, message: 'Trip not found' });
  return ok(res, trip);
});

router.post('/trips', (req, res) => {
  const b = req.body || {};
  const load = mockStore.loads.find((l) => l._id === b.loadId) || mockStore.loads[0];
  const vehicle = mockStore.vehicles.find((v) => v._id === b.vehicleId) || mockStore.vehicles[0];
  const driver = mockStore.drivers.find((d) => d._id === b.driverId) || mockStore.drivers[0];

  const tripNumber = 'TRP-2026-' + String(mockStore.trips.length + 1).padStart(3, '0');

  const stops = load && Array.isArray(load.stops) && load.stops.length > 0
    ? load.stops.map((s, idx) => ({
        _id: 'trp_stp_' + Date.now() + '_' + idx,
        sequence: s.sequence || (idx + 1),
        stopType: s.stopType || (idx === 0 ? 'PICKUP' : 'DELIVERY'),
        locationName: s.locationId?.name || s.locationName || 'Transit Hub',
        status: idx === 0 ? 'COMPLETED' : 'PENDING',
        allocatedQuantity: s.allocatedQuantity || 50,
        deliveredQuantity: idx === 0 ? (s.allocatedQuantity || 50) : 0,
        allocatedWeightMt: s.allocatedWeightMt || 25.0
      }))
    : [
        {
          _id: 'trp_stp_' + Date.now() + '_1',
          sequence: 1,
          stopType: 'PICKUP',
          locationName: 'Vadodara Central Logistics Hub',
          status: 'COMPLETED',
          allocatedQuantity: 50,
          deliveredQuantity: 50,
          allocatedWeightMt: 25.0
        },
        {
          _id: 'trp_stp_' + Date.now() + '_2',
          sequence: 2,
          stopType: 'DELIVERY',
          locationName: 'Destination Hub',
          status: 'PENDING',
          allocatedQuantity: 50,
          deliveredQuantity: 0,
          allocatedWeightMt: 25.0
        }
      ];

  const newTrip = {
    _id: 'trp_' + crypto.randomBytes(6).toString('hex'),
    companyId: mockStore.tenant._id,
    tripNumber,
    loadId: {
      _id: load._id,
      loadNumber: load.loadNumber
    },
    loadNumber: load.loadNumber,
    vehicleId: {
      _id: vehicle._id,
      plateNumber: vehicle.plateNumber,
      vehicleType: vehicle.vehicleType,
      capacityTonnage: vehicle.capacityTonnage
    },
    vehiclePlate: vehicle.plateNumber,
    driverId: {
      _id: driver._id,
      name: driver.name,
      phone: driver.phone,
      licenseNumber: driver.licenseNumber
    },
    driverName: driver.name,
    driverPhone: driver.phone,
    origin: load.originCity || 'Vadodara, Gujarat',
    destination: load.destinationCity || 'Mumbai, Maharashtra',
    status: 'IN_TRANSIT',
    odometerStart: parseInt(b.odometerStart || '140000', 10),
    totalDistanceKm: 480,
    currentLocation: 'NH-48 Golden Chokdi Outbound, Speed: 54 km/h',
    driverAdvancePaise: b.driverAdvancePaise || 1500000,
    stops,
    expenses: [],
    totalExpenses: 0,
    startedAt: new Date()
  };

  vehicle.status = 'ON_TRIP';
  driver.status = 'ON_TRIP';
  load.status = 'IN_TRANSIT';

  mockStore.trips.unshift(newTrip);
  return ok(res, newTrip, 'Trip dispatched successfully', 201);
});

router.patch('/trips/:id/status', (req, res) => {
  const trip = mockStore.trips.find((t) => t._id === req.params.id);
  if (!trip) return res.status(404).json({ success: false, message: 'Trip not found' });
  trip.status = req.body?.status || trip.status;
  return ok(res, trip, `Trip status updated to ${trip.status}`);
});

router.post('/trips/:id/status', (req, res) => {
  const trip = mockStore.trips.find((t) => t._id === req.params.id);
  if (!trip) return res.status(404).json({ success: false, message: 'Trip not found' });
  trip.status = req.body?.status || trip.status;
  return ok(res, trip, `Trip status updated to ${trip.status}`);
});

router.post('/trips/:id/stops/:stopId/deliver', (req, res) => {
  const trip = mockStore.trips.find((t) => t._id === req.params.id);
  if (!trip) return res.status(404).json({ success: false, message: 'Trip not found' });
  
  const stop = (trip.stops || []).find((s) => s._id === req.params.stopId);
  if (stop) {
    stop.status = 'COMPLETED';
    stop.deliveredQuantity = req.body?.deliveredQuantity || stop.allocatedQuantity || 1;
    stop.receiverName = req.body?.receiverName || 'Gate Incharge';
    stop.receiverPhone = req.body?.receiverPhone || '';
    stop.deliveredAt = new Date().toISOString();
  }

  // Check if all delivery stops are now completed
  const pendingDeliveries = (trip.stops || []).filter((s) => s.stopType === 'DELIVERY' && s.status !== 'COMPLETED');
  if (pendingDeliveries.length === 0) {
    trip.status = 'DELIVERED';
  }

  return ok(res, trip, 'Stop delivery confirmed successfully');
});

router.post('/trips/:id/close', (req, res) => {
  const trip = mockStore.trips.find((t) => t._id === req.params.id);
  if (!trip) return res.status(404).json({ success: false, message: 'Trip not found' });

  trip.status = 'CLOSED';
  trip.completedAt = new Date();
  
  if (Array.isArray(trip.stops)) {
    trip.stops.forEach((s) => {
      s.status = 'COMPLETED';
      if (!s.deliveredQuantity) s.deliveredQuantity = s.allocatedQuantity || 1;
    });
  }

  // Return vehicle & driver to available
  if (trip.vehicleId?._id) {
    const v = mockStore.vehicles.find((item) => item._id === trip.vehicleId._id);
    if (v) v.status = 'AVAILABLE';
  }
  if (trip.driverId?._id) {
    const d = mockStore.drivers.find((item) => item._id === trip.driverId._id);
    if (d) d.status = 'AVAILABLE';
  }

  return ok(res, trip, 'Trip closed and settled successfully');
});

router.post('/trips/:id/expenses', (req, res) => {
  const trip = mockStore.trips.find((t) => t._id === req.params.id);
  if (!trip) return res.status(404).json({ success: false, message: 'Trip not found' });
  
  const amount = parseFloat(req.body?.amountRupees || (req.body?.amountPaise ? req.body.amountPaise / 100 : '5000'));
  const newExpense = {
    _id: 'exp_' + Date.now(),
    category: req.body?.expenseType || req.body?.category || 'DIESEL',
    expenseType: req.body?.expenseType || req.body?.category || 'DIESEL',
    amount,
    amountPaise: Math.round(amount * 100),
    amountRupees: amount,
    paidBy: req.body?.paidBy || 'DRIVER',
    notes: req.body?.description || req.body?.notes || 'Route expense',
    description: req.body?.description || req.body?.notes || 'Route expense',
    createdAt: new Date().toISOString()
  };
  
  if (!trip.expenses) trip.expenses = [];
  trip.expenses.push(newExpense);
  trip.totalExpenses = trip.expenses.reduce((s, e) => s + (e.amount || 0), 0);
  
  return ok(res, trip, 'Expense recorded', 201);
});

router.get(['/trips/:id/pdf', '/trips/:id/sheet', '/trips/:id/tripsheet', '/trips/:id/settlement'], async (req, res) => {
  try {
    const trip = mockStore.trips.find((t) => t._id === req.params.id || t.tripNumber === req.params.id) || {};
    const pdfBuffer = await btsDocsService.generateMemoPdf({
      memoNumber: trip.tripNumber || req.params.id,
      date: trip.startedAt || trip.createdAt,
      fromStation: trip.origin,
      toStation: trip.destination,
      vehicleNumber: trip.vehiclePlate || trip.vehicleId?.plateNumber,
      driverName: trip.driverName || trip.driverId?.name,
      phoneNo: trip.driverPhone || trip.driverId?.phone,
      ownerName: 'Barkat Tempo Service',
      transporterName: 'Barkat Tempo Service',
      driverAdvance: 33000,
      driverBalance: 35500
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="BTS-Memo-${req.params.id}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('Error generating trip memo PDF:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Dedicated Barkat Tempo Service Document Endpoints
router.get('/bts/loading-receipt/:id', async (req, res) => {
  try {
    const record =
      mockStore.bilties.find((b) => b._id === req.params.id || b.lrNumber === req.params.id || b.biltyNumber === req.params.id) ||
      mockStore.loads.find((l) => l._id === req.params.id || l.loadNumber === req.params.id) || {};
    const pdfBuffer = await btsDocsService.generateLoadingReceiptPdf({
      lrNumber: record.lrNumber || record.loadNumber || req.params.id,
      date: record.createdAt,
      vehicleNumber: record.vehiclePlate,
      toStation: record.destination,
      weight: record.weightMt ? `${record.weightMt} MT` : undefined,
      freightAmount: record.freightAmount,
      advanceAmount: record.advanceAmount || record.advancePaid,
      balanceAmount: record.balanceAmount || record.balanceDue,
      consignee: { name: record.consignee || record.customerName, city: record.destination },
      consignor: { name: record.consignor, city: record.origin }
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="BTS-Loading-Receipt-${req.params.id}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/bts/memo/:id', async (req, res) => {
  try {
    const trip =
      mockStore.trips.find((t) => t._id === req.params.id || t.tripNumber === req.params.id) ||
      mockStore.loads.find((l) => l._id === req.params.id || l.loadNumber === req.params.id) || {};
    const pdfBuffer = await btsDocsService.generateMemoPdf({
      memoNumber: trip.tripNumber || trip.loadNumber || req.params.id,
      date: trip.startedAt || trip.createdAt,
      fromStation: trip.origin,
      toStation: trip.destination,
      vehicleNumber: trip.vehiclePlate || trip.vehicleId?.plateNumber,
      driverName: trip.driverName || trip.driverId?.name,
      phoneNo: trip.driverPhone || trip.driverId?.phone
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="BTS-Memo-${req.params.id}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
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

router.post('/pod', upload.single('file'), (req, res) => {
  const b = req.body || {};
  const trip = mockStore.trips.find((t) => t._id === b.tripId) || mockStore.trips[0];
  const originalFileName = req.file ? req.file.originalname : (b.fileName || 'pod_signed_receipt.pdf');
  const newPod = {
    _id: 'pod_' + crypto.randomBytes(6).toString('hex'),
    companyId: mockStore.tenant._id,
    podNumber: 'POD-2026-' + String(mockStore.pods.length + 1).padStart(4, '0'),
    loadId: trip?.loadId || { _id: 'ld_demo', loadNumber: 'LD-2026-0001' },
    loadNumber: trip?.loadNumber || 'LD-2026-0001',
    tripId: trip ? { _id: trip._id, tripNumber: trip.tripNumber } : { _id: 'trp_demo', tripNumber: 'TRP-2026-001' },
    tripNumber: trip?.tripNumber || 'TRP-2026-001',
    status: 'PENDING_VERIFICATION',
    quantityDelivered: parseInt(b.quantityDelivered || '1', 10),
    receivedBy: b.receiverName || b.receivedBy || 'Consignee Gate In Charge',
    receiverPhone: b.receiverPhone || '',
    remarks: b.remarks || 'Signed consignment copy received at delivery destination.',
    fileName: originalFileName,
    fileSize: req.file ? req.file.size : 124000,
    mimeType: req.file ? req.file.mimetype : 'application/pdf',
    createdAt: new Date().toISOString()
  };
  mockStore.pods.unshift(newPod);
  return ok(res, newPod, 'POD submitted successfully', 201);
});

router.post(['/pod/:id/verify', '/pod/:id/verify-direct'], (req, res) => {
  const pod = mockStore.pods.find((p) => p._id === req.params.id);
  if (!pod) return res.status(404).json({ success: false, message: 'POD not found' });
  pod.status = req.body?.status === 'REJECTED' ? 'REJECTED' : 'VERIFIED';
  pod.verifiedAt = new Date();
  pod.verifiedBy = 'BTS System Administrator';
  pod.remarks = req.body?.remarks || pod.remarks;
  return ok(res, pod, 'POD verification processed successfully');
});

router.get('/pod/:id/download', async (req, res) => {
  try {
    const pod = mockStore.pods.find((p) => p._id === req.params.id) || {};
    const pdfBuffer = await btsDocsService.generateLoadingReceiptPdf({
      lrNumber: pod.podNumber || 'POD-2026',
      date: pod.createdAt || new Date(),
      vehicleNumber: 'GJ-01-AB-1234',
      toStation: 'Mumbai Nhava Sheva',
      weight: '32.5 MT',
      freightAmount: 68500,
      advanceAmount: 35000,
      balanceAmount: 33500,
      consignee: { name: pod.receivedBy || 'Consignee Manager', city: 'Mumbai' }
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="BTS-POD-${req.params.id}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/documents/:id/download', async (req, res) => {
  try {
    const docId = req.params.id;
    let foundDoc = null;
    let ownerName = 'Barkat Tempo Service';
    
    for (const v of mockStore.vehicles) {
      const d = (v.documents || []).find((doc) => doc._id === docId);
      if (d) {
        foundDoc = d;
        ownerName = `Vehicle ${v.plateNumber}`;
        break;
      }
    }
    if (!foundDoc) {
      for (const drv of mockStore.drivers) {
        const d = (drv.documents || []).find((doc) => doc._id === docId);
        if (d) {
          foundDoc = d;
          ownerName = `Driver ${drv.name}`;
          break;
        }
      }
    }
    
    const pdfBuffer = await btsDocsService.generateLoadingReceiptPdf({
      lrNumber: foundDoc?.documentNumber || docId,
      date: foundDoc?.expiryDate || new Date(),
      vehicleNumber: ownerName,
      toStation: 'Gujarat RTO Compliance Records',
      weight: 'Compliance Document',
      freightAmount: 0,
      advanceAmount: 0,
      balanceAmount: 0,
      consignee: { name: ownerName, city: 'Vadodara' }
    });
    
    const filename = foundDoc?.originalFileName || `BTS_Doc_${docId}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(pdfBuffer);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 11. COMPLIANCE & EXPIRES
// ==========================================
router.get('/compliance/overview', (req, res) => {
  return ok(res, {
    documents: { total: 12, valid: 11, expiringSoon: 1, expired: 0 },
    drivers: { total: 5, valid: 5, expiringSoon: 0, expired: 0 }
  });
});

router.get('/compliance/notifications', (req, res) => {
  return ok(res, {
    items: mockStore.complianceNotifications,
    pagination: { page: 1, limit: 50, total: mockStore.complianceNotifications.length, totalPages: 1 }
  });
});

router.post('/compliance/scan', (req, res) => {
  return ok(res, {
    scannedVehicleDocuments: 12,
    scannedDrivers: 5,
    notificationsCreated: 1
  }, 'Regulatory audit scan complete');
});

router.patch('/compliance/notifications/:id/read', (req, res) => {
  const notif = mockStore.complianceNotifications.find((n) => n._id === req.params.id);
  if (notif) notif.isRead = true;
  return ok(res, notif, 'Notification marked as read');
});

router.post('/compliance/notifications/read-all', (req, res) => {
  mockStore.complianceNotifications.forEach((n) => (n.isRead = true));
  return ok(res, null, 'All notifications marked as read');
});

router.get('/compliance', (req, res) => {
  return ok(res, {
    summary: { expired: 0, expiring15Days: 1, expiring30Days: 2 },
    documents: [
      { _id: 'cmp_1', type: 'VEHICLE', entityName: 'MH12CD5678', docType: 'INSURANCE', expiryDate: '2026-11-15', daysLeft: 17, status: 'EXPIRING_SOON' },
      { _id: 'cmp_2', type: 'VEHICLE', entityName: 'GJ01AB1234', docType: 'FITNESS', expiryDate: '2026-12-30', daysLeft: 62, status: 'VALID' }
    ]
  });
});

// ==========================================
// 12. MAINTENANCE
// ==========================================
router.get('/maintenance/stats', (req, res) => {
  const scheduledCount = mockStore.maintenance.filter((m) => m.status === 'SCHEDULED').length;
  const inProgressCount = mockStore.maintenance.filter((m) => m.status === 'IN_PROGRESS').length;
  const completedThisMonth = mockStore.maintenance.filter((m) => m.status === 'COMPLETED').length;
  const totalCostThisMonthRupees = mockStore.maintenance.reduce((sum, m) => sum + (m.cost || (m.costPaise ? m.costPaise / 100 : 0)), 0);

  return ok(res, {
    scheduledCount,
    inProgressCount,
    completedThisMonth,
    overdueCount: 0,
    totalCostThisMonthRupees
  });
});

router.get('/maintenance', (req, res) => {
  const { page, limit, search, status } = req.query;
  const filter = {};
  if (status) filter.status = status;
  const result = mockStore.query(mockStore.maintenance, { filter, search, page, limit, sortField: 'createdAt', sortOrder: -1 });
  return paginated(res, result);
});

router.post('/maintenance', (req, res) => {
  const b = req.body || {};
  const vehicle = mockStore.vehicles.find((v) => v._id === b.vehicleId) || mockStore.vehicles[0];
  const costRupees = b.costRupees ? parseFloat(b.costRupees) : (b.costPaise ? b.costPaise / 100 : 10000);
  
  const newMaint = {
    _id: 'maint_' + crypto.randomBytes(6).toString('hex'),
    companyId: mockStore.tenant._id,
    maintenanceNumber: 'MAINT-2026-' + String(mockStore.maintenance.length + 1).padStart(3, '0'),
    vehicleId: {
      _id: vehicle._id,
      plateNumber: vehicle.plateNumber,
      vehicleType: vehicle.vehicleType,
      make: vehicle.make,
      model: vehicle.model,
      status: vehicle.status
    },
    vehiclePlate: vehicle.plateNumber,
    serviceType: b.serviceType || 'GENERAL_SERVICE',
    maintenanceType: b.serviceType || 'GENERAL_SERVICE',
    priority: b.priority || 'MEDIUM',
    serviceCenter: {
      name: b.serviceCenter?.name || b.serviceCenterName || 'BTS Workshop Baroda',
      city: b.serviceCenter?.city || b.serviceCenterCity || 'Vadodara',
      contactPhone: '93776 10333'
    },
    cost: costRupees,
    costPaise: Math.round(costRupees * 100),
    status: 'SCHEDULED',
    description: b.technicianRemarks || b.description || 'General maintenance inspection',
    scheduledDate: b.scheduledDate || new Date().toISOString().split('T')[0],
    createdAt: new Date()
  };
  mockStore.maintenance.unshift(newMaint);
  return ok(res, newMaint, 'Maintenance scheduled successfully', 201);
});

router.patch('/maintenance/:id/status', (req, res) => {
  const m = mockStore.maintenance.find((item) => item._id === req.params.id);
  if (!m) return res.status(404).json({ success: false, message: 'Maintenance record not found' });
  
  m.status = req.body?.status || m.status;
  if (req.body?.invoiceNumber) m.invoiceNumber = req.body.invoiceNumber;
  if (req.body?.costPaise) {
    m.costPaise = req.body.costPaise;
    m.cost = req.body.costPaise / 100;
  }
  if (req.body?.technicianRemarks) m.technicianRemarks = req.body.technicianRemarks;
  if (m.status === 'COMPLETED') m.completedDate = new Date().toISOString().split('T')[0];

  return ok(res, m, `Maintenance status updated to ${m.status}`);
});

router.get('/maintenance/:id/job-card', async (req, res) => {
  try {
    const m = mockStore.maintenance.find((item) => item._id === req.params.id) || {
      _id: req.params.id,
      maintenanceNumber: 'MAINT-2026-001',
      vehiclePlate: 'GJ01AB1234',
      serviceType: 'PREVENTIVE',
      costPaise: 450000,
      serviceCenter: { name: 'BTS Workshop Baroda', city: 'Vadodara' },
      description: 'Periodic inspection and scheduled maintenance',
      createdAt: new Date()
    };
    const pdfBuffer = await pdfService.generateMaintenancePdf(m, mockStore.tenant);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="BTS-JobCard-${req.params.id}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 13. WHATSAPP ENGINE & MESSAGES
// ==========================================
router.get('/whatsapp/config', (req, res) => {
  return ok(res, {
    provider: 'META_WHATSAPP_CLOUD',
    isEnabled: true,
    senderNumber: '+91 93776 10333',
    phoneNumberId: 'BTS_WA_PROD_01',
    hasApiKey: true,
    maskedApiKey: '••••••••••••1033',
    hasApiSecret: true,
    maskedApiSecret: '••••••••••••3266',
    hasWebhookSecret: true,
    maskedWebhookSecret: '••••••••••••2012'
  });
});

router.put('/whatsapp/config', (req, res) => {
  return ok(res, {
    provider: req.body?.provider || 'META_WHATSAPP_CLOUD',
    isEnabled: req.body?.isEnabled ?? true,
    senderNumber: req.body?.senderNumber || '+91 93776 10333',
    phoneNumberId: req.body?.phoneNumberId || 'BTS_WA_PROD_01',
    hasApiKey: true,
    maskedApiKey: '••••••••••••1033',
    hasApiSecret: true,
    maskedApiSecret: '••••••••••••3266',
    hasWebhookSecret: true,
    maskedWebhookSecret: '••••••••••••2012'
  }, 'WhatsApp configuration updated successfully');
});

router.get('/whatsapp/messages', (req, res) => {
  const { status, search } = req.query;
  let list = [...mockStore.whatsappMessages];
  if (status) {
    list = list.filter((m) => m.status === status);
  }
  if (search) {
    const q = search.toLowerCase();
    list = list.filter((m) => m.recipientPhone.includes(q) || (m.recipientName && m.recipientName.toLowerCase().includes(q)));
  }
  return ok(res, list);
});

router.post('/whatsapp/send', (req, res) => {
  const b = req.body || {};
  const newMsg = {
    _id: 'wa_msg_' + Date.now(),
    recipientPhone: b.toPhone || '+91 93776 10333',
    recipientName: b.recipientName || 'Commercial Client',
    templateName: b.templateName || 'LOAD_CREATED',
    messageType: 'TEMPLATE',
    renderedMessage: `Barkat Tempo Service: Consignment notification for ${b.variables?.loadNumber || 'Load'} sent.`,
    provider: 'META_WHATSAPP_CLOUD',
    providerMessageId: 'wamid.' + crypto.randomBytes(12).toString('hex'),
    status: 'DELIVERED',
    retryCount: 0,
    maxRetries: 3,
    deliveredAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };
  mockStore.whatsappMessages.unshift(newMsg);
  return ok(res, newMsg, 'WhatsApp template notification dispatched successfully', 201);
});

router.post('/whatsapp/send-document', (req, res) => {
  const b = req.body || {};
  const newMsg = {
    _id: 'wa_doc_' + Date.now(),
    recipientPhone: b.toPhone || '+91 93776 10333',
    recipientName: b.recipientName || 'Consignee Officer',
    templateName: 'DOCUMENT_SHARE',
    messageType: 'DOCUMENT',
    renderedMessage: b.caption || 'Barkat Tempo Service: Official consignment document attached.',
    documentFileName: `BTS-${b.documentType || 'Doc'}-${b.documentId || 'REF'}.pdf`,
    provider: 'META_WHATSAPP_CLOUD',
    providerMessageId: 'wamid.' + crypto.randomBytes(12).toString('hex'),
    status: 'DELIVERED',
    retryCount: 0,
    maxRetries: 3,
    deliveredAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };
  mockStore.whatsappMessages.unshift(newMsg);
  return ok(res, newMsg, 'Document PDF dispatched via WhatsApp', 201);
});

router.post('/whatsapp/send-custom', (req, res) => {
  const b = req.body || {};
  const newMsg = {
    _id: 'wa_custom_' + Date.now(),
    recipientPhone: b.toPhone || '+91 93776 10333',
    recipientName: b.recipientName || 'Contact',
    messageType: 'CUSTOM_TEXT',
    renderedMessage: b.message || 'Barkat Tempo Service fleet dispatch notice.',
    provider: 'META_WHATSAPP_CLOUD',
    providerMessageId: 'wamid.' + crypto.randomBytes(12).toString('hex'),
    status: 'DELIVERED',
    retryCount: 0,
    maxRetries: 3,
    deliveredAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };
  mockStore.whatsappMessages.unshift(newMsg);
  return ok(res, newMsg, 'Custom WhatsApp message dispatched successfully', 201);
});

router.post('/whatsapp/retry/:id', (req, res) => {
  const msg = mockStore.whatsappMessages.find((m) => m._id === req.params.id);
  if (msg) {
    msg.status = 'DELIVERED';
    msg.retryCount = (msg.retryCount || 0) + 1;
    msg.deliveredAt = new Date().toISOString();
  }
  return ok(res, msg, 'Message resent successfully');
});

// ==========================================
// 14. BULK DATA & DATA IMPORT / EXPORT (/master/*)
// ==========================================
router.get('/master/jobs', (req, res) => {
  return ok(res, mockStore.bulkJobs || []);
});

router.get('/master/template/:entity', (req, res) => {
  const entity = req.params.entity;
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${entity}_template.csv"`);
  
  let csv = 'Id,Code,Name,Status\n';
  if (entity === 'loads') {
    csv = 'loadNumber,customerId,originCity,destinationCity,packageType,totalWeightMt,totalQuantity,freightRupees\nLD-2026-9001,cust_1,Vadodara,Mumbai,PALLETS,25,50,45000\n';
  } else if (entity === 'vehicles') {
    csv = 'plateNumber,vehicleType,category,make,model,year,capacityTonnage\nGJ06AB1122,Heavy Commercial Vehicle (HCV),OWNED,Tata Motors,Signa,2024,35\n';
  } else if (entity === 'drivers') {
    csv = 'name,phone,licenseNumber,experienceYears,bloodGroup\nDriver Name,+91 93776 10333,GJ01-2024-9988,8,B+\n';
  } else if (entity === 'customers') {
    csv = 'legalName,tradeName,gstin,phone,city,state\nCommercial Corp Ltd,Commercial Corp,24AAACT1234A1Z5,+91 93776 10333,Vadodara,Gujarat\n';
  }
  return res.send(csv);
});

router.post('/master/dry-run/:entity', upload.single('file'), (req, res) => {
  const entity = req.params.entity;
  const fileName = req.file?.originalname || 'import.xlsx';
  const fileSize = req.file?.size || 0;
  return ok(res, {
    batchId: 'batch_' + Date.now(),
    fileName,
    fileSize,
    validRowsCount: 5,
    invalidRowsCount: 0,
    validRecords: [
      { row: 1, identifier: 'REC-001', status: 'VALID' },
      { row: 2, identifier: 'REC-002', status: 'VALID' },
      { row: 3, identifier: 'REC-003', status: 'VALID' },
      { row: 4, identifier: 'REC-004', status: 'VALID' },
      { row: 5, identifier: 'REC-005', status: 'VALID' }
    ],
    errors: []
  }, `Dry run validation completed for ${entity}: All rows passed compliance checks`);
});

router.post('/master/confirm/:entity', (req, res) => {
  const count = (req.body?.validRecords && req.body.validRecords.length) || 5;
  return ok(res, {
    committedCount: count,
    importedCount: count,
    message: `Successfully imported ${count} records into workspace`
  });
});

router.post('/master/jobs/export', (req, res) => {
  const jobId = 'job_' + Date.now();
  const entity = req.body?.entity || 'loads';
  const format = req.body?.format || 'xlsx';
  const job = {
    _id: jobId,
    entityType: entity,
    format,
    status: 'COMPLETED',
    downloadUrl: `/master/export/${entity}?format=${format}`,
    fileName: `BTS_${entity}_export.${format}`,
    createdAt: new Date().toISOString()
  };
  mockStore.bulkJobs.unshift(job);
  return ok(res, job, 'Export job completed successfully');
});

router.get(['/master/export/:entity', '/master/jobs/export/:entity'], (req, res) => {
  const entity = (req.params.entity || 'loads').toLowerCase();
  const format = (req.query.format || 'xlsx').toLowerCase();
  
  let rows = [];
  let headers = [];
  const filename = `BTS_${entity}_export.${format}`;
  
  if (entity === 'customers') {
    headers = ['ID', 'Name', 'PartyType', 'GSTIN', 'PAN', 'Phone', 'Email', 'City', 'State'];
    rows = mockStore.customers.map((c) => [
      c._id,
      `"${c.legalName || c.name || ''}"`,
      c.partyType || 'CUSTOMER',
      c.gstin || '',
      c.pan || '',
      c.phone || c.primaryContact?.phone || '',
      c.email || c.primaryContact?.email || '',
      `"${c.city || c.billingAddress?.city || ''}"`,
      `"${c.state || c.billingAddress?.state || ''}"`
    ]);
  } else if (entity === 'vehicles') {
    headers = ['ID', 'PlateNumber', 'Type', 'Category', 'CapacityTonnage', 'Make', 'Model', 'Status', 'OwnerName'];
    rows = mockStore.vehicles.map((v) => [
      v._id,
      v.plateNumber,
      `"${v.vehicleType || ''}"`,
      v.category || 'OWNED',
      v.capacityTonnage || 0,
      v.make || '',
      v.model || '',
      v.status,
      `"${v.ownerName || ''}"`
    ]);
  } else if (entity === 'drivers') {
    headers = ['ID', 'Name', 'Phone', 'LicenseNumber', 'LicenseExpiry', 'Status'];
    rows = mockStore.drivers.map((d) => [
      d._id,
      `"${d.name || ''}"`,
      d.phone || '',
      d.licenseNumber || '',
      d.licenseExpiry || '',
      d.status
    ]);
  } else if (entity === 'locations') {
    headers = ['ID', 'Name', 'Code', 'LocationType', 'City', 'State', 'ContactPerson', 'Phone'];
    rows = mockStore.locations.map((l) => [
      l._id,
      `"${l.name || ''}"`,
      l.code || '',
      l.locationType || 'PICKUP',
      `"${l.city || l.address?.city || ''}"`,
      `"${l.state || l.address?.state || ''}"`,
      `"${l.contactPerson || ''}"`,
      l.contactPhone || ''
    ]);
  } else if (entity === 'loads') {
    headers = ['LoadNumber', 'Customer', 'Origin', 'Destination', 'WeightMT', 'FreightRupees', 'Status'];
    rows = mockStore.loads.map((l) => [
      l.loadNumber,
      `"${l.customerId?.name || l.consignorName || ''}"`,
      `"${l.originCity || ''}"`,
      `"${l.destinationCity || ''}"`,
      l.weightMt || 0,
      l.freightAmount || 0,
      l.status
    ]);
  } else if (entity === 'trips') {
    headers = ['TripNumber', 'Vehicle', 'Driver', 'Origin', 'Destination', 'ExpensesRupees', 'Status'];
    rows = mockStore.trips.map((t) => [
      t.tripNumber,
      t.vehiclePlate,
      `"${t.driverName || ''}"`,
      `"${t.origin || ''}"`,
      `"${t.destination || ''}"`,
      t.totalExpenses || 0,
      t.status
    ]);
  } else {
    headers = ['ID', 'Name', 'Status'];
    rows = [[ '1', entity, 'ACTIVE' ]];
  }
  
  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(csvContent);
});

router.get('/master/jobs/:id/download', (req, res) => {
  const jobId = req.params.id;
  const job = mockStore.bulkJobs.find((j) => j._id === jobId) || { entityType: 'export', format: 'xlsx' };
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="BTS_Job_${jobId}.${job.format || 'csv'}"`);
  return res.send(`Job ID,Entity,Status,Date\n${jobId},${job.entityType || 'bulk'},COMPLETED,${new Date().toISOString()}`);
});

// ==========================================
// 15. REPORTS & EXPORTS
// ==========================================
router.get('/reports/loads', (req, res) => {
  return ok(res, {
    data: mockStore.loads,
    summary: {
      totalLoads: mockStore.loads.length,
      totalFreightRupees: mockStore.loads.reduce((s, l) => s + (l.freightAmount || 0), 0),
      totalWeightMt: mockStore.loads.reduce((s, l) => s + (l.weightMt || 0), 0),
      deliveredLoads: mockStore.loads.filter((l) => l.status === 'DELIVERED').length
    },
    meta: {
      page: 1,
      limit: 25,
      total: mockStore.loads.length,
      totalPages: 1
    }
  });
});

router.get('/reports/trips', (req, res) => {
  return ok(res, {
    data: mockStore.trips,
    summary: {
      totalTrips: mockStore.trips.length,
      inTransitTrips: mockStore.trips.filter((t) => t.status === 'IN_TRANSIT').length,
      completedTrips: mockStore.trips.filter((t) => t.status === 'CLOSED').length,
      totalExpenseRupees: mockStore.trips.reduce((s, t) => s + (t.totalExpenses || 0), 0)
    },
    meta: {
      page: 1,
      limit: 25,
      total: mockStore.trips.length,
      totalPages: 1
    }
  });
});

router.get(['/reports/freight', '/reports/financials'], (req, res) => {
  const totalBilled = mockStore.loads.reduce((s, l) => s + (l.freightAmount || 0), 0);
  const totalAdvance = mockStore.loads.reduce((s, l) => s + (l.advancePaid || 0), 0);
  const totalBalance = mockStore.loads.reduce((s, l) => s + (l.balanceDue || 0), 0);

  const freightRows = mockStore.loads.map((l) => ({
    _id: l._id,
    loadNumber: l.loadNumber,
    customerName: l.customerId?.name || l.consignorName || 'Customer',
    totalFreightRupees: l.freightAmount,
    advanceRupees: l.advancePaid,
    balanceRupees: l.balanceDue,
    status: l.status,
    date: l.createdAt
  }));

  return ok(res, {
    data: freightRows,
    summary: {
      totalBilledRupees: totalBilled,
      advanceReceivedRupees: totalAdvance,
      balancePendingRupees: totalBalance
    }
  });
});

router.get('/reports/compliance', (req, res) => {
  const docs = [
    { _id: 'cmp_1', type: 'VEHICLE', entityName: 'MH12CD5678', docType: 'INSURANCE', expiryDate: '2026-11-15', daysLeft: 17, status: 'EXPIRING_SOON' },
    { _id: 'cmp_2', type: 'VEHICLE', entityName: 'GJ01AB1234', docType: 'FITNESS', expiryDate: '2026-12-30', daysLeft: 62, status: 'VALID' },
    { _id: 'cmp_3', type: 'DRIVER', entityName: 'Ramesh Patel', docType: 'DRIVING_LICENCE', expiryDate: '2035-05-14', daysLeft: 3098, status: 'VALID' }
  ];

  return ok(res, {
    data: docs,
    summary: {
      totalDocs: docs.length,
      validDocs: 2,
      expiringDocs: 1,
      expiredDocs: 0
    }
  });
});

router.get('/reports/vehicles', (req, res) => {
  return ok(res, mockStore.vehicles);
});

router.get('/reports/export/:type', (req, res) => {
  const reportType = req.params.type;
  const format = req.query.format || 'csv';
  res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="BTS_${reportType}_report.${format}"`);
  
  let csv = 'ID,Reference,Party,Status,Date\n';
  if (reportType === 'loads') {
    csv = 'LoadNumber,Customer,Origin,Destination,WeightMT,FreightRupees,Status\n' +
      mockStore.loads.map((l) => `${l.loadNumber},"${l.customerId?.name || ''}","${l.originCity}","${l.destinationCity}",${l.weightMt},${l.freightAmount},${l.status}`).join('\n');
  } else if (reportType === 'trips') {
    csv = 'TripNumber,Vehicle,Driver,Origin,Destination,ExpensesRupees,Status\n' +
      mockStore.trips.map((t) => `${t.tripNumber},${t.vehiclePlate},"${t.driverName}","${t.origin}","${t.destination}",${t.totalExpenses},${t.status}`).join('\n');
  } else {
    csv = 'Item,Value\nTotalBilled,100000\nTotalAdvance,50000\nTotalBalance,50000\n';
  }
  return res.send(csv);
});

// ==========================================
// 16. ADMIN, USERS, ROLES & SETTINGS
// ==========================================
router.get('/admin/users', (req, res) => {
  const safeUsers = mockStore.users.map((u) => (typeof u.toSafeObject === 'function' ? u.toSafeObject() : u));
  return ok(res, safeUsers);
});

router.post('/admin/users', (req, res) => {
  const b = req.body || {};
  const roleObj = mockStore.roles.find((r) => r._id === b.roleId || r.slug === b.role) || mockStore.roles[1];
  const newUser = {
    _id: 'usr_' + crypto.randomBytes(6).toString('hex'),
    name: b.name || 'Staff User',
    email: (b.email || 'staff@barkattempo.com').trim().toLowerCase(),
    phone: b.phone || '93776 10333',
    role: roleObj?.slug || b.role || 'TRANSPORT_MANAGER',
    roleId: roleObj || mockStore.roles[1],
    companyId: mockStore.tenant,
    isActive: true,
    createdAt: new Date()
  };
  mockStore.users.push(newUser);
  return ok(res, newUser, 'User created', 201);
});

router.patch('/admin/users/:id/status', (req, res) => {
  const u = mockStore.users.find((user) => user._id === req.params.id);
  if (!u) return res.status(404).json({ success: false, message: 'User not found' });
  if (req.body?.isActive !== undefined) u.isActive = req.body.isActive;
  return ok(res, u, 'User status updated');
});

router.get('/admin/roles', (req, res) => {
  return ok(res, mockStore.roles);
});

router.get('/admin/audit-logs', (req, res) => {
  const sampleLogs = [
    {
      _id: 'aud_1',
      actorName: 'BTS Administrator',
      actorId: { name: 'BTS Administrator', email: 'barkattemposervice@gmail.com' },
      action: 'ORGANIZATION_INITIALIZED',
      module: 'AUTH',
      ipAddress: '127.0.0.1',
      createdAt: new Date(Date.now() - 3600000).toISOString()
    },
    {
      _id: 'aud_2',
      actorName: 'BTS Administrator',
      actorId: { name: 'BTS Administrator', email: 'barkattemposervice@gmail.com' },
      action: 'LOGIN_SUCCESS',
      module: 'AUTH',
      ipAddress: '127.0.0.1',
      createdAt: new Date().toISOString()
    }
  ];
  return paginated(res, { data: sampleLogs, pagination: { page: 1, limit: 20, total: 2, totalPages: 1 } });
});

router.get('/admin/settings', (req, res) => {
  return ok(res, mockStore.settings);
});

router.all(['/admin/settings'], (req, res, next) => {
  if (req.method === 'PUT' || req.method === 'PATCH') {
    mockStore.settings = { ...mockStore.settings, ...req.body };
    return ok(res, mockStore.settings, 'Settings updated successfully');
  }
  next();
});

// ==========================================
// 17. PUBLIC TRACKING & INQUIRIES
// ==========================================
router.get(['/public/track', '/public/track/:trackingId'], (req, res) => {
  const tid = (req.params.trackingId || req.query.q || req.query.lr || req.query.load || 'TRP-2026-003').toUpperCase();
  const trip = mockStore.trips[1] || mockStore.trips[0];
  const load = mockStore.loads[1] || mockStore.loads[0];

  const trackingPayload = {
    trackingNumber: tid,
    lrNumber: tid.startsWith('LR') ? tid : 'LR-2026-00102',
    biltyNumber: tid.startsWith('BL') ? tid : 'BL-2026-00102',
    loadNumber: load.loadNumber || 'LD-2026-0002',
    tripNumber: trip.tripNumber || 'TRP-2026-002',
    currentStatus: trip.status || 'IN_TRANSIT',
    statusLabel: trip.status === 'CLOSED' || trip.status === 'DELIVERED' ? 'Delivered' : 'In Transit',
    materialType: load.cargoType || 'Refined Industrial Bulk Consignment',
    totalQuantity: load.totalQuantity || 140,
    totalWeightMt: load.totalWeightMt || 28.0,
    parties: {
      consignor: load.consignorName || 'Adani Wilmar Limited',
      consignee: load.consigneeName || 'UltraTech Cement Limited'
    },
    vehicle: {
      type: trip.vehicleId?.vehicleType || 'Multi-Axle Truck',
      maskedPlateNumber: trip.vehiclePlate || 'MH12CD5678'
    },
    pickupDate: trip.startedAt || new Date().toISOString(),
    expectedDeliveryDate: new Date(Date.now() + 43200000).toISOString(),
    milestones: [
      {
        code: 'ORDER_PLACED',
        title: 'Consignment Created',
        description: 'Load registered and scheduled for dispatch at Barkat Tempo Service',
        status: 'COMPLETED',
        timestamp: new Date(Date.now() - 86400000).toISOString()
      },
      {
        code: 'VEHICLE_ASSIGNED',
        title: 'Vehicle & Driver Assigned',
        description: `Vehicle ${trip.vehiclePlate} and Driver ${trip.driverName} allocated`,
        status: 'COMPLETED',
        timestamp: new Date(Date.now() - 54000000).toISOString()
      },
      {
        code: 'IN_TRANSIT',
        title: 'Outbound On-Road Transit',
        description: 'Consignment in transit across NH-48 commercial corridor',
        status: 'IN_PROGRESS',
        timestamp: new Date(Date.now() - 21600000).toISOString()
      },
      {
        code: 'DELIVERED',
        title: 'Destination Delivery',
        description: 'Arrival at destination warehouse and POD stamp authentication',
        status: trip.status === 'CLOSED' ? 'COMPLETED' : 'PENDING',
        timestamp: trip.status === 'CLOSED' ? new Date().toISOString() : null
      }
    ],
    waypoints: [
      {
        sequence: 1,
        name: 'Mundra Port Logistics Terminal, Gujarat',
        city: 'Mundra',
        state: 'Gujarat',
        stopType: 'PICKUP',
        status: 'COMPLETED',
        coordinates: { lat: 22.8398, lng: 69.7042 }
      },
      {
        sequence: 2,
        name: 'Pune Chakan Auto Corridor Terminal, Maharashtra',
        city: 'Pune',
        state: 'Maharashtra',
        stopType: 'DELIVERY',
        status: trip.status === 'CLOSED' ? 'COMPLETED' : 'PENDING',
        coordinates: { lat: 18.7512, lng: 73.8541 }
      }
    ],
    podVerified: trip.status === 'CLOSED',
    podNumber: trip.status === 'CLOSED' ? 'POD-2026-0001' : null,
    podReceiver: trip.status === 'CLOSED' ? 'Gaurav Mehta' : null,
    telematics: {
      isLiveGps: true,
      locationSource: 'TELEMATICS_GPS',
      coordinates: { lat: 20.9467, lng: 72.952 },
      speedKmph: 62,
      lastSeenAt: new Date().toISOString(),
      disclaimer: 'Live AIS-140 GPS telematics feed from vehicle on-board unit.'
    },
    lastUpdated: new Date().toISOString()
  };

  return ok(res, trackingPayload);
});

// ==========================================
// GLOBAL COMMAND PALETTE SEARCH (/search?q=...)
// ==========================================
router.get('/search', (req, res) => {
  const start = Date.now();
  const q = String(req.query.q || '').trim().toLowerCase();
  if (!q) {
    return ok(res, { results: [], executionTimeMs: 0 });
  }

  const results = [];

  // Search Loads
  mockStore.loads.forEach((l) => {
    if (
      l.loadNumber?.toLowerCase().includes(q) ||
      l.customerId?.name?.toLowerCase().includes(q) ||
      l.consignorName?.toLowerCase().includes(q) ||
      l.consigneeName?.toLowerCase().includes(q) ||
      l.originCity?.toLowerCase().includes(q) ||
      l.destinationCity?.toLowerCase().includes(q)
    ) {
      results.push({
        id: l._id,
        type: 'LOAD',
        title: `Consignment ${l.loadNumber}`,
        subtitle: `${l.customerId?.name || l.consignorName || 'Customer'} • ${l.originCity || 'Origin'} → ${l.destinationCity || 'Dest'} (${l.weightMt || 0} MT)`,
        status: l.status,
        url: '/app/loads'
      });
    }
  });

  // Search LRs and Bilties
  (mockStore.bilties || []).forEach((b) => {
    if (
      b.lrNumber?.toLowerCase().includes(q) ||
      b.eWayBillNumber?.toLowerCase().includes(q)
    ) {
      results.push({
        id: b._id,
        type: 'LR',
        title: `Lorry Receipt ${b.lrNumber}`,
        subtitle: `E-Way Bill: ${b.eWayBillNumber || 'N/A'} • Status: ${b.status || 'ISSUED'}`,
        status: b.status || 'ISSUED',
        url: '/app/lr'
      });
    }

    if (
      b.biltyNumber?.toLowerCase().includes(q) ||
      b.remarks?.toLowerCase().includes(q)
    ) {
      results.push({
        id: b._id,
        type: 'BILTY',
        title: `Bilty Note ${b.biltyNumber}`,
        subtitle: `Terms: ${b.paymentTerms || 'TO_PAY'} • ₹${((b.financials?.totalFreightPaise || (b.freightAmount ? b.freightAmount * 100 : 0)) / 100).toLocaleString('en-IN')}`,
        status: b.status || 'ISSUED',
        url: '/app/bilties'
      });
    }
  });

  // Search Trips
  mockStore.trips.forEach((t) => {
    if (
      t.tripNumber?.toLowerCase().includes(q) ||
      t.vehiclePlate?.toLowerCase().includes(q) ||
      t.driverName?.toLowerCase().includes(q) ||
      t.origin?.toLowerCase().includes(q) ||
      t.destination?.toLowerCase().includes(q)
    ) {
      results.push({
        id: t._id,
        type: 'TRIP',
        title: `Trip ${t.tripNumber}`,
        subtitle: `${t.vehiclePlate} (${t.driverName}) • ${t.origin || ''} → ${t.destination || ''}`,
        status: t.status,
        url: '/app/trips'
      });
    }
  });

  // Search Vehicles
  mockStore.vehicles.forEach((v) => {
    if (
      v.plateNumber?.toLowerCase().includes(q) ||
      v.vehicleType?.toLowerCase().includes(q) ||
      v.ownerName?.toLowerCase().includes(q)
    ) {
      results.push({
        id: v._id,
        type: 'VEHICLE',
        title: `Vehicle ${v.plateNumber}`,
        subtitle: `${v.vehicleType} • ${v.capacityTonnage} MT • ${v.ownerName || 'BTS'}`,
        status: v.status,
        url: '/app/vehicles'
      });
    }
  });

  // Search Drivers
  mockStore.drivers.forEach((d) => {
    if (
      d.name?.toLowerCase().includes(q) ||
      d.phone?.toLowerCase().includes(q) ||
      d.licenseNumber?.toLowerCase().includes(q)
    ) {
      results.push({
        id: d._id,
        type: 'DRIVER',
        title: `Driver ${d.name}`,
        subtitle: `Phone: ${d.phone} • DL: ${d.licenseNumber}`,
        status: d.status,
        url: '/app/drivers'
      });
    }
  });

  // Search Customers
  mockStore.customers.forEach((c) => {
    if (
      c.legalName?.toLowerCase().includes(q) ||
      c.tradeName?.toLowerCase().includes(q) ||
      c.gstin?.toLowerCase().includes(q) ||
      c.city?.toLowerCase().includes(q)
    ) {
      results.push({
        id: c._id,
        type: 'CUSTOMER',
        title: c.legalName || c.tradeName,
        subtitle: `GSTIN: ${c.gstin || 'N/A'} • ${c.city || ''}`,
        status: 'ACTIVE',
        url: '/app/customers'
      });
    }
  });

  // Search Locations
  mockStore.locations.forEach((loc) => {
    if (
      loc.name?.toLowerCase().includes(q) ||
      loc.city?.toLowerCase().includes(q) ||
      loc.code?.toLowerCase().includes(q)
    ) {
      results.push({
        id: loc._id,
        type: 'LOCATION',
        title: loc.name,
        subtitle: `${loc.city}, ${loc.state} • ${loc.locationType}`,
        status: 'ACTIVE',
        url: '/app/locations'
      });
    }
  });

  const executionTimeMs = Date.now() - start;
  return ok(res, { results: results.slice(0, 20), executionTimeMs });
});

router.post('/contact', (req, res) => {
  return ok(res, null, 'Thank you! Your logistics inquiry has been received by Barkat Tempo Service.');
});

// Wildcard fallback for any other sub-routes: return 200 with empty array/object
router.all('*', (req, res) => {
  if (req.method === 'GET') {
    return ok(res, [], 'Autonomous In-Memory Demo Mode');
  }
  return ok(res, { id: 'mock_' + Date.now(), ...req.body }, 'Action executed in Live Demo Mode', 200);
});

module.exports = router;
