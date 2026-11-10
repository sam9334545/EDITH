import mongoose from 'mongoose';
import { ACTIVITY_EVENT_TYPES } from '../../shared/contracts.js';

const activityHistorySchema = new mongoose.Schema({
  appId: { type: mongoose.Schema.Types.ObjectId, ref: 'App', required: true },
  eventType: { type: String, enum: Object.values(ACTIVITY_EVENT_TYPES), required: true },
  description: { type: String, required: true },
  timestamp: { type: Date, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  isDemo: { type: Boolean, default: false, index: true },
  demoId: { type: String, default: null },
}, { timestamps: true, versionKey: false });

activityHistorySchema.index({ appId: 1, timestamp: -1 });
activityHistorySchema.index({ eventType: 1 });
activityHistorySchema.index({ timestamp: -1 });
activityHistorySchema.index({ demoId: 1 }, { unique: true, partialFilterExpression: { demoId: { $type: 'string' } } });

export default mongoose.models.ActivityHistory || mongoose.model('ActivityHistory', activityHistorySchema);
