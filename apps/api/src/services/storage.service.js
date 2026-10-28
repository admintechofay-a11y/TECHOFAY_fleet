/**
 * Private File Storage Service
 * Securely persists documents to disk in tenant-scoped directories.
 * Files are NOT accessible via public URLs; they require authenticated stream retrieval.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { AppError } = require('../middleware/errorHandler');

const defaultUploadDir = (process.env.VERCEL || process.env.SERVERLESS)
  ? path.join(require('os').tmpdir(), 'uploads')
  : './uploads';

const UPLOAD_ROOT = path.resolve(
  process.env.STORAGE_LOCAL_ROOT || process.env.STORAGE_LOCAL_DIR || defaultUploadDir
);

// Allowed MIME types for vehicle/driver compliance documents, attachments, and bulk exports
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv'
];

// Dangerous extensions that must never be permitted under any MIME type
const DANGEROUS_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.bash', '.php', '.phtml', '.php3', '.php4',
  '.php5', '.php7', '.phps', '.js', '.mjs', '.vbs', '.py', '.bin', '.dll',
  '.msi', '.jar', '.com', '.scr', '.ps1', '.hta', '.cpl'
]);

// Allowed extension mapping for each MIME type
const MIME_EXTENSION_MAP = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls', '.xlsx'],
  'text/csv': ['.csv', '.txt']
};

/**
 * Validates file signature (magic bytes) against declared MIME type
 */
function validateFileSignature(buffer, mimeType, filenameOrExt) {
  if (!buffer || buffer.length === 0) {
    throw new AppError('Uploaded file buffer is empty.', 400);
  }

  const ext = (filenameOrExt && filenameOrExt.startsWith('.') ? filenameOrExt : path.extname(filenameOrExt || '')).toLowerCase();

  // 1. Check for prohibited dangerous extensions
  if (DANGEROUS_EXTENSIONS.has(ext)) {
    throw new AppError(`Security violation: File extension '${ext}' is strictly prohibited.`, 400);
  }

  // 2. Check extension consistency with MIME
  const allowedExts = MIME_EXTENSION_MAP[mimeType];
  if (allowedExts && !allowedExts.includes(ext)) {
    throw new AppError(
      `File extension '${ext}' does not match declared MIME type '${mimeType}'. Expected: ${allowedExts.join(', ')}`,
      400
    );
  }

  // 3. Inspect magic bytes for binary spoofing prevention
  if (mimeType === 'application/pdf') {
    // PDF must start with '%PDF-' (0x25 0x50 0x44 0x46 0x2D) or '%PDF'
    const header = buffer.slice(0, 4).toString('ascii');
    if (header !== '%PDF') {
      throw new AppError('File signature mismatch: File claims to be PDF but lacks valid %PDF header.', 400);
    }
  } else if (mimeType === 'image/jpeg') {
    // JPEG starts with 0xFF 0xD8 0xFF
    if (buffer.length < 3 || buffer[0] !== 0xFF || buffer[1] !== 0xD8 || buffer[2] !== 0xFF) {
      throw new AppError('File signature mismatch: File claims to be JPEG but lacks valid SOI marker.', 400);
    }
  } else if (mimeType === 'image/png') {
    // PNG starts with 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
    if (
      buffer.length < 8 ||
      buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4E || buffer[3] !== 0x47 ||
      buffer[4] !== 0x0D || buffer[5] !== 0x0A || buffer[6] !== 0x1A || buffer[7] !== 0x0A
    ) {
      throw new AppError('File signature mismatch: File claims to be PNG but lacks valid PNG signature.', 400);
    }
  } else if (mimeType === 'image/webp') {
    // WEBP: bytes 0-3 'RIFF' and bytes 8-11 'WEBP'
    if (
      buffer.length < 12 ||
      buffer.slice(0, 4).toString('ascii') !== 'RIFF' ||
      buffer.slice(8, 12).toString('ascii') !== 'WEBP'
    ) {
      throw new AppError('File signature mismatch: File claims to be WEBP but lacks valid RIFF/WEBP header.', 400);
    }
  } else if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    // XLSX is a ZIP archive: starts with PK (0x50 0x4B 0x03 0x04 or 0x05 0x06 / 0x07 0x08)
    if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4B) {
      throw new AppError('File signature mismatch: File claims to be XLSX spreadsheet but lacks ZIP/PK signature.', 400);
    }
  } else if (mimeType === 'application/vnd.ms-excel') {
    // XLS OLE compound file: starts with 0xD0 0xCF 0x11 0xE0 or PK if modern xlsx renamed
    const isOle = buffer.length >= 4 && buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0;
    const isZip = buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4B;
    if (!isOle && !isZip) {
      throw new AppError('File signature mismatch: File claims to be Excel workbook but lacks valid signature.', 400);
    }
  } else if (mimeType === 'text/csv') {
    // CSV must be text: reject executable binaries (PE MZ, ELF, Mach-O)
    if (buffer.length >= 2 && buffer[0] === 0x4D && buffer[1] === 0x5A) {
      throw new AppError('Security violation: Executable binary (MZ header) disguised as CSV.', 400);
    }
    if (buffer.length >= 4 && buffer[0] === 0x7F && buffer.slice(1, 4).toString('ascii') === 'ELF') {
      throw new AppError('Security violation: ELF executable disguised as CSV.', 400);
    }
    // Reject NUL bytes in text files
    for (let i = 0; i < Math.min(buffer.length, 512); i++) {
      if (buffer[i] === 0) {
        throw new AppError('Security violation: Binary content with NUL bytes detected in CSV text file.', 400);
      }
    }
  }

  return true;
}

