// Deterministic seed. Never use Math.random / Date.now here. Schemas: shared/contracts.js
import { RESOURCE_TYPES, APPLICATION_STATUS, ACCESS_STATUS, ACTIVITY_EVENT_TYPES, RECOMMENDATION_STATUS, RECOMMENDATION_TYPES, SUGGESTED_ACTIONS } from '../../shared/contracts.js';
import { calculateInitialProfileScore } from '../services/trustScore.js';

const T0 = '2026-10-10T09:00:00.000Z';
const perms = (on, last = {}) => Object.fromEntries(RESOURCE_TYPES.map((r) => [r, {
  enabled: on.includes(r), grantedAt: on.includes(r) ? T0 : null, lastAccessedAt: last[r] || null }]));

const demoApp = (id, name, category, description, granted, expected, last = {}) => {
  const app = {
    id,
    name,
    category,
    description,
    expectedPermissions: expected,
    permissions: perms(granted, last),
    trustScore: 0,
    status: APPLICATION_STATUS.ACTIVE,
    createdAt: T0,
    updatedAt: T0,
    isDemo: true,
    demoId: `demo-${id}`,
  };
  app.trustScore = calculateInitialProfileScore(app);
  return app;
};

const DEMO_APPS = [
  demoApp('app_01', 'FitTrack (Fitness App)', 'fitness', 'Fictional fitness tracker demo for workout and route tracking', ['location', 'files'], ['location', 'files'], { location: '2026-11-08T08:10:00.000Z' }),
  demoApp('app_02', 'ShopEasy (Shopping App)', 'shopping', 'Fictional shopping app demo with product image search', ['camera', 'files'], ['camera', 'files'], { camera: '2026-11-08T12:00:00.000Z' }),
  demoApp('app_03', 'JotDown (Notes App)', 'notes', 'Fictional notes application demo with photo and voice attachments', ['camera', 'microphone', 'files'], ['camera', 'microphone', 'files'], { microphone: '2026-11-08T15:30:00.000Z' }),
  demoApp('app_04', 'Google Maps Demo', 'maps', 'Fictional navigation app; not affiliated with Google', ['location', 'files'], ['location', 'files'], { location: '2026-11-08T09:00:00.000Z' }),
  demoApp('app_05', 'WhatsApp Demo', 'communication', 'Fictional messaging app; not affiliated with WhatsApp', ['camera', 'microphone', 'contacts'], ['camera', 'microphone', 'contacts'], { contacts: '2026-11-07T14:00:00.000Z' }),
  demoApp('app_06', 'Instagram Demo', 'social', 'Fictional social photo-sharing app; not affiliated with Instagram', ['camera', 'files', 'contacts'], ['camera', 'files'], { camera: '2026-11-07T10:00:00.000Z' }),
  demoApp('app_07', 'Spotify Demo', 'media', 'Fictional audio streaming app; not affiliated with Spotify', ['camera', 'files'], ['files'], { files: '2026-11-06T16:00:00.000Z' }),
  demoApp('app_08', 'YouTube Demo', 'media', 'Fictional video streaming app; not affiliated with YouTube', ['camera', 'microphone', 'files'], ['camera', 'files'], { camera: '2026-11-06T11:00:00.000Z' }),
  demoApp('app_09', 'Calculator Demo', 'utilities', 'Fictional basic calculator app', ['contacts'], [], {}),
  demoApp('app_10', 'Weather App Demo', 'weather', 'Fictional local weather forecast app', ['location', 'files', 'contacts'], ['location', 'files'], { location: '2026-11-07T08:00:00.000Z' }),
  demoApp('app_11', 'Banking App Demo', 'finance', 'Fictional banking app with account-contact lookup', ['camera', 'files', 'contacts', 'location'], ['camera', 'files', 'contacts'], { camera: '2026-11-05T12:00:00.000Z' }),
  demoApp('app_12', 'Camera App Demo', 'camera', 'Fictional camera utility with optional voice capture', ['camera', 'microphone', 'files'], ['camera'], { camera: '2026-11-08T13:00:00.000Z' }),
  demoApp('app_13', 'File Manager Demo', 'file_manager', 'Fictional file organization utility', ['files', 'contacts'], ['files'], { files: '2026-11-04T09:00:00.000Z' }),
  demoApp('app_14', 'Unknown Third-party App', 'unknown', 'Fictional unverified demo application with an unclear purpose', ['camera', 'microphone', 'contacts', 'location', 'files'], ['files'], {}),
  demoApp('app_15', 'Travel Application', 'travel', 'Fictional trip planning and itinerary app', ['location', 'files', 'camera', 'microphone', 'contacts'], ['location', 'files'], { location: '2026-11-08T18:00:00.000Z' }),
];

export const seedData = () => ({
  apps: DEMO_APPS.map((app) => ({
    ...app,
    permissions: Object.fromEntries(Object.entries(app.permissions).map(([resource, permission]) => [
      resource,
      { ...permission },
    ])),
  })),
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
