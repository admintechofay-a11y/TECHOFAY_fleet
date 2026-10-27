/**
 * Role & Permission Mongoose Model
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { UserRole, SystemModule, ActionPermission } = require('../../../shared');

const permissionRuleSchema = new Schema(
  {
    module: {
      type: String,
      enum: Object.values(SystemModule),
      required: true
    },
    actions: [
      {
        type: String,
        enum: Object.values(ActionPermission),
        required: true
      }
    ]
  },
  { _id: false }
);

const roleSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    description: {
      type: String,
      default: ''
    },
    isSystemRole: {
      type: Boolean,
      default: false
    },
    permissions: [permissionRuleSchema]
  },
  {
    timestamps: true
  }
);

// Unique compound index: Role slug per company
roleSchema.index({ companyId: 1, slug: 1 }, { unique: true });

module.exports = mongoose.model('Role', roleSchema);
