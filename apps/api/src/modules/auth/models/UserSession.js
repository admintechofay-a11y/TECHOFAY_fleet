/**
 * UserSession (Refresh Token Store) Mongoose Model
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSessionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true
    },
    refreshTokenHash: {
      type: String,
      required: true,
      index: true
    },
    ipAddress: {
      type: String,
      default: ''
    },
    userAgent: {
      type: String,
      default: ''
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 } // MongoDB TTL index to auto-remove expired sessions
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true
  }
);

userSessionSchema.index({ userId: 1, isRevoked: 1 });

module.exports = mongoose.model('UserSession', userSessionSchema);
