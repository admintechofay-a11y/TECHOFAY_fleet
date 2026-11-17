/**
 * Barkat Tempo Service (BTS) Document Generation Engine
 * Produces pixel-perfect, print-ready vector PDFs for:
 * 1. Barkat Tempo Service Loading Receipt (Barkat_Tempo_Service_Loading_Receipt.docx)
 * 2. Barkat Tempo Service Trip Memo (Barkat_Tempo_Service_Memo.docx)
 */

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

class BtsDocsService {
  constructor() {
    this.primaryColor = '#002060'; // Transport deep navy
    this.accentRed = '#c00000'; // Transport deep red
    this.darkText = '#111827';
    this.lightBg = '#f8fafc';
    this.borderColor = '#334155';

    // Locate BTS logo
    const candidatePaths = [
      path.join(__dirname, '../assets/bts-logo-cropped.png'),
      path.join(__dirname, '../assets/bts-logo.png'),
      path.join(process.cwd(), 'apps/api/src/assets/bts-logo-cropped.png'),
      path.join(process.cwd(), 'apps/api/src/assets/bts-logo.png'),
      path.join(process.cwd(), 'BTS Logo.jpg.jpeg')
    ];
    this.logoPath = candidatePaths.find((p) => fs.existsSync(p)) || null;
  }

