/**
 * Document Compliance & Expiry Monitoring Service
 * Audits vehicle & driver regulatory documents, monitors 30/15/7 day expiry thresholds,
 * and generates deduplicated in-app operational alerts.
 */

const Vehicle = require('../../vehicles/models/Vehicle');
const VehicleDocument = require('../../vehicles/models/VehicleDocument');
const Driver = require('../../drivers/models/Driver');
const DriverDocument = require('../../drivers/models/DriverDocument');
const InAppNotification = require('../models/InAppNotification');
const { ComplianceStatus, NotificationCategory, NotificationSeverity } = require('@fleet/shared');

// Mandatory regulatory documents required for commercial transport vehicles
const MANDATORY_VEHICLE_DOCS = ['RC', 'INSURANCE', 'PUC', 'FITNESS'];

class ComplianceService {
  /**
   * Run automated compliance scan across all vehicles and drivers for a company
   */
  async runTenantComplianceCheck(companyId, referenceDate = new Date()) {
    const today = referenceDate.toISOString().split('T')[0];
    let notificationsCreated = 0;

    // 1. Scan Vehicle Documents
    const vehicleDocs = await VehicleDocument.find({
      companyId,
      isActive: true
    }).populate('vehicleId', 'plateNumber make model');

    for (const doc of vehicleDocs) {
      if (!doc.vehicleId) continue;

      const previousStatus = doc.complianceStatus;
      const currentStatus = doc.calculateComplianceStatus(referenceDate);

      if (previousStatus !== currentStatus) {
        doc.complianceStatus = currentStatus;
        await doc.save();
      }

      if (currentStatus === ComplianceStatus.EXPIRED || currentStatus === ComplianceStatus.EXPIRING_SOON) {
        const isExpired = currentStatus === ComplianceStatus.EXPIRED;
        const dedupKey = `EXPIRY:VEHICLE_DOC:${doc._id}:${today}`;
        const severity = isExpired ? NotificationSeverity.CRITICAL : NotificationSeverity.WARNING;
        const plate = doc.vehicleId.plateNumber;
        const expiryFormatted = doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString('en-IN') : 'N/A';

        const title = isExpired
          ? `Vehicle ${plate} Document Expired`
          : `Vehicle ${plate} Document Expiring Soon`;

        const message = isExpired
          ? `The ${doc.documentType} for vehicle ${plate} expired on ${expiryFormatted}. Vehicle must not be dispatched until renewed.`
          : `The ${doc.documentType} for vehicle ${plate} is expiring on ${expiryFormatted}. Please initiate renewal.`;

        const result = await InAppNotification.updateOne(
          { companyId, dedupKey },
          {
            $setOnInsert: {
              companyId,
              title,
              message,
              category: NotificationCategory.DOCUMENT_EXPIRY,
              severity,
              entityType: 'VEHICLE_DOC',
              entityId: doc.vehicleId._id,
              dedupKey,
              isRead: false
            }
          },
          { upsert: true }
        );

        if (result.upsertedCount > 0) {
          notificationsCreated++;
        }
      }
    }

    // 2. Scan Drivers (Licence Expiry & Documents)
    const drivers = await Driver.find({ companyId, isActive: true });

    for (const driver of drivers) {
      const expiry = new Date(driver.licenseExpiryDate);
      const diffMs = expiry.getTime() - referenceDate.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays <= 30) {
        const isExpired = diffDays < 0;
        const dedupKey = `EXPIRY:DRIVER_LICENCE:${driver._id}:${today}`;
        const severity = isExpired ? NotificationSeverity.CRITICAL : NotificationSeverity.WARNING;
        const expiryFormatted = expiry.toLocaleDateString('en-IN');

        const title = isExpired
          ? `Driver ${driver.name} Driving Licence Expired`
          : `Driver ${driver.name} Driving Licence Expiring Soon`;

        const message = isExpired
          ? `Driving licence (${driver.licenseNumber}) for driver ${driver.name} expired on ${expiryFormatted}. Driver cannot be assigned to trips.`
          : `Driving licence (${driver.licenseNumber}) for driver ${driver.name} will expire on ${expiryFormatted}.`;

        const result = await InAppNotification.updateOne(
          { companyId, dedupKey },
          {
            $setOnInsert: {
              companyId,
              title,
              message,
              category: NotificationCategory.DOCUMENT_EXPIRY,
              severity,
              entityType: 'DRIVER',
              entityId: driver._id,
              dedupKey,
              isRead: false
            }
          },
          { upsert: true }
        );

        if (result.upsertedCount > 0) {
          notificationsCreated++;
        }
      }
    }

    return {
      scannedVehicleDocuments: vehicleDocs.length,
      scannedDrivers: drivers.length,
      notificationsCreated
    };
  }

  /**
   * Get high-level compliance dashboard statistics for the tenant
   */
  async getComplianceOverview(companyId, referenceDate = new Date()) {
    const totalVehicles = await Vehicle.countDocuments({ companyId, isActive: true });
    const totalDrivers = await Driver.countDocuments({ companyId, isActive: true });

    // Aggregate vehicle document counts by status
    const vehicleDocs = await VehicleDocument.find({ companyId, isActive: true });
    let validDocCount = 0;
    let expiringSoonDocCount = 0;
    let expiredDocCount = 0;

    vehicleDocs.forEach(doc => {
      const status = doc.calculateComplianceStatus(referenceDate);
      if (status === ComplianceStatus.VALID) validDocCount++;
      else if (status === ComplianceStatus.EXPIRING_SOON) expiringSoonDocCount++;
      else if (status === ComplianceStatus.EXPIRED) expiredDocCount++;
    });

    // Drivers expiring soon or expired
    const drivers = await Driver.find({ companyId, isActive: true });
    let driverExpiringSoon = 0;
    let driverExpired = 0;

    drivers.forEach(driver => {
      const diffMs = new Date(driver.licenseExpiryDate).getTime() - referenceDate.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays < 0) driverExpired++;
      else if (diffDays <= 30) driverExpiringSoon++;
    });

    // Unread compliance alerts
    const unreadAlerts = await InAppNotification.find({
      companyId,
      isRead: false
    })
      .sort({ createdAt: -1 })
      .limit(10);

    return {
      totalVehicles,
      totalDrivers,
      documents: {
        total: vehicleDocs.length,
        valid: validDocCount,
        expiringSoon: expiringSoonDocCount,
        expired: expiredDocCount
      },
      drivers: {
        total: totalDrivers,
        valid: totalDrivers - driverExpiringSoon - driverExpired,
        expiringSoon: driverExpiringSoon,
        expired: driverExpired
      },
      unreadAlerts
    };
  }
}

module.exports = new ComplianceService();
