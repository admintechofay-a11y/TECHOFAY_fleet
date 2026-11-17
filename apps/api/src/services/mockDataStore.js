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

// 5 Realistic Indian Heavy Fleet Vehicles
const defaultVehicles = [
  {
    _id: '671e3b0f27d7a87e3cbb0010',
    companyId: defaultTenant._id,
    plateNumber: 'GJ01AB1234',
    vehicleType: 'Heavy Commercial Vehicle (HCV)',
    category: 'OWNED',
    make: 'Tata Motors',
    model: 'Signa 4825.TK',
    yearOfManufacture: 2024,
    capacityTonnage: 48,
    fuelType: 'DIESEL',
    status: 'AVAILABLE',
    isActive: true,
    ownerName: 'Barkat Tempo Service',
    ownerPhone: '93776 10333',
    currentLocation: 'Ahmedabad Central Hub',
    documents: [
      { _id: 'doc_v1_rc', documentType: 'RC', documentNumber: 'GJ01-2024-RC-9812', expiryDate: '2039-03-15', status: 'VERIFIED' },
      { _id: 'doc_v1_ins', documentType: 'INSURANCE', documentNumber: 'ICICI-LOMB-7721', expiryDate: '2027-02-10', status: 'VERIFIED' },
      { _id: 'doc_v1_fit', documentType: 'FITNESS', documentNumber: 'GJ-RTO-FIT-4412', expiryDate: '2026-12-30', status: 'VERIFIED' }
    ],
    createdAt: new Date('2026-01-10T10:00:00.000Z')
  },
  {
    _id: '671e3b0f27d7a87e3cbb0011',
    companyId: defaultTenant._id,
    plateNumber: 'MH12CD5678',
    vehicleType: 'Multi-Axle Truck',
    category: 'OWNED',
    make: 'Ashok Leyland',
    model: 'AVTR 3520',
    yearOfManufacture: 2023,
    capacityTonnage: 35,
    fuelType: 'DIESEL',
    status: 'ON_TRIP',
    isActive: true,
    ownerName: 'Barkat Tempo Service',
    ownerPhone: '93776 10333',
    currentLocation: 'In Transit: Surat - Mumbai Highway',
    documents: [
      { _id: 'doc_v2_rc', documentType: 'RC', documentNumber: 'MH12-2023-RC-5541', expiryDate: '2038-08-20', status: 'VERIFIED' },
      { _id: 'doc_v2_ins', documentType: 'INSURANCE', documentNumber: 'NEW-INDIA-8841', expiryDate: '2026-11-15', status: 'VERIFIED' }
    ],
    createdAt: new Date('2026-01-12T11:00:00.000Z')
  },
  {
    _id: '671e3b0f27d7a87e3cbb0012',
    companyId: defaultTenant._id,
    plateNumber: 'DL01GH3456',
    vehicleType: 'Tractor Trailer',
    category: 'ATTACHED',
    make: 'BharatBenz',
    model: '5528TT',
    yearOfManufacture: 2024,
    capacityTonnage: 55,
    fuelType: 'DIESEL',
    status: 'ON_TRIP',
    isActive: true,
    ownerName: 'North Logistics Partners',
    ownerPhone: '+91 98110 55432',
    currentLocation: 'In Transit: Kotputli - Delhi Corridor',
    documents: [
      { _id: 'doc_v3_rc', documentType: 'RC', documentNumber: 'DL01-2024-RC-1092', expiryDate: '2039-01-10', status: 'VERIFIED' }
    ],
    createdAt: new Date('2026-01-15T09:30:00.000Z')
  },
  {
    _id: '671e3b0f27d7a87e3cbb0013',
    companyId: defaultTenant._id,
    plateNumber: 'GJ06EF9012',
    vehicleType: 'Open Body Truck',
    category: 'MARKET',
    make: 'Eicher Motors',
    model: 'Pro 6035',
    yearOfManufacture: 2022,
    capacityTonnage: 28,
    fuelType: 'DIESEL',
    status: 'AVAILABLE',
    isActive: true,
    ownerName: 'Baroda Transport Fleet',
    ownerPhone: '+91 98240 77123',
    currentLocation: 'Vadodara Logistics Yard',
    documents: [],
    createdAt: new Date('2026-01-18T14:00:00.000Z')
  },
  {
    _id: '671e3b0f27d7a87e3cbb0014',
    companyId: defaultTenant._id,
    plateNumber: 'KA04JK7890',
    vehicleType: 'Heavy Commercial Vehicle (HCV)',
    category: 'OWNED',
    make: 'Mahindra',
    model: 'Blazo X 49',
    yearOfManufacture: 2023,
    capacityTonnage: 49,
    fuelType: 'DIESEL',
    status: 'UNDER_MAINTENANCE',
    isActive: true,
    ownerName: 'Barkat Tempo Service',
    ownerPhone: '93776 10333',
    currentLocation: 'Ahmedabad Authorized Workshop',
    documents: [],
    createdAt: new Date('2026-01-20T16:00:00.000Z')
  }
];

// 5 Professional Indian Commercial Drivers
const defaultDrivers = [
  {
    _id: '671e3b0f27d7a87e3cbb0020',
    companyId: defaultTenant._id,
    name: 'Ramesh Patel',
    phone: '+91 98251 11223',
    licenseNumber: 'GJ01-2015-001234',
    licenseExpiry: '2035-05-14',
    status: 'AVAILABLE',
    experienceYears: 12,
    bloodGroup: 'B+',
    isActive: true,
    assignedVehicleId: '671e3b0f27d7a87e3cbb0010',
    createdAt: new Date('2026-01-10T10:00:00.000Z')
  },
  {
    _id: '671e3b0f27d7a87e3cbb0021',
    companyId: defaultTenant._id,
    name: 'Vikram Singh',
    phone: '+91 98251 22334',
    licenseNumber: 'MH12-2017-005678',
    licenseExpiry: '2037-08-22',
    status: 'ON_TRIP',
    experienceYears: 9,
    bloodGroup: 'O+',
    isActive: true,
    assignedVehicleId: '671e3b0f27d7a87e3cbb0011',
    createdAt: new Date('2026-01-12T11:00:00.000Z')
  },
  {
    _id: '671e3b0f27d7a87e3cbb0022',
    companyId: defaultTenant._id,
    name: 'Suresh Sharma',
    phone: '+91 98251 33445',
    licenseNumber: 'DL04-2018-009012',
    licenseExpiry: '2038-03-10',
    status: 'ON_TRIP',
    experienceYears: 7,
    bloodGroup: 'A+',
    isActive: true,
    assignedVehicleId: '671e3b0f27d7a87e3cbb0012',
    createdAt: new Date('2026-01-15T09:30:00.000Z')
  },
  {
    _id: '671e3b0f27d7a87e3cbb0023',
    companyId: defaultTenant._id,
    name: 'Rajesh Kumar',
    phone: '+91 98251 44556',
    licenseNumber: 'RJ14-2019-003456',
    licenseExpiry: '2039-11-19',
    status: 'AVAILABLE',
    experienceYears: 15,
    bloodGroup: 'AB+',
    isActive: true,
    createdAt: new Date('2026-01-18T14:00:00.000Z')
  },
  {
    _id: '671e3b0f27d7a87e3cbb0024',
    companyId: defaultTenant._id,
    name: 'Mohammed Ali',
    phone: '+91 98251 55667',
    licenseNumber: 'KA05-2020-007890',
    licenseExpiry: '2040-07-05',
    status: 'ON_LEAVE',
    experienceYears: 6,
    bloodGroup: 'O-',
    isActive: true,
    createdAt: new Date('2026-01-20T16:00:00.000Z')
  }
];

