/**
 * Standardized API Error Contract & Error Handling Middleware
 */

class AppError extends Error {
  constructor(message, statusCode = 500, errors = [], errorCode = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.errorCode = errorCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

const HTTP_STATUS_NAMES = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error'
};

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);
  const errorTitle = HTTP_STATUS_NAMES[statusCode] || 'Error';
  const correlationId = req.id || 'req_unknown';

  // Log error internally with correlation ID (avoid logging secrets or full passwords)
  if (statusCode >= 500) {
    console.error(`[ERROR][${correlationId}] ${err.name}: ${err.message}`, {
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip
    });
  } else {
    console.warn(`[WARN][${correlationId}] ${statusCode} ${err.message}`);
  }

  // Handle Mongoose Duplicate Key Error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const value = err.keyValue ? err.keyValue[field] : 'value';
    return res.status(409).json({
      success: false,
      statusCode: 409,
      error: 'Conflict',
      message: `Duplicate entry: A record with ${field} '${value}' already exists.`,
      errors: [{ field, message: `${field} must be unique`, code: 'DUPLICATE_KEY' }],
      correlationId,
      timestamp: new Date().toISOString()
    });
  }

  // Handle Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const validationErrors = Object.values(err.errors || {}).map((e) => ({
      field: e.path,
      message: e.message,
      code: 'VALIDATION_FAILED'
    }));

    return res.status(422).json({
      success: false,
      statusCode: 422,
      error: 'Unprocessable Entity',
      message: 'Validation failed for one or more fields',
      errors: validationErrors,
      correlationId,
      timestamp: new Date().toISOString()
    });
  }

  // Standard Response Envelope
  const clientMessage = statusCode >= 500 && process.env.NODE_ENV === 'production'
    ? 'An unexpected internal server error occurred. Please contact support.'
    : err.message || 'An error occurred';

  res.status(statusCode).json({
    success: false,
    statusCode,
    error: errorTitle,
    message: clientMessage,
    errors: err.errors || [],
    correlationId,
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  AppError,
  errorHandler
};