  _formatDate(dateInput) {
    const d = dateInput ? new Date(dateInput) : new Date();
    if (isNaN(d.getTime())) return new Date().toLocaleDateString('en-IN');
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  _formatInr(amount) {
    if (amount === undefined || amount === null || isNaN(amount)) return '0.00';
    return Number(amount).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  /**
   * 1. Barkat Tempo Service - Loading Receipt PDF
   * Corresponds to Barkat_Tempo_Service_Loading_Receipt.docx
   */
  async generateLoadingReceiptPdf(data = {}, company = {}, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 36,
          info: {
            Title: `BTS Loading Receipt - ${data.lrNumber || data.loadNumber || 'RECEIPT'}`,
            Author: 'Barkat Tempo Service',
            Subject: 'Official Road Transport Loading Receipt',
            Keywords: 'BTS, Barkat Tempo Service, Loading Receipt, Consignment'
          }
        });

        const buffers = [];
        doc.on('data', (c) => buffers.push(c));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err) => reject(err));

        const margin = 36;
        const pageWidth = 595.28;
        const pageHeight = 841.89;
        const printableWidth = pageWidth - margin * 2; // 523.28

        // Outer Double Border Frame
        doc.rect(margin - 4, margin - 4, printableWidth + 8, pageHeight - margin * 2 + 8)
          .lineWidth(1.5)
          .strokeColor(this.primaryColor)
          .stroke();

        doc.rect(margin - 1.5, margin - 1.5, printableWidth + 3, pageHeight - margin * 2 + 3)
          .lineWidth(0.5)
          .strokeColor(this.primaryColor)
          .stroke();

        let y = margin + 8;

        // Top Header: Phones & Logo
        if (this.logoPath && fs.existsSync(this.logoPath)) {
          doc.image(this.logoPath, margin + 4, y - 2, { width: 110 });
        } else {
          doc.font('Helvetica-Bold')
            .fontSize(16)
            .fillColor(this.primaryColor)
            .text('══ [ BTS ] ══', margin + 4, y + 6);
        }

        // Phone numbers (Right aligned)
        doc.font('Helvetica-Bold')
          .fontSize(9.5)
          .fillColor(this.darkText)
          .text('(M) 93776 10333      84010 20129      82000 32668', margin, y + 4, {
            width: printableWidth,
            align: 'right'
          });

        y += 46;

        // Company Title
        doc.font('Helvetica-Bold')
          .fontSize(23)
          .fillColor(this.accentRed)
          .text('BARKAT TEMPO SERVICE', margin, y, {
            width: printableWidth,
            align: 'center',
            characterSpacing: 0.5
          });

        y += 26;

        // Subtitle
        doc.font('Helvetica-Bold')
          .fontSize(10)
          .fillColor(this.primaryColor)
          .text('TRANSPORT CONTRACTOR & COMMISSION AGENT', margin, y, {
            width: printableWidth,
            align: 'center',
            characterSpacing: 0.8
          });

        y += 16;

        // Address & Email
        doc.font('Helvetica')
          .fontSize(8.5)
          .fillColor('#334155')
          .text(
            'Shri Rang Market, Near Shri Rang Tyre Shop, N.H.No.-8, Golden Chokdi, Vadodara-390022  •  E-mail: barkattemposervice@gmail.com',
            margin,
            y,
            { width: printableWidth, align: 'center' }
          );

        y += 18;

        // Divider
        doc.moveTo(margin + 4, y)
          .lineTo(pageWidth - margin - 4, y)
          .lineWidth(1)
          .strokeColor(this.primaryColor)
          .stroke();

        y += 10;

        // Meta Bar: No. & Date
        const receiptNo = data.lrNumber || data.loadNumber || data.receiptNumber || 'BTS-LR-2026-001';
        const docDate = this._formatDate(data.date || data.billDate || data.createdAt);

        doc.font('Helvetica-Bold').fontSize(11).fillColor(this.accentRed);
        doc.text(`No.: ${receiptNo}`, margin + 10, y);

        doc.font('Helvetica-Bold').fontSize(10).fillColor(this.darkText);
        doc.text(`Date : ${docDate}`, margin, y, {
          width: printableWidth - 10,
          align: 'right'
        });

        y += 24;

        // Divider
        doc.moveTo(margin + 4, y)
          .lineTo(pageWidth - margin - 4, y)
          .lineWidth(0.5)
          .strokeColor('#94a3b8')
          .stroke();

        y += 14;

        // Consignee / To
        const toParty = data.consignee?.name || data.customer?.name || data.toParty || data.consignor?.name || '-';
        const toCity = data.consignee?.city || data.deliveryLocation?.city || data.toStation || '';

        doc.font('Helvetica-Bold').fontSize(10.5).fillColor(this.darkText);
        doc.text('To,', margin + 10, y);
        doc.font('Helvetica').fontSize(10.5).fillColor('#0f172a');
        doc.text(` ${toParty} - ${toCity}`, margin + 30, y);

        y += 22;

        doc.font('Helvetica-Bold').fontSize(9.5).fillColor(this.darkText);
        doc.text('Dear Sir,', margin + 10, y);
        y += 16;
        doc.font('Helvetica').fontSize(9.5).fillColor('#1e293b');
        doc.text('As per your Order / Verbal / Phone / Written', margin + 10, y);

        y += 22;

        // Boxed Details Table
        const tableY = y;
        const rowHeight = 24;
        const labelColWidth = 180;
        const valueColWidth = printableWidth - 20 - labelColWidth;

        const vehicleNo = data.vehicle?.registrationNumber || data.vehicleNumber || '-';
        const station = data.toStation || data.destination || data.deliveryLocation?.name || '-';
        const weight = data.weight || (data.weightMt ? `${data.weightMt} MT` : '-');
        const freightRate = Number(data.rate || data.freightAmount || 0);
        const advanceAmount = Number(data.advanceAmount !== undefined ? data.advanceAmount : (data.advancePaid || 0));
        const balanceAmount = Number(data.balanceAmount !== undefined ? data.balanceAmount : Math.max(0, freightRate - advanceAmount));
        const paymentMode = data.paymentTerm || data.paymentMode || 'To Pay';

        const fields = [
          { label: 'We have sent Truck / Tempo No.', value: vehicleNo, bold: true },
          { label: 'For Station', value: station, bold: true },
          { label: 'Weight', value: String(weight) },
          { label: 'Rate of Rs.', value: `₹ ${this._formatInr(freightRate)}` },
          { label: 'Advance Rs.', value: `₹ ${this._formatInr(advanceAmount)}` },
          { label: 'Balance', value: `₹ ${this._formatInr(balanceAmount)}`, bold: true, color: this.accentRed },
          { label: 'To Pay / To be billed', value: paymentMode, bold: true }
        ];

        // Draw Table Card
        const tableHeight = fields.length * rowHeight;
        doc.rect(margin + 10, tableY, printableWidth - 20, tableHeight)
          .lineWidth(0.8)
          .strokeColor('#94a3b8')
          .stroke();

        fields.forEach((row, idx) => {
          const currentY = tableY + idx * rowHeight;

          // Alternate row fill
          if (idx % 2 === 1) {
            doc.rect(margin + 10, currentY, printableWidth - 20, rowHeight)
              .fillColor('#f8fafc')
              .fill();
          }

          // Row divider line
          if (idx > 0) {
            doc.moveTo(margin + 10, currentY)
              .lineTo(margin + printableWidth - 10, currentY)
              .lineWidth(0.5)
              .strokeColor('#e2e8f0')
              .stroke();
          }

          // Vertical separator
          doc.moveTo(margin + 10 + labelColWidth, currentY)
            .lineTo(margin + 10 + labelColWidth, currentY + rowHeight)
            .lineWidth(0.5)
            .strokeColor('#e2e8f0')
            .stroke();

          // Text
          doc.font('Helvetica-Bold')
            .fontSize(9)
            .fillColor('#334155')
            .text(row.label, margin + 20, currentY + 7);

          doc.font(row.bold ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(9.5)
            .fillColor(row.color || this.darkText)
            .text(row.value, margin + 20 + labelColWidth, currentY + 7);
        });

        y = tableY + tableHeight + 16;

        // Detention notice
        doc.font('Helvetica-Bold')
          .fontSize(9.5)
          .fillColor(this.accentRed)
          .text('Detention per day Rs. 1500/-', margin + 10, y);

        y += 18;

        doc.font('Helvetica')
          .fontSize(9)
          .fillColor(this.darkText)
          .text('Please arrange to load the vehicle as early as Possible', margin + 10, y);

        y += 16;

        doc.text('Thanking You,', margin + 10, y);

        y += 30;

        // Signatures Section
        const sigY = y;
        doc.font('Helvetica-Bold').fontSize(9).fillColor(this.darkText);
        doc.text('PAN No. AOGPP3611Q', margin + 15, sigY + 28);
        doc.font('Helvetica').fontSize(8).fillColor('#64748b');
        doc.text('GSTIN: 24AAACT1234A1Z5', margin + 15, sigY + 40);

        doc.font('Helvetica-Bold').fontSize(9.5).fillColor(this.primaryColor);
        doc.text("Your's Faithfully", margin, sigY, { width: printableWidth - 20, align: 'right' });
        doc.text('For, BARKAT TEMPO SERVICE', margin, sigY + 16, { width: printableWidth - 20, align: 'right' });
        doc.font('Helvetica').fontSize(8).fillColor('#64748b');
        doc.text('(Authorised Signatory)', margin, sigY + 46, { width: printableWidth - 20, align: 'right' });

        y = sigY + 76;

        // Legal Caution / Disclaimer Box
        const disclaimerY = y;
        const disclaimerBoxHeight = 64;
        doc.rect(margin + 10, disclaimerY, printableWidth - 20, disclaimerBoxHeight)
          .lineWidth(0.8)
          .strokeColor('#cbd5e1')
          .fillAndStroke('#f1f5f9', '#94a3b8');

        doc.font('Helvetica-Bold')
          .fontSize(7.5)
          .fillColor('#1e293b')
          .text(
            'The BARKAT TEMPO SERVICE hereby specifically stipulates that is shall not be responsible any way or any casefully accident, damage theft, etc. after the loaded Vehicle Start for the Journey.',
            margin + 16,
            disclaimerY + 8,
            { width: printableWidth - 32 }
          );

        doc.font('Helvetica')
          .fontSize(7.5)
          .fillColor('#334155')
          .text(
            'Note: Please check up engine no., chessis no. and other documents Pertaining to Vehicle & Driver for your satisfaction.',
            margin + 16,
            disclaimerY + 34,
            { width: printableWidth - 32 }
          );

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * 2. Barkat Tempo Service - Memo PDF
   * Corresponds to Barkat_Tempo_Service_Memo.docx
   */
  async generateMemoPdf(data = {}, company = {}, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 32,
          info: {
            Title: `BTS Memo - ${data.memoNumber || data.tripNumber || 'MEMO'}`,
            Author: 'Barkat Tempo Service',
            Subject: 'Transport Trip Memo & Settlement Ledger',
            Keywords: 'BTS, Barkat Tempo Service, Memo, Trip Sheet'
          }
        });

        const buffers = [];
        doc.on('data', (c) => buffers.push(c));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err) => reject(err));

        const margin = 32;
        const pageWidth = 595.28;
        const pageHeight = 841.89;
        const printableWidth = pageWidth - margin * 2; // 531.28

        // Outer Double Border Frame
        doc.rect(margin - 4, margin - 4, printableWidth + 8, pageHeight - margin * 2 + 8)
          .lineWidth(1.5)
          .strokeColor(this.primaryColor)
          .stroke();

        doc.rect(margin - 1.5, margin - 1.5, printableWidth + 3, pageHeight - margin * 2 + 3)
          .lineWidth(0.5)
          .strokeColor(this.primaryColor)
          .stroke();

        let y = margin + 6;

        // Top Header Bar: Memo No & Date
        const memoNo = data.memoNumber || data.tripNumber || data.id || 'MEMO-2026-004';
        const memoDate = this._formatDate(data.date || data.startDate || data.createdAt);

        doc.font('Helvetica-Bold').fontSize(11).fillColor(this.accentRed);
        doc.text(`MEMO NO.:  ${memoNo}`, margin + 6, y);

        doc.font('Helvetica-Bold').fontSize(10).fillColor(this.darkText);
        doc.text(`DATE:  ${memoDate}`, margin, y, {
          width: printableWidth - 6,
          align: 'right'
        });

        y += 18;

        // BTS Logo / Header Title
        if (this.logoPath && fs.existsSync(this.logoPath)) {
          doc.image(this.logoPath, margin + (printableWidth - 140) / 2, y, { width: 140 });
          y += 52;
        } else {
          doc.font('Helvetica-Bold')
            .fontSize(14)
            .fillColor(this.primaryColor)
            .text('══ [ BTS ] ══', margin, y, { width: printableWidth, align: 'center' });
          y += 20;
        }

        // Title
        doc.font('Helvetica-Bold')
          .fontSize(22)
          .fillColor(this.accentRed)
          .text('BARKAT TEMPO SERVICE', margin, y, {
            width: printableWidth,
            align: 'center',
            characterSpacing: 0.5
          });

        y += 24;

        // Address & Contacts
        doc.font('Helvetica')
          .fontSize(8)
          .fillColor('#334155')
          .text(
            'Shree Rang Market, Near Shree Rang Tyre Shop, N.H. No. 8, Golden Chokdi, Vadodara 390 022',
            margin,
            y,
            { width: printableWidth, align: 'center' }
          );

        y += 12;

        doc.font('Helvetica-Bold')
          .fontSize(8)
          .fillColor(this.darkText)
          .text(
            '(M) 9377610333, 8401020129, 8200032668. E-mail : barkattemposervice@gmail.com',
            margin,
            y,
            { width: printableWidth, align: 'center' }
          );

        y += 16;

        // Divider
        doc.moveTo(margin + 4, y)
          .lineTo(pageWidth - margin - 4, y)
          .lineWidth(1)
          .strokeColor(this.primaryColor)
          .stroke();

        y += 8;

        // Section 1: Trip & Vehicle Info (2-column key-value grid)
        const infoY = y;
        const colW = printableWidth / 2;
        const rowH = 18;

        const fromStation = data.fromStation || data.originLocation?.name || '-';
        const toStation = data.toStation || data.destinationLocation?.name || '-';
        const truckNo = data.vehicle?.registrationNumber || data.vehicleNumber || '-';
        const driverName = data.driver?.name || data.driverName || '-';
        const ownerName = data.ownerName || data.vehicle?.ownerName || company.tradeName || 'Barkat Tempo Service';
        const phoneNo = data.driver?.phone || data.phoneNo || '-';
        const ownerAddress = data.ownerAddress || (company.address ? `${company.address.street}, ${company.address.city}` : 'Golden Chokdi, Vadodara');
        const transporterName = data.transporterName || company.tradeName || 'Barkat Tempo Service';

        const tripDetails = [
          [
            { label: 'From', value: fromStation },
            { label: 'To', value: toStation }
          ],
          [
            { label: 'Truck No.', value: truckNo, bold: true },
            { label: 'Driver Name', value: driverName }
          ],
          [
            { label: 'Owner Name', value: ownerName },
            { label: 'Phone No.', value: phoneNo }
          ],
          [
            { label: 'Owner Add.', value: ownerAddress },
            { label: "Transporter's Name", value: transporterName }
          ]
        ];

        // Draw Info Box
        doc.rect(margin + 4, infoY, printableWidth - 8, tripDetails.length * rowH)
          .lineWidth(0.6)
          .strokeColor('#94a3b8')
          .stroke();

        tripDetails.forEach((row, rIdx) => {
          const cy = infoY + rIdx * rowH;
          if (rIdx > 0) {
            doc.moveTo(margin + 4, cy)
              .lineTo(margin + printableWidth - 4, cy)
              .lineWidth(0.5)
              .strokeColor('#e2e8f0')
              .stroke();
          }

          // Vertical dividing line between left and right column
          doc.moveTo(margin + colW, cy)
            .lineTo(margin + colW, cy + rowH)
            .lineWidth(0.5)
            .strokeColor('#e2e8f0')
            .stroke();

          // Left Cell
          doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569').text(row[0].label + ' :', margin + 10, cy + 5);
          doc.font(row[0].bold ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(8.5)
            .fillColor(this.darkText)
            .text(row[0].value, margin + 85, cy + 5, { width: colW - 95 });

          // Right Cell
          doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569').text(row[1].label + ' :', margin + colW + 10, cy + 5);
          doc.font(row[1].bold ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(8.5)
            .fillColor(this.darkText)
            .text(row[1].value, margin + colW + 95, cy + 5, { width: colW - 105 });
        });

        y = infoY + tripDetails.length * rowH + 12;

        // Section 2: Consignments / Freight Table
        const freightTableY = y;
        const ftHeaderH = 18;
        const ftRowH = 16;
        const ftCols = [
          { key: 'name', label: "Transporter's Name", width: 171 },
          { key: 'freight', label: 'Freight', width: 90, align: 'right' },
          { key: 'advance', label: 'Advance', width: 90, align: 'right' },
          { key: 'balance', label: 'Balance', width: 90, align: 'right' },
          { key: 'topay', label: 'To Pay', width: 82, align: 'right' }
        ];

        // Table Header
        doc.rect(margin + 4, freightTableY, printableWidth - 8, ftHeaderH)
          .fillAndStroke(this.primaryColor, this.primaryColor);

        let hx = margin + 4;
        ftCols.forEach((col) => {
          doc.font('Helvetica-Bold')
            .fontSize(8)
            .fillColor('#ffffff')
            .text(col.label, hx + 4, freightTableY + 5, {
              width: col.width - 8,
              align: col.align || 'left'
            });
          hx += col.width;
        });

        // Consignment Rows (extract from data or empty)
        const items = data.items || (data.freightAmount ? [{ name: data.goodsDescription || 'Consignment Freight', freight: data.freightAmount, advance: data.advanceAmount || 0, balance: data.balanceAmount || 0, topay: 0 }] : []);

        let rY = freightTableY + ftHeaderH;
        if (items.length === 0) {
          doc.rect(margin + 4, rY, printableWidth - 8, ftRowH).fill('#ffffff');
          doc.font('Helvetica-Oblique').fontSize(8).fillColor('#64748b').text('No freight line items recorded for this trip memo', margin + 14, rY + 5);
          rY += ftRowH;
        } else {
          items.slice(0, 5).forEach((item, idx) => {
            if (idx % 2 === 1) {
              doc.rect(margin + 4, rY, printableWidth - 8, ftRowH).fill('#f8fafc');
            }

            let cx = margin + 4;
            ftCols.forEach((col) => {
              let val = '';
              if (col.key === 'name') val = item.name;
              else if (item[col.key] !== undefined) val = `₹ ${this._formatInr(item[col.key])}`;

              doc.font('Helvetica')
                .fontSize(7.5)
                .fillColor(this.darkText)
                .text(val, cx + 4, rY + 4, {
                  width: col.width - 8,
                  align: col.align || 'left'
                });
              cx += col.width;
            });

            rY += ftRowH;
          });
        }

        // Freight Table Outline
        doc.rect(margin + 4, freightTableY, printableWidth - 8, rY - freightTableY)
          .lineWidth(0.6)
          .strokeColor('#94a3b8')
          .stroke();

        y = rY + 10;

        // Section 3: Dual Financial Settlement Grids
        const dualGridY = y;
        const halfWidth = (printableWidth - 14) / 2;

        // Left Table: Driver Financial Summary
        const leftAdvance = Number(data.driverAdvance || data.advanceAmount || 0);
        const leftBalance = Number(data.driverBalance || data.balanceAmount || 0);
        const leftLocal = Number(data.localFreight || 0);
        const leftHamali = Number(data.hamali || 0);
        const leftTotal = leftAdvance + leftBalance + leftLocal + leftHamali;

        const leftRows = [
          { label: 'Advance', value: `₹ ${this._formatInr(leftAdvance)}` },
          { label: 'Balance', value: `₹ ${this._formatInr(leftBalance)}` },
          { label: 'Local', value: `₹ ${this._formatInr(leftLocal)}` },
          { label: 'Hamali', value: `₹ ${this._formatInr(leftHamali)}` },
          { label: 'Total', value: `₹ ${this._formatInr(leftTotal)}`, bold: true, color: this.primaryColor }
        ];

        // Right Table: Office Charges & Deductions Breakdown
        const comm = Number(data.commission || 0);
        const tapal = Number(data.tapal || 0);
        const guide = Number(data.guide || 0);
        const crane = Number(data.craneGodown || 0);
        const incHamali = Number(data.incomingHamali || 0);
        const localRight = Number(data.localDeduction || 0);
        const handLoan = Number(data.handLoan || 0);
        const memoHandLoan = Number(data.memoHandLoan || 0);
        const diesel = Number(data.diesel || 0);
        const rightTotal = comm + tapal + guide + crane + incHamali + localRight + handLoan + memoHandLoan + diesel;

        const rightRows = [
          { label: 'Commission', value: `₹ ${this._formatInr(comm)}` },
          { label: 'Tapal', value: `₹ ${this._formatInr(tapal)}` },
          { label: 'Guide', value: `₹ ${this._formatInr(guide)}` },
          { label: 'Crane + Godown', value: `₹ ${this._formatInr(crane)}` },
          { label: 'In coming Hamali', value: `₹ ${this._formatInr(incHamali)}` },
          { label: 'Local', value: `₹ ${this._formatInr(localRight)}` },
          { label: 'Hand Loan', value: `₹ ${this._formatInr(handLoan)}` },
          { label: 'Memo Hand Loan', value: `₹ ${this._formatInr(memoHandLoan)}` },
          { label: 'Diesel', value: `₹ ${this._formatInr(diesel)}`, bold: true },
          { label: 'TOTAL', value: `₹ ${this._formatInr(rightTotal)}`, bold: true, color: this.accentRed }
        ];

        const gridRowH = 14;

        // Render Left Grid
        doc.rect(margin + 4, dualGridY, halfWidth, leftRows.length * gridRowH + 18)
          .lineWidth(0.6)
          .strokeColor('#94a3b8')
          .stroke();

        doc.rect(margin + 4, dualGridY, halfWidth, 16).fill('#f1f5f9');
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(this.primaryColor).text('DRIVER / SETTLEMENT SUMMARY', margin + 10, dualGridY + 4);

        leftRows.forEach((r, idx) => {
          const cy = dualGridY + 16 + idx * gridRowH;
          if (idx > 0) {
            doc.moveTo(margin + 4, cy)
              .lineTo(margin + 4 + halfWidth, cy)
              .lineWidth(0.5)
              .strokeColor('#e2e8f0')
              .stroke();
          }
          doc.font('Helvetica-Bold').fontSize(7).fillColor('#334155').text(r.label, margin + 10, cy + 3);
          doc.font(r.bold ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(7.5)
            .fillColor(r.color || this.darkText)
            .text(r.value, margin + 10, cy + 3, { width: halfWidth - 20, align: 'right' });
        });

        // Render Right Grid
        doc.rect(margin + 10 + halfWidth, dualGridY, halfWidth, rightRows.length * gridRowH + 18)
          .lineWidth(0.6)
          .strokeColor('#94a3b8')
          .stroke();

        doc.rect(margin + 10 + halfWidth, dualGridY, halfWidth, 16).fill('#f1f5f9');
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(this.accentRed).text('CHARGES, EXPENSES & DEDUCTIONS', margin + 16 + halfWidth, dualGridY + 4);

        rightRows.forEach((r, idx) => {
          const cy = dualGridY + 16 + idx * gridRowH;
          if (idx > 0) {
            doc.moveTo(margin + 10 + halfWidth, cy)
              .lineTo(margin + 10 + halfWidth * 2, cy)
              .lineWidth(0.5)
              .strokeColor('#e2e8f0')
              .stroke();
          }
          doc.font('Helvetica-Bold').fontSize(7).fillColor('#334155').text(r.label, margin + 16 + halfWidth, cy + 3);
          doc.font(r.bold ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(7.5)
            .fillColor(r.color || this.darkText)
            .text(r.value, margin + 16 + halfWidth, cy + 3, { width: halfWidth - 26, align: 'right' });
        });

        y = dualGridY + rightRows.length * gridRowH + 26;

        // Section 4: 4-Point Terms & Notes Box
        const noteBoxY = y;
        const noteBoxH = 68;
        doc.rect(margin + 4, noteBoxY, printableWidth - 8, noteBoxH)
          .lineWidth(0.6)
          .strokeColor('#cbd5e1')
          .fillAndStroke('#fafafa', '#cbd5e1');

        doc.font('Helvetica-Bold').fontSize(7).fillColor(this.accentRed).text('NOTE :', margin + 10, noteBoxY + 6);

        const notes = [
          '1) ACKNOWLEDGMENT (PONCH) IF NOT RECEIVED WITHIN 10 DAYS THE BALANCE PAYMENT WILL NOT BE PAID.',
          '2) In case any shortage is found in goods or truck meets with an accident the truck owner will make goods for the loss.',
          '3) In case any goods are not delivered to the proper or not delivered at correct address, truck owner will be responsible for the same.',
          '4) At the time of loading truck, driver should check and verify the articles, if any shortage is found, the driver will be held responsible.'
        ];

        let ny = noteBoxY + 16;
        notes.forEach((n) => {
          doc.font('Helvetica').fontSize(6.5).fillColor('#1e293b').text(n, margin + 10, ny, { width: printableWidth - 20 });
          ny += 11;
        });

        y = noteBoxY + noteBoxH + 16;

        // Section 5: Signatures
        const sigY = y;
        doc.moveTo(margin + 16, sigY + 24)
          .lineTo(margin + 170, sigY + 24)
          .lineWidth(0.5)
          .strokeColor('#94a3b8')
          .stroke();
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(this.darkText).text("Driver's Signature", margin + 16, sigY + 28);

        doc.moveTo(margin + printableWidth - 180, sigY + 24)
          .lineTo(margin + printableWidth - 16, sigY + 24)
          .lineWidth(0.5)
          .strokeColor('#94a3b8')
          .stroke();
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(this.primaryColor).text('For BARKAT TEMPO SERVICE', margin, sigY + 28, {
          width: printableWidth - 16,
          align: 'right'
        });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}

module.exports = new BtsDocsService();
