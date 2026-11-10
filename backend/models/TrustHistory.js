import mongoose from 'mongoose';

const trustHistorySchema = new mongoose.Schema({
  appId: { type: mongoose.Schema.Types.ObjectId, ref: 'App', required: true },
  previousScore: { type: Number, min: 0, max: 100, required: true },
  newScore: { type: Number, min: 0, max: 100, required: true },
  change: { type: Number, required: true },
  reason: { type: String, required: true },
  changeReason: { type: String, required: true },
  alertId: { type: mongoose.Schema.Types.ObjectId, ref: 'Alert', default: null },
  penalty: { type: Number, min: 0, default: 0 },
  timestamp: { type: Date, required: true },
}, { timestamps: true, versionKey: false });

trustHistorySchema.index({ appId: 1, timestamp: -1 });
trustHistorySchema.index(
  { alertId: 1 },
  { unique: true, partialFilterExpression: { alertId: { $type: 'objectId' } } },
);

export default mongoose.models.TrustHistory || mongoose.model('TrustHistory', trustHistorySchema);
