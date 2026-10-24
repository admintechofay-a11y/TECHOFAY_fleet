/**
 * PDF Generation Engine
 * Generates official, template-driven PDFs for Lorry Receipts (LR), Bilties, and Loading Slips.
 * Uses PDFKit for high-performance server-side streamable document creation.
 */

const PDFDocument = require('pdfkit');

class PdfService {
  /**
   * Helper to draw a horizontal rule
   */
  _drawDivider(doc, y) {
    doc
      .strokeColor('#cbd5e1')
      .lineWidth(0.75)
      .moveTo(40, y)
      .lineTo(570, y)
      .stroke();
  }

  /**
   * Helper to write company branding header
   */
  _drawHeader(doc, company, documentTitle) {
    // Navy banner background
    doc.rect(40, 30, 530, 45).fill('#0f172a');

    doc
      .fillColor('#38bdf8')
      .fontSize(14)
      .font('Helvetica-Bold')
      .text(company.tradeName || company.legalName || 'TECHNOFAY LOGISTICS', 50, 38);

    doc
      .fillColor('#94a3b8')
      .fontSize(8)
      .font('Helvetica')
      .text(`GSTIN: ${company.gstin || 'N/A'}  •  GTA SAC CODE: 9965`, 50, 55);

    doc
      .fillColor('#f8fafc')
      .fontSize(11)
      .font('Helvetica-Bold')
      .text(documentTitle.toUpperCase(), 300, 44, { align: 'right', width: 260 });

    doc.moveDown(2);
  }

  /**
   * 1. Generate Lorry Receipt (LR) PDF
   */
  async generateLrPdf(lr, company) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      this._drawHeader(doc, company, 'Official Lorry Receipt');

      let y = 90;

      // LR & Date Box
      doc.rect(40, y, 530, 40).fillAndStroke('#f8fafc', '#e2e8f0');
      doc.fillColor('#1e293b').fontSize(9).font('Helvetica-Bold');
      doc.text(`LR Number: ${lr.lrNumber}`, 50, y + 10);
      doc.text(`Date Issued: ${new Date(lr.issuedDate || Date.now()).toLocaleDateString('en-IN')}`, 320, y + 10);

      doc.font('Helvetica').fontSize(8).fillColor('#475569');
      doc.text(`E-Way Bill: ${lr.eWayBillNumber || 'N/A'}`, 50, y + 24);
      doc.text(`Vehicle: ${lr.vehicleId?.plateNumber || 'Unassigned'}  •  Driver: ${lr.driverId?.name || 'Unassigned'}`, 320, y + 24);

      y += 50;

      // Consignor & Consignee Columns
      doc.rect(40, y, 260, 75).stroke('#cbd5e1');
      doc.rect(310, y, 260, 75).stroke('#cbd5e1');

      // Consignor
      doc.fillColor('#0284c7').fontSize(8).font('Helvetica-Bold').text('CONSIGNOR (FROM):', 50, y + 8);
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text(lr.consignorId?.name || 'Consignor Name', 50, y + 20);
      doc.font('Helvetica').fontSize(8).fillColor('#475569');
      doc.text(`GSTIN: ${lr.consignorId?.gstin || 'Unregistered'}`, 50, y + 33);
      doc.text(`${lr.consignorId?.billingAddress?.city || ''}, ${lr.consignorId?.billingAddress?.state || ''}`, 50, y + 45);

      // Consignee
      doc.fillColor('#0284c7').fontSize(8).font('Helvetica-Bold').text('CONSIGNEE (TO):', 320, y + 8);
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text(lr.consigneeId?.name || 'Consignee Name', 320, y + 20);
      doc.font('Helvetica').fontSize(8).fillColor('#475569');
      doc.text(`GSTIN: ${lr.consigneeId?.gstin || 'Unregistered'}`, 320, y + 33);
      doc.text(`${lr.consigneeId?.billingAddress?.city || ''}, ${lr.consigneeId?.billingAddress?.state || ''}`, 320, y + 45);

      y += 85;

      // Consignment Details Table Header
      doc.rect(40, y, 530, 22).fill('#1e293b');
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      doc.text('PACKAGE & GOODS DESCRIPTION', 50, y + 6);
      doc.text('QUANTITY', 280, y + 6);
      doc.text('TOTAL WEIGHT (MT)', 380, y + 6);
      doc.text('STATUS', 490, y + 6);

      y += 24;

