/**
 * Private File Storage Service
 * Securely persists documents to disk in tenant-scoped directories.
 * Files are NOT accessible via public URLs; they require authenticated stream retrieval.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { AppError } = require('../middleware/errorHandler');

const UPLOAD_ROOT = path.resolve(process.env.STORAGE_LOCAL_DIR || './uploads');

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

// 10 MB file size limit
const MAX_FILE_SIZE = 10 * 1024 * 1024;

class StorageService {
  constructor() {
    this.root = UPLOAD_ROOT;
    if (!fs.existsSync(this.root)) {
      fs.mkdirSync(this.root, { recursive: true });
    }
  }

  /**
   * Save an uploaded file buffer into tenant-isolated storage
   */
  async saveFile({ buffer, originalName, mimeType, companyId, module = 'documents' }) {
    if (!companyId) {
      throw new AppError('Tenant company ID is required for storage isolation.', 400);
    }

    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new AppError(`Invalid file format '${mimeType}'. Allowed formats: JPG, PNG, WEBP, PDF.`, 400);
    }

    if (buffer.length > MAX_FILE_SIZE) {
      throw new AppError('File size exceeds the 10 MB maximum limit.', 400);
    }

    // Tenant-isolated subdirectory
    const tenantDir = path.join(this.root, 'tenants', companyId.toString(), module);
    if (!fs.existsSync(tenantDir)) {
      fs.mkdirSync(tenantDir, { recursive: true });
    }

    // Generate collision-safe random storage filename
    const ext = path.extname(originalName).toLowerCase() || '.bin';
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
