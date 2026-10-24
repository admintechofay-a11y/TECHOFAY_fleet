/**
 * System Roles & Organization Bootstrapper
 * Populates system roles according to docs/ROLE_PERMISSION_MATRIX.md
 */

const Company = require('../models/Company');
const Role = require('../models/Role');
const User = require('../models/User');
const { UserRole, SystemModule, ActionPermission } = require('@fleet/shared');

// Default permission matrix definition based on docs/ROLE_PERMISSION_MATRIX.md
const SYSTEM_ROLES_DEFINITIONS = [
  {
    name: 'Super Administrator',
    slug: UserRole.SUPER_ADMIN,
    description: 'Full master access across all system modules, settings, and audit logs',
    isSystemRole: true,
    permissions: Object.values(SystemModule).map((mod) => ({
      module: mod,
      actions: Object.values(ActionPermission)
    }))
  },
  {
    name: 'Administrator',
    slug: UserRole.ADMIN,
    description: 'Operational administration, master data, user management, and reporting',
    isSystemRole: true,
    permissions: [
      { module: SystemModule.AUTH, actions: ['view', 'edit'] },
      { module: SystemModule.USERS, actions: ['view', 'add', 'edit'] },
      { module: SystemModule.ROLES, actions: ['view', 'add', 'edit'] },
      { module: SystemModule.LOADS, actions: ['view', 'add', 'edit', 'delete', 'export'] },
      { module: SystemModule.LR, actions: ['view', 'add', 'edit', 'delete', 'export'] },
      { module: SystemModule.BILTIES, actions: ['view', 'add', 'edit', 'delete', 'export'] },
      { module: SystemModule.TRIPS, actions: ['view', 'add', 'edit', 'delete', 'export'] },
      { module: SystemModule.VEHICLES, actions: ['view', 'add', 'edit', 'delete', 'export'] },
      { module: SystemModule.VEHICLE_DOCS, actions: ['view', 'add', 'edit', 'delete', 'export'] },
      { module: SystemModule.DRIVERS, actions: ['view', 'add', 'edit', 'delete', 'export'] },
      { module: SystemModule.DRIVER_DOCS, actions: ['view', 'add', 'edit', 'delete', 'export'] },
      { module: SystemModule.CUSTOMERS, actions: ['view', 'add', 'edit', 'delete', 'export'] },
      { module: SystemModule.LOCATIONS, actions: ['view', 'add', 'edit', 'delete', 'export'] },
      { module: SystemModule.BILLING, actions: ['view', 'add', 'edit', 'export'] },
      { module: SystemModule.POD, actions: ['view', 'add', 'edit', 'delete', 'export'] },
      { module: SystemModule.DOCUMENTS, actions: ['view', 'add', 'export'] },
      { module: SystemModule.WHATSAPP, actions: ['view', 'add', 'export'] },
      { module: SystemModule.REPORTS, actions: ['view', 'export'] },
      { module: SystemModule.SETTINGS, actions: ['view', 'edit'] },
      { module: SystemModule.AUDIT, actions: ['view', 'export'] }
    ]
  },
  {
    name: 'Transport Manager',
    slug: UserRole.TRANSPORT_MANAGER,
    description: 'Full transport operations, loads, LR, Bilties, and trip dispatch',
    isSystemRole: true,
    permissions: [
      { module: SystemModule.AUTH, actions: ['view', 'edit'] },
      { module: SystemModule.LOADS, actions: ['view', 'add', 'edit', 'export'] },
      { module: SystemModule.LR, actions: ['view', 'add', 'edit', 'export'] },
      { module: SystemModule.BILTIES, actions: ['view', 'add', 'edit', 'export'] },
      { module: SystemModule.TRIPS, actions: ['view', 'add', 'edit', 'export'] },
      { module: SystemModule.VEHICLES, actions: ['view'] },
      { module: SystemModule.VEHICLE_DOCS, actions: ['view'] },
      { module: SystemModule.DRIVERS, actions: ['view'] },
      { module: SystemModule.DRIVER_DOCS, actions: ['view'] },
      { module: SystemModule.CUSTOMERS, actions: ['view', 'add', 'edit'] },
      { module: SystemModule.LOCATIONS, actions: ['view', 'add', 'edit'] },
      { module: SystemModule.BILLING, actions: ['view', 'add'] },
      { module: SystemModule.POD, actions: ['view', 'add', 'edit'] },
      { module: SystemModule.DOCUMENTS, actions: ['view', 'add', 'export'] },
      { module: SystemModule.WHATSAPP, actions: ['view', 'add'] },
      { module: SystemModule.REPORTS, actions: ['view', 'export'] }
    ]
  },
  {
    name: 'Fleet Manager',
    slug: UserRole.FLEET_MANAGER,
    description: 'Vehicle fleet registry, maintenance, driver compliance and document expiry tracking',
    isSystemRole: true,
    permissions: [
      { module: SystemModule.AUTH, actions: ['view', 'edit'] },
      { module: SystemModule.LOADS, actions: ['view'] },
      { module: SystemModule.LR, actions: ['view'] },
      { module: SystemModule.TRIPS, actions: ['view', 'edit'] },
      { module: SystemModule.VEHICLES, actions: ['view', 'add', 'edit', 'delete', 'export'] },
      { module: SystemModule.VEHICLE_DOCS, actions: ['view', 'add', 'edit', 'delete', 'export'] },
      { module: SystemModule.DRIVERS, actions: ['view', 'add', 'edit', 'delete', 'export'] },
      { module: SystemModule.DRIVER_DOCS, actions: ['view', 'add', 'edit', 'delete', 'export'] },
      { module: SystemModule.POD, actions: ['view'] },
      { module: SystemModule.DOCUMENTS, actions: ['view', 'export'] },
      { module: SystemModule.REPORTS, actions: ['view', 'export'] }
    ]
  },
  {
    name: 'Operations Manager',
    slug: UserRole.OPERATIONS_MANAGER,
    description: 'Load stops, waypoints, arrival/dispatch, and stop-wise POD verification',
    isSystemRole: true,
    permissions: [
      { module: SystemModule.AUTH, actions: ['view', 'edit'] },
      { module: SystemModule.LOADS, actions: ['view', 'add', 'edit'] },
      { module: SystemModule.LR, actions: ['view', 'add', 'edit'] },
      { module: SystemModule.BILTIES, actions: ['view'] },
      { module: SystemModule.TRIPS, actions: ['view', 'add', 'edit'] },
      { module: SystemModule.VEHICLES, actions: ['view'] },
      { module: SystemModule.DRIVERS, actions: ['view'] },
      { module: SystemModule.CUSTOMERS, actions: ['view', 'add'] },
      { module: SystemModule.LOCATIONS, actions: ['view', 'add', 'edit'] },
      { module: SystemModule.POD, actions: ['view', 'add', 'edit', 'admin'] },
      { module: SystemModule.DOCUMENTS, actions: ['view', 'add', 'export'] },
      { module: SystemModule.WHATSAPP, actions: ['view', 'add'] },
      { module: SystemModule.REPORTS, actions: ['view', 'export'] }
    ]
  },
  {
    name: 'Data Entry Operator',
    slug: UserRole.DATA_ENTRY,
    description: 'Routine entry of loads, locations, customers, and master records',
    isSystemRole: true,
    permissions: [
      { module: SystemModule.AUTH, actions: ['view', 'edit'] },
      { module: SystemModule.LOADS, actions: ['view', 'add'] },
      { module: SystemModule.LR, actions: ['view', 'add'] },
      { module: SystemModule.BILTIES, actions: ['view', 'add'] },
      { module: SystemModule.VEHICLES, actions: ['view', 'add'] },
      { module: SystemModule.VEHICLE_DOCS, actions: ['view', 'add'] },
      { module: SystemModule.DRIVERS, actions: ['view', 'add'] },
      { module: SystemModule.DRIVER_DOCS, actions: ['view', 'add'] },
      { module: SystemModule.CUSTOMERS, actions: ['view', 'add'] },
      { module: SystemModule.LOCATIONS, actions: ['view', 'add'] },
      { module: SystemModule.POD, actions: ['view', 'add'] },
      { module: SystemModule.DOCUMENTS, actions: ['view'] }
    ]
  },
  {
    name: 'Accounts User',
    slug: UserRole.ACCOUNTS,
    description: 'Financial ledger, freight calculations, statements, advances, and payment tracking',
    isSystemRole: true,
    permissions: [
      { module: SystemModule.AUTH, actions: ['view', 'edit'] },
      { module: SystemModule.LOADS, actions: ['view', 'export'] },
      { module: SystemModule.LR, actions: ['view', 'export'] },
      { module: SystemModule.BILTIES, actions: ['view', 'add', 'edit', 'export'] },
      { module: SystemModule.TRIPS, actions: ['view'] },
      { module: SystemModule.CUSTOMERS, actions: ['view', 'add', 'edit', 'export'] },
      { module: SystemModule.BILLING, actions: ['view', 'add', 'edit', 'export', 'admin'] },
      { module: SystemModule.POD, actions: ['view', 'edit'] },
      { module: SystemModule.DOCUMENTS, actions: ['view', 'add', 'export'] },
      { module: SystemModule.REPORTS, actions: ['view', 'export'] }
    ]
  },
  {
    name: 'Management User',
    slug: UserRole.MANAGEMENT,
    description: 'Executive read-only visibility into operational dashboards, reports, and analytics',
    isSystemRole: true,
    permissions: [
      { module: SystemModule.AUTH, actions: ['view', 'edit'] },
      { module: SystemModule.LOADS, actions: ['view', 'export'] },
      { module: SystemModule.LR, actions: ['view', 'export'] },
      { module: SystemModule.BILTIES, actions: ['view', 'export'] },
      { module: SystemModule.TRIPS, actions: ['view', 'export'] },
      { module: SystemModule.VEHICLES, actions: ['view', 'export'] },
      { module: SystemModule.DRIVERS, actions: ['view', 'export'] },
      { module: SystemModule.CUSTOMERS, actions: ['view', 'export'] },
      { module: SystemModule.BILLING, actions: ['view', 'export'] },
      { module: SystemModule.POD, actions: ['view', 'export'] },
      { module: SystemModule.DOCUMENTS, actions: ['view', 'export'] },
      { module: SystemModule.REPORTS, actions: ['view', 'export'] },
      { module: SystemModule.AUDIT, actions: ['view'] }
    ]
  }
];

