/**
 * Autonomous In-Memory Mock Data Store
 * Provides complete, realistic Indian Fleet & Transport Management operations
 * when running in Standalone / Offline / Demo mode without an external MongoDB.
 */

const crypto = require('node:crypto');
const TokenService = require('../modules/auth/services/token.service');

// Default Indian Logistics Tenant Profile
const defaultTenant = {
  _id: '671e3b0f27d7a87e3cbb0001',
  legalName: 'Barkat Tempo Service',
  tradeName: 'Barkat Tempo Service',
  gstin: '24AAACT1234A1Z5',
  pan: 'AOGPP3611Q',
  status: 'ACTIVE',
  isActive: true,
  phone: '93776 10333 / 84010 20129 / 82000 32668',
  email: 'barkattemposervice@gmail.com',
  address: {
    street: 'Shri Rang Market, Near Shri Rang Tyre Shop, N.H.No.-8, Golden Chokdi',
    city: 'Vadodara',
    state: 'Gujarat',
    pincode: '390022',
    country: 'IN'
  },
  settings: {
    defaultTimezone: 'Asia/Kolkata',
    defaultCurrency: 'INR',
    defaultGtaGstRate: 5.0,
    defaultGtaSacCode: '9965',
    defaultWeightUnit: 'MT',
    defaultDistanceUnit: 'KM'
  },
  createdAt: new Date('2026-01-01T00:00:00.000Z')
};

// System Roles
const defaultRoles = [
  {
    _id: '671e3b0f27d7a87e3cbb0003',
    companyId: defaultTenant._id,
    name: 'Super Administrator',
    slug: 'super_admin',
    isSystem: true,
    permissions: ['*'],
    description: 'Full unconstrained platform control'
  },
  {
    _id: '671e3b0f27d7a87e3cbb0004',
    companyId: defaultTenant._id,
    name: 'Transport Manager',
    slug: 'transport_manager',
    isSystem: true,
    permissions: ['loads:*', 'vehicles:*', 'drivers:*', 'trips:*', 'pod:*', 'reports:*'],
    description: 'Fleet and freight operations director'
  },
  {
    _id: '671e3b0f27d7a87e3cbb0005',
    companyId: defaultTenant._id,
    name: 'Fleet Dispatcher',
    slug: 'dispatcher',
    isSystem: true,
    permissions: ['loads:read', 'loads:update', 'trips:read', 'trips:update', 'tracking:read'],
    description: 'Trip routing and live tracking'
  },
  {
    _id: '671e3b0f27d7a87e3cbb0006',
    companyId: defaultTenant._id,
    name: 'Billing & Accounts',
    slug: 'accountant',
    isSystem: true,
    permissions: ['bilties:*', 'lr:*', 'reports:*', 'pod:read'],
    description: 'Freight invoicing and GST compliances'
  }
];

// System Administrator User
const defaultUsers = [
  {
    _id: '671e3b0f27d7a87e3cbb0002',
    companyId: defaultTenant,
    name: 'BTS Administrator',
    email: 'barkattemposervice@gmail.com',
    phone: '93776 10333',
    role: 'SUPER_ADMIN',
    roleId: defaultRoles[0],
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    toSafeObject: function () {
      return {
        _id: this._id,
        name: this.name,
        email: this.email,
        phone: this.phone,
        role: this.role,
        roleId: this.roleId,
        companyId: this.companyId,
        isActive: this.isActive
      };
    }
  }
];

// Clean Operational Collections (No fake or demo data seeded)
const defaultVehicles = [];
const defaultDrivers = [];
const defaultCustomers = [];
const defaultLocations = [];
const defaultLoads = [];
const defaultBilties = [];
const defaultTrips = [];
const defaultPods = [];
const defaultMaintenance = [];

// Master In-Memory Store State
class MockDataStore {
  constructor() {
    this.tenant = { ...defaultTenant };
    this.roles = [...defaultRoles];
    this.users = [...defaultUsers];
    this.vehicles = [...defaultVehicles];
    this.drivers = [...defaultDrivers];
    this.customers = [...defaultCustomers];
    this.locations = [...defaultLocations];
    this.loads = [...defaultLoads];
    this.bilties = [...defaultBilties];
    this.trips = [...defaultTrips];
    this.pods = [...defaultPods];
    this.maintenance = [...defaultMaintenance];
    this.whatsappMessages = [];
    this.complianceNotifications = [];
    this.bulkJobs = [];
    this.auditLogs = [];
    this.settings = { ...defaultTenant.settings };
  }

  // Generic Query Helper with Search, Filter & Pagination
  query(collection, { filter = {}, search = '', page = 1, limit = 20, sortField = 'createdAt', sortOrder = -1 } = {}) {
    let items = [...collection];

    // Apply exact or multi-value filter matches
    Object.keys(filter).forEach((key) => {
      const val = filter[key];
      if (val !== undefined && val !== null && val !== '') {
        items = items.filter((item) => {
          if (item[key] === undefined) return false;
          if (Array.isArray(val)) {
            return val.map((v) => String(v).toLowerCase()).includes(String(item[key]).toLowerCase());
          }
          if (typeof val === 'string' && val.includes(',')) {
            const list = val.split(',').map((v) => v.trim().toLowerCase());
            return list.includes(String(item[key]).toLowerCase());
          }
          return String(item[key]).toLowerCase() === String(val).toLowerCase();
        });
      }
    });

    // Apply Search
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter((item) => {
        return Object.values(item).some((v) => {
          if (typeof v === 'string') return v.toLowerCase().includes(q);
          if (typeof v === 'number') return String(v).includes(q);
          return false;
        });
      });
    }

