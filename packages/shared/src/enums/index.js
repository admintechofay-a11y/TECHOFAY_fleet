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
  ComplianceStatus
};