// Major Indian Corporate Consignors / Consignees
const defaultCustomers = [
  {
    _id: '671e3b0f27d7a87e3cbb0030',
    companyId: defaultTenant._id,
    name: 'Reliance Industries Limited',
    legalName: 'Reliance Industries Limited',
    tradeName: 'Reliance Petrochemicals Hazira',
    gstin: '24AAACR1234A1Z1',
    pan: 'AAACR1234A',
    type: 'CONSIGNOR',
    contactPerson: 'Sanjay Deshmukh',
    email: 'logistics.hazira@ril.com',
    phone: '+91 98250 99881',
    billingAddress: { street: 'Hazira Manufacturing Division', city: 'Surat', state: 'Gujarat', pincode: '394510', country: 'IN' },
    creditPeriodDays: 30,
    isActive: true,
    createdAt: new Date('2026-01-05T09:00:00.000Z')
  },
  {
    _id: '671e3b0f27d7a87e3cbb0031',
    companyId: defaultTenant._id,
    name: 'Adani Wilmar Limited',
    legalName: 'Adani Wilmar Limited',
    tradeName: 'Adani Wilmar Mundra Port',
    gstin: '24AAACA5678B1Z2',
    pan: 'AAACA5678B',
    type: 'BOTH',
    contactPerson: 'Ketan Trivedi',
    email: 'freight.mundra@adaniwilmar.in',
    phone: '+91 98250 77662',
    billingAddress: { street: 'Fortune House, Navrangpura', city: 'Ahmedabad', state: 'Gujarat', pincode: '380009', country: 'IN' },
    creditPeriodDays: 45,
    isActive: true,
    createdAt: new Date('2026-01-06T10:00:00.000Z')
  },
  {
    _id: '671e3b0f27d7a87e3cbb0032',
    companyId: defaultTenant._id,
    name: 'Tata Steel Limited',
    legalName: 'Tata Steel Limited',
    tradeName: 'Tata Steel Tubes Division',
    gstin: '27AAACT9012C1Z3',
    pan: 'AAACT9012C',
    type: 'CONSIGNOR',
    contactPerson: 'Abhinav Sen',
    email: 'outbound.shipping@tatasteel.com',
    phone: '+91 98300 44331',
    billingAddress: { street: 'Bombay House, 24 Homi Mody Street', city: 'Mumbai', state: 'Maharashtra', pincode: '400001', country: 'IN' },
    creditPeriodDays: 30,
    isActive: true,
    createdAt: new Date('2026-01-07T11:00:00.000Z')
  },
  {
    _id: '671e3b0f27d7a87e3cbb0033',
    companyId: defaultTenant._id,
    name: 'UltraTech Cement Limited',
    legalName: 'UltraTech Cement Limited',
    tradeName: 'UltraTech Kovaya Works',
    gstin: '24AAACU3456D1Z4',
    pan: 'AAACU3456D',
    type: 'CONSIGNEE',
    contactPerson: 'Mahesh Joshi',
    email: 'dispatch.kovaya@adityabirla.com',
    phone: '+91 98250 33221',
    billingAddress: { street: 'Kovaya Works, Rajula', city: 'Amreli', state: 'Gujarat', pincode: '365541', country: 'IN' },
    creditPeriodDays: 15,
    isActive: true,
    createdAt: new Date('2026-01-08T12:00:00.000Z')
  },
  {
    _id: '671e3b0f27d7a87e3cbb0034',
    companyId: defaultTenant._id,
    name: 'Asian Paints Limited',
    legalName: 'Asian Paints Limited',
    tradeName: 'Asian Paints Industrial Center',
    gstin: '27AAACA7890E1Z5',
    pan: 'AAACA7890E',
    type: 'CONSIGNEE',
    contactPerson: 'Gaurav Mehta',
    email: 'central.supply@asianpaints.com',
    phone: '+91 98200 11990',
    billingAddress: { street: '6A Shantiniketan, Santacruz East', city: 'Mumbai', state: 'Maharashtra', pincode: '400055', country: 'IN' },
    creditPeriodDays: 30,
    isActive: true,
    createdAt: new Date('2026-01-09T13:00:00.000Z')
  }
];

// Major Logistics Hubs
const defaultLocations = [
  {
    _id: '671e3b0f27d7a87e3cbb0040',
    companyId: defaultTenant._id,
    name: 'Ahmedabad Central Transport Hub',
    code: 'AMD-HUB-01',
    city: 'Ahmedabad',
    state: 'Gujarat',
    address: 'Narol Transport Nagar, National Highway 48',
    pincode: '382405',
    hubType: 'CENTRAL_HUB',
    coordinates: { lat: 22.9812, lng: 72.6021 },
    isActive: true
  },
  {
    _id: '671e3b0f27d7a87e3cbb0041',
    companyId: defaultTenant._id,
    name: 'Mundra Port Container Terminal',
    code: 'MUN-PORT-01',
    city: 'Mundra',
    state: 'Gujarat',
    address: 'APSEZ Terminal, Mundra Port Special Economic Zone',
    pincode: '370421',
    hubType: 'PORT_TERMINAL',
    coordinates: { lat: 22.8398, lng: 69.7042 },
    isActive: true
  },
  {
    _id: '671e3b0f27d7a87e3cbb0042',
    companyId: defaultTenant._id,
    name: 'Nhava Sheva JNPT Port Yard',
    code: 'BOM-JNPT-01',
    city: 'Navi Mumbai',
    state: 'Maharashtra',
    address: 'Jawaharlal Nehru Port Trust Logistics Park, Uran',
    pincode: '400707',
    hubType: 'PORT_TERMINAL',
    coordinates: { lat: 18.9501, lng: 72.9514 },
    isActive: true
  },
  {
    _id: '671e3b0f27d7a87e3cbb0043',
    companyId: defaultTenant._id,
    name: 'Delhi NCR Logistics Logistics Center',
    code: 'DEL-NCR-01',
    city: 'Gurugram',
    state: 'Haryana',
    address: 'Bilaspur Logistics Cluster, NH-48',
    pincode: '122413',
    hubType: 'CENTRAL_HUB',
    coordinates: { lat: 28.3241, lng: 76.8412 },
    isActive: true
  },
  {
    _id: '671e3b0f27d7a87e3cbb0044',
    companyId: defaultTenant._id,
    name: 'Pune Chakan Auto Corridor Hub',
    code: 'PUN-CHK-01',
    city: 'Pune',
    state: 'Maharashtra',
    address: 'Chakan MIDC Phase 2, Talegaon Road',
    pincode: '410501',
    hubType: 'WAREHOUSE',
    coordinates: { lat: 18.7512, lng: 73.8541 },
    isActive: true
  }
];

