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

const ExcelJS = require('exceljs');
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
} = require('@fleet/shared');
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
   * Helper to sanitize cell values against spreadsheet formula injection
   */
  sanitizeSpreadsheetValue(val) {
    return sanitizeSpreadsheetValue(val);
  }

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
   * 2. Dry-Run / Preview & Validation of Uploaded Master Excel Workbook
   */
  async dryRunValidate(entityType, fileBuffer, companyId, userId = null) {
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

        if (!name) rowErrors.push({ rowNumber, field: 'name', message: 'Party Name is mandatory.' });
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
            paymentTermsDays: parseInt(data['Payment Terms Days'] || '30', 10) || 30
          });
        }
      } else if (entityType === 'vehicles') {
        const plateNumber = (data['Plate Number *'] || data['Plate Number'] || '').toString().trim().toUpperCase().replace(/\s+/g, '');
        const vehicleType = (data['Vehicle Type *'] || data['Vehicle Type'] || '').toString().trim();
        const category = (data['Category (OWNED/ATTACHED/MARKET) *'] || data['Category'] || 'OWNED').toString().trim().toUpperCase();
        const rawCap = data['Capacity Tonnage (MT) *'] || data['Capacity Tonnage'] || data['Capacity (MT)'];
        const capacityTonnage = parseFloat(rawCap);

        if (!plateNumber) {
          rowErrors.push({ rowNumber, field: 'plateNumber', message: 'Plate Number is mandatory.' });
        } else if (!/^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/.test(plateNumber)) {
          rowErrors.push({ rowNumber, field: 'plateNumber', value: plateNumber, message: 'Invalid vehicle registration plate format.' });
        }
        if (!vehicleType) rowErrors.push({ rowNumber, field: 'vehicleType', message: 'Vehicle Type is mandatory.' });
        if (!Object.values(VehicleCategory).includes(category)) {
          rowErrors.push({ rowNumber, field: 'category', value: category, message: `Invalid Category. Allowed: ${Object.values(VehicleCategory).join(', ')}` });
        }
        if (isNaN(capacityTonnage) || capacityTonnage <= 0) {
          rowErrors.push({ rowNumber, field: 'capacityTonnage', value: rawCap, message: 'Capacity must be a positive number in Metric Tons.' });
        }

        if (plateNumber) {
          if (seenInFile.has(`PLATE:${plateNumber}`)) {
            rowErrors.push({ rowNumber, field: 'plateNumber', value: plateNumber, message: 'Duplicate vehicle plate within uploaded file.' });
          } else {
            seenInFile.add(`PLATE:${plateNumber}`);
          }
        }

        if (rowErrors.length === 0) {
          validRecords.push({
            plateNumber,
            vehicleType,
            category,
            capacityTonnage,
            make: (data['Make'] || '').toString().trim(),
            model: (data['Model'] || '').toString().trim(),
            yearOfManufacture: parseInt(data['Year of Manufacture'] || '', 10) || undefined,
            chassisNumber: (data['Chassis Number'] || '').toString().trim(),
            engineNumber: (data['Engine Number'] || '').toString().trim(),
            ownerName: (data['Owner Name'] || '').toString().trim(),
            ownerPhone: (data['Owner Phone'] || '').toString().trim()
          });
        }
      } else if (entityType === 'drivers') {
        const name = (data['Driver Name *'] || data['Driver Name'] || '').toString().trim();
        const phone = (data['Phone Number *'] || data['Phone Number'] || data['Phone'] || '').toString().trim();
        const licenseNumber = (data['Licence Number *'] || data['Licence Number'] || '').toString().trim().toUpperCase();
        const licenseType = (data['Licence Type (LMV/HMV/TRANS/TRAILER) *'] || data['Licence Type'] || 'HMV').toString().trim().toUpperCase();
        const rawExpiry = (data['Licence Expiry Date (YYYY-MM-DD) *'] || data['Licence Expiry Date'] || '').toString().trim();
        const expiryDate = new Date(rawExpiry);

        if (!name) rowErrors.push({ rowNumber, field: 'name', message: 'Driver name is mandatory.' });
        if (!phone) rowErrors.push({ rowNumber, field: 'phone', message: 'Phone number is mandatory.' });
        if (!licenseNumber) rowErrors.push({ rowNumber, field: 'licenseNumber', message: 'Licence number is mandatory.' });
        if (!Object.values(DriverLicenseType).includes(licenseType)) {
          rowErrors.push({ rowNumber, field: 'licenseType', value: licenseType, message: `Invalid Licence Type. Allowed: ${Object.values(DriverLicenseType).join(', ')}` });
        }
        if (isNaN(expiryDate.getTime())) {
          rowErrors.push({ rowNumber, field: 'licenseExpiryDate', value: rawExpiry, message: 'Invalid licence expiry date (Format: YYYY-MM-DD).' });
        }

        if (licenseNumber) {
          if (seenInFile.has(`DL:${licenseNumber}`)) {
            rowErrors.push({ rowNumber, field: 'licenseNumber', value: licenseNumber, message: 'Duplicate licence number within uploaded file.' });
          } else {
            seenInFile.add(`DL:${licenseNumber}`);
          }
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
      } else if (entityType === 'loads') {
        const customerRef = (data['Customer GSTIN or Name *'] || data['Customer'] || '').toString().trim();
        const consignorRef = (data['Consignor GSTIN or Name *'] || data['Consignor'] || '').toString().trim();
        const consigneeRef = (data['Consignee GSTIN or Name *'] || data['Consignee'] || '').toString().trim();
        const originRef = (data['Origin Location Code or Name *'] || data['Origin'] || '').toString().trim();
        const destRef = (data['Destination Location Code or Name *'] || data['Destination'] || '').toString().trim();
        const totalWeightMt = parseFloat(data['Total Weight MT *'] || data['Total Weight MT'] || 0);
        const totalQuantity = parseInt(data['Total Quantity *'] || data['Total Quantity'] || 1, 10);
        const packageType = (data['Package Type (Bags/Boxes/Drums/Pallets)'] || data['Package Type'] || 'Boxes').toString().trim();
        const baseFreightRupees = parseFloat(data['Base Freight INR *'] || data['Base Freight INR'] || 0);
        const advanceRupees = parseFloat(data['Advance Freight INR'] || 0);
        const remarks = (data['Remarks'] || '').toString().trim();

        if (!customerRef) rowErrors.push({ rowNumber, field: 'customerRef', message: 'Customer reference is mandatory.' });
        if (!consignorRef) rowErrors.push({ rowNumber, field: 'consignorRef', message: 'Consignor reference is mandatory.' });
        if (!consigneeRef) rowErrors.push({ rowNumber, field: 'consigneeRef', message: 'Consignee reference is mandatory.' });
        if (!originRef) rowErrors.push({ rowNumber, field: 'originRef', message: 'Origin location reference is mandatory.' });
        if (!destRef) rowErrors.push({ rowNumber, field: 'destRef', message: 'Destination location reference is mandatory.' });
        if (isNaN(totalWeightMt) || totalWeightMt <= 0) {
          rowErrors.push({ rowNumber, field: 'totalWeightMt', value: data['Total Weight MT *'], message: 'Total weight must be positive MT.' });
        }
        if (isNaN(baseFreightRupees) || baseFreightRupees <= 0) {
          rowErrors.push({ rowNumber, field: 'baseFreightRupees', value: data['Base Freight INR *'], message: 'Base freight must be positive.' });
        }

        if (rowErrors.length === 0) {
          validRecords.push({
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
    } else if (entityType === 'loads' && validRecords.length > 0) {
      // Resolve referenced customers and locations
      const parties = await CustomerParty.find({ companyId }).select('_id name gstin partyTypes');
      const locations = await Location.find({ companyId }).select('_id name code');

      for (let i = validRecords.length - 1; i >= 0; i--) {
        const item = validRecords[i];
        const custMatch = parties.find(p => p.gstin === item.customerRef || p.name.toLowerCase() === item.customerRef.toLowerCase());
        const conMatch = parties.find(p => p.gstin === item.consignorRef || p.name.toLowerCase() === item.consignorRef.toLowerCase());
        const cneeMatch = parties.find(p => p.gstin === item.consigneeRef || p.name.toLowerCase() === item.consigneeRef.toLowerCase());
        const origMatch = locations.find(l => l.code === item.originRef || l.name.toLowerCase() === item.originRef.toLowerCase());
        const destMatch = locations.find(l => l.code === item.destRef || l.name.toLowerCase() === item.destRef.toLowerCase());

        let hasRefError = false;
        if (!custMatch) {
          errors.push({ rowNumber: i + 2, field: 'customerRef', value: item.customerRef, message: `Customer '${item.customerRef}' not found in master records.` });
          hasRefError = true;
        }
        if (!conMatch) {
          errors.push({ rowNumber: i + 2, field: 'consignorRef', value: item.consignorRef, message: `Consignor '${item.consignorRef}' not found in master records.` });
          hasRefError = true;
        }
        if (!cneeMatch) {
          errors.push({ rowNumber: i + 2, field: 'consigneeRef', value: item.consigneeRef, message: `Consignee '${item.consigneeRef}' not found in master records.` });
          hasRefError = true;
        }
        if (!origMatch) {
          errors.push({ rowNumber: i + 2, field: 'originRef', value: item.originRef, message: `Origin location '${item.originRef}' not found.` });
          hasRefError = true;
        }
        if (!destMatch) {
          errors.push({ rowNumber: i + 2, field: 'destRef', value: item.destRef, message: `Destination location '${item.destRef}' not found.` });
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
    const enriched = recordsToImport.map(r => ({
      ...r,
      companyId,
      createdVia: 'EXCEL_IMPORT'
    }));

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
    const workbook = new ExcelJS.Workbook();
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
}

module.exports = new MasterImportExportService();