class StorageService {
  constructor() {
    this.root = UPLOAD_ROOT;
    this.driver = process.env.STORAGE_DRIVER || 'local';
    const maxMb = parseInt(process.env.STORAGE_MAX_FILE_SIZE_MB, 10) || 15;
    this.maxFileSize = maxMb * 1024 * 1024;

    try {
      if (!fs.existsSync(this.root)) {
        fs.mkdirSync(this.root, { recursive: true });
      }
    } catch (err) {
      console.warn('[STORAGE] Local storage initialization warning:', err.message);
    }
  }

  /**
   * Public validation helper for file signatures
   */
  validateFileSignature(buffer, mimeType, originalName) {
    return validateFileSignature(buffer, mimeType, originalName);
  }

  /**
   * Save an uploaded file buffer into tenant-isolated storage
   */
  async saveFile({ buffer, originalName, mimeType, companyId, module = 'documents' }) {
    if (!companyId) {
      throw new AppError('Tenant company ID is required for storage isolation.', 400);
    }

    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new AppError(
        `Invalid file format '${mimeType}'. Allowed formats: JPG, PNG, WEBP, PDF, XLSX, CSV.`,
        400
      );
    }

    if (buffer.length > this.maxFileSize) {
      const limitMb = Math.round(this.maxFileSize / (1024 * 1024));
      throw new AppError(`File size exceeds the ${limitMb} MB maximum limit.`, 400);
    }

    const ext = path.extname(originalName || '').toLowerCase() || '.bin';

    // Validate magic bytes and extension consistency
    validateFileSignature(buffer, mimeType, ext);

    // Tenant-isolated subdirectory
    const tenantDir = path.join(this.root, 'tenants', companyId.toString(), module);
    try {
      if (!fs.existsSync(tenantDir)) {
        fs.mkdirSync(tenantDir, { recursive: true });
      }
    } catch (err) {
      console.warn('[STORAGE] Tenant directory creation warning:', err.message);
    }

    // Generate collision-safe random storage filename
    const randomHex = crypto.randomBytes(16).toString('hex');
    const storageFileName = `${Date.now()}_${randomHex}${ext}`;
    const fullPath = path.join(tenantDir, storageFileName);

    await fs.promises.writeFile(fullPath, buffer);

    // Relative storage key (e.g., "tenants/60a1/vehicles/1729..._abc.pdf")
    const relativeKey = path.relative(this.root, fullPath).replace(/\\/g, '/');

    return {
      fileKey: relativeKey,
      originalFileName: originalName,
      mimeType,
      fileSize: buffer.length
    };
  }

  /**
   * Resolve and verify absolute path for a stored file key
   */
  getFilePath(fileKey, companyId = null) {
    if (!fileKey || typeof fileKey !== 'string') {
      throw new AppError('Invalid file key provided.', 400);
    }

    // Path traversal prevention: normalize and ensure starts within root
    const resolvedPath = path.resolve(this.root, fileKey);
    if (!resolvedPath.startsWith(this.root)) {
      throw new AppError('Invalid path: Directory traversal detected.', 403);
    }

    // If companyId is provided, enforce that file key belongs to this tenant
    if (companyId) {
      const tenantPrefix = path.resolve(this.root, 'tenants', companyId.toString());
      if (!resolvedPath.startsWith(tenantPrefix)) {
        throw new AppError('Access denied: Document does not belong to your organization.', 403);
      }
    }

    if (!fs.existsSync(resolvedPath)) {
      throw new AppError('The requested file was not found on the server.', 404);
    }

    return resolvedPath;
  }

  /**
   * Remove a file from private storage
   */
  async deleteFile(fileKey, companyId = null) {
    try {
      const fullPath = this.getFilePath(fileKey, companyId);
      await fs.promises.unlink(fullPath);
      return true;
    } catch (err) {
      if (err.statusCode === 404) return false;
      throw err;
    }
  }
}

module.exports = new StorageService();