// Active & Completed Freight Consignments
const defaultLoads = [
  {
    _id: '671e3b0f27d7a87e3cbb0050',
    companyId: defaultTenant._id,
    loadNumber: 'LD-2026-0001',
    orderDate: '2026-01-20T08:00:00.000Z',
    customerId: {
      _id: defaultCustomers[0]._id,
      name: defaultCustomers[0].legalName,
      legalName: defaultCustomers[0].legalName,
      tradeName: defaultCustomers[0].tradeName,
      phone: defaultCustomers[0].phone
    },
    customer: defaultCustomers[0],
    consignorId: {
      _id: defaultCustomers[0]._id,
      name: defaultCustomers[0].legalName,
      legalName: defaultCustomers[0].legalName,
      phone: defaultCustomers[0].phone
    },
    consigneeId: {
      _id: defaultCustomers[4]._id,
      name: defaultCustomers[4].legalName,
      legalName: defaultCustomers[4].legalName,
      phone: defaultCustomers[4].phone
    },
    consignorName: 'Reliance Industries Limited',
    consigneeName: 'Asian Paints Limited',
    originLocationId: defaultLocations[0]._id,
    originCity: 'Ahmedabad, GJ',
    origin: 'Ahmedabad, GJ',
    destinationLocationId: defaultLocations[2]._id,
    destinationCity: 'Mumbai JNPT, MH',
    destination: 'Mumbai JNPT, MH',
    cargoType: 'Polymers & Petrochemicals',
    packageType: 'JUMBO_BAGS',
    totalWeightMt: 32.5,
    weightMt: 32.5,
    totalQuantity: 65,
    quantity: 65,
    unit: 'BAGS',
    freightAmount: 68500,
    advancePaid: 35000,
    balanceDue: 33500,
    financials: {
      baseFreightRupees: 68500,
      totalFreightRupees: 68500,
      advanceRupees: 35000,
      balanceRupees: 33500,
      baseFreightPaise: 6850000,
      totalFreightPaise: 6850000,
      advancePaise: 3500000,
      balancePaise: 3350000
    },
    status: 'DELIVERED',
    assignedVehicleId: {
      _id: defaultVehicles[0]._id,
      plateNumber: defaultVehicles[0].plateNumber,
      vehicleType: defaultVehicles[0].vehicleType,
      capacityTonnage: defaultVehicles[0].capacityTonnage,
      status: defaultVehicles[0].status
    },
    assignedVehiclePlate: defaultVehicles[0].plateNumber,
    vehiclePlate: defaultVehicles[0].plateNumber,
    assignedDriverId: {
      _id: defaultDrivers[0]._id,
      name: defaultDrivers[0].name,
      phone: defaultDrivers[0].phone,
      licenseNumber: defaultDrivers[0].licenseNumber
    },
    assignedDriverName: defaultDrivers[0].name,
    driverName: defaultDrivers[0].name,
    stops: [
      {
        _id: 'stp_ld1_1',
        sequence: 1,
        stopType: 'PICKUP',
        locationId: { _id: defaultLocations[0]._id, name: defaultLocations[0].name, city: defaultLocations[0].city, address: defaultLocations[0].address },
        allocatedQuantity: 65,
        allocatedWeightMt: 32.5,
        status: 'COMPLETED'
      },
      {
        _id: 'stp_ld1_2',
        sequence: 2,
        stopType: 'DELIVERY',
        locationId: { _id: defaultLocations[2]._id, name: defaultLocations[2].name, city: defaultLocations[2].city, address: defaultLocations[2].address },
        allocatedQuantity: 65,
        allocatedWeightMt: 32.5,
        status: 'COMPLETED'
      }
    ],
    gtaGstRate: 5.0,
    gtaGstAmount: 3425,
    sacCode: '9965',
    createdAt: new Date('2026-01-20T08:00:00.000Z')
  },
  {
    _id: '671e3b0f27d7a87e3cbb0051',
    companyId: defaultTenant._id,
    loadNumber: 'LD-2026-0002',
    orderDate: '2026-01-22T09:30:00.000Z',
    customerId: {
      _id: defaultCustomers[1]._id,
      name: defaultCustomers[1].legalName,
      legalName: defaultCustomers[1].legalName,
      tradeName: defaultCustomers[1].tradeName,
      phone: defaultCustomers[1].phone
    },
    customer: defaultCustomers[1],
    consignorId: {
      _id: defaultCustomers[1]._id,
      name: defaultCustomers[1].legalName,
      legalName: defaultCustomers[1].legalName,
      phone: defaultCustomers[1].phone
    },
    consigneeId: {
      _id: defaultCustomers[3]._id,
      name: defaultCustomers[3].legalName,
      legalName: defaultCustomers[3].legalName,
      phone: defaultCustomers[3].phone
    },
    consignorName: 'Adani Wilmar Limited',
    consigneeName: 'UltraTech Cement Limited',
    originLocationId: defaultLocations[1]._id,
    originCity: 'Mundra Port, GJ',
    origin: 'Mundra Port, GJ',
    destinationLocationId: defaultLocations[4]._id,
    destinationCity: 'Pune Chakan, MH',
    destination: 'Pune Chakan, MH',
    cargoType: 'Refined Edible Bulk Oils',
    packageType: 'BARRELS',
    totalWeightMt: 28.0,
    weightMt: 28.0,
    totalQuantity: 140,
    quantity: 140,
    unit: 'DRUMS',
    freightAmount: 84000,
    advancePaid: 45000,
    balanceDue: 39000,
    financials: {
      baseFreightRupees: 84000,
      totalFreightRupees: 84000,
      advanceRupees: 45000,
      balanceRupees: 39000,
      baseFreightPaise: 8400000,
      totalFreightPaise: 8400000,
      advancePaise: 4500000,
      balancePaise: 3900000
    },
    status: 'IN_TRANSIT',
    assignedVehicleId: {
      _id: defaultVehicles[1]._id,
      plateNumber: defaultVehicles[1].plateNumber,
      vehicleType: defaultVehicles[1].vehicleType,
      capacityTonnage: defaultVehicles[1].capacityTonnage,
      status: defaultVehicles[1].status
    },
    assignedVehiclePlate: defaultVehicles[1].plateNumber,
    vehiclePlate: defaultVehicles[1].plateNumber,
    assignedDriverId: {
      _id: defaultDrivers[1]._id,
      name: defaultDrivers[1].name,
      phone: defaultDrivers[1].phone,
      licenseNumber: defaultDrivers[1].licenseNumber
    },
    assignedDriverName: defaultDrivers[1].name,
    driverName: defaultDrivers[1].name,
    stops: [
      {
        _id: 'stp_ld2_1',
        sequence: 1,
        stopType: 'PICKUP',
        locationId: { _id: defaultLocations[1]._id, name: defaultLocations[1].name, city: defaultLocations[1].city, address: defaultLocations[1].address },
        allocatedQuantity: 140,
        allocatedWeightMt: 28.0,
        status: 'COMPLETED'
      },
      {
        _id: 'stp_ld2_2',
        sequence: 2,
        stopType: 'DELIVERY',
        locationId: { _id: defaultLocations[4]._id, name: defaultLocations[4].name, city: defaultLocations[4].city, address: defaultLocations[4].address },
        allocatedQuantity: 140,
        allocatedWeightMt: 28.0,
        status: 'IN_TRANSIT'
      }
    ],
    gtaGstRate: 5.0,
    gtaGstAmount: 4200,
    sacCode: '9965',
    createdAt: new Date('2026-01-22T09:30:00.000Z')
  },
  {
    _id: '671e3b0f27d7a87e3cbb0052',
    companyId: defaultTenant._id,
    loadNumber: 'LD-2026-0003',
    orderDate: '2026-01-23T11:00:00.000Z',
    customerId: {
      _id: defaultCustomers[2]._id,
      name: defaultCustomers[2].legalName,
      legalName: defaultCustomers[2].legalName,
      tradeName: defaultCustomers[2].tradeName,
      phone: defaultCustomers[2].phone
    },
    customer: defaultCustomers[2],
    consignorId: {
      _id: defaultCustomers[2]._id,
      name: defaultCustomers[2].legalName,
      legalName: defaultCustomers[2].legalName,
      phone: defaultCustomers[2].phone
    },
    consigneeId: {
      _id: defaultCustomers[0]._id,
      name: defaultCustomers[0].legalName,
      legalName: defaultCustomers[0].legalName,
      phone: defaultCustomers[0].phone
    },
    consignorName: 'Tata Steel Limited',
    consigneeName: 'Reliance Industries Limited',
    originLocationId: defaultLocations[0]._id,
    originCity: 'Ahmedabad Hub, GJ',
    origin: 'Ahmedabad Hub, GJ',
    destinationLocationId: defaultLocations[3]._id,
    destinationCity: 'Delhi NCR Bilaspur, HR',
    destination: 'Delhi NCR Bilaspur, HR',
    cargoType: 'Hot Rolled Steel Coils',
    packageType: 'BUNDLES',
    totalWeightMt: 42.0,
    weightMt: 42.0,
    totalQuantity: 8,
    quantity: 8,
    unit: 'COILS',
    freightAmount: 125000,
    advancePaid: 60000,
    balanceDue: 65000,
    financials: {
      baseFreightRupees: 125000,
      totalFreightRupees: 125000,
      advanceRupees: 60000,
      balanceRupees: 65000,
      baseFreightPaise: 12500000,
      totalFreightPaise: 12500000,
      advancePaise: 6000000,
      balancePaise: 6500000
    },
    status: 'IN_TRANSIT',
    assignedVehicleId: {
      _id: defaultVehicles[2]._id,
      plateNumber: defaultVehicles[2].plateNumber,
      vehicleType: defaultVehicles[2].vehicleType,
      capacityTonnage: defaultVehicles[2].capacityTonnage,
      status: defaultVehicles[2].status
    },
    assignedVehiclePlate: defaultVehicles[2].plateNumber,
    vehiclePlate: defaultVehicles[2].plateNumber,
    assignedDriverId: {
      _id: defaultDrivers[2]._id,
      name: defaultDrivers[2].name,
      phone: defaultDrivers[2].phone,
      licenseNumber: defaultDrivers[2].licenseNumber
    },
    assignedDriverName: defaultDrivers[2].name,
    driverName: defaultDrivers[2].name,
    stops: [
      {
        _id: 'stp_ld3_1',
        sequence: 1,
        stopType: 'PICKUP',
        locationId: { _id: defaultLocations[0]._id, name: defaultLocations[0].name, city: defaultLocations[0].city, address: defaultLocations[0].address },
        allocatedQuantity: 8,
        allocatedWeightMt: 42.0,
        status: 'COMPLETED'
      },
      {
        _id: 'stp_ld3_2',
        sequence: 2,
        stopType: 'DELIVERY',
        locationId: { _id: defaultLocations[3]._id, name: defaultLocations[3].name, city: defaultLocations[3].city, address: defaultLocations[3].address },
        allocatedQuantity: 8,
        allocatedWeightMt: 42.0,
        status: 'IN_TRANSIT'
      }
    ],
    gtaGstRate: 5.0,
    gtaGstAmount: 6250,
    sacCode: '9965',
    createdAt: new Date('2026-01-23T11:00:00.000Z')
  },
  {
    _id: '671e3b0f27d7a87e3cbb0053',
    companyId: defaultTenant._id,
    loadNumber: 'LD-2026-0004',
    orderDate: '2026-01-24T14:15:00.000Z',
    customerId: {
      _id: defaultCustomers[3]._id,
      name: defaultCustomers[3].legalName,
      legalName: defaultCustomers[3].legalName,
      tradeName: defaultCustomers[3].tradeName,
      phone: defaultCustomers[3].phone
    },
    customer: defaultCustomers[3],
    consignorId: {
      _id: defaultCustomers[3]._id,
      name: defaultCustomers[3].legalName,
      legalName: defaultCustomers[3].legalName,
      phone: defaultCustomers[3].phone
    },
    consigneeId: {
      _id: defaultCustomers[4]._id,
      name: defaultCustomers[4].legalName,
      legalName: defaultCustomers[4].legalName,
      phone: defaultCustomers[4].phone
    },
    consignorName: 'UltraTech Cement Limited',
    consigneeName: 'Asian Paints Limited',
    originLocationId: defaultLocations[0]._id,
    originCity: 'Amreli Works, GJ',
    origin: 'Amreli Works, GJ',
    destinationLocationId: defaultLocations[0]._id,
    destinationCity: 'Ahmedabad Yard, GJ',
    destination: 'Ahmedabad Yard, GJ',
    cargoType: 'Packaged Grade 53 Cement',
    packageType: 'PALLETS',
    totalWeightMt: 35.0,
    weightMt: 35.0,
    totalQuantity: 700,
    quantity: 700,
    unit: 'BAGS',
    freightAmount: 42000,
    advancePaid: 20000,
    balanceDue: 22000,
    financials: {
      baseFreightRupees: 42000,
      totalFreightRupees: 42000,
      advanceRupees: 20000,
      balanceRupees: 22000,
      baseFreightPaise: 4200000,
      totalFreightPaise: 4200000,
      advancePaise: 2000000,
      balancePaise: 2200000
    },
    status: 'VEHICLE_ASSIGNED',
    assignedVehicleId: {
      _id: defaultVehicles[3]._id,
      plateNumber: defaultVehicles[3].plateNumber,
      vehicleType: defaultVehicles[3].vehicleType,
      capacityTonnage: defaultVehicles[3].capacityTonnage,
      status: defaultVehicles[3].status
    },
    assignedVehiclePlate: defaultVehicles[3].plateNumber,
    vehiclePlate: defaultVehicles[3].plateNumber,
    assignedDriverId: {
      _id: defaultDrivers[3]._id,
      name: defaultDrivers[3].name,
      phone: defaultDrivers[3].phone,
      licenseNumber: defaultDrivers[3].licenseNumber
    },
    assignedDriverName: defaultDrivers[3].name,
    driverName: defaultDrivers[3].name,
    stops: [
      {
        _id: 'stp_ld4_1',
        sequence: 1,
        stopType: 'PICKUP',
        locationId: { _id: defaultLocations[0]._id, name: 'Amreli Works Logistics Gate', city: 'Amreli', address: 'Amreli Works, Gujarat' },
        allocatedQuantity: 700,
        allocatedWeightMt: 35.0,
        status: 'PENDING'
      },
      {
        _id: 'stp_ld4_2',
        sequence: 2,
        stopType: 'DELIVERY',
        locationId: { _id: defaultLocations[0]._id, name: defaultLocations[0].name, city: defaultLocations[0].city, address: defaultLocations[0].address },
        allocatedQuantity: 700,
        allocatedWeightMt: 35.0,
        status: 'PENDING'
      }
    ],
    gtaGstRate: 5.0,
    gtaGstAmount: 2100,
    sacCode: '9965',
    createdAt: new Date('2026-01-24T14:15:00.000Z')
  },
  {
    _id: '671e3b0f27d7a87e3cbb0054',
    companyId: defaultTenant._id,
    loadNumber: 'LD-2026-0005',
    orderDate: '2026-01-25T16:00:00.000Z',
    customerId: {
      _id: defaultCustomers[0]._id,
      name: defaultCustomers[0].legalName,
      legalName: defaultCustomers[0].legalName,
      tradeName: defaultCustomers[0].tradeName,
      phone: defaultCustomers[0].phone
    },
    customer: defaultCustomers[0],
    consignorId: {
      _id: defaultCustomers[0]._id,
      name: defaultCustomers[0].legalName,
      legalName: defaultCustomers[0].legalName,
      phone: defaultCustomers[0].phone
    },
    consigneeId: {
      _id: defaultCustomers[1]._id,
      name: defaultCustomers[1].legalName,
      legalName: defaultCustomers[1].legalName,
      phone: defaultCustomers[1].phone
    },
    consignorName: 'Reliance Industries Limited',
    consigneeName: 'Adani Wilmar Limited',
    originLocationId: defaultLocations[0]._id,
    originCity: 'Surat Hazira, GJ',
    origin: 'Surat Hazira, GJ',
    destinationLocationId: defaultLocations[2]._id,
    destinationCity: 'Mumbai Port, MH',
    destination: 'Mumbai Port, MH',
    cargoType: 'Chemical Intermediate Drums',
    packageType: 'BARRELS',
    totalWeightMt: 24.0,
    weightMt: 24.0,
    totalQuantity: 120,
    quantity: 120,
    unit: 'DRUMS',
    freightAmount: 38000,
    advancePaid: 0,
    balanceDue: 38000,
    financials: {
      baseFreightRupees: 38000,
      totalFreightRupees: 38000,
      advanceRupees: 0,
      balanceRupees: 38000,
      baseFreightPaise: 3800000,
      totalFreightPaise: 3800000,
      advancePaise: 0,
      balancePaise: 3800000
    },
    status: 'CREATED',
    stops: [
      {
        _id: 'stp_ld5_1',
        sequence: 1,
        stopType: 'PICKUP',
        locationId: { _id: defaultLocations[0]._id, name: 'Hazira Chemical Gate', city: 'Surat', address: 'Hazira Manufacturing Division' },
        allocatedQuantity: 120,
        allocatedWeightMt: 24.0,
        status: 'PENDING'
      },
      {
        _id: 'stp_ld5_2',
        sequence: 2,
        stopType: 'DELIVERY',
        locationId: { _id: defaultLocations[2]._id, name: defaultLocations[2].name, city: defaultLocations[2].city, address: defaultLocations[2].address },
        allocatedQuantity: 120,
        allocatedWeightMt: 24.0,
        status: 'PENDING'
      }
    ],
    gtaGstRate: 5.0,
    gtaGstAmount: 1900,
    sacCode: '9965',
    createdAt: new Date('2026-01-25T16:00:00.000Z')
  }
];