      // Table Row
      doc.rect(40, y, 530, 30).fillAndStroke('#ffffff', '#e2e8f0');
      doc.fillColor('#0f172a').fontSize(8).font('Helvetica');
      doc.text(`${lr.loadId?.packageType || 'General Cargo'} - Bulk Consignment`, 50, y + 10);
      doc.text(`${lr.loadId?.totalQuantity || 1} Pkgs`, 280, y + 10);
      doc.text(`${lr.loadId?.totalWeightMt || 0} MT`, 380, y + 10);
      doc.font('Helvetica-Bold').text(lr.status || 'BOOKED', 490, y + 10);

      y += 45;

      // Freight & Balance Box
      if (lr.loadId?.financials) {
        const f = lr.loadId.financials;
        doc.rect(40, y, 530, 45).fillAndStroke('#f8fafc', '#cbd5e1');
        doc.fillColor('#1e293b').fontSize(8).font('Helvetica-Bold');
        doc.text('FREIGHT SUMMARY (INR):', 50, y + 8);
        doc.font('Helvetica').fontSize(8).fillColor('#334155');
        doc.text(`Base Freight: ₹${((f.baseFreightPaise || 0) / 100).toFixed(2)}`, 50, y + 22);
        doc.text(`Toll & Loading: ₹${(((f.tollPaise || 0) + (f.loadingPaise || 0)) / 100).toFixed(2)}`, 180, y + 22);
        doc.text(`Total Freight: ₹${((f.totalFreightPaise || 0) / 100).toFixed(2)}`, 320, y + 22);
        doc.font('Helvetica-Bold').fillColor('#0284c7');
        doc.text(`Balance to Pay: ₹${((f.balancePaise || 0) / 100).toFixed(2)}`, 440, y + 22);
        y += 55;
      }

      // Terms & Signature block
      y += 10;
      doc.fillColor('#64748b').fontSize(7).font('Helvetica');
      doc.text('Terms: Subject to standard GTA Carrier conditions. Consignee copy to be signed and stamped upon delivery.', 40, y);

      y += 40;
      this._drawDivider(doc, y);
      y += 15;

      doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold');
      doc.text('Authorized Signatory / Booking Officer', 50, y);
      doc.text('Driver Signature / Fingerprint', 240, y);
      doc.text('Consignee Receiving Seal & Sign', 420, y);

      // Watermark note
      doc.fontSize(6).fillColor('#94a3b8').text('SAMPLE DOCUMENT GENERATED BY TECHNOFAY FLEET OS', 40, 800, { align: 'center', width: 530 });

