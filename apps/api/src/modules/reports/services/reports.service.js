/**
 * Reports Service
 * Multi-criteria operational analytics, financial ledgers, compliance audits,
 * and high-fidelity streaming Excel/CSV exports with formula sanitization.
 */

let ExcelJS = null;
function getExcelJS() {
  if (!ExcelJS) {
    ExcelJS = require('exceljs');
  }
  return ExcelJS;
}
const mongoose = require('mongoose');
const Load = require('../../loads/models/Load');
const Trip = require('../../trips/models/Trip');
const Vehicle = require('../../vehicles/models/Vehicle');
const Driver = require('../../drivers/models/Driver');
const VehicleDocument = require('../../vehicles/models/VehicleDocument');
const DriverDocument = require('../../drivers/models/DriverDocument');
const CustomerParty = require('../../customers/models/CustomerParty');
const { AppError } = require('../../../middleware/errorHandler');

// Formula injection defense
function sanitizeValue(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number' || typeof val === 'boolean') return val;
  if (val instanceof Date) return val.toISOString().split('T')[0];
  const rawStr = String(val);
  const trimmed = rawStr.trim();
  if (!trimmed) return '';
  if (/^[\t\r]/.test(rawStr) || /^[=+\-@\t\r]/.test(trimmed)) {
    return `'${trimmed}`;
  }
  return trimmed;
}

class ReportsService {
  /**
   * 1. Loads Operational Report
   */
  static async getLoadsReport(companyId, filters = {}, pagination = {}) {
    const tenantObjectId = new mongoose.Types.ObjectId(companyId);
    const query = { companyId: tenantObjectId };

    if (filters.status) query.status = filters.status;
    if (filters.consignorId) query.consignorId = new mongoose.Types.ObjectId(filters.consignorId);
    if (filters.consigneeId) query.consigneeId = new mongoose.Types.ObjectId(filters.consigneeId);
    if (filters.vehicleId) query.assignedVehicleId = new mongoose.Types.ObjectId(filters.vehicleId);
    if (filters.driverId) query.assignedDriverId = new mongoose.Types.ObjectId(filters.driverId);

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const page = Math.max(1, parseInt(pagination.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(pagination.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const [rows, total, summaryAgg] = await Promise.all([
      Load.find(query)
        .populate('consignorId', 'name city state gstin')
        .populate('consigneeId', 'name city state gstin')
        .populate('assignedVehicleId', 'plateNumber registrationNumber make model')
        .populate('assignedDriverId', 'name phone licenseNumber licenceNumber')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Load.countDocuments(query),

      Load.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalFreight: {
              $sum: {
                $cond: [
                  { $gt: [{ $ifNull: ['$financials.totalFreightPaise', 0] }, 0] },
                  { $divide: ['$financials.totalFreightPaise', 100] },
                  { $ifNull: ['$charges.totalAmount', 0] }
                ]
              }
            },
            totalAdvance: {
              $sum: {
                $cond: [
                  { $gt: [{ $ifNull: ['$financials.advancePaise', 0] }, 0] },
                  { $divide: ['$financials.advancePaise', 100] },
                  { $ifNull: ['$charges.advanceAmount', 0] }
                ]
              }
            },
            totalBalance: {
              $sum: {
                $cond: [
                  { $gt: [{ $ifNull: ['$financials.balancePaise', 0] }, 0] },
                  { $divide: ['$financials.balancePaise', 100] },
                  { $ifNull: ['$charges.balanceAmount', 0] }
                ]
              }
            },
            totalWeightMt: { $sum: { $ifNull: ['$totalWeightMt', 0] } }
          }
        }
      ])
    ]);

    const summary = summaryAgg[0] || {
      totalFreight: 0,
      totalAdvance: 0,
      totalBalance: 0,
      totalWeightMt: 0
    };