// Bilties & LRs
const defaultBilties = [
  {
    _id: '671e3b0f27d7a87e3cbb0060',
    companyId: defaultTenant._id,
    biltyNumber: 'BL-2026-00101',
    lrNumber: 'LR-2026-00101',
    loadId: {
      _id: defaultLoads[0]._id,
      loadNumber: defaultLoads[0].loadNumber
    },
    loadNumber: defaultLoads[0].loadNumber,
    lrId: {
      _id: '671e3b0f27d7a87e3cbb0060',
      lrNumber: 'LR-2026-00101'
    },
    vehicleId: {
      _id: defaultVehicles[0]._id,
      plateNumber: defaultVehicles[0].plateNumber,
      vehicleType: defaultVehicles[0].vehicleType
    },
    vehiclePlate: defaultVehicles[0].plateNumber,
    driverId: {
      _id: defaultDrivers[0]._id,
      name: defaultDrivers[0].name,
      phone: defaultDrivers[0].phone
    },
    driverName: defaultDrivers[0].name,
    driverPhone: defaultDrivers[0].phone,
    consignorId: {
      _id: defaultCustomers[0]._id,
      name: defaultCustomers[0].legalName,
      phone: defaultCustomers[0].phone,
      gstin: defaultCustomers[0].gstin
    },
    consignor: defaultCustomers[0].legalName,
    consigneeId: {
      _id: defaultCustomers[4]._id,
      name: defaultCustomers[4].legalName,
      phone: defaultCustomers[4].phone,
      gstin: defaultCustomers[4].gstin
    },
    consignee: defaultCustomers[4].legalName,
    consignorGstin: defaultCustomers[0].gstin,
    consigneeGstin: defaultCustomers[4].gstin,
    origin: 'Ahmedabad Central Hub',
    destination: 'Mumbai Nhava Sheva',
    goodsDescription: 'Industrial Polymers 32.5 MT',
    weightMt: 32.5,
    packagesCount: 65,
    freightRate: 2100,
    freightAmount: 68500,
    advanceAmount: 35000,
    balanceAmount: 33500,
    gstRate: 5.0,
    gstAmount: 3425,
    gstPayableBy: 'CONSIGNOR',
    status: 'DELIVERED',
    createdAt: new Date('2026-01-20T08:30:00.000Z')
  },
  {
    _id: '671e3b0f27d7a87e3cbb0061',
    companyId: defaultTenant._id,
    biltyNumber: 'BL-2026-00102',
    lrNumber: 'LR-2026-00102',
    loadId: {
      _id: defaultLoads[1]._id,
      loadNumber: defaultLoads[1].loadNumber
    },
    loadNumber: defaultLoads[1].loadNumber,
    lrId: {
      _id: '671e3b0f27d7a87e3cbb0061',
      lrNumber: 'LR-2026-00102'
    },
    vehicleId: {
      _id: defaultVehicles[1]._id,
      plateNumber: defaultVehicles[1].plateNumber,
      vehicleType: defaultVehicles[1].vehicleType
    },
    vehiclePlate: defaultVehicles[1].plateNumber,
    driverId: {
      _id: defaultDrivers[1]._id,
      name: defaultDrivers[1].name,
      phone: defaultDrivers[1].phone
    },
    driverName: defaultDrivers[1].name,
    driverPhone: defaultDrivers[1].phone,
    consignorId: {
      _id: defaultCustomers[1]._id,
      name: defaultCustomers[1].legalName,
      phone: defaultCustomers[1].phone,
      gstin: defaultCustomers[1].gstin
    },
    consignor: defaultCustomers[1].legalName,
    consigneeId: {
      _id: defaultCustomers[3]._id,
      name: defaultCustomers[3].legalName,
      phone: defaultCustomers[3].phone,
      gstin: defaultCustomers[3].gstin
    },
    consignee: defaultCustomers[3].legalName,
    consignorGstin: defaultCustomers[1].gstin,
    consigneeGstin: defaultCustomers[3].gstin,
    origin: 'Mundra Port Container Terminal',
    destination: 'Pune Chakan Auto Corridor',
    goodsDescription: 'Refined Edible Bulk Oils 28 MT',
    weightMt: 28.0,
    packagesCount: 140,
    freightRate: 3000,
    freightAmount: 84000,
    advanceAmount: 45000,
    balanceAmount: 39000,
    gstRate: 5.0,
    gstAmount: 4200,
    gstPayableBy: 'CONSIGNOR',
    status: 'IN_TRANSIT',
    createdAt: new Date('2026-01-22T10:00:00.000Z')
  },
  {
    _id: '671e3b0f27d7a87e3cbb0062',
    companyId: defaultTenant._id,
    biltyNumber: 'BL-2026-00103',
    lrNumber: 'LR-2026-00103',
    loadId: {
      _id: defaultLoads[2]._id,
      loadNumber: defaultLoads[2].loadNumber
    },
    loadNumber: defaultLoads[2].loadNumber,
    lrId: {
      _id: '671e3b0f27d7a87e3cbb0062',
      lrNumber: 'LR-2026-00103'
    },
    vehicleId: {
      _id: defaultVehicles[2]._id,
      plateNumber: defaultVehicles[2].plateNumber,
      vehicleType: defaultVehicles[2].vehicleType
    },
    vehiclePlate: defaultVehicles[2].plateNumber,
    driverId: {
      _id: defaultDrivers[2]._id,
      name: defaultDrivers[2].name,
      phone: defaultDrivers[2].phone
    },
    driverName: defaultDrivers[2].name,
    driverPhone: defaultDrivers[2].phone,
    consignorId: {
      _id: defaultCustomers[2]._id,
      name: defaultCustomers[2].legalName,
      phone: defaultCustomers[2].phone,
      gstin: defaultCustomers[2].gstin
    },
    consignor: defaultCustomers[2].legalName,
    consigneeId: {
      _id: defaultCustomers[0]._id,
      name: defaultCustomers[0].legalName,
      phone: defaultCustomers[0].phone,
      gstin: defaultCustomers[0].gstin
    },
    consignee: defaultCustomers[0].legalName,
    consignorGstin: defaultCustomers[2].gstin,
    consigneeGstin: defaultCustomers[0].gstin,
    origin: 'Ahmedabad Central Hub',
    destination: 'Delhi NCR Bilaspur Logistics',
    goodsDescription: 'Hot Rolled Steel Coils 42 MT',
    weightMt: 42.0,
    packagesCount: 8,
    freightRate: 2976,
    freightAmount: 125000,
    advanceAmount: 60000,
    balanceAmount: 65000,
    gstRate: 5.0,
    gstAmount: 6250,
    gstPayableBy: 'CONSIGNOR',
    status: 'IN_TRANSIT',
    createdAt: new Date('2026-01-23T11:30:00.000Z')
  }
];