    // Sort
    items.sort((a, b) => {
      const valA = a[sortField] || 0;
      const valB = b[sortField] || 0;
      if (valA < valB) return sortOrder === 1 ? -1 : 1;
      if (valA > valB) return sortOrder === 1 ? 1 : -1;
      return 0;
    });

    // Paginate
    const total = items.length;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const totalPages = Math.ceil(total / limitNum) || 1;
    const startIndex = (pageNum - 1) * limitNum;
    const data = items.slice(startIndex, startIndex + limitNum);

    return {
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        totalCount: total
      }
    };
  }

  // Dashboard KPI Metrics Aggregation
  getMetrics() {
    const totalLoads = this.loads.length;
    const todayStr = new Date().toISOString().split('T')[0];
    const loadsToday = this.loads.filter((l) => {
      const d = l.createdAt ? new Date(l.createdAt).toISOString().split('T')[0] : '';
      return d === todayStr;
    }).length;

    const activeTrips = this.trips.filter((t) => t.status === 'IN_TRANSIT').length;
    const availableVehicles = this.vehicles.filter((v) => v.status === 'AVAILABLE').length;
    const onTripVehicles = this.vehicles.filter((v) => v.status === 'ON_TRIP').length;
    const maintenanceVehicles = this.vehicles.filter((v) => v.status === 'UNDER_MAINTENANCE').length;
    const availableDrivers = this.drivers.filter((d) => d.status === 'AVAILABLE').length;
    const onTripDrivers = this.drivers.filter((d) => d.status === 'ON_TRIP').length;

    const totalFreightBilled = this.loads.reduce((sum, l) => sum + (l.freightAmount || 0), 0);
    const totalAdvanceReceived = this.loads.reduce((sum, l) => sum + (l.advancePaid || 0), 0);
    const totalBalanceDue = this.loads.reduce((sum, l) => sum + (l.balanceDue || 0), 0);
    const totalExpenses = this.trips.reduce((sum, t) => sum + (t.totalExpenses || 0), 0);

    // Compute real compliance counts dynamically from vehicle and driver documents
    let expiredDocs = 0;
    let expiring15Days = 0;
    let expiring30Days = 0;
    const now = Date.now();

    const checkDoc = (doc) => {
      if (!doc || !doc.expiryDate) return;
      const exp = new Date(doc.expiryDate).getTime();
      const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) expiredDocs++;
      else if (diffDays <= 15) expiring15Days++;
      else if (diffDays <= 30) expiring30Days++;
    };

    this.vehicles.forEach((v) => (v.documents || []).forEach(checkDoc));
    this.drivers.forEach((d) => {
      if (d.licenseExpiry) checkDoc({ expiryDate: d.licenseExpiry });
      (d.documents || []).forEach(checkDoc);
    });

    const waTotal = (this.whatsappMessages || []).length;
    const waSuccess = (this.whatsappMessages || []).filter((m) => m.status === 'DELIVERED' || m.status === 'SENT').length;
    const waFailed = (this.whatsappMessages || []).filter((m) => m.status === 'FAILED').length;
    const waRate = waTotal > 0 ? Math.round((waSuccess / waTotal) * 100) : 100;

    return {
      loads: {
        total: totalLoads,
        today: loadsToday,
        byStatus: {
          CREATED: this.loads.filter((l) => l.status === 'CREATED').length,
          VEHICLE_ASSIGNED: this.loads.filter((l) => l.status === 'VEHICLE_ASSIGNED').length,
          IN_TRANSIT: this.loads.filter((l) => l.status === 'IN_TRANSIT').length,
          DELIVERED: this.loads.filter((l) => l.status === 'DELIVERED').length,
          CANCELLED: this.loads.filter((l) => l.status === 'CANCELLED').length
        },
        totalWeightMt: this.loads.reduce((sum, l) => sum + (l.weightMt || 0), 0)
      },
      trips: {
        total: this.trips.length,
        active: activeTrips,
        closed: this.trips.filter((t) => t.status === 'CLOSED').length,
        byStatus: {
          CREATED: this.trips.filter((t) => t.status === 'CREATED').length,
          IN_TRANSIT: activeTrips,
          CLOSED: this.trips.filter((t) => t.status === 'CLOSED').length
        },
        totalExpenses
      },
      fleet: {
        vehicles: {
          total: this.vehicles.length,
          available: availableVehicles,
          onTrip: onTripVehicles,
          maintenance: maintenanceVehicles,
          byStatus: {
            AVAILABLE: availableVehicles,
            ON_TRIP: onTripVehicles,
            UNDER_MAINTENANCE: maintenanceVehicles
          }
        },
        drivers: {
          total: this.drivers.length,
          active: this.drivers.filter((d) => d.isActive).length,
          available: availableDrivers,
          onTrip: onTripDrivers,
          byStatus: {
            AVAILABLE: availableDrivers,
            ON_TRIP: onTripDrivers,
            LEAVE: this.drivers.filter((d) => d.status === 'ON_LEAVE').length
          }
        }
      },
      financials: {
        totalFreightBilled,
        totalAdvanceReceived,
        totalBalanceDue,
        totalExpenses,
        grossMargin: totalFreightBilled - totalExpenses
      },
      compliance: {
        expired: expiredDocs,
        expiring15Days: expiring15Days,
        expiring30Days: expiring30Days,
        vehicles: { expired: 0, expiring15: 0, expiring30: 0 },
        drivers: { expired: 0, expiring15: 0, expiring30: 0 }
      },
      pod: {
        pendingSubmission: this.pods.filter((p) => p.status === 'PENDING_SUBMISSION').length,
        pendingVerification: this.pods.filter((p) => p.status === 'SUBMITTED').length,
        verified: this.pods.filter((p) => p.status === 'VERIFIED').length,
        rejected: this.pods.filter((p) => p.status === 'REJECTED').length
      },
      whatsapp: {
        total: waTotal,
        successful: waSuccess,
        failed: waFailed,
        deliverySuccessRate: waRate
      }
    };
  }

  // Register New Organization & Admin User
  registerOrganization({
    companyLegalName,
    tradeName,
    companyGstin,
    adminName,
    email,
    password,
    phone,
    city,
    state
  }) {
    const newTenantId = 'cmp_' + crypto.randomBytes(6).toString('hex');
    const newUserId = 'usr_' + crypto.randomBytes(6).toString('hex');

    const cleanLegal = (companyLegalName || 'Barkat Tempo Service').trim();
    const cleanTrade = (tradeName || cleanLegal).trim();
    const cleanEmail = (email || 'barkattemposervice@gmail.com').trim().toLowerCase();

    this.tenant = {
      _id: newTenantId,
      legalName: cleanLegal,
      tradeName: cleanTrade,
      gstin: (companyGstin || '24AAACT1234A1Z5').trim().toUpperCase(),
      status: 'ACTIVE',
      isActive: true,
      phone: phone || '93776 10333',
      email: cleanEmail,
      address: {
        street: 'Shri Rang Market, Near Shri Rang Tyre Shop, N.H.No.-8, Golden Chokdi',
        city: city || 'Vadodara',
        state: state || 'Gujarat',
        pincode: '390022',
        country: 'IN'
      },
      settings: { ...defaultTenant.settings },
      createdAt: new Date()
    };

    const newUser = {
      _id: newUserId,
      name: (adminName || 'Lead Administrator').trim(),
      email: cleanEmail,
      phone: phone || '+91 98251 12345',
      role: 'SUPER_ADMIN',
      roleId: defaultRoles[0],
      companyId: this.tenant,
      isActive: true,
      createdAt: new Date(),
      toSafeObject: function () {
        return {
          _id: this._id,
          name: this.name,
          email: this.email,
          phone: this.phone,
          role: this.role,
          roleId: this.roleId,
          companyId: this.companyId,
          isActive: this.isActive
        };
      }
    };

    // Replace or prepend user
    this.users = [newUser, ...this.users.filter((u) => u.email !== cleanEmail)];

    const accessToken = TokenService.generateAccessToken(newUser);
    const rawRefreshToken = TokenService.generateRefreshToken();

    return {
      accessToken,
      rawRefreshToken,
      user: newUser.toSafeObject(),
      tenant: this.tenant
    };
  }

  // Login
  loginUser(email, password) {
    const cleanEmail = (email || '').trim().toLowerCase();
    let user = this.users.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!user) {
      // Allow any email to log in seamlessly in demo mode
      user = {
        _id: 'usr_' + crypto.randomBytes(6).toString('hex'),
        name: cleanEmail.split('@')[0].replace(/[._]/g, ' ').toUpperCase() || 'Administrator',
        email: cleanEmail || 'barkattemposervice@gmail.com',
        phone: '93776 10333',
        role: 'SUPER_ADMIN',
        roleId: defaultRoles[0],
        companyId: this.tenant,
        isActive: true,
        toSafeObject: function () {
          return {
            _id: this._id,
            name: this.name,
            email: this.email,
            phone: this.phone,
            role: this.role,
            roleId: this.roleId,
            companyId: this.companyId,
            isActive: this.isActive
          };
        }
      };
      this.users.push(user);
    }

    const accessToken = TokenService.generateAccessToken(user);
    const rawRefreshToken = TokenService.generateRefreshToken();

    return {
      accessToken,
      rawRefreshToken,
      user: typeof user.toSafeObject === 'function' ? user.toSafeObject() : user,
      tenant: this.tenant
    };
  }
}

const mockStore = new MockDataStore();
module.exports = mockStore;
