/**
 * Private Document Routes
 */

const express = require('express');
const documentController = require('../controllers/document.controller');
const { authenticate, enforceTenantScope } = require('../../../middleware/auth.middleware');

const router = express.Router();

const optionalAuth = (req, res, next) => {
  authenticate(req, res, (err) => {
    if (err) {
      // Continue without session; controller will verify ?token= query param
      return next();
    }
    enforceTenantScope(req, res, next);
  });
};

// Stream document PDF (Supports authenticated session OR signed expiring ?token=)
router.get('/:type/:id/pdf', optionalAuth, documentController.streamDocumentPdf);

// Private authenticated file download (for vehicle/driver compliance documents)
router.use(authenticate, enforceTenantScope);
router.get('/:id/download', documentController.download);

module.exports = router;
