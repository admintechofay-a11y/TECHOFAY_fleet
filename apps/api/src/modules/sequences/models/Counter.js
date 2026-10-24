/**
 * Counter Mongoose Model
 * Manages atomic sequence generation for collision-safe numbering (Loads, LR, Bilty, Loading Slip).
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const counterSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true
    },
    entityType: {
      type: String,
      required: true // e.g. "LOAD", "LR", "BILTY", "LOADING_SLIP"
    },
    year: {
      type: Number,
      required: true,
      default: () => new Date().getFullYear()
    },
    seq: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// Compound unique index ensures each sequence has exactly one counter document per year per tenant
counterSchema.index({ companyId: 1, entityType: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Counter', counterSchema);
