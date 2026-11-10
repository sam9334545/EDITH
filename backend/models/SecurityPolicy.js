import mongoose from 'mongoose';
import { ALERT_SEVERITY } from '../../shared/contracts.js';

const securityPolicySchema = new mongoose.Schema({
  ruleId: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  condition: { type: String, required: true },
  severity: { type: String, enum: Object.values(ALERT_SEVERITY), required: true },
  threshold: { type: Number, min: 1, required: true },
  weight: { type: Number, min: 0, max: 100, default: 0 },
  enabled: { type: Boolean, default: true },
  recommendedAction: { type: String, required: true },
  isDemo: { type: Boolean, default: false, index: true },
}, { timestamps: true, versionKey: false });

securityPolicySchema.index({ enabled: 1, severity: 1 });

export default mongoose.models.SecurityPolicy
  || mongoose.model('SecurityPolicy', securityPolicySchema);
