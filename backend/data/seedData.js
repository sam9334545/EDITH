// Deterministic seed. Never use Math.random / Date.now here. Schemas: shared/contracts.js
import { RESOURCE_TYPES, APPLICATION_STATUS, ACCESS_STATUS, ACTIVITY_EVENT_TYPES, RECOMMENDATION_STATUS, RECOMMENDATION_TYPES, SUGGESTED_ACTIONS } from '../../shared/contracts.js';

const T0 = '2026-11-01T09:00:00.000Z';
const perms = (on, last = {}) => Object.fromEntries(RESOURCE_TYPES.map((r) => [r, {
  enabled: on.includes(r), grantedAt: on.includes(r) ? T0 : null, lastAccessedAt: last[r] || null }]));

export const seedData = () => ({
  apps: [
    { id: 'app_01', name: 'FitTrack (Fitness App)', description: 'Workout and route tracking app',
      permissions: perms(['location', 'files'], { location: '2026-11-08T08:10:00.000Z' }), trustScore: 94,
      status: APPLICATION_STATUS.ACTIVE, createdAt: T0, updatedAt: T0 },
    { id: 'app_02', name: 'ShopEasy (Shopping App)', description: 'Online shopping with image search',
      permissions: perms(['camera', 'files'], { camera: '2026-11-08T12:00:00.000Z' }), trustScore: 91,
      status: APPLICATION_STATUS.ACTIVE, createdAt: T0, updatedAt: T0 },
    { id: 'app_03', name: 'JotDown (Notes App)', description: 'Notes with photo and voice attachments',
      permissions: perms(['camera', 'microphone', 'files'], { microphone: '2026-11-08T15:30:00.000Z' }), trustScore: 88,
      status: APPLICATION_STATUS.ACTIVE, createdAt: T0, updatedAt: T0 },
  ],
  events: [
    { id: 'evt_0001', appId: 'app_01', resource: 'location', reason: 'Workout route tracking', timestamp: '2026-11-08T08:00:00.000Z', status: ACCESS_STATUS.ALLOWED, suspicious: false, alertId: null },
    { id: 'evt_0002', appId: 'app_01', resource: 'location', reason: 'Workout route tracking', timestamp: '2026-11-08T08:05:00.000Z', status: ACCESS_STATUS.ALLOWED, suspicious: false, alertId: null },
    { id: 'evt_0003', appId: 'app_01', resource: 'location', reason: 'Workout route tracking', timestamp: '2026-11-08T08:10:00.000Z', status: ACCESS_STATUS.ALLOWED, suspicious: false, alertId: null },
    { id: 'evt_0004', appId: 'app_02', resource: 'camera', reason: 'Product image search', timestamp: '2026-11-08T12:00:00.000Z', status: ACCESS_STATUS.ALLOWED, suspicious: false, alertId: null },
    { id: 'evt_0005', appId: 'app_03', resource: 'microphone', reason: 'Voice note recording', timestamp: '2026-11-08T15:30:00.000Z', status: ACCESS_STATUS.ALLOWED, suspicious: false, alertId: null },
  ],
  alerts: [],
  recommendations: [
    { id: 'rec_0001', appId: 'app_03', type: RECOMMENDATION_TYPES.REVIEW_PERMISSION, title: 'Review camera permission',
      description: 'JotDown has camera access but has not used it yet. Consider restricting if not needed (unused is not necessarily malicious).',
      suggestedAction: SUGGESTED_ACTIONS.REVOKE_PERMISSION, resource: 'camera', alertId: null,
      status: RECOMMENDATION_STATUS.PENDING, createdAt: '2026-11-08T16:00:00.000Z' },
  ],
  history: [
    { id: 'act_0001', appId: 'app_01', eventType: ACTIVITY_EVENT_TYPES.PERMISSION_GRANTED, description: 'location permission granted', timestamp: T0, metadata: { resource: 'location' } },
    { id: 'act_0002', appId: 'app_01', eventType: ACTIVITY_EVENT_TYPES.ACCESS_ALLOWED, description: 'location access allowed', timestamp: '2026-11-08T08:00:00.000Z', metadata: { resource: 'location', eventId: 'evt_0001' } },
    { id: 'act_0003', appId: 'app_02', eventType: ACTIVITY_EVENT_TYPES.ACCESS_ALLOWED, description: 'camera access allowed', timestamp: '2026-11-08T12:00:00.000Z', metadata: { resource: 'camera', eventId: 'evt_0004' } },
    { id: 'act_0004', appId: 'app_03', eventType: ACTIVITY_EVENT_TYPES.ACCESS_ALLOWED, description: 'microphone access allowed', timestamp: '2026-11-08T15:30:00.000Z', metadata: { resource: 'microphone', eventId: 'evt_0005' } },
    { id: 'act_0005', appId: 'app_03', eventType: ACTIVITY_EVENT_TYPES.RECOMMENDATION_CREATED, description: 'Recommendation: Review camera permission', timestamp: '2026-11-08T16:00:00.000Z', metadata: { recommendationId: 'rec_0001' } },
  ],
  trustHistory: [
    { id: 'ts_0001', appId: 'app_01', previousScore: 100, newScore: 94, changeReason: 'Initial profile score (location + files)', timestamp: T0 },
    { id: 'ts_0002', appId: 'app_02', previousScore: 100, newScore: 91, changeReason: 'Initial profile score (camera + files)', timestamp: T0 },
    { id: 'ts_0003', appId: 'app_03', previousScore: 100, newScore: 88, changeReason: 'Initial profile score (camera + microphone + files)', timestamp: T0 },
  ],
  counters: { evt: 5, alt: 0, rec: 1, act: 5, ts: 3 },
});
export default seedData;