      doc.end();
    });
  }

  /**
   * 2. Generate Bilty Consignment Note PDF
   */
  async generateBiltyPdf(bilty, company) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      this._drawHeader(doc, company, 'Consignment Bilty');

      let y = 90;

      // Key details banner
      doc.rect(40, y, 530, 36).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold');
      doc.text(`Bilty No: ${bilty.biltyNumber}`, 50, y + 8);
      doc.text(`LR Link: ${bilty.lrId?.lrNumber || 'N/A'}`, 240, y + 8);
      doc.text(`Payment: ${bilty.paymentTerms}`, 430, y + 8);

      doc.font('Helvetica').fontSize(8).fillColor('#64748b');
      doc.text(`GTA SAC Code: ${bilty.gstGtaSac} (Rate: ${bilty.gstGtaRate}%)`, 50, y + 22);
      doc.text(`Date: ${new Date(bilty.createdAt || Date.now()).toLocaleDateString('en-IN')}`, 430, y + 22);

      y += 48;

      // Parties block
      doc.rect(40, y, 260, 65).stroke('#cbd5e1');
      doc.rect(310, y, 260, 65).stroke('#cbd5e1');

      doc.fillColor('#0284c7').fontSize(8).font('Helvetica-Bold').text('CONSIGNOR:', 50, y + 6);
      doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text(bilty.consignorId?.name || '', 50, y + 18);
      doc.font('Helvetica').fontSize(7.5).fillColor('#475569');
      doc.text(`GSTIN: ${bilty.consignorId?.gstin || 'Unregistered'}`, 50, y + 30);
      doc.text(`${bilty.consignorId?.billingAddress?.city || ''}, ${bilty.consignorId?.billingAddress?.state || ''}`, 50, y + 42);

      doc.fillColor('#0284c7').fontSize(8).font('Helvetica-Bold').text('CONSIGNEE:', 320, y + 6);
      doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text(bilty.consigneeId?.name || '', 320, y + 18);
      doc.font('Helvetica').fontSize(7.5).fillColor('#475569');
      doc.text(`GSTIN: ${bilty.consigneeId?.gstin || 'Unregistered'}`, 320, y + 30);
      doc.text(`${bilty.consigneeId?.billingAddress?.city || ''}, ${bilty.consigneeId?.billingAddress?.state || ''}`, 320, y + 42);

      y += 75;

      // Financial Calculation Table
      doc.rect(40, y, 530, 20).fill('#1e293b');
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      doc.text('FREIGHT ACCOUNTING BREAKDOWN', 50, y + 5);
      doc.text('AMOUNT (INR)', 470, y + 5);

      y += 22;

      const totalFreight = ((bilty.totalFreightPaise || 0) / 100).toFixed(2);
      const advance = ((bilty.advancePaise || 0) / 100).toFixed(2);
      const balance = ((bilty.balancePaise || 0) / 100).toFixed(2);

      doc.rect(40, y, 530, 60).fillAndStroke('#ffffff', '#e2e8f0');
      doc.fillColor('#1e293b').fontSize(8).font('Helvetica');
      doc.text('Gross Freight Charges (Inclusive of all route expenses)', 50, y + 8);
      doc.text(`₹${totalFreight}`, 470, y + 8);

      doc.text('Less: Advance Paid to Transporter/Driver', 50, y + 24);
      doc.text(`- ₹${advance}`, 470, y + 24);

      doc.font('Helvetica-Bold').fillColor('#0284c7');
      doc.text('Net Balance Freight Payable upon Delivery', 50, y + 42);
      doc.text(`₹${balance}`, 470, y + 42);

      y += 75;

      // GST GTA Notice Box
      doc.rect(40, y, 530, 35).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fillColor('#334155').fontSize(7.5).font('Helvetica-Bold');
      doc.text('GST DECLARATION UNDER REVERSE CHARGE MECHANISM (RCM):', 50, y + 6);
      doc.font('Helvetica').fontSize(7).fillColor('#64748b');
      doc.text(
        'Transport of goods by road in a goods carriage. Tax on GTA services is payable by the recipient under Section 9(3) of CGST Act at 5% SAC 9965 unless otherwise specified.',
        50,
        y + 18,
        { width: 510 }
      );

      y += 50;
      this._drawDivider(doc, y);
      y += 20;

      doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold');
      doc.text('For ' + (company.tradeName || 'Carrier'), 50, y);
      doc.text('Driver Acknowledgement', 260, y);
      doc.text('Receiver Signature', 440, y);

      doc.end();
    });
  }

  /**
   * 3. Generate Loading Slip / Gate Pass PDF
   */
  async generateLoadingSlipPdf(load, company) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      this._drawHeader(doc, company, 'Loading Slip & Gate Pass');

      let y = 90;

      // Load & Vehicle Header
      doc.rect(40, y, 530, 40).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold');
      doc.text(`Load Number: ${load.loadNumber}`, 50, y + 10);
      doc.text(`Assigned Vehicle: ${load.assignedVehicleId?.plateNumber || 'Pending'}`, 240, y + 10);
      doc.text(`Driver: ${load.assignedDriverId?.name || 'Pending'}`, 400, y + 10);

      doc.font('Helvetica').fontSize(8).fillColor('#64748b');
      doc.text(`Package: ${load.packageType}  •  Weight: ${load.totalWeightMt} MT`, 50, y + 24);
      doc.text(`Order Date: ${new Date(load.orderDate).toLocaleDateString('en-IN')}`, 400, y + 24);

      y += 55;

      // Ordered Route Stops Table
      doc.rect(40, y, 530, 20).fill('#1e293b');
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      doc.text('SEQ', 48, y + 5);
      doc.text('STOP TYPE', 80, y + 5);
      doc.text('LOCATION / TERMINAL', 160, y + 5);
      doc.text('ALLOCATED QTY', 350, y + 5);
      doc.text('STATUS', 480, y + 5);

      y += 22;

      if (load.stops && load.stops.length > 0) {
        load.stops.forEach((stop, idx) => {
          doc.rect(40, y, 530, 26).fillAndStroke(idx % 2 === 0 ? '#ffffff' : '#f8fafc', '#e2e8f0');
          doc.fillColor('#0f172a').fontSize(8).font('Helvetica');
          doc.text(String(stop.sequence), 52, y + 8);
          doc.font('Helvetica-Bold').text(stop.stopType, 80, y + 8);
          doc.font('Helvetica').text(stop.locationId?.name || 'Terminal Point', 160, y + 8);
          doc.text(`${stop.allocatedQuantity || 0} Pkgs (${stop.allocatedWeightMt || 0} MT)`, 350, y + 8);
          doc.text(stop.status || 'PENDING', 480, y + 8);
          y += 28;
        });
      }

      y += 20;
      doc.rect(40, y, 530, 40).stroke('#cbd5e1');
      doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold').text('SPECIAL INSTRUCTIONS / REMARKS:', 50, y + 8);
      doc.font('Helvetica').fontSize(8).fillColor('#64748b').text(load.remarks || 'Ensure all cargo straps and tarpaulins are securely fastened before exit.', 50, y + 22);

      y += 60;
      this._drawDivider(doc, y);
      y += 20;

      doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold');
      doc.text('Loading Supervisor', 50, y);
      doc.text('Security Gate Stamp', 240, y);
      doc.text('Driver Signature', 440, y);

      doc.end();
    });
  }

  /**
   * 4. Generate Official Trip Sheet / Dispatch Challan PDF
   */
  async generateTripSheetPdf(trip, company) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      this._drawHeader(doc, company, 'Official Trip Sheet');

      let y = 90;

      // Trip Dispatch Header Box
      doc.rect(40, y, 530, 48).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold');
      doc.text(`Trip Number: ${trip.tripNumber}`, 50, y + 8);
      doc.text(`Status: ${trip.status}`, 240, y + 8);
      doc.text(`Date: ${new Date(trip.startDateTime || Date.now()).toLocaleDateString('en-IN')}`, 410, y + 8);

      doc.font('Helvetica').fontSize(8).fillColor('#475569');
      doc.text(`Vehicle: ${trip.vehicleId?.plateNumber || 'N/A'} (${trip.vehicleId?.make || ''} ${trip.vehicleId?.model || ''})`, 50, y + 24);
      doc.text(`Driver: ${trip.driverId?.name || 'N/A'} (Phone: ${trip.driverId?.phone || 'N/A'})`, 240, y + 24);
      doc.text(`DL: ${trip.driverId?.licenseNumber || 'N/A'}`, 410, y + 24);

      y += 60;

      // Underlying Consignment Details
      doc.rect(40, y, 530, 36).fillAndStroke('#ffffff', '#e2e8f0');
      doc.fillColor('#0284c7').fontSize(8).font('Helvetica-Bold').text('LINKED CONSIGNMENT LOAD:', 50, y + 6);
      doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica');
      doc.text(`Load No: ${trip.loadId?.loadNumber || 'N/A'}`, 50, y + 18);
      doc.text(`Cargo: ${trip.loadId?.packageType || 'General Cargo'} - ${trip.loadId?.totalWeightMt || 0} MT (${trip.loadId?.totalQuantity || 0} Pkgs)`, 180, y + 18);
      doc.text(`Customer: ${trip.loadId?.customerId?.name || 'N/A'}`, 400, y + 18);

      y += 46;

      // Ordered Stops Table
      doc.rect(40, y, 530, 20).fill('#1e293b');
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      doc.text('SEQ', 48, y + 5);
      doc.text('STOP TYPE', 80, y + 5);
      doc.text('LOCATION / TERMINAL', 150, y + 5);
      doc.text('ALLOCATED', 340, y + 5);
      doc.text('DELIVERED', 420, y + 5);
      doc.text('STATUS', 490, y + 5);

      y += 22;

      if (trip.stops && trip.stops.length > 0) {
        trip.stops.forEach((stop, idx) => {
          doc.rect(40, y, 530, 26).fillAndStroke(idx % 2 === 0 ? '#ffffff' : '#f8fafc', '#e2e8f0');
          doc.fillColor('#0f172a').fontSize(8).font('Helvetica');
          doc.text(String(stop.sequence), 52, y + 8);
          doc.font('Helvetica-Bold').text(stop.stopType, 80, y + 8);
          doc.font('Helvetica').text(stop.locationId?.name || 'Waypoint', 150, y + 8);
          doc.text(`${stop.allocatedQuantity || 0} Pkgs`, 340, y + 8);
          doc.text(`${stop.deliveredQuantity || 0} Pkgs`, 420, y + 8);
          doc.font('Helvetica-Bold').text(stop.status || 'PENDING', 490, y + 8);
          y += 28;
        });
      }

      y += 15;

      // Advance & Instructions Box
      doc.rect(40, y, 530, 45).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold');
      doc.text('DRIVER DISPATCH INSTRUCTIONS & ADVANCE:', 50, y + 8);
      doc.font('Helvetica').fontSize(8).fillColor('#64748b');
      doc.text(`Driver Fuel/Route Advance: ₹${((trip.financials?.driverAdvancePaise || 0) / 100).toFixed(2)}`, 50, y + 24);
      doc.text(trip.remarks || 'Maintain transit temperature/speed limits. Report breakdowns immediately to transport desk.', 220, y + 24, { width: 330 });

      y += 65;
      this._drawDivider(doc, y);
      y += 20;

      doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold');
      doc.text('Transport Dispatcher', 50, y);
      doc.text('Driver Acknowledged & Received Advance', 240, y);
      doc.text('Gate Security Check', 440, y);

      doc.end();
    });
  }

  /**
   * 5. Generate Trip Settlement Statement PDF
   */
  async generateSettlementPdf(trip, company) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      this._drawHeader(doc, company, 'Trip Financial Settlement');

      let y = 90;

      // Settlement Header
      doc.rect(40, y, 530, 42).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold');
      doc.text(`Trip Ref: ${trip.tripNumber}`, 50, y + 8);
      doc.text(`Vehicle: ${trip.vehicleId?.plateNumber || 'N/A'}`, 240, y + 8);
      doc.text(`Settlement Date: ${new Date().toLocaleDateString('en-IN')}`, 400, y + 8);

      doc.font('Helvetica').fontSize(8).fillColor('#475569');
      doc.text(`Driver: ${trip.driverId?.name || 'N/A'}`, 50, y + 24);
      doc.text(`Load No: ${trip.loadId?.loadNumber || 'N/A'}`, 240, y + 24);
      doc.text(`Trip Status: ${trip.status}`, 400, y + 24);

      y += 54;

      // Itemized Route Expenses Table
      doc.rect(40, y, 530, 20).fill('#1e293b');
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      doc.text('EXPENSE CATEGORY', 50, y + 5);
      doc.text('DESCRIPTION', 180, y + 5);
      doc.text('PAID BY', 370, y + 5);
      doc.text('AMOUNT (INR)', 470, y + 5);

      y += 22;

      if (trip.expenses && trip.expenses.length > 0) {
        trip.expenses.forEach((exp, idx) => {
          doc.rect(40, y, 530, 24).fillAndStroke(idx % 2 === 0 ? '#ffffff' : '#f8fafc', '#e2e8f0');
          doc.fillColor('#0f172a').fontSize(8).font('Helvetica');
          doc.text(exp.expenseType, 50, y + 6);
          doc.text(exp.description || 'Route expense', 180, y + 6);
          doc.text(exp.paidBy || 'DRIVER', 370, y + 6);
          doc.text(`₹${((exp.amountPaise || 0) / 100).toFixed(2)}`, 470, y + 6);
          y += 26;
        });
      } else {
        doc.rect(40, y, 530, 24).fillAndStroke('#ffffff', '#e2e8f0');
        doc.fillColor('#64748b').fontSize(8).font('Helvetica').text('No line-item route expenses recorded.', 50, y + 6);
        y += 26;
      }

      y += 15;

      // Settlement Accounting Box
      doc.rect(40, y, 530, 85).fillAndStroke('#ffffff', '#cbd5e1');
      doc.fillColor('#1e293b').fontSize(8.5).font('Helvetica-Bold').text('FINAL TRIP RECONCILIATION:', 50, y + 8);

      const grossFreight = ((trip.financials?.grossFreightPaise || 0) / 100).toFixed(2);
      const totalExp = ((trip.financials?.totalExpensesPaise || 0) / 100).toFixed(2);
      const adv = ((trip.financials?.driverAdvancePaise || 0) / 100).toFixed(2);
      const net = ((trip.financials?.netSettlementPaise || 0) / 100).toFixed(2);

      doc.font('Helvetica').fontSize(8).fillColor('#334155');
      doc.text('Gross Freight Revenue:', 50, y + 26);
      doc.text(`₹${grossFreight}`, 470, y + 26);

      doc.text('Less: Total Incurred Route Expenses:', 50, y + 42);
      doc.text(`- ₹${totalExp}`, 470, y + 42);

      doc.text('Less: Advance Disbursed to Driver:', 50, y + 56);
      doc.text(`- ₹${adv}`, 470, y + 56);

      doc.font('Helvetica-Bold').fontSize(9).fillColor('#0284c7');
      doc.text('Net Trip Balance / Margin:', 50, y + 72);
      doc.text(`₹${net}`, 470, y + 72);

      y += 105;
      this._drawDivider(doc, y);
      y += 20;

      doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold');
      doc.text('Driver Settlement Sign', 50, y);
      doc.text('Accounts Officer', 240, y);
      doc.text('Transport Manager Approval', 420, y);

      doc.end();
    });
  }
}

module.exports = new PdfService();
