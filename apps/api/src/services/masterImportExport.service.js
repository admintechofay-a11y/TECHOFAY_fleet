/**
 * Master Data & Operational Excel/CSV Import and Export Engine
 * Supports: Customers, Locations, Vehicles, Drivers, Loads, LR Numbers, Bilties, Trips, and Proof of Delivery.
 * Features:
 * - Versioned downloadable Excel templates with sample data
 * - Two-stage dry-run preview and row-level error reporting
 * - Duplicate checks (intra-file and against tenant database)
 * - Anti-formula injection defense on all CSV and Excel exports
 * - Confirmed batch persistence with audit logging
 * - Asynchronous/trackable ExportJob generation with 24h expiration
 */

let ExcelJS = null;
function getExcelJS() {
  if (!ExcelJS) {
    ExcelJS = require('exceljs');
  }
  return ExcelJS;
}
const mongoose = require('mongoose');
const CustomerParty = require('../modules/customers/models/CustomerParty');
const Location = require('../modules/locations/models/Location');
const Vehicle = require('../modules/vehicles/models/Vehicle');
const Driver = require('../modules/drivers/models/Driver');
const Load = require('../modules/loads/models/Load');
const LrNumber = require('../modules/lr/models/LrNumber');
const Bilty = require('../modules/bilties/models/Bilty');
const Trip = require('../modules/trips/models/Trip');
const ProofOfDelivery = require('../modules/pod/models/ProofOfDelivery');
const ExportJob = require('../modules/masterData/models/ExportJob');
const ImportBatch = require('../modules/masterData/models/ImportBatch');
const sequenceService = require('../modules/sequences/services/sequence.service');
const storageService = require('./storage.service');
const auditLogService = require('../modules/audit/services/auditLog.service');
const {
  SystemModule,
  AuditAction,
  PartyType,
  LocationType,
  VehicleCategory,
  DriverLicenseType,
  StopType,
  StopStatus,
  LoadStatus
} = require('../shared');
const { AppError } = require('../middleware/errorHandler');

// Formula injection defense for CSV/Excel cells
function sanitizeSpreadsheetValue(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number' || typeof val === 'boolean') return val;
  if (val instanceof Date) return val.toISOString().split('T')[0];

  const rawStr = String(val);
  const trimmed = rawStr.trim();
  if (!trimmed) return '';

  // Defend against formula injection (=, +, -, @, \t, \r)
  // Check if raw value has leading tab or carriage return, or if trimmed value begins with formula trigger
  if (/^[\t\r]/.test(rawStr) || /^[=+\-@\t\r]/.test(trimmed)) {
    return `'${trimmed}`;
  }
  return trimmed;
}

class MasterImportExportService {
  /**
   * Helper to sanitize cell values against spreadsheet formula injection
   */
  sanitizeSpreadsheetValue(val) {
    return sanitizeSpreadsheetValue(val);
  }

