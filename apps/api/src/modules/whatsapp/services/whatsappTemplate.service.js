/**
 * WhatsApp Template Registry & Message Rendering Service
 * Formats, renders, and validates pre-approved business notification templates.
 */

const { WhatsAppTemplateType } = require('@fleet/shared');
const { AppError } = require('../../../middleware/errorHandler');

/**
 * Standard templates registry
 */
const TEMPLATES = {
  [WhatsAppTemplateType.LOAD_CREATED]: {
    name: WhatsAppTemplateType.LOAD_CREATED,
    title: 'Load Order Registered',
    requiredVars: ['loadNumber', 'originCity', 'destCity', 'weightMt'],
    render: (v) =>
      `🚚 *Technofay Logistics Update*\n\n` +
      `Dear Customer,\nA new consignment load *${v.loadNumber}* has been registered.\n` +
      `📍 *Origin:* ${v.originCity || 'Origin Hub'}\n` +
      `🏁 *Destination:* ${v.destCity || 'Destination Terminal'}\n` +
      `📦 *Cargo:* ${v.weightMt} MT (${v.packageType || 'Packages'})\n\n` +
      `Thank you for choosing our fleet services!`
  },

  [WhatsAppTemplateType.VEHICLE_DISPATCHED]: {
    name: WhatsAppTemplateType.VEHICLE_DISPATCHED,
    title: 'Vehicle Dispatched on Trip',
    requiredVars: ['tripNumber', 'vehiclePlate', 'driverName'],
    render: (v) =>
      `🚛 *Trip Dispatched - On The Move*\n\n` +
      `Trip *${v.tripNumber}* ${v.loadNumber ? `(Load ${v.loadNumber})` : ''} has been dispatched!\n` +
      `🚚 *Vehicle Plate:* ${v.vehiclePlate}\n` +
      `👤 *Assigned Driver:* ${v.driverName} ${v.driverPhone ? `(📞 ${v.driverPhone})` : ''}\n` +
      `📍 *Route:* ${v.originCity || 'Origin'} ➔ ${v.destCity || 'Destination'}\n\n` +
      `Technofay Fleet Dispatch Management`
  },

  [WhatsAppTemplateType.IN_TRANSIT]: {
    name: WhatsAppTemplateType.IN_TRANSIT,
    title: 'Consignment In Transit',
    requiredVars: ['loadNumber', 'destCity'],
    render: (v) =>
      `📍 *Consignment In Transit*\n\n` +
      `Load *${v.loadNumber}* is currently on route to *${v.destCity}*.\n` +
      `Expected Arrival: *${v.expectedDate || 'As scheduled'}*.\n` +
      `${v.driverPhone ? `Driver Contact: ${v.driverPhone}\n\n` : '\n'}` +
      `Technofay Fleet Operations`
  },

  [WhatsAppTemplateType.DELIVERY_COMPLETED]: {
    name: WhatsAppTemplateType.DELIVERY_COMPLETED,
    title: 'Delivery Completed & Acknowledged',
    requiredVars: ['loadNumber', 'destCity', 'deliveredQty'],
    render: (v) =>
      `✅ *Consignment Delivered Successfully*\n\n` +
      `Load *${v.loadNumber}* has successfully arrived at ${v.destCity}.\n` +
      `📦 *Delivered Quantity:* ${v.deliveredQty} Units\n` +
      `${v.receivedBy ? `👤 *Received By:* ${v.receivedBy}\n` : ''}` +
      `Proof of Delivery (POD) has been verified and recorded.`
  },

  [WhatsAppTemplateType.LR_BILTY_SHARE]: {
    name: WhatsAppTemplateType.LR_BILTY_SHARE,
    title: 'Official Document Share',
    requiredVars: ['documentType', 'documentNumber', 'loadNumber'],
    render: (v) =>
      `📄 *Official Consignment Document Attached*\n\n` +
      `Please find attached official ${v.documentType} *${v.documentNumber}* for Load *${v.loadNumber}*.\n` +
      `${v.vehiclePlate ? `🚚 Vehicle: ${v.vehiclePlate}\n` : ''}` +
      `${v.totalFreightRupees ? `💰 Freight: INR ${v.totalFreightRupees}\n` : ''}\n` +
      `Technofay Fleet Document Management`
  }
};

/**
 * Normalizes phone numbers to standard E.164 international format (+91XXXXXXXXXX)
 */
function normalizePhoneNumber(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string') {
    throw new AppError('Recipient phone number is required.', 400);
  }

  const cleaned = rawPhone.trim().replace(/[\s\-\(\)]/g, '');
  const digits = cleaned.replace(/\D/g, '');

  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `+91${digits.slice(1)}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  if (cleaned.startsWith('+') && digits.length >= 7 && digits.length <= 15) {
    return `+${digits}`;
  }

  throw new AppError(
    `Invalid phone number '${rawPhone}'. Must be a valid 10-digit Indian mobile or E.164 international format.`,
    400
  );
}

/**
 * Render template text with validation of required variables
 */
function renderTemplate(templateName, variables = {}) {
  const tpl = TEMPLATES[templateName];
  if (!tpl) {
    throw new AppError(`Unsupported WhatsApp template '${templateName}'. Allowed: ${Object.keys(TEMPLATES).join(', ')}`, 400);
  }

  // Check required variables
  for (const reqVar of tpl.requiredVars) {
    if (!variables[reqVar] && variables[reqVar] !== 0) {
      throw new AppError(`Missing required template variable '${reqVar}' for template '${templateName}'.`, 400);
    }
  }

  return tpl.render(variables);
}

module.exports = {
  TEMPLATES,
  normalizePhoneNumber,
  renderTemplate
};
