import mongoose from 'mongoose';
import {
  ALERT_SEVERITY,
  FINDING_STATUS,
  POSTURE_FINDING_TYPES,
  RESOURCE_TYPES,
} from '../../shared/contracts.js';

const findingHistorySchema = new mongoose.Schema({
  status: { type: String, enum: Object.values(FINDING_STATUS), required: true },
  timestamp: { type: Date, required: true },
  note: { type: String, default: '' },
}, { _id: false });

const securityFindingSchema = new mongoose.Schema({
  appId: { type: mongoose.Schema.Types.ObjectId, ref: 'App', required: true },
  findingKey: { type: String, required: true },
  findingType: { type: String, enum: Object.values(POSTURE_FINDING_TYPES), required: true },
  title: { type: String, required: true },
  severity: { type: String, enum: Object.values(ALERT_SEVERITY), required: true },
  reason: { type: String, required: true },
  permissionResources: [{ type: String, enum: RESOURCE_TYPES }],
  relatedEventIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Event' }],
  alertIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Alert' }],
  ruleId: { type: String, default: null },
  recommendedAction: { type: String, required: true },
  status: { type: String, enum: Object.values(FINDING_STATUS), default: FINDING_STATUS.OPEN },
  conditionActive: { type: Boolean, default: true },
  detectedAt: { type: Date, required: true },
  lastObservedAt: { type: Date, required: true },
  history: { type: [findingHistorySchema], default: [] },
  isDemo: { type: Boolean, default: false, index: true },
}, { timestamps: true, versionKey: false });

securityFindingSchema.index({ appId: 1, findingKey: 1 }, { unique: true });
securityFindingSchema.index({ status: 1, severity: 1, lastObservedAt: -1 });
securityFindingSchema.index({ findingType: 1, lastObservedAt: -1 });

export default mongoose.models.SecurityFinding
  || mongoose.model('SecurityFinding', securityFindingSchema);
