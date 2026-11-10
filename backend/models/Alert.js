import mongoose from 'mongoose';
import { ALERT_SEVERITY, ALERT_TYPES } from '../../shared/contracts.js';

const alertSchema = new mongoose.Schema({
  appId: { type: mongoose.Schema.Types.ObjectId, ref: 'App', required: true },
  alertType: { type: String, enum: Object.values(ALERT_TYPES), required: true },
  resource: { type: String, required: true },
  severity: { type: String, enum: Object.values(ALERT_SEVERITY), required: true },
  message: { type: String, required: true },
  relatedEventIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Event' }],
  acknowledged: { type: Boolean, default: false },
  timestamp: { type: Date, required: true },
  recommendationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Recommendation', default: null },
}, { timestamps: true, versionKey: false });

alertSchema.index({ appId: 1, timestamp: -1 });
alertSchema.index({ appId: 1, alertType: 1, resource: 1, timestamp: -1 });
alertSchema.index({ severity: 1, acknowledged: 1 });

export default mongoose.models.Alert || mongoose.model('Alert', alertSchema);