class BootstrapService {
  /**
   * Bootstraps company, default roles, and super admin user
   */
  static async bootstrapSystem({
    companyLegalName = 'Techofay Global Logistics Pvt Ltd',
    tradeName,
    companyGstin = '24AAACT1234A1Z5',
    adminEmail = 'admin@technofay.com',
    adminPassword = 'change_on_first_login_secure_password',
    adminName = 'System Super Administrator',
    phone = '+91 98765 43210',
    address
  } = {}) {
    // 1. Ensure or create Company
    let company = await Company.findOne({ gstin: companyGstin });
    if (!company) {
      company = await Company.create({
        legalName: companyLegalName,
        tradeName: tradeName || (companyLegalName === 'Techofay Global Logistics Pvt Ltd' ? 'Techofay Transport' : companyLegalName),
        gstin: companyGstin,
        pan: companyGstin.length >= 12 ? companyGstin.substring(2, 12) : 'AAACT1234A',
        email: adminEmail || 'dispatch@technofay.com',
        phone: phone || '+91 98765 43210',
        address: {
          street: address?.street || 'Transport Hub Complex, Sarkhej-Bavla Highway',
          city: address?.city || 'Ahmedabad',
          state: address?.state || 'Gujarat',
          pincode: address?.pincode || '382210',
          country: address?.country || 'IN'
        },
        settings: {
          timezone: 'Asia/Kolkata',
          currency: 'INR',
          defaultGtaGstRate: 5.0,
          defaultGtaSacCode: '9965'
        }
      });
      console.log(`[BOOTSTRAP] Created default organization: ${company.legalName}`);
    }

    // 2. Ensure or create System Roles for this company
    const roleMap = {};
    for (const def of SYSTEM_ROLES_DEFINITIONS) {
      let role = await Role.findOne({ companyId: company._id, slug: def.slug });
      if (!role) {
        role = await Role.create({
          companyId: company._id,
          name: def.name,
          slug: def.slug,
          description: def.description,
          isSystemRole: def.isSystemRole,
          permissions: def.permissions
        });
      }
      roleMap[def.slug] = role;
    }
    console.log(`[BOOTSTRAP] Verified ${Object.keys(roleMap).length} system roles for ${company.tradeName}`);

    // 3. Ensure or create Super Admin User
    const superAdminRole = roleMap[UserRole.SUPER_ADMIN];
    let superAdmin = await User.findOne({ companyId: company._id, email: adminEmail.toLowerCase() });
    if (!superAdmin) {
      superAdmin = await User.create({
        companyId: company._id,
        name: adminName,
        email: adminEmail.toLowerCase(),
        passwordHash: adminPassword, // Pre-save hook will bcrypt hash
        phone: phone || '+91 98765 43210',
        roleId: superAdminRole._id,
        isActive: true
      });
      console.log(`[BOOTSTRAP] Created Super Administrator: ${superAdmin.email}`);
    }

    return { company, roles: roleMap, superAdmin };
  }
}

module.exports = BootstrapService;