// Active & Closed Trips
const defaultTrips = [
  {
    _id: '671e3b0f27d7a87e3cbb0070',
    companyId: defaultTenant._id,
    tripNumber: 'TRP-2026-001',
    loadId: {
      _id: defaultLoads[0]._id,
      loadNumber: defaultLoads[0].loadNumber
    },
    loadNumber: defaultLoads[0].loadNumber,
    vehicleId: {
      _id: defaultVehicles[0]._id,
      plateNumber: defaultVehicles[0].plateNumber,
      vehicleType: defaultVehicles[0].vehicleType,
      capacityTonnage: defaultVehicles[0].capacityTonnage
    },
    vehiclePlate: defaultVehicles[0].plateNumber,
    driverId: {
      _id: defaultDrivers[0]._id,
      name: defaultDrivers[0].name,
      phone: defaultDrivers[0].phone,
      licenseNumber: defaultDrivers[0].licenseNumber
    },
    driverName: defaultDrivers[0].name,
    driverPhone: defaultDrivers[0].phone,
    origin: 'Ahmedabad, Gujarat',
    destination: 'Mumbai, Maharashtra',
    status: 'CLOSED',
    odometerStart: 142100,
    odometerEnd: 142640,
    totalDistanceKm: 540,
    stops: [
      {
        _id: 'trp_stp_1_1',
        sequence: 1,
        stopType: 'PICKUP',
        locationName: 'Ahmedabad Central Transport Hub',
        status: 'COMPLETED',
        allocatedQuantity: 65,
        deliveredQuantity: 65,
        allocatedWeightMt: 32.5
      },
      {
        _id: 'trp_stp_1_2',
        sequence: 2,
        stopType: 'DELIVERY',
        locationName: 'Nhava Sheva JNPT Port Yard',
        status: 'COMPLETED',
        allocatedQuantity: 65,
        deliveredQuantity: 65,
        allocatedWeightMt: 32.5
      }
    ],
    expenses: [
      { _id: 'exp_1', category: 'FUEL', amount: 14200, notes: 'HPCL Highway Pump Vadodara' },
      { _id: 'exp_2', category: 'TOLL', amount: 2850, notes: 'Fastag Automatic Deductions NH-48' },
      { _id: 'exp_3', category: 'DRIVER_ALLOWANCE', amount: 2500, notes: 'Bata / Food allowance' }
    ],
    totalExpenses: 19550,
    startedAt: new Date('2026-01-20T09:00:00.000Z'),
    completedAt: new Date('2026-01-21T18:00:00.000Z')
  },
  {
    _id: '671e3b0f27d7a87e3cbb0071',
    companyId: defaultTenant._id,
    tripNumber: 'TRP-2026-002',
    loadId: {
      _id: defaultLoads[1]._id,
      loadNumber: defaultLoads[1].loadNumber
    },
    loadNumber: defaultLoads[1].loadNumber,
    vehicleId: {
      _id: defaultVehicles[1]._id,
      plateNumber: defaultVehicles[1].plateNumber,
      vehicleType: defaultVehicles[1].vehicleType,
      capacityTonnage: defaultVehicles[1].capacityTonnage
    },
    vehiclePlate: defaultVehicles[1].plateNumber,
    driverId: {
      _id: defaultDrivers[1]._id,
      name: defaultDrivers[1].name,
      phone: defaultDrivers[1].phone,
      licenseNumber: defaultDrivers[1].licenseNumber
    },
    driverName: defaultDrivers[1].name,
    driverPhone: defaultDrivers[1].phone,
    origin: 'Mundra Port, Gujarat',
    destination: 'Pune Chakan, Maharashtra',
    status: 'IN_TRANSIT',
    odometerStart: 98450,
    totalDistanceKm: 890,
    currentLocation: 'NH-48 Near Navsari Bypass, Speed: 62 km/h',
    stops: [
      {
        _id: 'trp_stp_2_1',
        sequence: 1,
        stopType: 'PICKUP',
        locationName: 'Mundra Port Container Terminal',
        status: 'COMPLETED',
        allocatedQuantity: 140,
        deliveredQuantity: 140,
        allocatedWeightMt: 28.0
      },
      {
        _id: 'trp_stp_2_2',
        sequence: 2,
        stopType: 'DELIVERY',
        locationName: 'Pune Chakan Auto Corridor Hub',
        status: 'PENDING',
        allocatedQuantity: 140,
        deliveredQuantity: 0,
        allocatedWeightMt: 28.0
      }
    ],
    expenses: [
      { _id: 'exp_4', category: 'FUEL', amount: 18400, notes: 'IOCL Mundra Exit' },
      { _id: 'exp_5', category: 'TOLL', amount: 3100, notes: 'Fastag Samakhiyali Toll' }
    ],
    totalExpenses: 21500,
    startedAt: new Date('2026-01-22T10:30:00.000Z')
  },
  {
    _id: '671e3b0f27d7a87e3cbb0072',
    companyId: defaultTenant._id,
    tripNumber: 'TRP-2026-003',
    loadId: {
      _id: defaultLoads[2]._id,
      loadNumber: defaultLoads[2].loadNumber
    },
    loadNumber: defaultLoads[2].loadNumber,
    vehicleId: {
      _id: defaultVehicles[2]._id,
      plateNumber: defaultVehicles[2].plateNumber,
      vehicleType: defaultVehicles[2].vehicleType,
      capacityTonnage: defaultVehicles[2].capacityTonnage
    },
    vehiclePlate: defaultVehicles[2].plateNumber,
    driverId: {
      _id: defaultDrivers[2]._id,
      name: defaultDrivers[2].name,
      phone: defaultDrivers[2].phone,
      licenseNumber: defaultDrivers[2].licenseNumber
    },
    driverName: defaultDrivers[2].name,
    driverPhone: defaultDrivers[2].phone,
    origin: 'Ahmedabad, Gujarat',
    destination: 'Delhi NCR, Haryana',
    status: 'IN_TRANSIT',
    odometerStart: 72100,
    totalDistanceKm: 950,
    currentLocation: 'NH-48 Near Jaipur Express Corridor, Speed: 58 km/h',
    stops: [
      {
        _id: 'trp_stp_3_1',
        sequence: 1,
        stopType: 'PICKUP',
        locationName: 'Ahmedabad Central Transport Hub',
        status: 'COMPLETED',
        allocatedQuantity: 8,
        deliveredQuantity: 8,
        allocatedWeightMt: 42.0
      },
      {
        _id: 'trp_stp_3_2',
        sequence: 2,
        stopType: 'DELIVERY',
        locationName: 'Delhi NCR Logistics Center',
        status: 'PENDING',
        allocatedQuantity: 8,
        deliveredQuantity: 0,
        allocatedWeightMt: 42.0
      }
    ],
    expenses: [
      { _id: 'exp_6', category: 'FUEL', amount: 22000, notes: 'BPCL Himatnagar Bypass' }
    ],
    totalExpenses: 22000,
    startedAt: new Date('2026-01-23T12:00:00.000Z')
  }
];