    return {
      rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      summary: {
        totalLoads: total,
        totalWeightMt: Math.round(summary.totalWeightMt * 100) / 100,
        totalFreight: summary.totalFreight,
        totalAdvance: summary.totalAdvance,
        totalBalance: summary.totalBalance
      }
    };
  }

  /**
   * 2. Trips Operational Report
   */
  static async getTripsReport(companyId, filters = {}, pagination = {}) {
    const tenantObjectId = new mongoose.Types.ObjectId(companyId);
    const query = { companyId: tenantObjectId };

    if (filters.status) query.status = filters.status;
    if (filters.vehicleId) query.vehicleId = new mongoose.Types.ObjectId(filters.vehicleId);
    if (filters.driverId) query.driverId = new mongoose.Types.ObjectId(filters.driverId);

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const page = Math.max(1, parseInt(pagination.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(pagination.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const [rows, total, summaryAgg] = await Promise.all([
      Trip.find(query)
        .populate('vehicleId', 'plateNumber registrationNumber make model')
        .populate('driverId', 'name licenseNumber licenceNumber phone')
        .populate('stops.locationId', 'name city state')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Trip.countDocuments(query),

      Trip.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalFreight: {
              $sum: {
                $cond: [
                  { $gt: [{ $ifNull: ['$financials.grossFreightPaise', 0] }, 0] },
                  { $divide: ['$financials.grossFreightPaise', 100] },
                  { $ifNull: ['$freightAmount', 0] }
                ]
              }
            },
            totalAdvance: {
              $sum: {
                $cond: [
                  { $gt: [{ $ifNull: ['$financials.driverAdvancePaise', 0] }, 0] },
                  { $divide: ['$financials.driverAdvancePaise', 100] },
                  { $ifNull: ['$advanceAmount', 0] }
                ]
              }
            },
            totalExpenses: {
              $sum: {
                $cond: [
                  { $gt: [{ $ifNull: ['$financials.totalExpensesPaise', 0] }, 0] },
                  { $divide: ['$financials.totalExpensesPaise', 100] },
                  {
                    $reduce: {
                      input: {
                        $cond: [
                          { $gt: [{ $size: { $ifNull: ['$expenses', []] } }, 0] },
                          '$expenses',
                          { $ifNull: ['$tripExpenses', []] }
                        ]
                      },
                      initialValue: 0,
                      in: {
                        $add: [
                          '$$value',
                          {
                            $cond: [
                              { $gt: [{ $ifNull: ['$$this.amountPaise', 0] }, 0] },
                              { $divide: ['$$this.amountPaise', 100] },
                              { $ifNull: ['$$this.amount', 0] }
                            ]
                          }
                        ]
                      }
                    }
                  }
                ]
              }
            }
          }
        }
      ])
    ]);

    const summary = summaryAgg[0] || {
      totalFreight: 0,
      totalAdvance: 0,
      totalExpenses: 0
    };

    return {
      rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      summary: {
        totalTrips: total,
        totalFreight: summary.totalFreight,
        totalAdvance: summary.totalAdvance,
        totalExpenses: summary.totalExpenses,
        netEarnings: summary.totalFreight - summary.totalExpenses
      }
    };
  }

  /**
   * 3. Freight Billing & Customer Ledger Report
   */
  static async getFreightReport(companyId, filters = {}) {
    const tenantObjectId = new mongoose.Types.ObjectId(companyId);
    const match = { companyId: tenantObjectId };

    if (filters.customerId) {
      const custObjId = new mongoose.Types.ObjectId(filters.customerId);
      match.$or = [
        { customerId: custObjId },
        { consignorId: custObjId }
      ];
    }

    if (filters.startDate || filters.endDate) {
      match.createdAt = {};
      if (filters.startDate) match.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        match.createdAt.$lte = end;
      }
    }

    const customerAgg = await Load.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $ifNull: ['$customerId', '$consignorId'] },
          loadCount: { $sum: 1 },
          totalWeightMt: { $sum: { $ifNull: ['$totalWeightMt', 0] } },
          grossFreight: {
            $sum: {
              $cond: [
                { $gt: [{ $ifNull: ['$financials.baseFreightPaise', 0] }, 0] },
                { $divide: ['$financials.baseFreightPaise', 100] },
                { $ifNull: ['$charges.freightRate', 0] }
              ]
            }
          },
          totalCharges: {
            $sum: {
              $cond: [
                { $gt: [{ $ifNull: ['$financials.totalFreightPaise', 0] }, 0] },
                { $divide: ['$financials.totalFreightPaise', 100] },
                { $ifNull: ['$charges.totalAmount', 0] }
              ]
            }
          },
          advanceReceived: {
            $sum: {
              $cond: [
                { $gt: [{ $ifNull: ['$financials.advancePaise', 0] }, 0] },
                { $divide: ['$financials.advancePaise', 100] },
                { $ifNull: ['$charges.advanceAmount', 0] }
              ]
            }
          },
          balanceOutstanding: {
            $sum: {
              $cond: [
                { $gt: [{ $ifNull: ['$financials.balancePaise', 0] }, 0] },
                { $divide: ['$financials.balancePaise', 100] },
                { $ifNull: ['$charges.balanceAmount', 0] }
              ]
            }
          },
          gtaGstAmount: {
            $sum: {
              $multiply: [
                {
                  $cond: [
                    { $gt: [{ $ifNull: ['$financials.baseFreightPaise', 0] }, 0] },
                    { $divide: ['$financials.baseFreightPaise', 100] },
                    { $ifNull: ['$charges.freightRate', 0] }
                  ]
                },
                0.05 // 5% GTA SAC 9965
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'customerparties',
          localField: '_id',
          foreignField: '_id',
          as: 'customer'
        }
      },
      { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
      { $sort: { totalCharges: -1 } }
    ]);

    let grandGrossFreight = 0;
    let grandAdvanceReceived = 0;
    let grandBalanceOutstanding = 0;
    let grandGtaGst = 0;
    let grandWeightMt = 0;

    const rows = customerAgg.map((item) => {
      grandGrossFreight += item.totalCharges;
      grandAdvanceReceived += item.advanceReceived;
      grandBalanceOutstanding += item.balanceOutstanding;
      grandGtaGst += item.gtaGstAmount;
      grandWeightMt += item.totalWeightMt;

      return {
        customerId: item._id,
        customerName: item.customer?.name || 'Unassigned / Cash Party',
        gstin: item.customer?.gstin || 'Unregistered',
        city: item.customer?.billingAddress?.city || item.customer?.city || 'N/A',
        state: item.customer?.billingAddress?.state || item.customer?.state || 'N/A',
        loadCount: item.loadCount,
        totalWeightMt: Math.round(item.totalWeightMt * 100) / 100,
        grossFreight: item.totalCharges,
        gtaGstAmount: Math.round(item.gtaGstAmount * 100) / 100,
        advanceReceived: item.advanceReceived,
        balanceOutstanding: item.balanceOutstanding
      };
    });

    return {
      rows,
      summary: {
        totalCustomers: rows.length,
        totalWeightMt: Math.round(grandWeightMt * 100) / 100,
        grossFreight: grandGrossFreight,
        gtaGstAmount: Math.round(grandGtaGst * 100) / 100,
        advanceReceived: grandAdvanceReceived,
        balanceOutstanding: grandBalanceOutstanding
      }
    };
  }

  /**
   * 4. Fleet Compliance Audit Report
   */
  static async getComplianceReport(companyId, filters = {}) {
    const tenantObjectId = new mongoose.Types.ObjectId(companyId);
    const now = new Date();
    const in15Days = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [vDocs, dDocs] = await Promise.all([
      VehicleDocument.find({ companyId: tenantObjectId })
        .populate('vehicleId', 'plateNumber registrationNumber make model category vehicleType')
        .sort({ expiryDate: 1 })
        .lean(),

      DriverDocument.find({ companyId: tenantObjectId })
        .populate('driverId', 'name licenseNumber licenceNumber phone licenseType')
        .sort({ expiryDate: 1 })
        .lean()
    ]);

    const items = [];

    vDocs.forEach((d) => {
      const exp = new Date(d.expiryDate);
      const daysLeft = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
      let status = 'VALID';
      if (daysLeft < 0) status = 'EXPIRED';
      else if (daysLeft <= 15) status = 'CRITICAL_15';
      else if (daysLeft <= 30) status = 'WARNING_30';

      items.push({
        id: `vdoc_${d._id}`,
        entityType: 'VEHICLE',
        identifier: d.vehicleId?.plateNumber || d.vehicleId?.registrationNumber || 'Unknown Vehicle',
        subtext: `${d.vehicleId?.make || ''} ${d.vehicleId?.model || ''} (${d.vehicleId?.category || d.vehicleId?.vehicleType || 'Fleet'})`,
        documentType: d.documentType,
        documentNumber: d.documentNumber,
        issueDate: d.issueDate,
        expiryDate: d.expiryDate,
        daysLeft,
        status
      });
    });

    dDocs.forEach((d) => {
      const exp = new Date(d.expiryDate);
      const daysLeft = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
      let status = 'VALID';
      if (daysLeft < 0) status = 'EXPIRED';
      else if (daysLeft <= 15) status = 'CRITICAL_15';
      else if (daysLeft <= 30) status = 'WARNING_30';

      items.push({
        id: `ddoc_${d._id}`,
        entityType: 'DRIVER',
        identifier: d.driverId?.name || 'Unknown Driver',
        subtext: `DL: ${d.driverId?.licenseNumber || d.driverId?.licenceNumber || 'N/A'} • ${d.driverId?.phone || ''}`,
        documentType: d.documentType || 'DRIVING_LICENCE',
        documentNumber: d.documentNumber,
        issueDate: d.issueDate,
        expiryDate: d.expiryDate,
        daysLeft,
        status
      });
    });

    // Apply filtering
    let filtered = items;
    if (filters.status && filters.status !== 'ALL') {
      filtered = filtered.filter((i) => i.status === filters.status);
    }
    if (filters.entityType && filters.entityType !== 'ALL') {
      filtered = filtered.filter((i) => i.entityType === filters.entityType);
    }

    // Sort: EXPIRED first, then CRITICAL_15, then WARNING_30, then VALID
    const statusPriority = { EXPIRED: 1, CRITICAL_15: 2, WARNING_30: 3, VALID: 4 };
    filtered.sort((a, b) => {
      if (statusPriority[a.status] !== statusPriority[b.status]) {
        return statusPriority[a.status] - statusPriority[b.status];
      }
      return a.daysLeft - b.daysLeft;
    });

    const summary = {
      total: items.length,
      expired: items.filter((i) => i.status === 'EXPIRED').length,
      critical15: items.filter((i) => i.status === 'CRITICAL_15').length,
      warning30: items.filter((i) => i.status === 'WARNING_30').length,
      valid: items.filter((i) => i.status === 'VALID').length
    };

    return {
      rows: filtered,
      summary
    };
  }

  /**
   * 5. High-Fidelity Excel / CSV Export Builder
   */
  static async exportReport(companyId, reportType, filters = {}, format = 'xlsx') {
    const workbook = new (getExcelJS().Workbook)();
    workbook.creator = 'Technofay Fleet OS';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(reportType.toUpperCase());

    // Configure Columns & Populate based on report type
    if (reportType === 'loads') {
      const data = await this.getLoadsReport(companyId, filters, { page: 1, limit: 10000 });
      sheet.columns = [
        { header: 'Load Number', key: 'loadNumber', width: 18 },
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Consignor', key: 'consignor', width: 24 },
        { header: 'Consignee', key: 'consignee', width: 24 },
        { header: 'Origin', key: 'origin', width: 18 },
        { header: 'Destination', key: 'destination', width: 18 },
        { header: 'Weight (MT)', key: 'weightMt', width: 14 },
        { header: 'Status', key: 'status', width: 16 },
        { header: 'Total Freight (₹)', key: 'totalFreight', width: 18 },
        { header: 'Advance (₹)', key: 'advance', width: 16 },
        { header: 'Balance (₹)', key: 'balance', width: 16 }
      ];

      data.rows.forEach((r) => {
        sheet.addRow({
          loadNumber: sanitizeValue(r.loadNumber),
          date: r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : '',
          consignor: sanitizeValue(r.consignorId?.name || 'N/A'),
          consignee: sanitizeValue(r.consigneeId?.name || 'N/A'),
          origin: sanitizeValue(r.originLocation || ''),
          destination: sanitizeValue(r.destinationLocation || ''),
          weightMt: r.totalWeightMt || 0,
          status: sanitizeValue(r.status),
          totalFreight: (r.financials?.totalFreightPaise ? r.financials.totalFreightPaise / 100 : 0) || r.charges?.totalAmount || 0,
          advance: (r.financials?.advancePaise ? r.financials.advancePaise / 100 : 0) || r.charges?.advanceAmount || 0,
          balance: (r.financials?.balancePaise ? r.financials.balancePaise / 100 : 0) || r.charges?.balanceAmount || 0
        });
      });

      // Append Summary Total Row
      const totalRow = sheet.addRow({
        loadNumber: 'TOTAL',
        weightMt: data.summary.totalWeightMt,
        totalFreight: data.summary.totalFreight,
        advance: data.summary.totalAdvance,
        balance: data.summary.totalBalance
      });
      totalRow.font = { bold: true };
    } else if (reportType === 'trips') {
      const data = await this.getTripsReport(companyId, filters, { page: 1, limit: 10000 });
      sheet.columns = [
        { header: 'Trip Number', key: 'tripNumber', width: 18 },
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Vehicle', key: 'vehicle', width: 18 },
        { header: 'Driver', key: 'driver', width: 20 },
        { header: 'Origin', key: 'origin', width: 18 },
        { header: 'Destination', key: 'destination', width: 18 },
        { header: 'Status', key: 'status', width: 16 },
        { header: 'Freight (₹)', key: 'freight', width: 16 },
        { header: 'Advance (₹)', key: 'advance', width: 16 },
        { header: 'Expenses (₹)', key: 'expenses', width: 16 },
        { header: 'Net (₹)', key: 'net', width: 16 }
      ];

      data.rows.forEach((r) => {
        const expenses = (r.financials?.totalExpensesPaise ? r.financials.totalExpensesPaise / 100 : 0) ||
          (r.expenses || []).reduce((acc, e) => acc + (e.amountPaise ? e.amountPaise / 100 : 0), 0) ||
          (r.tripExpenses || []).reduce((acc, e) => acc + (e.amount || 0), 0);
        const freight = (r.financials?.grossFreightPaise ? r.financials.grossFreightPaise / 100 : 0) || r.freightAmount || 0;
        const advance = (r.financials?.driverAdvancePaise ? r.financials.driverAdvancePaise / 100 : 0) || r.advanceAmount || 0;
        sheet.addRow({
          tripNumber: sanitizeValue(r.tripNumber),
          date: r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : '',
          vehicle: sanitizeValue(r.vehicleId?.plateNumber || r.vehicleId?.registrationNumber || 'N/A'),
          driver: sanitizeValue(r.driverId?.name || 'N/A'),
          origin: sanitizeValue(r.stops?.[0]?.locationId?.name || ''),
          destination: sanitizeValue(r.stops?.[r.stops?.length - 1]?.locationId?.name || ''),
          status: sanitizeValue(r.status),
          freight,
          advance,
          expenses,
          net: freight - expenses
        });
      });

      const totalRow = sheet.addRow({
        tripNumber: 'TOTAL',
        freight: data.summary.totalFreight,
        advance: data.summary.totalAdvance,
        expenses: data.summary.totalExpenses,
        net: data.summary.netEarnings
      });
      totalRow.font = { bold: true };
    } else if (reportType === 'freight') {
      const data = await this.getFreightReport(companyId, filters);
      sheet.columns = [
        { header: 'Customer Party', key: 'customer', width: 26 },
        { header: 'GSTIN', key: 'gstin', width: 18 },
        { header: 'City', key: 'city', width: 16 },
        { header: 'Loads Count', key: 'loads', width: 14 },
        { header: 'Weight (MT)', key: 'weightMt', width: 14 },
        { header: 'Gross Freight (₹)', key: 'grossFreight', width: 18 },
        { header: '5% GTA GST (₹)', key: 'gst', width: 16 },
        { header: 'Advance Received (₹)', key: 'advance', width: 20 },
        { header: 'Balance Due (₹)', key: 'balance', width: 18 }
      ];

      data.rows.forEach((r) => {
        sheet.addRow({
          customer: sanitizeValue(r.customerName),
          gstin: sanitizeValue(r.gstin),
          city: sanitizeValue(r.city),
          loads: r.loadCount,
          weightMt: r.totalWeightMt,
          grossFreight: r.grossFreight,
          gst: r.gtaGstAmount,
          advance: r.advanceReceived,
          balance: r.balanceOutstanding
        });
      });

      const totalRow = sheet.addRow({
        customer: 'TOTAL',
        loads: data.rows.reduce((acc, r) => acc + r.loadCount, 0),
        weightMt: data.summary.totalWeightMt,
        grossFreight: data.summary.grossFreight,
        gst: data.summary.gtaGstAmount,
        advance: data.summary.advanceReceived,
        balance: data.summary.balanceOutstanding
      });
      totalRow.font = { bold: true };
    } else if (reportType === 'compliance') {
      const data = await this.getComplianceReport(companyId, filters);
      sheet.columns = [
        { header: 'Entity', key: 'entityType', width: 12 },
        { header: 'Registration / Name', key: 'identifier', width: 24 },
        { header: 'Details', key: 'subtext', width: 26 },
        { header: 'Document', key: 'documentType', width: 18 },
        { header: 'Document #', key: 'documentNumber', width: 20 },
        { header: 'Expiry Date', key: 'expiryDate', width: 16 },
        { header: 'Days Left', key: 'daysLeft', width: 12 },
        { header: 'Compliance Status', key: 'status', width: 18 }
      ];

      data.rows.forEach((r) => {
        sheet.addRow({
          entityType: sanitizeValue(r.entityType),
          identifier: sanitizeValue(r.identifier),
          subtext: sanitizeValue(r.subtext),
          documentType: sanitizeValue(r.documentType),
          documentNumber: sanitizeValue(r.documentNumber),
          expiryDate: r.expiryDate ? new Date(r.expiryDate).toLocaleDateString('en-IN') : '',
          daysLeft: r.daysLeft,
          status: sanitizeValue(r.status)
        });
      });
    } else {
      throw new AppError(`Unknown report type: ${reportType}`, 400);
    }

    // Header styling
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' } // Dark Navy
    };

    if (format === 'csv') {
      return workbook.csv.writeBuffer();
    }
    return workbook.xlsx.writeBuffer();
  }
}

module.exports = ReportsService;
