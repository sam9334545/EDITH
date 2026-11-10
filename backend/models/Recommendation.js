import mongoose from 'mongoose';
import {
  RECOMMENDATION_STATUS,
  RECOMMENDATION_TYPES,
  RESOURCE_TYPES,
  SUGGESTED_ACTIONS,
} from '../../shared/contracts.js';

const recommendationSchema = new mongoose.Schema({
  appId: { type: mongoose.Schema.Types.ObjectId, ref: 'App', required: true },
  alertId: { type: mongoose.Schema.Types.ObjectId, ref: 'Alert', required: true },
  type: { type: String, enum: Object.values(RECOMMENDATION_TYPES), required: true },
  resource: { type: String, enum: [...RESOURCE_TYPES, null], default: null },
  title: { type: String, required: true },
  description: { type: String, required: true },
  suggestedAction: { type: String, enum: Object.values(SUGGESTED_ACTIONS), required: true },
  status: { type: String, enum: Object.values(RECOMMENDATION_STATUS), default: RECOMMENDATION_STATUS.PENDING },
  appliedAt: { type: Date, default: null },
  isDemo: { type: Boolean, default: false, index: true },
  demoId: { type: String, default: null },
}, { timestamps: true, versionKey: false });

recommendationSchema.index({ appId: 1, createdAt: -1 });
recommendationSchema.index(
  { appId: 1, type: 1, resource: 1 },
  { unique: true, partialFilterExpression: { status: RECOMMENDATION_STATUS.PENDING } },
);
recommendationSchema.index({ demoId: 1 }, { unique: true, partialFilterExpression: { demoId: { $type: 'string' } } });

export default mongoose.models.Recommendation || mongoose.model('Recommendation', recommendationSchema);
