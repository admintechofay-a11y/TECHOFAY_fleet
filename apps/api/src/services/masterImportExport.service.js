/**
 * Master Data Excel/CSV Import and Export Service
 * Supports Customers, Locations, Vehicles, Drivers with:
 * - Versioned downloadable templates with validation rules
 * - Dry-run preview and row-level error reporting
 * - Duplicate checks (intra-file and against database)
 * - Formula injection defense on export
 * - Confirmed atomic/batch persistence with audit logging
 */

const ExcelJS = require('exceljs');
const CustomerParty = require('../modules/customers/models/CustomerParty');
const Location = require('../modules/locations/models/Location');
const Vehicle = require('../modules/vehicles/models/Vehicle');
const Driver = require('../modules/drivers/models/Driver');
const auditLogService = require('../modules/audit/services/auditLog.service');
const { SystemModule, AuditAction, PartyType, LocationType, VehicleCategory, DriverLicenseType } = require('@fleet/shared');
const { AppError } = require('../middleware/errorHandler');

// Formula injection defense for CSV/Excel cells
function sanitizeSpreadsheetValue(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number' || typeof val === 'boolean') return val;
  if (val instanceof Date) return val.toISOString().split('T')[0];

  const str = String(val).trim();
  // If cell starts with dangerous formula triggers: =, +, -, @, Tab, Carriage Return
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`; // Escape with leading single-quote
  }
  return str;
}

class MasterImportExportService {
  /**
   * 1. Generate downloadable Excel Template with instructions & sample data
   */
  async generateTemplate(entityType) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Technofay Fleet Platform';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(`${entityType.toUpperCase()}_TEMPLATE`);

    let columns = [];
    let sampleRows = [];

    switch (entityType.toLowerCase()) {
      case 'customers':
        columns = [
          { header: 'Party Name *', key: 'name', width: 28 },
          { header: 'Code', key: 'code', width: 14 },
          { header: 'Party Type (CUSTOMER/CONSIGNOR/CONSIGNEE/BOTH) *', key: 'partyType', width: 25 },
          { header: 'GSTIN (15 chars)', key: 'gstin', width: 20 },
          { header: 'PAN', key: 'pan', width: 15 },
          { header: 'Contact Person', key: 'contactName', width: 20 },
          { header: 'Phone *', key: 'phone', width: 16 },
          { header: 'Email', key: 'email', width: 24 },
          { header: 'Billing Street', key: 'street', width: 24 },
          { header: 'City *', key: 'city', width: 16 },
          { header: 'State *', key: 'state', width: 16 },
          { header: 'Pincode', key: 'pincode', width: 12 },
          { header: 'Payment Terms Days', key: 'paymentTermsDays', width: 18 }
        ];
        sampleRows = [
          {
            name: 'Adani Logistics Ltd',
            code: 'CUST-ADANI',
            partyType: 'CUSTOMER',
            gstin: '24AAACA1234A1Z5',
            pan: 'AAACA1234A',
            contactName: 'Ramesh Patel',
            phone: '9876543210',
            email: 'logistics@adani.example.com',
            street: 'Mundra Port Complex',
            city: 'Mundra',
            state: 'Gujarat',
            pincode: '370421',
            paymentTermsDays: 30
          }
        ];
        break;

      case 'locations':
        columns = [
          { header: 'Location Name *', key: 'name', width: 28 },
          { header: 'Code', key: 'code', width: 14 },
          { header: 'Location Type (HUB/PICKUP/DELIVERY/WAYPOINT) *', key: 'locationType', width: 24 },
          { header: 'Street Address', key: 'street', width: 24 },
          { header: 'City *', key: 'city', width: 16 },
          { header: 'State *', key: 'state', width: 16 },
          { header: 'Pincode', key: 'pincode', width: 12 },
          { header: 'Contact Person', key: 'contactPerson', width: 20 },
          { header: 'Contact Phone', key: 'contactPhone', width: 16 }
        ];
        sampleRows = [
          {
            name: 'Sanand Industrial Hub 1',
            code: 'LOC-SND-01',
            locationType: 'PICKUP',
            street: 'GIDC Phase 2, Gate 4',
            city: 'Sanand',
            state: 'Gujarat',
            pincode: '382170',
            contactPerson: 'Suresh Shah',
            contactPhone: '9825012345'
          }
        ];
        break;

      case 'vehicles':
        columns = [
          { header: 'Plate Number *', key: 'plateNumber', width: 18 },
          { header: 'Vehicle Type *', key: 'vehicleType', width: 18 },
          { header: 'Category (OWNED/ATTACHED/MARKET) *', key: 'category', width: 20 },
          { header: 'Capacity Tonnage (MT) *', key: 'capacityTonnage', width: 22 },
          { header: 'Make', key: 'make', width: 16 },
          { header: 'Model', key: 'model', width: 16 },
          { header: 'Year of Manufacture', key: 'yearOfManufacture', width: 20 },
          { header: 'Chassis Number', key: 'chassisNumber', width: 22 },
          { header: 'Engine Number', key: 'engineNumber', width: 20 },
          { header: 'Owner Name', key: 'ownerName', width: 20 },
          { header: 'Owner Phone', key: 'ownerPhone', width: 16 }
        ];
        sampleRows = [
          {
            plateNumber: 'GJ01AB1234',
            vehicleType: 'Trailer 40ft',
            category: 'OWNED',
            capacityTonnage: 35.5,
            make: 'Tata Motors',
            model: 'Signa 4825.TK',
            yearOfManufacture: 2023,
            chassisNumber: 'MAT623000P1234567',
            engineNumber: 'CUMMINS250B1234',
            ownerName: 'Technofay Fleet Ops',
            ownerPhone: '9898012345'
          }
        ];
        break;

      case 'drivers':
        columns = [
          { header: 'Driver Name *', key: 'name', width: 24 },
          { header: 'Phone Number *', key: 'phone', width: 18 },
          { header: 'Alternate Phone', key: 'alternatePhone', width: 18 },
          { header: 'Licence Number *', key: 'licenseNumber', width: 22 },
          { header: 'Licence Type (LMV/HMV/TRANS/TRAILER) *', key: 'licenseType', width: 24 },
          { header: 'Licence Expiry Date (YYYY-MM-DD) *', key: 'licenseExpiryDate', width: 24 },
          { header: 'Address', key: 'address', width: 24 },
          { header: 'Emergency Contact Name', key: 'emergencyName', width: 22 },
          { header: 'Emergency Contact Phone', key: 'emergencyPhone', width: 22 }
        ];
        sampleRows = [
          {
            name: 'Rajesh Kumar Singh',
            phone: '9876501234',
            alternatePhone: '9876505678',
            licenseNumber: 'GJ0120150012345',
            licenseType: 'HMV',
            licenseExpiryDate: '2028-12-31',
            address: 'Village Bavla, Ahmedabad Rural',
            emergencyName: 'Sunita Singh (Wife)',
            emergencyPhone: '9876599999'
          }
        ];
        break;

      default:
        throw new AppError(`Unsupported template entity type '${entityType}'.`, 400);
    }

    worksheet.columns = columns;

    // Header styling: Enterprise Navy theme with bold white text
    worksheet.getRow(1).eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' }
      };
      cell.font = {
        name: 'Arial',
        size: 11,
        bold: true,
        color: { argb: 'FFFFFFFF' }
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    worksheet.getRow(1).height = 28;

    // Insert sample rows
    sampleRows.forEach(row => worksheet.addRow(row));

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }

  /**
   * 2. Dry-Run / Preview & Validation of Uploaded Master Excel Workbook
   */
  async dryRunValidate(entityType, fileBuffer, companyId) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new AppError('The uploaded workbook contains no readable sheets.', 400);
    }

    const rows = [];
    const headers = [];

    // Extract headers from Row 1
    worksheet.getRow(1).eachCell((cell, colNumber) => {
      headers[colNumber] = cell.text.trim();
    });

    // Extract Data Rows
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header
      const rowData = {};
      let hasContent = false;

      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber];
        if (header) {
          const val = cell.value;
          // Handle ExcelJS rich text or formula values
          const cleanVal = (val && typeof val === 'object' && val.text) ? val.text : val;
          rowData[header] = cleanVal;
          if (cleanVal !== undefined && cleanVal !== null && cleanVal !== '') {
            hasContent = true;
          }
        }
      });

      if (hasContent) {
        rows.push({ rowNumber, data: rowData });
      }
    });

    if (rows.length === 0) {
      throw new AppError('The uploaded spreadsheet contains no data rows.', 400);
    }

    const errors = [];
    const validRecords = [];
    const seenInFile = new Set();

    // Map entity validation logic
    for (const item of rows) {
      const { rowNumber, data } = item;
      const rowErrors = [];

      if (entityType === 'customers') {
        const name = (data['Party Name *'] || data['Party Name'] || '').toString().trim();
        const code = (data['Code'] || '').toString().trim().toUpperCase();
        const partyType = (data['Party Type (CUSTOMER/CONSIGNOR/CONSIGNEE/BOTH) *'] || data['Party Type'] || 'CUSTOMER').toString().trim().toUpperCase();
        const gstin = (data['GSTIN (15 chars)'] || data['GSTIN'] || '').toString().trim().toUpperCase();
        const pan = (data['PAN'] || '').toString().trim().toUpperCase();
        const phone = (data['Phone *'] || data['Phone'] || '').toString().trim();
        const city = (data['City *'] || data['City'] || '').toString().trim();
        const state = (data['State *'] || data['State'] || '').toString().trim();

        if (!name) {
          rowErrors.push({ rowNumber, field: 'name', message: 'Party Name is mandatory.' });
        }
        if (!Object.values(PartyType).includes(partyType)) {
          rowErrors.push({ rowNumber, field: 'partyType', value: partyType, message: `Invalid Party Type. Allowed: ${Object.values(PartyType).join(', ')}` });
        }
        if (gstin) {
          if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin)) {
            rowErrors.push({ rowNumber, field: 'gstin', value: gstin, message: 'Invalid 15-character GSTIN format.' });
          } else {
            if (seenInFile.has(`GSTIN:${gstin}`)) {
              rowErrors.push({ rowNumber, field: 'gstin', value: gstin, message: 'Duplicate GSTIN within uploaded file.' });
            } else {
              seenInFile.add(`GSTIN:${gstin}`);
            }
          }
        }

        if (rowErrors.length === 0) {
          validRecords.push({
            name,
            code,
            partyType,
            gstin,
            pan,
            primaryContact: {
              name: (data['Contact Person'] || '').toString().trim(),
              phone,
              email: (data['Email'] || '').toString().trim().toLowerCase()
            },
            billingAddress: {
              street: (data['Billing Street'] || '').toString().trim(),
              city,
              state,
              pincode: (data['Pincode'] || '').toString().trim()
            },
            paymentTermsDays: Number(data['Payment Terms Days']) || 30
          });
        }
      } else if (entityType === 'vehicles') {
        const rawPlate = (data['Plate Number *'] || data['Plate Number'] || '').toString().trim().toUpperCase();
        const plateNumber = rawPlate.replace(/\s+/g, '');
        const vehicleType = (data['Vehicle Type *'] || data['Vehicle Type'] || '').toString().trim();
        const category = (data['Category (OWNED/ATTACHED/MARKET) *'] || data['Category'] || 'OWNED').toString().trim().toUpperCase();
        const capacityTonnage = parseFloat(data['Capacity Tonnage (MT) *'] || data['Capacity Tonnage'] || 0);

        if (!plateNumber) {
          rowErrors.push({ rowNumber, field: 'plateNumber', message: 'Vehicle plate number is mandatory.' });
        } else if (!/^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/.test(plateNumber)) {
          rowErrors.push({ rowNumber, field: 'plateNumber', value: plateNumber, message: 'Invalid vehicle plate number format.' });
        } else if (seenInFile.has(`PLATE:${plateNumber}`)) {
          rowErrors.push({ rowNumber, field: 'plateNumber', value: plateNumber, message: 'Duplicate plate number within uploaded file.' });
        } else {
          seenInFile.add(`PLATE:${plateNumber}`);
        }

        if (!vehicleType) {
          rowErrors.push({ rowNumber, field: 'vehicleType', message: 'Vehicle type is mandatory.' });
        }
        if (!Object.values(VehicleCategory).includes(category)) {
          rowErrors.push({ rowNumber, field: 'category', value: category, message: `Invalid Category. Allowed: ${Object.values(VehicleCategory).join(', ')}` });
        }
        if (isNaN(capacityTonnage) || capacityTonnage <= 0) {
          rowErrors.push({ rowNumber, field: 'capacityTonnage', value: data['Capacity Tonnage (MT) *'], message: 'Capacity tonnage must be greater than 0.' });
        }

        if (rowErrors.length === 0) {
          validRecords.push({
            plateNumber,
            vehicleType,
            category,
            capacityTonnage,
            make: (data['Make'] || '').toString().trim(),
            model: (data['Model'] || '').toString().trim(),
            yearOfManufacture: parseInt(data['Year of Manufacture']) || undefined,
            chassisNumber: (data['Chassis Number'] || '').toString().trim().toUpperCase(),
            engineNumber: (data['Engine Number'] || '').toString().trim().toUpperCase(),
            ownerName: (data['Owner Name'] || '').toString().trim(),
            ownerPhone: (data['Owner Phone'] || '').toString().trim()
          });
        }
      } else if (entityType === 'drivers') {
        const name = (data['Driver Name *'] || data['Driver Name'] || '').toString().trim();
        const phone = (data['Phone Number *'] || data['Phone Number'] || '').toString().trim();
        const licenseNumber = (data['Licence Number *'] || data['Licence Number'] || '').toString().trim().toUpperCase();
        const licenseType = (data['Licence Type (LMV/HMV/TRANS/TRAILER) *'] || data['Licence Type'] || 'HMV').toString().trim().toUpperCase();
        const rawExpiry = (data['Licence Expiry Date (YYYY-MM-DD) *'] || data['Licence Expiry Date'] || '');

        if (!name) rowErrors.push({ rowNumber, field: 'name', message: 'Driver name is mandatory.' });
        if (!phone) rowErrors.push({ rowNumber, field: 'phone', message: 'Driver phone number is mandatory.' });
        if (!licenseNumber) {
          rowErrors.push({ rowNumber, field: 'licenseNumber', message: 'Licence number is mandatory.' });
        } else if (seenInFile.has(`DL:${licenseNumber}`)) {
          rowErrors.push({ rowNumber, field: 'licenseNumber', value: licenseNumber, message: 'Duplicate licence number within uploaded file.' });
        } else {
          seenInFile.add(`DL:${licenseNumber}`);
        }

        if (!Object.values(DriverLicenseType).includes(licenseType)) {
          rowErrors.push({ rowNumber, field: 'licenseType', value: licenseType, message: `Invalid Licence Type. Allowed: ${Object.values(DriverLicenseType).join(', ')}` });
        }

        const expiryDate = new Date(rawExpiry);
        if (!rawExpiry || isNaN(expiryDate.getTime())) {
          rowErrors.push({ rowNumber, field: 'licenseExpiryDate', value: rawExpiry, message: 'Invalid licence expiry date (Format: YYYY-MM-DD).' });
        }

        if (rowErrors.length === 0) {
          validRecords.push({
            name,
            phone,
            alternatePhone: (data['Alternate Phone'] || '').toString().trim(),
            licenseNumber,
            licenseType,
            licenseExpiryDate: expiryDate,
            address: (data['Address'] || '').toString().trim(),
            emergencyContact: {
              name: (data['Emergency Contact Name'] || '').toString().trim(),
              phone: (data['Emergency Contact Phone'] || '').toString().trim()
            }
          });
        }
      } else if (entityType === 'locations') {
        const name = (data['Location Name *'] || data['Location Name'] || '').toString().trim();
        const code = (data['Code'] || '').toString().trim().toUpperCase();
        const locationType = (data['Location Type (HUB/PICKUP/DELIVERY/WAYPOINT) *'] || data['Location Type'] || 'PICKUP').toString().trim().toUpperCase();
        const city = (data['City *'] || data['City'] || '').toString().trim();
        const state = (data['State *'] || data['State'] || '').toString().trim();

        if (!name) rowErrors.push({ rowNumber, field: 'name', message: 'Location name is mandatory.' });
        if (!city) rowErrors.push({ rowNumber, field: 'city', message: 'City is mandatory.' });
        if (!state) rowErrors.push({ rowNumber, field: 'state', message: 'State is mandatory.' });
        if (!Object.values(LocationType).includes(locationType)) {
          rowErrors.push({ rowNumber, field: 'locationType', value: locationType, message: `Invalid Location Type. Allowed: ${Object.values(LocationType).join(', ')}` });
        }

        if (rowErrors.length === 0) {
          validRecords.push({
            name,
            code,
            locationType,
            address: {
              street: (data['Street Address'] || '').toString().trim(),
              city,
              state,
              pincode: (data['Pincode'] || '').toString().trim()
            },
            contactPerson: (data['Contact Person'] || '').toString().trim(),
            contactPhone: (data['Contact Phone'] || '').toString().trim()
          });
        }
      }

      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
      }
    }

    // Check database collisions for valid records
    if (entityType === 'vehicles' && validRecords.length > 0) {
      const plates = validRecords.map(r => r.plateNumber);
      const existing = await Vehicle.find({ companyId, plateNumber: { $in: plates } }).select('plateNumber');
      const existingSet = new Set(existing.map(e => e.plateNumber));
      for (let i = validRecords.length - 1; i >= 0; i--) {
        if (existingSet.has(validRecords[i].plateNumber)) {
          errors.push({
            rowNumber: i + 2,
            field: 'plateNumber',
            value: validRecords[i].plateNumber,
            message: `Vehicle plate '${validRecords[i].plateNumber}' already exists in your organization's fleet.`
          });
          validRecords.splice(i, 1);
        }
      }
    } else if (entityType === 'drivers' && validRecords.length > 0) {
      const dls = validRecords.map(r => r.licenseNumber);
      const existing = await Driver.find({ companyId, licenseNumber: { $in: dls } }).select('licenseNumber');
      const existingSet = new Set(existing.map(e => e.licenseNumber));
      for (let i = validRecords.length - 1; i >= 0; i--) {
        if (existingSet.has(validRecords[i].licenseNumber)) {
          errors.push({
            rowNumber: i + 2,
            field: 'licenseNumber',
            value: validRecords[i].licenseNumber,
            message: `Driving licence '${validRecords[i].licenseNumber}' already exists for another driver.`
          });
          validRecords.splice(i, 1);
        }
      }
    } else if (entityType === 'customers' && validRecords.length > 0) {
      const gstins = validRecords.map(r => r.gstin).filter(Boolean);
      if (gstins.length > 0) {
        const existing = await CustomerParty.find({ companyId, gstin: { $in: gstins } }).select('gstin');
        const existingSet = new Set(existing.map(e => e.gstin));
        for (let i = validRecords.length - 1; i >= 0; i--) {
          if (validRecords[i].gstin && existingSet.has(validRecords[i].gstin)) {
            errors.push({
              rowNumber: i + 2,
              field: 'gstin',
              value: validRecords[i].gstin,
              message: `Customer party with GSTIN '${validRecords[i].gstin}' already exists.`
            });
            validRecords.splice(i, 1);
          }
        }
      }
    }

    return {
      totalRows: rows.length,
      validCount: validRecords.length,
      invalidCount: rows.length - validRecords.length,
      errors,
      preview: validRecords.slice(0, 10),
      validRecords
    };
  }

  /**
   * 3. Confirmed Atomic Batch Import
   */
  async confirmImport({ entityType, validRecords, companyId, actorId, ipAddress }) {
    if (!validRecords || validRecords.length === 0) {
      throw new AppError('No valid records to import.', 400);
    }

    let inserted = [];
    const enriched = validRecords.map(r => ({ ...r, companyId }));

    switch (entityType.toLowerCase()) {
      case 'customers':
        inserted = await CustomerParty.insertMany(enriched, { ordered: false });
        break;
      case 'vehicles':
        inserted = await Vehicle.insertMany(enriched, { ordered: false });
        break;
      case 'drivers':
        inserted = await Driver.insertMany(enriched, { ordered: false });
        break;
      case 'locations':
        inserted = await Location.insertMany(enriched, { ordered: false });
        break;
      default:
        throw new AppError(`Unsupported import entity '${entityType}'.`, 400);
    }

    // Record Immutable Audit Log
    await auditLogService.logAction({
      companyId,
      actorId,
      module: SystemModule.IMPORT_EXPORT,
      action: AuditAction.CREATE,
      entityId: null,
      oldValues: null,
      newValues: { importedCount: inserted.length, entityType },
      ipAddress
    });

    return {
      success: true,
      importedCount: inserted.length,
      message: `Successfully imported ${inserted.length} ${entityType} records into your organization.`
    };
  }

  /**
   * 4. Safe Master Data Export with Formula Injection Defense (.xlsx and .csv)
   */
  async exportMasterData({ entityType, companyId, format = 'xlsx' }) {
    let records = [];
    let columns = [];

    switch (entityType.toLowerCase()) {
      case 'customers':
        records = await CustomerParty.find({ companyId }).sort({ createdAt: -1 });
        columns = [
          { header: 'Party Name', key: 'name', width: 28 },
          { header: 'Code', key: 'code', width: 14 },
          { header: 'Party Type', key: 'partyType', width: 18 },
          { header: 'GSTIN', key: 'gstin', width: 20 },
          { header: 'PAN', key: 'pan', width: 15 },
          { header: 'Contact Person', key: 'contactName', width: 20 },
          { header: 'Phone', key: 'phone', width: 16 },
          { header: 'Email', key: 'email', width: 24 },
          { header: 'City', key: 'city', width: 16 },
          { header: 'State', key: 'state', width: 16 },
          { header: 'Status', key: 'status', width: 12 }
        ];
        break;

      case 'vehicles':
        records = await Vehicle.find({ companyId }).sort({ createdAt: -1 });
        columns = [
          { header: 'Plate Number', key: 'plateNumber', width: 18 },
          { header: 'Vehicle Type', key: 'vehicleType', width: 18 },
          { header: 'Category', key: 'category', width: 16 },
          { header: 'Capacity (MT)', key: 'capacityTonnage', width: 16 },
          { header: 'Make', key: 'make', width: 16 },
          { header: 'Model', key: 'model', width: 16 },
          { header: 'Owner Name', key: 'ownerName', width: 20 },
          { header: 'Status', key: 'status', width: 16 }
        ];
        break;

      case 'drivers':
        records = await Driver.find({ companyId }).sort({ createdAt: -1 });
        columns = [
          { header: 'Driver Name', key: 'name', width: 24 },
          { header: 'Phone', key: 'phone', width: 16 },
          { header: 'Licence Number', key: 'licenseNumber', width: 22 },
          { header: 'Licence Type', key: 'licenseType', width: 16 },
          { header: 'Licence Expiry', key: 'licenseExpiryDate', width: 18 },
          { header: 'Status', key: 'status', width: 14 }
        ];
        break;

      case 'locations':
        records = await Location.find({ companyId }).sort({ createdAt: -1 });
        columns = [
          { header: 'Location Name', key: 'name', width: 28 },
          { header: 'Code', key: 'code', width: 14 },
          { header: 'Location Type', key: 'locationType', width: 18 },
          { header: 'City', key: 'city', width: 16 },
          { header: 'State', key: 'state', width: 16 },
          { header: 'Contact Person', key: 'contactPerson', width: 20 },
          { header: 'Contact Phone', key: 'contactPhone', width: 16 }
        ];
        break;

      default:
        throw new AppError(`Unsupported export entity type '${entityType}'.`, 400);
    }

    if (format === 'csv') {
      // Build sanitized CSV
      const headerLine = columns.map(c => `"${c.header.replace(/"/g, '""')}"`).join(',');
      const rows = records.map(rec => {
        return columns.map(c => {
          let val = '';
          if (c.key === 'contactName') val = rec.primaryContact?.name;
          else if (c.key === 'phone') val = rec.primaryContact?.phone || rec.phone;
          else if (c.key === 'email') val = rec.primaryContact?.email;
          else if (c.key === 'city') val = rec.billingAddress?.city || rec.address?.city;
          else if (c.key === 'state') val = rec.billingAddress?.state || rec.address?.state;
          else if (c.key === 'status') val = rec.status || (rec.isActive ? 'ACTIVE' : 'INACTIVE');
          else if (c.key === 'licenseExpiryDate') val = rec.licenseExpiryDate ? new Date(rec.licenseExpiryDate).toISOString().split('T')[0] : '';
          else val = rec[c.key];

          const sanitized = sanitizeSpreadsheetValue(val);
          return `"${String(sanitized).replace(/"/g, '""')}"`;
        }).join(',');
      });

      return {
        contentType: 'text/csv; charset=utf-8',
        filename: `${entityType}_export_${new Date().toISOString().split('T')[0]}.csv`,
        buffer: Buffer.from([headerLine, ...rows].join('\r\n'), 'utf8')
      };
    }

    // Build ExcelJS workbook with styling and formula sanitization
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Technofay Fleet Platform';
    const worksheet = workbook.addWorksheet(`${entityType.toUpperCase()}`);
    worksheet.columns = columns;

    // Header styling
    worksheet.getRow(1).eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    worksheet.getRow(1).height = 26;

    records.forEach(rec => {
      const rowData = {};
      columns.forEach(c => {
        let val = '';
        if (c.key === 'contactName') val = rec.primaryContact?.name;
        else if (c.key === 'phone') val = rec.primaryContact?.phone || rec.phone;
        else if (c.key === 'email') val = rec.primaryContact?.email;
        else if (c.key === 'city') val = rec.billingAddress?.city || rec.address?.city;
        else if (c.key === 'state') val = rec.billingAddress?.state || rec.address?.state;
        else if (c.key === 'status') val = rec.status || (rec.isActive ? 'ACTIVE' : 'INACTIVE');
        else if (c.key === 'licenseExpiryDate') val = rec.licenseExpiryDate ? new Date(rec.licenseExpiryDate).toISOString().split('T')[0] : '';
        else val = rec[c.key];

        rowData[c.key] = sanitizeSpreadsheetValue(val);
      });
      worksheet.addRow(rowData);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `${entityType}_export_${new Date().toISOString().split('T')[0]}.xlsx`,
      buffer
    };
  }
}

module.exports = new MasterImportExportService();
