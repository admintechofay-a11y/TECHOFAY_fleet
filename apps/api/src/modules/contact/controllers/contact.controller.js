/**
 * Contact Controller
 * Handles public inquiries, form submissions, spam checks, and retrieval.
 */

const ContactSubmission = require('../models/ContactSubmission');
const { AppError } = require('../../../middleware/errorHandler');

class ContactController {
  /**
   * POST /api/v1/contact
   * Public contact form submission with spam protection
   */
  static async submitInquiry(req, res, next) {
    try {
      const { name, email, phone, company, subject, message, honeypot } = req.body;

      // Anti-spam honeypot verification
      if (honeypot) {
        return res.status(200).json({
          success: true,
          statusCode: 200,
          message: 'Inquiry received successfully. Our team will contact you shortly.'
        });
      }

      if (!name || !name.trim()) {
        throw new AppError('Name is required', 400);
      }
      if (!email || !email.trim()) {
        throw new AppError('Valid email address is required', 400);
      }
      const emailRegex = /^\S+@\S+\.\S+$/;
      if (!emailRegex.test(email.trim())) {
        throw new AppError('Invalid email format', 400);
      }
      if (!message || !message.trim()) {
        throw new AppError('Inquiry message is required', 400);
      }

      const ipAddress = req.ip || req.connection?.remoteAddress || '';
      const userAgent = req.headers['user-agent'] || '';

      const submission = await ContactSubmission.create({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone ? phone.trim() : '',
        company: company ? company.trim() : '',
        subject: subject ? subject.trim() : 'General Logistics Inquiry',
        message: message.trim(),
        ipAddress,
        userAgent,
        status: 'NEW'
      });

      res.status(201).json({
        success: true,
        statusCode: 201,
        message: 'Your inquiry has been received. Our haulage specialist will respond within 24 hours.',
        data: {
          id: submission._id,
          name: submission.name,
          email: submission.email,
          createdAt: submission.createdAt
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/contact
   * Admin inquiry viewer (requires auth)
   */
  static async getInquiries(req, res, next) {
    try {
      const { status, limit = 50, page = 1 } = req.query;
      const query = {};
      if (status) query.status = status;

      const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      const [submissions, total] = await Promise.all([
        ContactSubmission.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit, 10)),
        ContactSubmission.countDocuments(query)
      ]);

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Contact inquiries retrieved successfully',
        data: submissions,
        meta: {
          total,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          totalPages: Math.ceil(total / parseInt(limit, 10)) || 1
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ContactController;
