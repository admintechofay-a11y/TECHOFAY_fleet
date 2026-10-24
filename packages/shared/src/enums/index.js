/**
 * System Enums for RBAC, Modules, and Lifecycle States
 */

const UserRole = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  TRANSPORT_MANAGER: 'transport_manager',
  FLEET_MANAGER: 'fleet_manager',
  OPERATIONS_MANAGER: 'operations_manager',
  DATA_ENTRY: 'data_entry',
  ACCOUNTS: 'accounts',
  MANAGEMENT: 'management'
});

const SystemModule = Object.freeze({
  AUTH: 'auth',
  USERS: 'users',
  ROLES: 'roles',
  LOADS: 'loads',
  LR: 'lr',
  BILTIES: 'bilties',
  TRIPS: 'trips',
  VEHICLES: 'vehicles',
  VEHICLE_DOCS: 'vehicle_docs',
  DRIVERS: 'drivers',
  DRIVER_DOCS: 'driver_docs',
  CUSTOMERS: 'customers',
  LOCATIONS: 'locations',
  BILLING: 'billing',
  POD: 'pod',
  DOCUMENTS: 'documents',
  WHATSAPP: 'whatsapp',
  REPORTS: 'reports',
  IMPORT_EXPORT: 'import_export',
  SETTINGS: 'settings',
  AUDIT: 'audit'
});

const ActionPermission = Object.freeze({
  VIEW: 'view',
  ADD: 'add',
  EDIT: 'edit',
  DELETE: 'delete',
  ADMIN: 'admin',
  EXPORT: 'export'
});

const AuditAction = Object.freeze({
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  STATUS_CHANGE: 'STATUS_CHANGE',
  PASSWORD_RESET: 'PASSWORD_RESET',
  EXPORT: 'EXPORT'
});

const VehicleStatus = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  ASSIGNED: 'ASSIGNED',
  ON_TRIP: 'ON_TRIP',
  UNDER_MAINTENANCE: 'UNDER_MAINTENANCE',
  INACTIVE: 'INACTIVE',
  OUT_OF_SERVICE: 'OUT_OF_SERVICE'
});

const DriverStatus = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  ASSIGNED: 'ASSIGNED',
  ON_TRIP: 'ON_TRIP',
  ON_LEAVE: 'ON_LEAVE',
  INACTIVE: 'INACTIVE'
});

const LoadStatus = Object.freeze({
  CREATED: 'CREATED',
  ASSIGNED: 'ASSIGNED',
  LOADING: 'LOADING',
  IN_TRANSIT: 'IN_TRANSIT',
  PARTIALLY_DELIVERED: 'PARTIALLY_DELIVERED',
  DELIVERED: 'DELIVERED',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED'
});

const LrStatus = Object.freeze({
  BOOKED: 'BOOKED',
  LOADED: 'LOADED',
  IN_TRANSIT: 'IN_TRANSIT',
  PARTIALLY_DELIVERED: 'PARTIALLY_DELIVERED',
  DELIVERED: 'DELIVERED',
  POD_CLOSED: 'POD_CLOSED',
  CANCELLED: 'CANCELLED'
});

const TripStatus = Object.freeze({
  CREATED: 'CREATED',
  VEHICLE_ASSIGNED: 'VEHICLE_ASSIGNED',
  LOADING: 'LOADING',
  IN_TRANSIT: 'IN_TRANSIT',
  PARTIALLY_DELIVERED: 'PARTIALLY_DELIVERED',
  DELIVERED: 'DELIVERED',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED'
});

const ComplianceStatus = Object.freeze({
  VALID: 'VALID',
  EXPIRING_SOON: 'EXPIRING_SOON',
  EXPIRED: 'EXPIRED',
  MISSING: 'MISSING'
});

const PartyType = Object.freeze({
  CUSTOMER: 'CUSTOMER',
  CONSIGNOR: 'CONSIGNOR',
  CONSIGNEE: 'CONSIGNEE',
  TRANSPORTER: 'TRANSPORTER',
  BOTH: 'BOTH'
});

const LocationType = Object.freeze({
  HUB: 'HUB',
  PICKUP: 'PICKUP',
  DELIVERY: 'DELIVERY',
  WAYPOINT: 'WAYPOINT'
});

const VehicleCategory = Object.freeze({
  OWNED: 'OWNED',
  ATTACHED: 'ATTACHED',
  MARKET: 'MARKET'
});

const VehicleDocumentType = Object.freeze({
  RC: 'RC',
  INSURANCE: 'INSURANCE',
  PUC: 'PUC',
  FITNESS: 'FITNESS',
  NATIONAL_PERMIT: 'NATIONAL_PERMIT',
  STATE_PERMIT: 'STATE_PERMIT',
  TAX_RECEIPT: 'TAX_RECEIPT',
  OTHER: 'OTHER'
});

const DriverLicenseType = Object.freeze({
  LMV: 'LMV',
  HMV: 'HMV',
  TRANS: 'TRANS',
  TRAILER: 'TRAILER'
});

const DriverDocumentType = Object.freeze({
  DRIVING_LICENCE: 'DRIVING_LICENCE',
  AADHAAR: 'AADHAAR',
  PAN: 'PAN',
  POLICE_VERIFICATION: 'POLICE_VERIFICATION',
  MEDICAL_FITNESS: 'MEDICAL_FITNESS',
  OTHER: 'OTHER'
});

const NotificationCategory = Object.freeze({
  DOCUMENT_EXPIRY: 'DOCUMENT_EXPIRY',
  SYSTEM: 'SYSTEM',
  TRIP_ALERT: 'TRIP_ALERT'
});

const NotificationSeverity = Object.freeze({
  INFO: 'INFO',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL'
});

const BiltyStatus = Object.freeze({
  DRAFT: 'DRAFT',
  ISSUED: 'ISSUED',
  CANCELLED: 'CANCELLED'
});

const StopType = Object.freeze({
  PICKUP: 'PICKUP',
  DELIVERY: 'DELIVERY',
  WAYPOINT: 'WAYPOINT'
});

const StopStatus = Object.freeze({
  PENDING: 'PENDING',
  ARRIVED: 'ARRIVED',
  LOADING: 'LOADING',
  UNLOADING: 'UNLOADING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED'
});

const PaymentTerms = Object.freeze({
  TO_PAY: 'TO_PAY',
  PAID: 'PAID',
  TO_BE_BILLED: 'TO_BE_BILLED'
});

const TripExpenseType = Object.freeze({
  DIESEL: 'DIESEL',
  TOLL: 'TOLL',
  DRIVER_BHATTA: 'DRIVER_BHATTA',
  POLICE_CHALLAN: 'POLICE_CHALLAN',
  MAINTENANCE: 'MAINTENANCE',
  LOADING_UNLOADING: 'LOADING_UNLOADING',
  OTHER: 'OTHER'
});

const PodStatus = Object.freeze({
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED'
});

module.exports = {
  UserRole,
  SystemModule,
  ActionPermission,
  AuditAction,
  VehicleStatus,
  DriverStatus,
  LoadStatus,
  LrStatus,
  TripStatus,
  ComplianceStatus,
  PartyType,
  LocationType,
  VehicleCategory,
  VehicleDocumentType,
  DriverLicenseType,
  DriverDocumentType,
  NotificationCategory,
  NotificationSeverity,
  BiltyStatus,
  StopType,
  StopStatus,
  PaymentTerms,
  TripExpenseType,
  PodStatus
};