// Proof of Deliveries (POD)
const defaultPods = [
  {
    _id: '671e3b0f27d7a87e3cbb0080',
    companyId: defaultTenant._id,
    podNumber: 'POD-2026-0001',
    loadId: {
      _id: defaultLoads[0]._id,
      loadNumber: defaultLoads[0].loadNumber
    },
    loadNumber: defaultLoads[0].loadNumber,
    tripId: {
      _id: '671e3b0f27d7a87e3cbb0070',
      tripNumber: 'TRP-2026-001'
    },
    tripNumber: 'TRP-2026-001',
    status: 'VERIFIED',
    receivedBy: 'Gaurav Mehta (Warehouse Manager)',
    receiverPhone: '+91 98200 11990',
    quantityDelivered: 65,
    deliveredAt: new Date('2026-01-21T17:30:00.000Z'),
    verifiedAt: new Date('2026-01-21T19:00:00.000Z'),
    verifiedBy: 'Lead System Administrator',
    remarks: 'Goods delivered in sound condition. Clean receipt stamped without shortage or damage.',
    documentUrl: '/storage/demo/pod_signed_0001.pdf',
    fileName: 'pod_LD_2026_0001.pdf',
    createdAt: new Date('2026-01-21T17:45:00.000Z')
  },
  {
    _id: '671e3b0f27d7a87e3cbb0081',
    companyId: defaultTenant._id,
    podNumber: 'POD-2026-0002',
    loadId: {
      _id: defaultLoads[1]._id,
      loadNumber: defaultLoads[1].loadNumber
    },
    loadNumber: defaultLoads[1].loadNumber,
    tripId: {
      _id: '671e3b0f27d7a87e3cbb0071',
      tripNumber: 'TRP-2026-002'
    },
    tripNumber: 'TRP-2026-002',
    status: 'PENDING_VERIFICATION',
    quantityDelivered: 140,
    receivedBy: 'Ketan Trivedi (Security Gate)',
    receiverPhone: '+91 98250 77662',
    remarks: 'Consignment received at gate. Awaiting warehouse stamp verification.',
    documentUrl: '/storage/demo/pod_signed_0002.pdf',
    fileName: 'pod_LD_2026_0002.pdf',
    createdAt: new Date('2026-01-22T10:30:00.000Z')
  }
];

