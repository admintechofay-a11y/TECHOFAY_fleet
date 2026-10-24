/**
 * Admin Settings Service
 * Manages organization details, operational parameters, GST settings, and branding.
 */

const Company = require('../../auth/models/Company');
const AuditLogService = require('../../audit/services/auditLog.service');
const { AppError } = require('../../../middleware/errorHandler');

class SettingsService {
  /**
   * Retrieves company profile and system settings
   * @param {string|ObjectId} companyId
   */
  static async getSettings(companyId) {
    const company = await Company.findById(companyId);
    if (!company) {
      throw new AppError('Organization not found', 404);
    }

    return {
      companyId: company._id,
      legalName: company.legalName,
      tradeName: company.tradeName,
      gstin: company.gstin,
      pan: company.pan,
      email: company.email,
      phone: company.phone,
      address: company.address || {
        street: '',
        city: '',
        state: '',
        pincode: '',
        country: 'IN'
      },
      settings: {
        timezone: company.settings?.timezone || 'Asia/Kolkata',
        currency: company.settings?.currency || 'INR',
        weightUnit: company.settings?.weightUnit || 'MT',
        distanceUnit: company.settings?.distanceUnit || 'KM',
        defaultGtaGstRate: company.settings?.defaultGtaGstRate ?? 5.0,
        defaultGtaSacCode: company.settings?.defaultGtaSacCode || '9965',
        prefixes: {
          load: 'LD',
          lr: 'LR',
          bilty: 'BL',
          trip: 'TR'
        }
      },
      branding: company.branding || {
        logoUrl: '',
        letterheadHeaderUrl: '',
        authorizedSignatoryUrl: ''
      },
      updatedAt: company.updatedAt
    };
  }

  /**
   * Updates company profile and operational preferences
   * @param {string|ObjectId} companyId
   * @param {Object} updateData
   * @param {string} actorId
   * @param {string} ipAddress
   */
  static async updateSettings(companyId, updateData, actorId = null, ipAddress = '') {
    const company = await Company.findById(companyId);
    if (!company) {
      throw new AppError('Organization not found', 404);
    }

    const oldValues = {
      legalName: company.legalName,
      tradeName: company.tradeName,
      gstin: company.gstin,
      email: company.email,
      phone: company.phone,
      settings: company.settings
    };

    // Validate GSTIN if modified
    if (updateData.gstin) {
      const gstinClean = updateData.gstin.trim().toUpperCase();
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinRegex.test(gstinClean)) {
        throw new AppError('Invalid GSTIN format. Must be a 15-character valid Indian GSTIN.', 400);
      }
      company.gstin = gstinClean;
    }

    if (updateData.legalName) company.legalName = updateData.legalName.trim();
    if (updateData.tradeName) company.tradeName = updateData.tradeName.trim();
    if (updateData.pan) company.pan = updateData.pan.trim().toUpperCase();
    if (updateData.email) company.email = updateData.email.trim().toLowerCase();
    if (updateData.phone) company.phone = updateData.phone.trim();

    if (updateData.address) {
      company.address = {
        ...company.address.toObject(),
        ...updateData.address
      };
    }

    if (updateData.settings) {
      company.settings = {
        ...company.settings.toObject(),
        ...updateData.settings
      };
    }

    if (updateData.branding) {
      company.branding = {
        ...company.branding.toObject(),
        ...updateData.branding
      };
    }

    await company.save();

    // Record Audit Log
    await AuditLogService.log({
      companyId: company._id,
      actorId,
      module: 'settings',
      action: 'UPDATE',
      entityId: company._id,
      oldValues,
      newValues: {
        legalName: company.legalName,
        tradeName: company.tradeName,
        gstin: company.gstin,
        email: company.email,
        phone: company.phone,
        settings: company.settings
      },
      ipAddress
    });

    return this.getSettings(company._id);
  }
}

module.exports = SettingsService;