  /**
   * 1. Generate downloadable Excel Template with instructions & sample data
   */
  async generateTemplate(entityType) {
    const workbook = new (getExcelJS().Workbook)();
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

      case 'loads':
        columns = [
          { header: 'Customer GSTIN or Name *', key: 'customerRef', width: 26 },
          { header: 'Consignor GSTIN or Name *', key: 'consignorRef', width: 26 },
          { header: 'Consignee GSTIN or Name *', key: 'consigneeRef', width: 26 },
          { header: 'Origin Location Code or Name *', key: 'originRef', width: 26 },
          { header: 'Destination Location Code or Name *', key: 'destRef', width: 26 },
          { header: 'Total Weight MT *', key: 'totalWeightMt', width: 18 },
          { header: 'Total Quantity *', key: 'totalQuantity', width: 16 },
          { header: 'Package Type (Bags/Boxes/Drums/Pallets)', key: 'packageType', width: 22 },
          { header: 'Base Freight INR *', key: 'baseFreightRupees', width: 18 },
          { header: 'Advance Freight INR', key: 'advanceRupees', width: 18 },
          { header: 'Scheduled Delivery Date (YYYY-MM-DD)', key: 'expectedDeliveryDate', width: 24 },
          { header: 'Remarks', key: 'remarks', width: 24 }
        ];
        sampleRows = [
          {
            customerRef: '24AAACA1234A1Z5',
            consignorRef: 'Sanand Industrial Hub 1',
            consigneeRef: 'Mumbai Nhava Sheva Depot',
            originRef: 'LOC-SND-01',
            destRef: 'WH-MUM-01',
            totalWeightMt: 24.5,
            totalQuantity: 200,
            packageType: 'Boxes',
            baseFreightRupees: 85000,
            advanceRupees: 20000,
            expectedDeliveryDate: '2026-11-15',
            remarks: 'Fragile electrical components'
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
   * 2. Dry-Run / Preview & Validation of Uploaded Master Excel / CSV Workbook
   */
  async dryRunValidate(entityType, fileBuffer, companyId, userId = null) {
    if (!fileBuffer || !Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
      throw new AppError('The uploaded file is empty or missing.', 400);
    }

    const workbook = new (getExcelJS().Workbook)();
    let isLoaded = false;

    // 1. Try loading as XLSX
    try {
      await workbook.xlsx.load(fileBuffer);
      isLoaded = true;
    } catch (_) {}

    // 2. If XLSX failed, try loading as CSV (handling UTF-8 BOM if present)
    if (!isLoaded) {
      try {
        const { Readable } = require('stream');
        let cleanBuffer = fileBuffer;
        if (fileBuffer[0] === 0xEF && fileBuffer[1] === 0xBB && fileBuffer[2] === 0xBF) {
          cleanBuffer = fileBuffer.slice(3);
        }
        await workbook.csv.read(Readable.from(cleanBuffer));
        isLoaded = true;
      } catch (_) {
        throw new AppError('Unable to parse spreadsheet file. Please upload a valid, uncorrupted Excel (.xlsx) or CSV (.csv) file.', 400);
      }
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new AppError('The uploaded workbook contains no readable sheets.', 400);
    }

    const rows = [];
    const headers = [];

    // Extract headers from Row 1
    worksheet.getRow(1).eachCell((cell, colNumber) => {
      headers[colNumber] = cell.text ? cell.text.trim() : '';
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

    if (rows.length > 5000) {
      throw new AppError(`Spreadsheet contains ${rows.length} data rows, which exceeds the maximum allowed batch limit of 5,000 rows. Please split the file into smaller batches.`, 400);
    }

    // Helper to construct exact row-level error location
    const makeError = (rowNumber, field, value, message) => ({
      row: rowNumber,
      rowNumber: rowNumber,
      column: field,
      field: field,
      value: value !== undefined && value !== null ? String(value) : '',
      reason: message,
      message: message
    });

    // Helper for header drift & synonym resolution
    const normalizeHeader = (h) => String(h || '').toLowerCase().replace(/[\*\(\)\[\]_.\-\s/]/g, '');

    const createRowAccessor = (rowData) => {
      const normMap = new Map();
      for (const [k, v] of Object.entries(rowData)) {
        normMap.set(normalizeHeader(k), v);
      }
      return (aliases, defaultVal = '') => {
        for (const alias of aliases) {
          const normKey = normalizeHeader(alias);
          if (normMap.has(normKey)) {
            const val = normMap.get(normKey);
            const clean = (val && typeof val === 'object' && val.text) ? val.text : val;
            if (clean !== undefined && clean !== null && String(clean).trim() !== '') {
              return clean;
            }
          }
        }
        return defaultVal;
      };
    };

    const errors = [];
    const validRecords = [];
    const seenInFile = new Set();

    // Map entity validation logic
    for (const item of rows) {
      const { rowNumber, data } = item;
      const rowErrors = [];
      const rowGet = createRowAccessor(data);

      if (entityType === 'customers') {
        const name = String(rowGet(['Party Name *', 'Party Name', 'Customer Name', 'Name', 'Company Name'])).trim();
        const code = String(rowGet(['Code', 'Customer Code', 'Party Code'])).trim().toUpperCase();
        const partyType = String(rowGet(['Party Type (CUSTOMER/CONSIGNOR/CONSIGNEE/BOTH) *', 'Party Type', 'Type'], 'CUSTOMER')).trim().toUpperCase();
        const gstin = String(rowGet(['GSTIN (15 chars)', 'GSTIN', 'GST Number', 'GST'])).trim().toUpperCase();
        const pan = String(rowGet(['PAN', 'PAN Number'])).trim().toUpperCase();
        const phone = String(rowGet(['Phone *', 'Phone', 'Phone Number', 'Mobile Number', 'Mobile'])).trim();
        const city = String(rowGet(['City *', 'City'])).trim();
        const state = String(rowGet(['State *', 'State'])).trim();

        if (!name) rowErrors.push(makeError(rowNumber, 'name', '', 'Party Name is mandatory.'));
        if (!Object.values(PartyType).includes(partyType)) {
          rowErrors.push(makeError(rowNumber, 'partyType', partyType, `Invalid Party Type. Allowed: ${Object.values(PartyType).join(', ')}`));
        }
        if (gstin) {
          if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin)) {
            rowErrors.push(makeError(rowNumber, 'gstin', gstin, 'Invalid 15-character GSTIN format.'));
          } else {
            if (seenInFile.has(`GSTIN:${gstin}`)) {
              rowErrors.push(makeError(rowNumber, 'gstin', gstin, 'Duplicate GSTIN within uploaded file.'));
            } else {
              seenInFile.add(`GSTIN:${gstin}`);
            }
          }
        }
        if (code) {
          if (seenInFile.has(`CODE:${code}`)) {
            rowErrors.push(makeError(rowNumber, 'code', code, 'Duplicate party code within uploaded file.'));
          } else {
            seenInFile.add(`CODE:${code}`);
          }
        }

        if (rowErrors.length === 0) {
          validRecords.push({
            _sourceRowNumber: rowNumber,
            name,
            code,
            partyType,
            gstin,
            pan,
            primaryContact: {
              name: String(rowGet(['Contact Person', 'Contact Name', 'Contact'])).trim(),
              phone,
              email: String(rowGet(['Email', 'Email Address'])).trim().toLowerCase()
            },
            billingAddress: {
              street: String(rowGet(['Billing Street', 'Street Address', 'Street', 'Address'])).trim(),
              city,
              state,
              pincode: String(rowGet(['Pincode', 'Pin Code', 'Postal Code', 'ZIP'])).trim()
            },
            paymentTermsDays: parseInt(String(rowGet(['Payment Terms Days', 'Payment Terms', 'Credit Days'], '30')), 10) || 30
          });
        }
      } else if (entityType === 'vehicles') {
        const plateNumber = String(rowGet(['Plate Number *', 'Plate Number', 'Vehicle Number', 'Vehicle No', 'Registration Number', 'Reg No', 'Plate No'])).trim().toUpperCase().replace(/\s+/g, '');
        const vehicleType = String(rowGet(['Vehicle Type *', 'Vehicle Type', 'Type'])).trim();
        const category = String(rowGet(['Category (OWNED/ATTACHED/MARKET) *', 'Category', 'Vehicle Category'], 'OWNED')).trim().toUpperCase();
        const rawCap = rowGet(['Capacity Tonnage (MT) *', 'Capacity Tonnage', 'Capacity (MT)', 'Capacity MT', 'Capacity', 'Tonnage']);
        const capacityTonnage = parseFloat(rawCap);

        if (!plateNumber) {
          rowErrors.push(makeError(rowNumber, 'plateNumber', '', 'Plate Number is mandatory.'));
        } else if (!/^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/.test(plateNumber)) {
          rowErrors.push(makeError(rowNumber, 'plateNumber', plateNumber, 'Invalid vehicle registration plate format.'));
        }
        if (!vehicleType) rowErrors.push(makeError(rowNumber, 'vehicleType', '', 'Vehicle Type is mandatory.'));
        if (!Object.values(VehicleCategory).includes(category)) {
          rowErrors.push(makeError(rowNumber, 'category', category, `Invalid Category. Allowed: ${Object.values(VehicleCategory).join(', ')}`));
        }
        if (isNaN(capacityTonnage) || capacityTonnage <= 0) {
          rowErrors.push(makeError(rowNumber, 'capacityTonnage', rawCap, 'Capacity must be a positive number in Metric Tons.'));
        }

        if (plateNumber) {
          if (seenInFile.has(`PLATE:${plateNumber}`)) {
            rowErrors.push(makeError(rowNumber, 'plateNumber', plateNumber, 'Duplicate vehicle plate within uploaded file.'));
          } else {
            seenInFile.add(`PLATE:${plateNumber}`);
          }
        }

        if (rowErrors.length === 0) {
          validRecords.push({
            _sourceRowNumber: rowNumber,
            plateNumber,
            vehicleType,
            category,
            capacityTonnage,
            make: String(rowGet(['Make', 'Brand', 'Manufacturer'])).trim(),
            model: String(rowGet(['Model', 'Vehicle Model'])).trim(),
            yearOfManufacture: parseInt(String(rowGet(['Year of Manufacture', 'Manufacture Year', 'Year'])), 10) || undefined,
            chassisNumber: String(rowGet(['Chassis Number', 'Chassis No', 'VIN'])).trim(),
            engineNumber: String(rowGet(['Engine Number', 'Engine No'])).trim(),
            ownerName: String(rowGet(['Owner Name', 'Owner'])).trim(),
            ownerPhone: String(rowGet(['Owner Phone', 'Owner Mobile'])).trim()
          });
        }
      } else if (entityType === 'drivers') {
        const name = String(rowGet(['Driver Name *', 'Driver Name', 'Name', 'Driver'])).trim();
        const phone = String(rowGet(['Phone Number *', 'Phone Number', 'Phone *', 'Phone', 'Mobile Number', 'Mobile'])).trim();
        const licenseNumber = String(rowGet(['Licence Number *', 'Licence Number', 'License Number', 'DL Number', 'DL No'])).trim().toUpperCase();
        const licenseType = String(rowGet(['Licence Type (LMV/HMV/TRANS/TRAILER) *', 'Licence Type', 'License Type', 'DL Type'], 'HMV')).trim().toUpperCase();
        const rawExpiry = String(rowGet(['Licence Expiry Date (YYYY-MM-DD) *', 'Licence Expiry Date', 'License Expiry Date', 'Expiry Date', 'DL Expiry'])).trim();
        const expiryDate = new Date(rawExpiry);

        if (!name) rowErrors.push(makeError(rowNumber, 'name', '', 'Driver name is mandatory.'));
        if (!phone) rowErrors.push(makeError(rowNumber, 'phone', '', 'Phone number is mandatory.'));
        if (!licenseNumber) rowErrors.push(makeError(rowNumber, 'licenseNumber', '', 'Licence number is mandatory.'));
        if (!Object.values(DriverLicenseType).includes(licenseType)) {
          rowErrors.push(makeError(rowNumber, 'licenseType', licenseType, `Invalid Licence Type. Allowed: ${Object.values(DriverLicenseType).join(', ')}`));
        }
        if (isNaN(expiryDate.getTime())) {
          rowErrors.push(makeError(rowNumber, 'licenseExpiryDate', rawExpiry, 'Invalid licence expiry date (Format: YYYY-MM-DD).'));
        }

        if (licenseNumber) {
          if (seenInFile.has(`DL:${licenseNumber}`)) {
            rowErrors.push(makeError(rowNumber, 'licenseNumber', licenseNumber, 'Duplicate licence number within uploaded file.'));
          } else {
            seenInFile.add(`DL:${licenseNumber}`);
          }
        }

        if (rowErrors.length === 0) {
          validRecords.push({
            _sourceRowNumber: rowNumber,
            name,
            phone,
            alternatePhone: String(rowGet(['Alternate Phone', 'Alt Phone', 'Secondary Phone'])).trim(),
            licenseNumber,
            licenseType,
            licenseExpiryDate: expiryDate,
            address: String(rowGet(['Address', 'Driver Address'])).trim(),
            emergencyContact: {
              name: String(rowGet(['Emergency Contact Name', 'Emergency Contact'])).trim(),
              phone: String(rowGet(['Emergency Contact Phone', 'Emergency Phone'])).trim()
            }
          });
        }
      } else if (entityType === 'locations') {
        const name = String(rowGet(['Location Name *', 'Location Name', 'Hub Name', 'Name'])).trim();
        const code = String(rowGet(['Code', 'Location Code', 'Hub Code'])).trim().toUpperCase();
        const locationType = String(rowGet(['Location Type (HUB/PICKUP/DELIVERY/WAYPOINT) *', 'Location Type', 'Type'], 'PICKUP')).trim().toUpperCase();
        const city = String(rowGet(['City *', 'City'])).trim();
        const state = String(rowGet(['State *', 'State'])).trim();

        if (!name) rowErrors.push(makeError(rowNumber, 'name', '', 'Location name is mandatory.'));
        if (!city) rowErrors.push(makeError(rowNumber, 'city', '', 'City is mandatory.'));
        if (!state) rowErrors.push(makeError(rowNumber, 'state', '', 'State is mandatory.'));
        if (!Object.values(LocationType).includes(locationType)) {
          rowErrors.push(makeError(rowNumber, 'locationType', locationType, `Invalid Location Type. Allowed: ${Object.values(LocationType).join(', ')}`));
        }

        if (code) {
          if (seenInFile.has(`LOC_CODE:${code}`)) {
            rowErrors.push(makeError(rowNumber, 'code', code, 'Duplicate location code within uploaded file.'));
          } else {
            seenInFile.add(`LOC_CODE:${code}`);
          }
        }

        if (rowErrors.length === 0) {
          validRecords.push({
            _sourceRowNumber: rowNumber,
            name,
            code,
            locationType,
            address: {
              street: String(rowGet(['Street Address', 'Street', 'Address'])).trim(),
              city,
              state,
              pincode: String(rowGet(['Pincode', 'Pin Code', 'Postal Code'])).trim()
            },
            contactPerson: String(rowGet(['Contact Person', 'Contact Name'])).trim(),
            contactPhone: String(rowGet(['Contact Phone', 'Phone'])).trim()
          });
        }
      } else if (entityType === 'loads') {
        const customerRef = String(rowGet(['Customer GSTIN or Name *', 'Customer', 'Customer Name', 'Customer GSTIN', 'Customer Ref'])).trim();
        const consignorRef = String(rowGet(['Consignor GSTIN or Name *', 'Consignor', 'Consignor Name', 'Consignor Ref'])).trim();
        const consigneeRef = String(rowGet(['Consignee GSTIN or Name *', 'Consignee', 'Consignee Name', 'Consignee Ref'])).trim();
        const originRef = String(rowGet(['Origin Location Code or Name *', 'Origin', 'Origin Location', 'Origin Ref'])).trim();
        const destRef = String(rowGet(['Destination Location Code or Name *', 'Destination', 'Destination Location', 'Dest', 'Dest Ref'])).trim();
        const rawWeight = rowGet(['Total Weight MT *', 'Total Weight MT', 'Weight MT', 'Weight (MT)', 'Weight']);
        const totalWeightMt = parseFloat(rawWeight);
        const rawQty = rowGet(['Total Quantity *', 'Total Quantity', 'Quantity', 'Packages', 'Qty'], 1);
        const totalQuantity = parseInt(rawQty, 10);
        const packageType = String(rowGet(['Package Type (Bags/Boxes/Drums/Pallets)', 'Package Type', 'Packaging'], 'Boxes')).trim();
        const rawFreight = rowGet(['Base Freight INR *', 'Base Freight INR', 'Base Freight', 'Freight (INR)', 'Freight']);
        const baseFreightRupees = parseFloat(rawFreight);
        const advanceRupees = parseFloat(rowGet(['Advance Freight INR', 'Advance Freight', 'Advance (INR)', 'Advance'], 0));
        const remarks = String(rowGet(['Remarks', 'Instructions', 'Notes'])).trim();

        if (!customerRef) rowErrors.push(makeError(rowNumber, 'customerRef', '', 'Customer reference is mandatory.'));
        if (!consignorRef) rowErrors.push(makeError(rowNumber, 'consignorRef', '', 'Consignor reference is mandatory.'));
        if (!consigneeRef) rowErrors.push(makeError(rowNumber, 'consigneeRef', '', 'Consignee reference is mandatory.'));
        if (!originRef) rowErrors.push(makeError(rowNumber, 'originRef', '', 'Origin location reference is mandatory.'));
        if (!destRef) rowErrors.push(makeError(rowNumber, 'destRef', '', 'Destination location reference is mandatory.'));
        if (isNaN(totalWeightMt) || totalWeightMt <= 0) {
          rowErrors.push(makeError(rowNumber, 'totalWeightMt', rawWeight, 'Total weight must be positive MT.'));
        }
        if (isNaN(baseFreightRupees) || baseFreightRupees <= 0) {
          rowErrors.push(makeError(rowNumber, 'baseFreightRupees', rawFreight, 'Base freight must be positive.'));
        }

        if (rowErrors.length === 0) {
          validRecords.push({
            _sourceRowNumber: rowNumber,
            customerRef,
            consignorRef,
            consigneeRef,
            originRef,
            destRef,
            totalWeightMt,
            totalQuantity: isNaN(totalQuantity) || totalQuantity <= 0 ? 1 : totalQuantity,
            packageType,
            baseFreightRupees,
            advanceRupees: isNaN(advanceRupees) ? 0 : advanceRupees,
            remarks
          });
        }
      }

      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
      }
    }

    // Check database collisions for valid records using exact original row number
    if (entityType === 'customers' && validRecords.length > 0) {
      const gstins = validRecords.map(r => r.gstin).filter(Boolean);
      const codes = validRecords.map(r => r.code).filter(Boolean);
      const existing = await CustomerParty.find({
        companyId,
        $or: [
          ...(gstins.length ? [{ gstin: { $in: gstins } }] : []),
          ...(codes.length ? [{ code: { $in: codes } }] : [])
        ]
      }).select('gstin code name');
      const existingGstins = new Set(existing.map(e => e.gstin).filter(Boolean));
      const existingCodes = new Set(existing.map(e => e.code).filter(Boolean));

      for (let i = validRecords.length - 1; i >= 0; i--) {
        const item = validRecords[i];
        if (item.gstin && existingGstins.has(item.gstin)) {
          errors.push(makeError(item._sourceRowNumber, 'gstin', item.gstin, `Customer with GSTIN '${item.gstin}' already exists in your organization.`));
          validRecords.splice(i, 1);
        } else if (item.code && existingCodes.has(item.code)) {
          errors.push(makeError(item._sourceRowNumber, 'code', item.code, `Customer with code '${item.code}' already exists.`));
          validRecords.splice(i, 1);
        }
      }
    } else if (entityType === 'vehicles' && validRecords.length > 0) {
      const plates = validRecords.map(r => r.plateNumber);
      const existing = await Vehicle.find({ companyId, plateNumber: { $in: plates } }).select('plateNumber');
      const existingSet = new Set(existing.map(e => e.plateNumber));
      for (let i = validRecords.length - 1; i >= 0; i--) {
        const item = validRecords[i];
        if (existingSet.has(item.plateNumber)) {
          errors.push(makeError(
            item._sourceRowNumber,
            'plateNumber',
            item.plateNumber,
            `Vehicle plate '${item.plateNumber}' already exists in your organization's fleet.`
          ));
          validRecords.splice(i, 1);
        }
      }
    } else if (entityType === 'drivers' && validRecords.length > 0) {
      const dls = validRecords.map(r => r.licenseNumber);
      const existing = await Driver.find({ companyId, licenseNumber: { $in: dls } }).select('licenseNumber');
      const existingSet = new Set(existing.map(e => e.licenseNumber));
      for (let i = validRecords.length - 1; i >= 0; i--) {
        const item = validRecords[i];
        if (existingSet.has(item.licenseNumber)) {
          errors.push(makeError(
            item._sourceRowNumber,
            'licenseNumber',
            item.licenseNumber,
            `Driving licence '${item.licenseNumber}' already exists for another driver.`
          ));
          validRecords.splice(i, 1);
        }
      }
    } else if (entityType === 'locations' && validRecords.length > 0) {
      const codes = validRecords.map(r => r.code).filter(Boolean);
      if (codes.length > 0) {
        const existing = await Location.find({ companyId, code: { $in: codes } }).select('code');
        const existingSet = new Set(existing.map(e => e.code));
        for (let i = validRecords.length - 1; i >= 0; i--) {
          const item = validRecords[i];
          if (item.code && existingSet.has(item.code)) {
            errors.push(makeError(
              item._sourceRowNumber,
              'code',
              item.code,
              `Location with code '${item.code}' already exists.`
            ));
            validRecords.splice(i, 1);
          }
        }
      }
    } else if (entityType === 'loads' && validRecords.length > 0) {
      // Resolve referenced customers and locations
      const parties = await CustomerParty.find({ companyId }).select('_id name gstin partyTypes');
      const locations = await Location.find({ companyId }).select('_id name code');

      for (let i = validRecords.length - 1; i >= 0; i--) {
        const item = validRecords[i];
        const srcRow = item._sourceRowNumber;
        const custMatch = parties.find(p => (item.customerRef && (p.gstin === item.customerRef || p.name.toLowerCase() === item.customerRef.toLowerCase())));
        const conMatch = parties.find(p => (item.consignorRef && (p.gstin === item.consignorRef || p.name.toLowerCase() === item.consignorRef.toLowerCase())));
        const cneeMatch = parties.find(p => (item.consigneeRef && (p.gstin === item.consigneeRef || p.name.toLowerCase() === item.consigneeRef.toLowerCase())));
        const origMatch = locations.find(l => (item.originRef && (l.code === item.originRef || l.name.toLowerCase() === item.originRef.toLowerCase())));
        const destMatch = locations.find(l => (item.destRef && (l.code === item.destRef || l.name.toLowerCase() === item.destRef.toLowerCase())));

        let hasRefError = false;
        if (!custMatch) {
          errors.push(makeError(srcRow, 'customerRef', item.customerRef, `Customer '${item.customerRef}' not found in master records.`));
          hasRefError = true;
        }
        if (!conMatch) {
          errors.push(makeError(srcRow, 'consignorRef', item.consignorRef, `Consignor '${item.consignorRef}' not found in master records.`));
          hasRefError = true;
        }
        if (!cneeMatch) {
          errors.push(makeError(srcRow, 'consigneeRef', item.consigneeRef, `Consignee '${item.consigneeRef}' not found in master records.`));
          hasRefError = true;
        }
        if (!origMatch) {
          errors.push(makeError(srcRow, 'originRef', item.originRef, `Origin location '${item.originRef}' not found.`));
          hasRefError = true;
        }
        if (!destMatch) {
          errors.push(makeError(srcRow, 'destRef', item.destRef, `Destination location '${item.destRef}' not found.`));
          hasRefError = true;
        }

        if (hasRefError) {
          validRecords.splice(i, 1);
        } else {
          item.customerId = custMatch._id;
          item.consignorId = conMatch._id;
          item.consigneeId = cneeMatch._id;
          item.originLocationId = origMatch._id;
          item.destinationLocationId = destMatch._id;
        }
      }
    }

    let batchId = null;
    if (userId) {
      try {
        const stagedBatch = await ImportBatch.create({
          companyId,
          userId,
          entityType: entityType.toLowerCase(),
          validRecords,
          totalRows: rows.length,
          validCount: validRecords.length,
          errorCount: errors.length,
          errors,
          status: 'STAGED',
          expiresAt: new Date(Date.now() + 30 * 60 * 1000)
        });
        batchId = stagedBatch._id.toString();
      } catch (batchErr) {
        console.error('[ImportBatch] Staging error:', batchErr.message);
      }
    }

    return {
      batchId,
      entityType,
      totalRows: rows.length,
      validCount: validRecords.length,
      invalidCount: errors.length,
      validRowsCount: validRecords.length,
      invalidRowsCount: errors.length,
      errors,
      validRecords
    };
  }

  /**
   * 3. Confirmed Import Execution
   */
  async confirmImport({ entityType, batchId = null, validRecords = null, companyId, actorId, ipAddress }) {
    let recordsToImport = validRecords;

    if (batchId) {
      const stagedBatch = await ImportBatch.findOneAndUpdate(
        {
          _id: batchId,
          companyId,
          entityType: entityType.toLowerCase(),
          status: 'STAGED',
          expiresAt: { $gt: new Date() }
        },
        { status: 'COMMITTED' },
        { new: false }
      );

      if (!stagedBatch) {
        throw new AppError('Import batch was not found, has expired, or was already committed. Please upload and preview again.', 400);
      }

      recordsToImport = stagedBatch.validRecords;
    }

    if (!recordsToImport || !Array.isArray(recordsToImport) || recordsToImport.length === 0) {
      throw new AppError('No valid records provided for confirmed import.', 400);
    }

    let inserted = [];
    const enriched = recordsToImport.map(r => {
      const copy = { ...r, companyId, createdVia: 'EXCEL_IMPORT' };
      delete copy._sourceRowNumber;
      return copy;
    });

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
      case 'loads':
        for (const item of enriched) {
          const loadNumber = await sequenceService.getNextSequence(companyId, 'LOAD', 'LD');
          const baseFreightPaise = Math.round((item.baseFreightRupees || 0) * 100);
          const advancePaise = Math.round((item.advanceRupees || 0) * 100);

          const load = new Load({
            companyId,
            loadNumber,
            customerId: item.customerId,
            consignorId: item.consignorId,
            consigneeId: item.consigneeId,
            originLocationId: item.originLocationId,
            destinationLocationId: item.destinationLocationId,
            totalWeightMt: item.totalWeightMt,
            totalQuantity: item.totalQuantity || 1,
            packageType: item.packageType || 'Boxes',
            financials: {
              baseFreightPaise,
              advancePaise,
              totalFreightPaise: baseFreightPaise,
              balancePaise: baseFreightPaise - advancePaise
            },
            stops: [
              {
                sequence: 1,
                stopType: StopType.PICKUP,
                locationId: item.originLocationId,
                allocatedQuantity: item.totalQuantity || 1,
                allocatedWeightMt: item.totalWeightMt,
                deliveredQuantity: 0,
                pendingQuantity: item.totalQuantity || 1,
                status: StopStatus.COMPLETED
              },
              {
                sequence: 2,
                stopType: StopType.DELIVERY,
                locationId: item.destinationLocationId,
                allocatedQuantity: item.totalQuantity || 1,
                allocatedWeightMt: item.totalWeightMt,
                deliveredQuantity: 0,
                pendingQuantity: item.totalQuantity || 1,
                status: StopStatus.PENDING
              }
            ],
            status: LoadStatus.CREATED,
            remarks: item.remarks || ''
          });

          await load.save();
          inserted.push(load);
        }
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
   * 4. Safe Master & Operational Data Export with Formula Injection Defense (.xlsx and .csv)
   */
  async exportMasterData({ entityType, companyId, format = 'xlsx', filters = {} }) {
    let records = [];
    let columns = [];

    const baseFilter = { companyId };
    if (filters.status) baseFilter.status = filters.status;
    if (filters.search) {
      const reg = new RegExp(filters.search.trim(), 'i');
      baseFilter.$or = [{ name: reg }, { code: reg }, { plateNumber: reg }, { loadNumber: reg }, { tripNumber: reg }];
    }

    const maxLimit = Math.min(Math.max(parseInt(filters.limit, 10) || 10000, 1), 50000);

    switch (entityType.toLowerCase()) {
      case 'customers':
        records = await CustomerParty.find(baseFilter).sort({ createdAt: -1 }).limit(maxLimit);
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
        records = await Vehicle.find(baseFilter).sort({ createdAt: -1 }).limit(maxLimit);
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
        records = await Driver.find(baseFilter).sort({ createdAt: -1 }).limit(maxLimit);
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
        records = await Location.find(baseFilter).sort({ createdAt: -1 }).limit(maxLimit);
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

      case 'loads':
        records = await Load.find(baseFilter)
          .populate('customerId', 'name gstin')
          .populate('consignorId', 'name')
          .populate('consigneeId', 'name')
          .populate('originLocationId', 'name city')
          .populate('destinationLocationId', 'name city')
          .populate('stops.locationId', 'name city')
          .sort({ createdAt: -1 })
          .limit(maxLimit);
        columns = [
          { header: 'Load Number', key: 'loadNumber', width: 18 },
          { header: 'Status', key: 'status', width: 16 },
          { header: 'Customer', key: 'customerName', width: 26 },
          { header: 'Consignor', key: 'consignorName', width: 24 },
          { header: 'Consignee', key: 'consigneeName', width: 24 },
          { header: 'Origin', key: 'originName', width: 22 },
          { header: 'Destination', key: 'destName', width: 22 },
          { header: 'Weight MT', key: 'totalWeightMt', width: 14 },
          { header: 'Packages', key: 'totalQuantity', width: 12 },
          { header: 'Gross Freight INR', key: 'grossFreight', width: 18 },
          { header: 'Advance INR', key: 'advance', width: 16 },
          { header: 'Balance INR', key: 'balance', width: 16 },
          { header: 'Created Date', key: 'createdDate', width: 16 }
        ];
        break;

      case 'lr':
        records = await LrNumber.find(baseFilter)
          .populate('loadId', 'loadNumber')
          .populate('vehicleId', 'plateNumber')
          .populate('driverId', 'name')
          .sort({ createdAt: -1 })
          .limit(maxLimit);
        columns = [
          { header: 'LR Number', key: 'lrNumber', width: 18 },
          { header: 'Status', key: 'status', width: 16 },
          { header: 'Linked Load', key: 'loadNumber', width: 18 },
          { header: 'E-Way Bill', key: 'eWayBillNumber', width: 20 },
          { header: 'Vehicle Plate', key: 'plateNumber', width: 16 },
          { header: 'Driver Name', key: 'driverName', width: 22 },
          { header: 'Issued Date', key: 'createdDate', width: 16 }
        ];
        break;

      case 'bilties':
        records = await Bilty.find(baseFilter)
          .populate('lrId', 'lrNumber')
          .populate('consignorId', 'name')
          .populate('consigneeId', 'name')
          .sort({ createdAt: -1 })
          .limit(maxLimit);
        columns = [
          { header: 'Bilty Number', key: 'biltyNumber', width: 18 },
          { header: 'LR Number', key: 'lrNumber', width: 18 },
          { header: 'Consignor', key: 'consignorName', width: 24 },
          { header: 'Consignee', key: 'consigneeName', width: 24 },
          { header: 'Payment Terms', key: 'paymentTerms', width: 16 },
          { header: 'GTA SAC Code', key: 'gstGtaSac', width: 14 },
          { header: 'Total Freight INR', key: 'totalFreight', width: 18 },
          { header: 'Advance INR', key: 'advance', width: 16 },
          { header: 'Balance INR', key: 'balance', width: 16 },
          { header: 'Issued Date', key: 'createdDate', width: 16 }
        ];
        break;

      case 'trips':
        records = await Trip.find(baseFilter)
          .populate('loadId', 'loadNumber')
          .populate('vehicleId', 'plateNumber')
          .populate('driverId', 'name')
          .sort({ createdAt: -1 })
          .limit(maxLimit);
        columns = [
          { header: 'Trip Number', key: 'tripNumber', width: 18 },
          { header: 'Status', key: 'status', width: 16 },
          { header: 'Load Number', key: 'loadNumber', width: 18 },
          { header: 'Vehicle Plate', key: 'plateNumber', width: 16 },
          { header: 'Driver Name', key: 'driverName', width: 22 },
          { header: 'Gross Freight INR', key: 'grossFreight', width: 18 },
          { header: 'Driver Advance INR', key: 'advance', width: 18 },
          { header: 'Total Route Expenses INR', key: 'expenses', width: 24 },
          { header: 'Net Settlement INR', key: 'netSettlement', width: 20 },
          { header: 'Dispatched Date', key: 'createdDate', width: 18 }
        ];
        break;

      case 'pod':
        records = await ProofOfDelivery.find(baseFilter)
          .populate('tripId', 'tripNumber')
          .populate('verifiedBySupervisor', 'name')
          .sort({ createdAt: -1 })
          .limit(maxLimit);
        columns = [
          { header: 'POD Number', key: 'podNumber', width: 18 },
          { header: 'Trip Number', key: 'tripNumber', width: 18 },
          { header: 'Receiver Name', key: 'receiverName', width: 22 },
          { header: 'Receiver Phone', key: 'receiverPhone', width: 16 },
          { header: 'Quantity Delivered', key: 'quantityDelivered', width: 18 },
          { header: 'Status', key: 'status', width: 22 },
          { header: 'Verified By', key: 'verifiedBy', width: 20 },
          { header: 'Delivered Date', key: 'createdDate', width: 16 }
        ];
        break;

      default:
        throw new AppError(`Unsupported export entity type '${entityType}'.`, 400);
    }

    // Helper row extractor
    const extractRow = (rec) => {
      const row = {};
      columns.forEach(c => {
        let val = '';
        if (c.key === 'contactName') val = rec.primaryContact?.name;
        else if (c.key === 'phone') val = rec.primaryContact?.phone || rec.phone;
        else if (c.key === 'email') val = rec.primaryContact?.email;
        else if (c.key === 'city') val = rec.billingAddress?.city || rec.address?.city;
        else if (c.key === 'state') val = rec.billingAddress?.state || rec.address?.state;
        else if (c.key === 'status') val = rec.status || (rec.isActive ? 'ACTIVE' : 'INACTIVE');
        else if (c.key === 'licenseExpiryDate') val = rec.licenseExpiryDate ? new Date(rec.licenseExpiryDate).toISOString().split('T')[0] : '';
        else if (c.key === 'customerName') val = rec.customerId?.name || '';
        else if (c.key === 'consignorName') val = rec.consignorId?.name || '';
        else if (c.key === 'consigneeName') val = rec.consigneeId?.name || '';
        else if (c.key === 'originName') {
          val = rec.originLocationId?.name || rec.stops?.find(s => s.stopType === 'PICKUP')?.locationId?.name || '';
        }
        else if (c.key === 'destName') {
          val = rec.destinationLocationId?.name || rec.stops?.find(s => s.stopType === 'DELIVERY')?.locationId?.name || '';
        }
        else if (c.key === 'loadNumber') val = rec.loadId?.loadNumber || '';
        else if (c.key === 'plateNumber') val = rec.vehicleId?.plateNumber || '';
        else if (c.key === 'driverName') val = rec.driverId?.name || '';
        else if (c.key === 'tripNumber') val = rec.tripId?.tripNumber || '';
        else if (c.key === 'verifiedBy') val = rec.verifiedBySupervisor?.name || '';
        else if (c.key === 'grossFreight') val = ((rec.financials?.grossFreightPaise || rec.financials?.totalFreightPaise || 0) / 100).toFixed(2);
        else if (c.key === 'advance') val = ((rec.financials?.driverAdvancePaise || rec.financials?.advancePaise || rec.advancePaise || 0) / 100).toFixed(2);
        else if (c.key === 'totalFreight') val = ((rec.totalFreightPaise || 0) / 100).toFixed(2);
        else if (c.key === 'balance') val = ((rec.balancePaise || rec.financials?.balancePaise || 0) / 100).toFixed(2);
        else if (c.key === 'expenses') val = ((rec.financials?.totalExpensesPaise || 0) / 100).toFixed(2);
        else if (c.key === 'netSettlement') val = ((rec.financials?.netSettlementPaise || 0) / 100).toFixed(2);
        else if (c.key === 'createdDate') val = new Date(rec.createdAt || Date.now()).toISOString().split('T')[0];
        else val = rec[c.key];

        row[c.key] = sanitizeSpreadsheetValue(val);
      });
      return row;
    };

    if (format === 'csv') {
      const headerLine = columns.map(c => `"${c.header.replace(/"/g, '""')}"`).join(',');
      const rows = records.map(rec => {
        const rowData = extractRow(rec);
        return columns.map(c => `"${String(rowData[c.key] || '').replace(/"/g, '""')}"`).join(',');
      });

      return {
        contentType: 'text/csv; charset=utf-8',
        filename: `${entityType}_export_${new Date().toISOString().split('T')[0]}.csv`,
        buffer: Buffer.from([headerLine, ...rows].join('\r\n'), 'utf8'),
        totalRecords: records.length
      };
    }

    // Build ExcelJS workbook with styling
    const workbook = new (getExcelJS().Workbook)();
    workbook.creator = 'Technofay Fleet Platform';
    const worksheet = workbook.addWorksheet(entityType.toUpperCase());
    worksheet.columns = columns;

    worksheet.getRow(1).eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    worksheet.getRow(1).height = 26;

    records.forEach(rec => {
      worksheet.addRow(extractRow(rec));
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `${entityType}_export_${new Date().toISOString().split('T')[0]}.xlsx`,
      buffer,
      totalRecords: records.length
    };
  }

  /**
   * 5. Initiate and Track Asynchronous Export Jobs
   */
  async createExportJob({ companyId, userId, entityType, format = 'xlsx', filters = {} }) {
    const job = new ExportJob({
      companyId,
      jobType: 'EXPORT',
      entityType: entityType.toLowerCase(),
      format,
      status: 'PROCESSING',
      requestedBy: userId,
      filtersApplied: filters
    });
    await job.save();

    try {
      const exportResult = await this.exportMasterData({
        entityType,
        companyId,
        format,
        filters
      });

      // Save to tenant storage
      const saved = await storageService.saveFile({
        buffer: exportResult.buffer,
        originalName: exportResult.filename,
        mimeType: exportResult.contentType,
        companyId,
        module: 'exports'
      });

      job.status = 'COMPLETED';
      job.fileKey = saved.fileKey;
      job.fileName = saved.originalFileName;
      job.fileSize = saved.fileSize;
      job.totalRecords = exportResult.totalRecords;
      await job.save();

      return job;
    } catch (err) {
      job.status = 'FAILED';
      job.errorDetails = [{ row: 0, field: 'general', message: err.message }];
      await job.save();
      throw err;
    }
  }

  /**
   * 6. Retrieve Export Job Download Stream
   */
  async getJobDownloadStream(jobId, companyId) {
    if (!mongoose.isValidObjectId(jobId)) {
      throw new AppError('Export job not found or access denied.', 404);
    }
    const job = await ExportJob.findOne({ _id: jobId, companyId });
    if (!job) {
      throw new AppError('Export job not found or access denied.', 404);
    }

    if (job.status !== 'COMPLETED') {
      throw new AppError(`Export job is currently ${job.status}. File is not yet ready.`, 400);
    }

    if (new Date() > new Date(job.downloadExpiresAt)) {
      throw new AppError('This export download has expired. Please initiate a new export.', 410);
    }

    const filePath = storageService.getFilePath(job.fileKey, companyId);
    const contentType = job.format === 'csv'
      ? 'text/csv; charset=utf-8'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    return {
      filePath,
      fileName: job.fileName,
      contentType,
      fileSize: job.fileSize
    };
  }

  /**
   * 7. Initiate and Track Asynchronous Import Jobs
   */
  async createImportJob({ companyId, userId, entityType, fileBuffer, fileName = 'import.xlsx' }) {
    if (!fileBuffer || !Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
      throw new AppError('Import file is required.', 400);
    }

    const job = new ExportJob({
      companyId,
      jobType: 'IMPORT',
      entityType: entityType.toLowerCase(),
      format: fileName.endsWith('.csv') ? 'csv' : 'xlsx',
      status: 'PROCESSING',
      requestedBy: userId,
      fileName,
      totalRecords: 0
    });
    await job.save();

    try {
      // 1. Execute Dry-Run Validation
      const dryRunResult = await this.dryRunValidate(entityType, fileBuffer, companyId, userId);

      job.totalRecords = dryRunResult.totalRows;
      job.validCount = dryRunResult.validRowsCount;
      job.errorCount = dryRunResult.invalidRowsCount;
      job.batchId = dryRunResult.batchId;
      job.errorDetails = dryRunResult.errors.map(e => ({
        row: e.rowNumber,
        field: e.field,
        message: e.message
      }));

      // 2. Persist uploaded file in tenant storage for audit & durability
      const saved = await storageService.saveFile({
        buffer: fileBuffer,
        originalName: fileName,
        mimeType: fileName.endsWith('.csv') ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        companyId,
        module: 'imports'
      });
      job.fileKey = saved.fileKey;
      job.fileSize = saved.fileSize;

      job.status = 'COMPLETED';
      await job.save();

      return {
        job,
        dryRunResult
      };
    } catch (err) {
      job.status = 'FAILED';
      job.errorDetails = [{ row: 0, field: 'general', message: err.message }];
      await job.save();
      throw err;
    }
  }
}

module.exports = new MasterImportExportService();
