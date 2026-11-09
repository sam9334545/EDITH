import mongoose from 'mongoose';
import { ACCESS_STATUS, RESOURCE_TYPES } from '../../shared/contracts.js';

const eventSchema = new mongoose.Schema({
  appId: { type: mongoose.Schema.Types.ObjectId, ref: 'App', required: true },
  resource: { type: String, enum: RESOURCE_TYPES, required: true },
  reason: { type: String, required: true },
  timestamp: { type: Date, required: true, index: true },
  status: { type: String, enum: Object.values(ACCESS_STATUS), required: true },
  suspicious: { type: Boolean, default: false, index: true },
  denialReason: { type: String, enum: ['permission_disabled', 'app_suspended', null], default: null },
  alertId: { type: mongoose.Schema.Types.ObjectId, ref: 'Alert', default: null },
}, { timestamps: true, versionKey: false });

eventSchema.index({ appId: 1, timestamp: -1 });
eventSchema.index({ resource: 1 });
eventSchema.index({ status: 1 });

export default mongoose.models.Event || mongoose.model('Event', eventSchema);