// Vehicle Maintenance Logs
const defaultMaintenance = [
  {
    _id: '671e3b0f27d7a87e3cbb0090',
    companyId: defaultTenant._id,
    maintenanceNumber: 'MAINT-2026-001',
    vehicleId: {
      _id: defaultVehicles[4]._id,
      plateNumber: defaultVehicles[4].plateNumber,
      vehicleType: defaultVehicles[4].vehicleType,
      make: defaultVehicles[4].make,
      model: defaultVehicles[4].model,
      status: defaultVehicles[4].status
    },
    vehiclePlate: defaultVehicles[4].plateNumber,
    serviceType: 'SCHEDULED_SERVICE',
    maintenanceType: 'SCHEDULED_SERVICE',
    priority: 'HIGH',
    serviceCenter: {
      name: 'Mahindra Trucks Authorized Workshop Narol',
      city: 'Ahmedabad',
      contactPhone: '+91 98251 00112'
    },
    cost: 18500,
    costPaise: 1850000,
    odometer: 64200,
    odometerReadingKm: 64200,
    status: 'IN_PROGRESS',
    description: 'Engine oil replacement, fuel filter overhaul, transmission fluid check and brake adjustment.',
    scheduledDate: '2026-01-25',
    createdAt: new Date('2026-01-24T10:00:00.000Z')
  },
  {
    _id: '671e3b0f27d7a87e3cbb0091',
    companyId: defaultTenant._id,
    maintenanceNumber: 'MAINT-2026-002',
    vehicleId: {
      _id: defaultVehicles[0]._id,
      plateNumber: defaultVehicles[0].plateNumber,
      vehicleType: defaultVehicles[0].vehicleType,
      make: defaultVehicles[0].make,
      model: defaultVehicles[0].model,
      status: defaultVehicles[0].status
    },
    vehiclePlate: defaultVehicles[0].plateNumber,
    serviceType: 'PREVENTIVE',
    maintenanceType: 'PREVENTIVE',
    priority: 'MEDIUM',
    serviceCenter: {
      name: 'Tata Commercial Service Hub Sanand',
      city: 'Ahmedabad',
      contactPhone: '+91 98251 00334'
    },
    cost: 12400,
    costPaise: 1240000,
    odometer: 141000,
    odometerReadingKm: 141000,
    status: 'COMPLETED',
    description: 'Heavy duty brake pad replacement and wheel alignment inspection.',
    scheduledDate: '2026-01-18',
    completedDate: '2026-01-18',
    createdAt: new Date('2026-01-17T09:00:00.000Z')
  }
];

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

    return {
      loads: {
        total: totalLoads,
        today: 4,
        byStatus: {
          CREATED: this.loads.filter((l) => l.status === 'CREATED').length,
          VEHICLE_ASSIGNED: this.loads.filter((l) => l.status === 'VEHICLE_ASSIGNED').length,
          IN_TRANSIT: this.loads.filter((l) => l.status === 'IN_TRANSIT').length,
          DELIVERED: this.loads.filter((l) => l.status === 'DELIVERED').length,
          CANCELLED: 0
        },
        totalWeightMt: this.loads.reduce((sum, l) => sum + (l.weightMt || 0), 0)
      },
      trips: {
        total: this.trips.length,
        active: activeTrips,
        closed: this.trips.filter((t) => t.status === 'CLOSED').length,
        byStatus: {
          CREATED: 0,
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
        expired: 0,
        expiring15Days: 1,
        expiring30Days: 2,
        vehicles: { expired: 0, expiring15: 1, expiring30: 1 },
        drivers: { expired: 0, expiring15: 0, expiring30: 1 }
      },
      pod: {
        pendingSubmission: this.pods.filter((p) => p.status === 'PENDING_SUBMISSION').length,
        pendingVerification: this.pods.filter((p) => p.status === 'SUBMITTED').length,
        verified: this.pods.filter((p) => p.status === 'VERIFIED').length,
        rejected: 0
      },
      whatsapp: {
        total: 48,
        successful: 47,
        failed: 1,
        deliverySuccessRate: 98
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
