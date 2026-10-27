/**
 * Production PDF Generation Engine
 * Generates official, template-driven, print-ready PDFs for:
 * 1. Lorry Receipts (LR) with multi-copy support (Consignor, Consignee, Driver, Transporter)
 * 2. Bilty Consignment Notes compliant with GTA SAC 9965 and Section 9(3) CGST Act 2017
 * 3. Loading Slips & Security Gate Passes
 * 4. Official Trip Sheets & Dispatch Challans
 * 5. Trip Financial Settlement Statements
 * 6. Fleet Maintenance Job Cards & Work Orders
 *
 * Uses PDFKit with precision vector layouts, simulated barcodes, and Indian logistics formatting.
 */

let PDFDocument = null;
function getPDFDocument() {
  if (!PDFDocument) {
    PDFDocument = require('pdfkit');
  }
  return PDFDocument;
}

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
   * Draw an authentic ISO/IEC 15417 Code 128-B scannable vector barcode
   */
  _drawBarcode(doc, x, y, codeText) {
    const raw = String(codeText || '').trim();
    if (!raw) return;

    // Standard Code 128 Pattern Table (0 to 106)
    const CODE128_PATTERNS = [
      '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
      '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
      '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
      '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
      '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
      '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
      '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
      '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
      '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
      '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
      '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
    ];

    // Encode chars in Code 128-B range (ASCII 32 to 126)
    const values = [];
    for (let i = 0; i < raw.length; i++) {
      const code = raw.charCodeAt(i);
      if (code >= 32 && code <= 126) {
        values.push(code - 32);
      }
    }

    // Start Code B is index 104
    let checksum = 104;
    for (let i = 0; i < values.length; i++) {
      checksum += values[i] * (i + 1);
    }
    checksum %= 103;

    // Sequence: Start B (104), data symbols, checksum, Stop (106)
    const sequence = [104, ...values, checksum, 106];

    // Calculate total module count
    // Each standard symbol is 11 modules; Stop is 13 modules
    const totalModules = (sequence.length - 1) * 11 + 13;
    const maxBarcodeWidth = 145;
    const moduleWidth = Math.min(0.85, maxBarcodeWidth / totalModules);
    const barcodeHeight = 22;

    doc.save();
    // Background card for quiet zone
    doc.rect(x - 4, y - 2, maxBarcodeWidth + 8, barcodeHeight + 14).fill('#ffffff');

    let currentX = x;
    sequence.forEach((symIdx) => {
      const pattern = CODE128_PATTERNS[symIdx] || '212222';
      for (let p = 0; p < pattern.length; p++) {
        const width = parseInt(pattern[p], 10) * moduleWidth;
        if (p % 2 === 0) {
          // Bar (filled)
          doc.rect(currentX, y, width, barcodeHeight).fill('#0f172a');
        }
        currentX += width;
      }
    });

    // Human-readable caption beneath barcode
    doc
      .fillColor('#334155')
      .fontSize(7)
      .font('Courier-Bold')
      .text(`* ${raw} *`, x, y + barcodeHeight + 2, { width: maxBarcodeWidth, align: 'center' });

    doc.restore();
  }

  /**
   * Helper to write company branding header with copy indicator
   */
  _drawHeader(doc, company = {}, documentTitle, copyType = 'ORIGINAL') {
    // Determine badge color based on copy type
    const copyColors = {
      CONSIGNOR: { bg: '#be123c', text: '#ffffff', label: 'CONSIGNOR COPY' },
      CONSIGNEE: { bg: '#047857', text: '#ffffff', label: 'CONSIGNEE COPY' },
      DRIVER: { bg: '#1d4ed8', text: '#ffffff', label: 'DRIVER / LORRY COPY' },
      TRANSPORTER: { bg: '#334155', text: '#ffffff', label: 'TRANSPORTER RECORD' },
      ORIGINAL: { bg: '#0284c7', text: '#ffffff', label: 'ORIGINAL COPY' }
    };
    const activeBadge = copyColors[copyType.toUpperCase()] || copyColors.ORIGINAL;

    // Navy banner background
    doc.rect(40, 30, 530, 52).fill('#0b1329');

    // Company Logo / Emblem mark
    doc.rect(48, 38, 36, 36).fill('#0284c7');
    doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold').text('T', 60, 48);

    // Company Name & Info (Never fabricate names or fake GSTINs)
    const companyDisplayName =
      company.tradeName || company.legalName || company.name || 'ORGANIZATION NAME NOT CONFIGURED';
    const gstinLine = company.gstin ? `GSTIN: ${company.gstin}` : 'GSTIN: UNREGISTERED / NOT CONFIGURED';
    const panLine = company.pan
      ? `PAN: ${company.pan}`
      : (company.gstin && company.gstin.length >= 12 ? `PAN: ${company.gstin.slice(2, 12)}` : 'PAN: NOT CONFIGURED');

    let carrierAddress = '';
    if (company.address) {
      if (typeof company.address === 'string') {
        carrierAddress = company.address;
      } else {
        carrierAddress = [
          company.address.addressLine1 || company.address.street,
          company.address.city,
          company.address.state,
          company.address.pincode
        ].filter(Boolean).join(', ');
      }
    }
    if (!carrierAddress && company.billingAddress) {
      carrierAddress = [
        company.billingAddress.addressLine1 || company.billingAddress.street,
        company.billingAddress.city,
        company.billingAddress.state,
        company.billingAddress.pincode
      ].filter(Boolean).join(', ');
    }
    if (!carrierAddress) {
      carrierAddress = company.registeredAddress || 'Registered Office Address: Not Configured';
    }

    doc
      .fillColor('#38bdf8')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(companyDisplayName, 92, 38, { width: 240, ellipsis: true });

    doc
      .fillColor('#94a3b8')
      .fontSize(7.5)
      .font('Helvetica')
      .text(`${gstinLine}  •  ${panLine}  •  GTA SAC: 9965`, 92, 54);

    doc
      .fillColor('#64748b')
      .fontSize(7)
      .font('Helvetica')
      .text(`Carrier Office: ${carrierAddress}`, 92, 66, { width: 250, ellipsis: true });

    // Document Title & Copy Type Badge
    doc
      .fillColor('#f8fafc')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text(documentTitle.toUpperCase(), 340, 38, { align: 'right', width: 220 });

    // Copy Type Tag
    doc.rect(450, 56, 110, 16).fill(activeBadge.bg);
    doc
      .fillColor(activeBadge.text)
      .fontSize(7)
      .font('Helvetica-Bold')
      .text(activeBadge.label, 450, 60, { align: 'center', width: 110 });

    doc.moveDown(2);
  }

  /**
   * 1. Generate Lorry Receipt (LR) PDF
   */
  async generateLrPdf(lr, company, options = {}) {
    const copy = (options.copy || 'ORIGINAL').toUpperCase();
    return new Promise((resolve, reject) => {
      const doc = new (getPDFDocument())({ margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      this._drawHeader(doc, company, 'Official Lorry Receipt', copy);

      let y = 92;

      // LR & Barcode Box
      doc.rect(40, y, 530, 46).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fillColor('#0f172a').fontSize(9.5).font('Helvetica-Bold');
      doc.text(`LR Number: ${lr.lrNumber}`, 50, y + 10);
      doc.text(`Date Issued: ${new Date(lr.issuedDate || Date.now()).toLocaleDateString('en-IN')}`, 230, y + 10);

      doc.font('Helvetica').fontSize(8).fillColor('#475569');
      doc.text(`E-Way Bill: ${lr.eWayBillNumber || 'N/A'}`, 50, y + 26);
      doc.text(
        `Vehicle: ${lr.vehicleId?.plateNumber || 'Unassigned'}  •  Driver: ${lr.driverId?.name || 'Unassigned'}`,
        230,
        y + 26
      );

      // Scannable barcode on right
      this._drawBarcode(doc, 410, y + 6, lr.lrNumber);

      y += 56;

      // Consignor & Consignee Columns
      doc.rect(40, y, 260, 80).stroke('#cbd5e1');
      doc.rect(310, y, 260, 80).stroke('#cbd5e1');

      // Consignor Box
      doc.fillColor('#0284c7').fontSize(7.5).font('Helvetica-Bold').text('CONSIGNOR (BOOKED BY / FROM):', 50, y + 8);
      doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text(lr.consignorId?.name || 'Party Name Not Provided', 50, y + 20);
      doc.font('Helvetica').fontSize(7.5).fillColor('#475569');
      doc.text(`GSTIN: ${lr.consignorId?.gstin || 'Unregistered'}  •  PAN: ${lr.consignorId?.pan || 'N/A'}`, 50, y + 33);
      doc.text(`Dispatch Terminal: ${lr.fromLocationId?.name || lr.consignorId?.billingAddress?.city || 'Origin Depot'}`, 50, y + 45);
      doc.text(`${lr.consignorId?.billingAddress?.city || ''}, ${lr.consignorId?.billingAddress?.state || ''} - India`, 50, y + 57);

      // Consignee Box
      doc.fillColor('#0284c7').fontSize(7.5).font('Helvetica-Bold').text('CONSIGNEE (DELIVER TO):', 320, y + 8);
      doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text(lr.consigneeId?.name || 'Party Name Not Provided', 320, y + 20);
      doc.font('Helvetica').fontSize(7.5).fillColor('#475569');
      doc.text(`GSTIN: ${lr.consigneeId?.gstin || 'Unregistered'}  •  PAN: ${lr.consigneeId?.pan || 'N/A'}`, 320, y + 33);
      doc.text(`Delivery Hub: ${lr.toLocationId?.name || lr.consigneeId?.billingAddress?.city || 'Destination Hub'}`, 320, y + 45);
      doc.text(`${lr.consigneeId?.billingAddress?.city || ''}, ${lr.consigneeId?.billingAddress?.state || ''} - India`, 320, y + 57);

      y += 90;

      // Consignment Details Table Header
      doc.rect(40, y, 530, 22).fill('#1e293b');
      doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
      doc.text('PACKAGE & CARGO DESCRIPTION', 50, y + 6);
      doc.text('METHOD', 230, y + 6);
      doc.text('QUANTITY', 320, y + 6);
      doc.text('WEIGHT (MT)', 410, y + 6);
      doc.text('STATUS', 500, y + 6);

      y += 24;

      // Consignment Row
      doc.rect(40, y, 530, 32).fillAndStroke('#ffffff', '#e2e8f0');
      doc.fillColor('#0f172a').fontSize(8).font('Helvetica');
      doc.text(`${lr.loadId?.packageType || 'General Freight'} - Industrial Consignment`, 50, y + 10);
      doc.text(lr.loadId?.materialType || 'Standard Freight', 230, y + 10);
      doc.text(`${lr.loadId?.totalQuantity || 1} Pkgs`, 320, y + 10);
      doc.font('Helvetica-Bold').text(`${lr.loadId?.totalWeightMt || 0} MT`, 410, y + 10);
      doc.font('Helvetica-Bold').fillColor('#0284c7').text(lr.status || 'BOOKED', 500, y + 10);

      y += 45;

      // Freight & Balance Box
      if (lr.loadId?.financials) {
        const f = lr.loadId.financials;
        doc.rect(40, y, 530, 48).fillAndStroke('#f8fafc', '#cbd5e1');
        doc.fillColor('#1e293b').fontSize(8).font('Helvetica-Bold');
        doc.text('FREIGHT ACCOUNTING & SETTLEMENT (INR):', 50, y + 8);
        doc.font('Helvetica').fontSize(8).fillColor('#334155');
        doc.text(`Base Freight: ₹${((f.baseFreightPaise || 0) / 100).toFixed(2)}`, 50, y + 24);
        doc.text(`Toll & Loading: ₹${(((f.tollPaise || 0) + (f.loadingPaise || 0)) / 100).toFixed(2)}`, 180, y + 24);
        doc.text(`Gross Freight: ₹${((f.totalFreightPaise || 0) / 100).toFixed(2)}`, 320, y + 24);
        doc.font('Helvetica-Bold').fillColor('#0284c7');
        doc.text(`Net Balance Payable: ₹${((f.balancePaise || 0) / 100).toFixed(2)}`, 430, y + 24);
        y += 58;
      }

      // Terms & Legal Notice
      doc.rect(40, y, 530, 40).stroke('#e2e8f0');
      doc.fillColor('#475569').fontSize(7).font('Helvetica');
      doc.text(
        'STATUTORY CARRIAGE DECLARATION: This consignment is accepted subject to conditions of the Carriage by Road Act 2007 and Carriage by Road Rules 2011. ' +
        'Goods are carried at Owner\'s Risk unless covered by Carrier Risk premium. Service tax on GTA services (SAC 9965) is payable under Reverse Charge Mechanism (RCM) by the recipient under Sec 9(3) of CGST Act 2017. ' +
        'Consignee copy must be endorsed and signed upon delivery before releasing cargo.',
        46,
        y + 6,
        { width: 518, lineGap: 1.5 }
      );

      y += 50;
      this._drawDivider(doc, y);
      y += 18;

      // Official Triple Signatures
      doc.fillColor('#1e293b').fontSize(8).font('Helvetica-Bold');
      doc.text('Consignor / Booking Agent', 50, y);
      doc.text('Driver Signature / LTI', 240, y);
      doc.text(`For ${company.tradeName || 'Carrier'} Authorised Signatory`, 400, y);

      doc.font('Helvetica').fontSize(7).fillColor('#94a3b8');
      doc.text('(Signature / Date)', 50, y + 24);
      doc.text('(Received in Good Condition)', 240, y + 24);
      doc.text('(Verified Dispatch Seal)', 400, y + 24);

      // Watermark note
      doc.fontSize(6).fillColor('#94a3b8').text('DIGITALLY ISSUED BY TECHNOFAY ENTERPRISE FLEET & TRANSPORT OS', 40, 805, { align: 'center', width: 530 });

      doc.end();
    });
  }

  /**
   * 2. Generate Bilty Consignment Note PDF
   */
  async generateBiltyPdf(bilty, company, options = {}) {
    const copy = (options.copy || 'ORIGINAL').toUpperCase();
    return new Promise((resolve, reject) => {
      const doc = new (getPDFDocument())({ margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      this._drawHeader(doc, company, 'Consignment Bilty Note', copy);

      let y = 92;

      // Key details banner
      doc.rect(40, y, 530, 44).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold');
      doc.text(`Bilty No: ${bilty.biltyNumber}`, 50, y + 8);
      doc.text(`LR Link: ${bilty.lrId?.lrNumber || 'N/A'}`, 230, y + 8);
      doc.text(`Payment Terms: ${bilty.paymentTerms}`, 400, y + 8);

      doc.font('Helvetica').fontSize(8).fillColor('#64748b');
      doc.text(`GTA SAC Code: ${bilty.gstGtaSac || '9965'} (Rate: ${bilty.gstGtaRate || 5.0}%)`, 50, y + 24);
      doc.text(`Date Issued: ${new Date(bilty.createdAt || Date.now()).toLocaleDateString('en-IN')}`, 400, y + 24);

      // Barcode
      this._drawBarcode(doc, 220, y + 20, bilty.biltyNumber);

      y += 54;

      // Parties block
      doc.rect(40, y, 260, 75).stroke('#cbd5e1');
      doc.rect(310, y, 260, 75).stroke('#cbd5e1');

      doc.fillColor('#0284c7').fontSize(7.5).font('Helvetica-Bold').text('CONSIGNOR (SENDER):', 50, y + 6);
      doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text(bilty.consignorId?.name || '', 50, y + 18);
      doc.font('Helvetica').fontSize(7.5).fillColor('#475569');
      doc.text(`GSTIN: ${bilty.consignorId?.gstin || 'Unregistered'}`, 50, y + 32);
      doc.text(`${bilty.consignorId?.billingAddress?.city || ''}, ${bilty.consignorId?.billingAddress?.state || ''}`, 50, y + 44);

      doc.fillColor('#0284c7').fontSize(7.5).font('Helvetica-Bold').text('CONSIGNEE (RECEIVER):', 320, y + 6);
      doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text(bilty.consigneeId?.name || '', 320, y + 18);
      doc.font('Helvetica').fontSize(7.5).fillColor('#475569');
      doc.text(`GSTIN: ${bilty.consigneeId?.gstin || 'Unregistered'}`, 320, y + 32);
      doc.text(`${bilty.consigneeId?.billingAddress?.city || ''}, ${bilty.consigneeId?.billingAddress?.state || ''}`, 320, y + 44);

      y += 85;

      // Financial Calculation Table
      doc.rect(40, y, 530, 20).fill('#1e293b');
      doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
      doc.text('FREIGHT ACCOUNTING BREAKDOWN', 50, y + 5);
      doc.text('AMOUNT (INR)', 470, y + 5);

      y += 22;

      const totalFreight = ((bilty.totalFreightPaise || 0) / 100).toFixed(2);
      const advance = ((bilty.advancePaise || 0) / 100).toFixed(2);
      const balance = ((bilty.balancePaise || 0) / 100).toFixed(2);

      doc.rect(40, y, 530, 70).fillAndStroke('#ffffff', '#e2e8f0');
      doc.fillColor('#1e293b').fontSize(8).font('Helvetica');
      doc.text('Gross Freight Charges (Inclusive of all route & handling charges)', 50, y + 10);
      doc.text(`₹${totalFreight}`, 470, y + 10);

      doc.text('Less: Advance Disbursed / Paid by Booking Party', 50, y + 28);
      doc.text(`- ₹${advance}`, 470, y + 28);

      doc.font('Helvetica-Bold').fillColor('#0284c7');
      doc.text('Net Balance Freight Payable upon Presentation of Bilty', 50, y + 48);
      doc.text(`₹${balance}`, 470, y + 48);

      y += 80;

      // GST GTA Notice Box
      doc.rect(40, y, 530, 42).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fillColor('#334155').fontSize(7.5).font('Helvetica-Bold');
      doc.text('GST DECLARATION UNDER REVERSE CHARGE MECHANISM (RCM):', 50, y + 6);
      doc.font('Helvetica').fontSize(7).fillColor('#64748b');
      doc.text(
        'Transport of goods by road in a goods carriage. Tax on GTA services (SAC 9965) is payable by the recipient under Section 9(3) of the CGST Act 2017 at the prescribed rate of 5% (without Input Tax Credit) unless opting for forward charge under Sec 9(1). The liability to discharge GST rests with the recipient entity.',
        50,
        y + 18,
        { width: 510, lineGap: 1.5 }
      );

      y += 55;
      this._drawDivider(doc, y);
      y += 20;

      doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold');
      doc.text('For ' + (company.tradeName || 'Carrier Logistics'), 50, y);
      doc.text('Driver Acknowledged Goods', 260, y);
      doc.text('Consignee Receiving Seal', 430, y);

      doc.fontSize(6).fillColor('#94a3b8').text('DIGITALLY ISSUED BY TECHNOFAY ENTERPRISE FLEET & TRANSPORT OS', 40, 805, { align: 'center', width: 530 });

      doc.end();
    });
  }

  /**
   * 3. Generate Loading Slip / Gate Pass PDF
   */
  async generateLoadingSlipPdf(load, company, options = {}) {
    const copy = (options.copy || 'ORIGINAL').toUpperCase();
    return new Promise((resolve, reject) => {
      const doc = new (getPDFDocument())({ margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      this._drawHeader(doc, company, 'Loading Slip & Gate Pass', copy);

      let y = 92;

      // Load & Vehicle Header
      doc.rect(40, y, 530, 42).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold');
      doc.text(`Load Number: ${load.loadNumber}`, 50, y + 10);
      doc.text(`Assigned Vehicle: ${load.assignedVehicleId?.plateNumber || 'Pending'}`, 230, y + 10);
      doc.text(`Driver: ${load.assignedDriverId?.name || 'Pending'}`, 400, y + 10);

      doc.font('Helvetica').fontSize(8).fillColor('#64748b');
      doc.text(`Package: ${load.packageType}  •  Weight: ${load.totalWeightMt} MT`, 50, y + 24);
      doc.text(`Order Date: ${new Date(load.orderDate).toLocaleDateString('en-IN')}`, 400, y + 24);

      this._drawBarcode(doc, 220, y + 22, load.loadNumber);

      y += 55;

      // Ordered Route Stops Table
      doc.rect(40, y, 530, 20).fill('#1e293b');
      doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
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
      doc.rect(40, y, 530, 42).stroke('#cbd5e1');
      doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold').text('SPECIAL GATE & SECURITY INSTRUCTIONS:', 50, y + 8);
      doc.font('Helvetica').fontSize(7.5).fillColor('#64748b').text(load.remarks || 'Check gross vehicle tare weight on terminal weighbridge. Ensure tarpaulin, lashings, and cargo seals are intact before exit.', 50, y + 22, { width: 510 });

      y += 65;
      this._drawDivider(doc, y);
      y += 20;

      doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold');
      doc.text('Loading Supervisor', 50, y);
      doc.text('Security Gate Pass Stamp', 240, y);
      doc.text('Driver Signature & Gate Out', 420, y);

      doc.fontSize(6).fillColor('#94a3b8').text('DIGITALLY ISSUED BY TECHNOFAY ENTERPRISE FLEET & TRANSPORT OS', 40, 805, { align: 'center', width: 530 });

      doc.end();
    });
  }

  /**
   * 4. Generate Official Trip Sheet / Dispatch Challan PDF
   */
  async generateTripSheetPdf(trip, company, options = {}) {
    const copy = (options.copy || 'ORIGINAL').toUpperCase();
    return new Promise((resolve, reject) => {
      const doc = new (getPDFDocument())({ margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      this._drawHeader(doc, company, 'Official Trip Sheet', copy);

      let y = 92;

      // Trip Dispatch Header Box
      doc.rect(40, y, 530, 46).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold');
      doc.text(`Trip Number: ${trip.tripNumber}`, 50, y + 8);
      doc.text(`Status: ${trip.status}`, 230, y + 8);
      doc.text(`Date: ${new Date(trip.startDateTime || Date.now()).toLocaleDateString('en-IN')}`, 410, y + 8);

      doc.font('Helvetica').fontSize(8).fillColor('#475569');
      doc.text(`Vehicle: ${trip.vehicleId?.plateNumber || 'N/A'}`, 50, y + 24);
      doc.text(`Driver: ${trip.driverId?.name || 'N/A'} (📞 ${trip.driverId?.phone || 'N/A'})`, 230, y + 24);
      doc.text(`DL: ${trip.driverId?.licenseNumber || 'N/A'}`, 410, y + 24);

      this._drawBarcode(doc, 390, y + 6, trip.tripNumber);

      y += 58;

      // Underlying Consignment Details
      doc.rect(40, y, 530, 36).fillAndStroke('#ffffff', '#e2e8f0');
      doc.fillColor('#0284c7').fontSize(7.5).font('Helvetica-Bold').text('LINKED CONSIGNMENT LOAD:', 50, y + 6);
      doc.fillColor('#0f172a').fontSize(8).font('Helvetica');
      doc.text(`Load No: ${trip.loadId?.loadNumber || 'N/A'}`, 50, y + 18);
      doc.text(`Cargo: ${trip.loadId?.packageType || 'Freight'} - ${trip.loadId?.totalWeightMt || 0} MT`, 200, y + 18);
      doc.text(`Customer: ${trip.loadId?.customerId?.name || 'Enterprise Customer'}`, 380, y + 18);

      y += 46;

      // Ordered Stops Table
      doc.rect(40, y, 530, 20).fill('#1e293b');
      doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
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

      y += 18;

      // Advance & Instructions Box
      doc.rect(40, y, 530, 45).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold');
      doc.text('DRIVER DISPATCH INSTRUCTIONS & ADVANCE DISBURSEMENT:', 50, y + 8);
      doc.font('Helvetica').fontSize(8).fillColor('#64748b');
      doc.text(`Driver Fuel/Route Advance: ₹${((trip.financials?.driverAdvancePaise || 0) / 100).toFixed(2)}`, 50, y + 24);
      doc.text(trip.remarks || 'Maintain transit temperature and speed limits. Report all checkpoint halts immediately.', 220, y + 24, { width: 330 });

      y += 65;
      this._drawDivider(doc, y);
      y += 20;

      doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold');
      doc.text('Transport Dispatcher', 50, y);
      doc.text('Driver Acknowledged & Received', 240, y);
      doc.text('Gate Security Check In/Out', 420, y);

      doc.fontSize(6).fillColor('#94a3b8').text('DIGITALLY ISSUED BY TECHNOFAY ENTERPRISE FLEET & TRANSPORT OS', 40, 805, { align: 'center', width: 530 });

      doc.end();
    });
  }

  /**
   * 5. Generate Trip Settlement Statement PDF
   */
  async generateSettlementPdf(trip, company, options = {}) {
    const copy = (options.copy || 'ORIGINAL').toUpperCase();
    return new Promise((resolve, reject) => {
      const doc = new (getPDFDocument())({ margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      this._drawHeader(doc, company, 'Trip Financial Settlement', copy);

      let y = 92;

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
      doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
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

      y += 18;

      // Settlement Accounting Box
      doc.rect(40, y, 530, 85).fillAndStroke('#ffffff', '#cbd5e1');
      doc.fillColor('#1e293b').fontSize(8.5).font('Helvetica-Bold').text('FINAL TRIP FINANCIAL RECONCILIATION:', 50, y + 8);

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

      doc.fontSize(6).fillColor('#94a3b8').text('DIGITALLY ISSUED BY TECHNOFAY ENTERPRISE FLEET & TRANSPORT OS', 40, 805, { align: 'center', width: 530 });

      doc.end();
    });
  }

  /**
   * 6. Generate Vehicle Maintenance Job Card & Service Order PDF
   */
  async generateMaintenancePdf(maintenance, company, options = {}) {
    const copy = (options.copy || 'ORIGINAL').toUpperCase();
    return new Promise((resolve, reject) => {
      const doc = new (getPDFDocument())({ margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      this._drawHeader(doc, company, 'Maintenance Job Card & Service Order', copy);

      let y = 92;

      // Job Card Header Box
      doc.rect(40, y, 530, 46).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fillColor('#0f172a').fontSize(9.5).font('Helvetica-Bold');
      doc.text(`Job Card #: ${maintenance.maintenanceNumber}`, 50, y + 8);
      doc.text(`Status: ${maintenance.status}`, 240, y + 8);
      doc.text(`Priority: ${maintenance.priority}`, 420, y + 8);

      doc.font('Helvetica').fontSize(8).fillColor('#475569');
      doc.text(`Vehicle Plate: ${maintenance.vehicleId?.plateNumber || 'N/A'}`, 50, y + 24);
      doc.text(`Service Type: ${String(maintenance.serviceType || '').replace(/_/g, ' ')}`, 240, y + 24);
      doc.text(`Scheduled: ${new Date(maintenance.scheduledDate).toLocaleDateString('en-IN')}`, 420, y + 24);

      this._drawBarcode(doc, 390, y + 6, maintenance.maintenanceNumber);

      y += 58;

      // Garage & Technical Info Box
      doc.rect(40, y, 530, 45).fillAndStroke('#ffffff', '#e2e8f0');
      doc.fillColor('#0284c7').fontSize(7.5).font('Helvetica-Bold').text('DEPOT / WORKSHOP & ODOMETER SPECIFICATION:', 50, y + 6);
      doc.fillColor('#0f172a').fontSize(8).font('Helvetica');
      doc.text(`Authorized Center: ${maintenance.serviceCenter?.name || 'In-House Central Garage'} (${maintenance.serviceCenter?.city || 'Terminal'})`, 50, y + 20);
      doc.text(`Odometer at Check-in: ${maintenance.odometerReadingKm || 0} KM`, 340, y + 20);

      y += 56;

      // Scope of Work & Remarks
      doc.rect(40, y, 530, 60).stroke('#cbd5e1');
      doc.fillColor('#1e293b').fontSize(8).font('Helvetica-Bold').text('SCOPE OF WORK / TECHNICIAN INSTRUCTIONS:', 50, y + 8);
      doc.font('Helvetica').fontSize(8).fillColor('#475569');
      doc.text(
        maintenance.technicianRemarks ||
        'Conduct full multi-point safety inspection: check brake liners, tyre tread depth, steer axle alignment, engine lubrication, and replace all certified filters.',
        50,
        y + 22,
        { width: 510, lineGap: 2 }
      );

      y += 72;

      // Cost & Settlement Card
      doc.rect(40, y, 530, 48).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fillColor('#1e293b').fontSize(8).font('Helvetica-Bold').text('ESTIMATED & CERTIFIED COST SUMMARY:', 50, y + 8);
      doc.font('Helvetica').fontSize(8).fillColor('#475569');
      doc.text(`Estimated Budget: ₹${((maintenance.costPaise || 0) / 100).toFixed(2)}`, 50, y + 24);
      doc.text(`Final Invoice #: ${maintenance.invoiceNumber || 'PENDING'}`, 240, y + 24);
      doc.font('Helvetica-Bold').fillColor('#047857');
      doc.text(`Total Certified Amount: ₹${((maintenance.costPaise || 0) / 100).toFixed(2)}`, 380, y + 24);

      y += 70;
      this._drawDivider(doc, y);
      y += 20;

      doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold');
      doc.text('Fleet Maintenance Engineer', 50, y);
      doc.text('Garage Lead Mechanic / Certifier', 240, y);
      doc.text('Transport Asset Release Stamp', 420, y);

      doc.fontSize(6).fillColor('#94a3b8').text('DIGITALLY ISSUED BY TECHNOFAY ENTERPRISE FLEET & TRANSPORT OS', 40, 805, { align: 'center', width: 530 });

      doc.end();
    });
  }
}

module.exports = new PdfService();
