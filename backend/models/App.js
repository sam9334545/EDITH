import mongoose from 'mongoose';
import { APPLICATION_STATUS, RESOURCE_TYPES } from '../../shared/contracts.js';

const permissionSchema = new mongoose.Schema({
  enabled: { type: Boolean, required: true, default: false },
  grantedAt: { type: Date, default: null },
  lastAccessedAt: { type: Date, default: null },
}, { _id: false });

const permissionsSchema = new mongoose.Schema(
  Object.fromEntries(RESOURCE_TYPES.map((resource) => [resource, { type: permissionSchema, required: true }])),
  { _id: false },
);

const appSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, immutable: true, trim: true },
  name: { type: String, required: true, trim: true },
  category: { type: String, trim: true, default: 'unknown' },
  description: { type: String, required: true },
  expectedPermissions: { type: [{ type: String, enum: RESOURCE_TYPES }], default: [] },
  status: { type: String, enum: Object.values(APPLICATION_STATUS), required: true, default: APPLICATION_STATUS.ACTIVE },
  trustScore: { type: Number, min: 0, max: 100, required: true },
  permissions: { type: permissionsSchema, required: true },
  isDemo: { type: Boolean, default: false, index: true },
  demoId: { type: String, default: null, index: true },
  revision: { type: Number, default: 0 },
}, { timestamps: true, versionKey: false });

appSchema.index({ status: 1 });

export default mongoose.models.App || mongoose.model('App', appSchema);
