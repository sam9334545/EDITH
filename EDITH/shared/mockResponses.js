// Mock responses mirroring shared/API_CONTRACTS.md and seedData.js. M5 uses these until backend is ready.
const T0 = '2026-11-01T09:00:00.000Z';
const p = (on) => Object.fromEntries(['location','contacts','camera','microphone','files'].map((r) => [r, { enabled: on.includes(r), grantedAt: on.includes(r) ? T0 : null, lastAccessedAt: null }]));
const env = (data, message = 'Operation completed successfully') => ({ success: true, data, message });

export const mockApps = [
  { id: 'app_01', name: 'FitTrack (Fitness App)', description: 'Workout and route tracking app', permissions: p(['location','files']), trustScore: 94, trustLevel: 'high', status: 'active', createdAt: T0, updatedAt: T0 },
  { id: 'app_02', name: 'ShopEasy (Shopping App)', description: 'Online shopping with image search', permissions: p(['camera','files']), trustScore: 91, trustLevel: 'high', status: 'active', createdAt: T0, updatedAt: T0 },
  { id: 'app_03', name: 'JotDown (Notes App)', description: 'Notes with photo and voice attachments', permissions: p(['camera','microphone','files']), trustScore: 88, trustLevel: 'high', status: 'active', createdAt: T0, updatedAt: T0 },
];
export const mockEvents = [
  { id: 'evt_0005', appId: 'app_03', resource: 'microphone', reason: 'Voice note recording', timestamp: '2026-11-08T15:30:00.000Z', status: 'allowed', suspicious: false, alertId: null },
  { id: 'evt_0004', appId: 'app_02', resource: 'camera', reason: 'Product image search', timestamp: '2026-11-08T12:00:00.000Z', status: 'allowed', suspicious: false, alertId: null },
  { id: 'evt_0003', appId: 'app_01', resource: 'location', reason: 'Workout route tracking', timestamp: '2026-11-08T08:10:00.000Z', status: 'allowed', suspicious: false, alertId: null },
];
export const mockAlerts = [];
export const mockRecommendations = [
  { id: 'rec_0001', appId: 'app_03', type: 'review_permission', title: 'Review camera permission', description: 'JotDown has camera access but has not used it yet.', suggestedAction: 'revoke_permission', resource: 'camera', alertId: null, status: 'pending', createdAt: '2026-11-08T16:00:00.000Z' },
];
export const mockHistory = [
  { id: 'act_0005', appId: 'app_03', eventType: 'recommendation_created', description: 'Recommendation: Review camera permission', timestamp: '2026-11-08T16:00:00.000Z', metadata: { recommendationId: 'rec_0001' } },
  { id: 'act_0004', appId: 'app_03', eventType: 'access_allowed', description: 'microphone access allowed', timestamp: '2026-11-08T15:30:00.000Z', metadata: { resource: 'microphone', eventId: 'evt_0005' } },
];
export const mockScore = (appId = 'app_01') => ({ appId, score: mockApps.find((a) => a.id === appId)?.trustScore ?? 0, level: 'high',
  history: [{ id: 'ts_0001', appId: 'app_01', previousScore: 100, newScore: 94, changeReason: 'Initial profile score (location + files)', timestamp: T0 }],
  explanation: ['Initial profile score 94; no penalties applied.'] });

export const mockResponses = {
  'GET /api/health': env({ status: 'ok', uptime: 1, simulated: true }),
  'GET /api/apps': env(mockApps),
  'GET /api/apps/:id': env(mockApps[0]),
  'PATCH /api/apps/:id/permissions': env({ ...mockApps[0], permissions: { ...mockApps[0].permissions, location: { ...mockApps[0].permissions.location, enabled: false } } }),
  'PATCH /api/apps/:id/status': env({ ...mockApps[0], status: 'suspended' }),
  'GET /api/events': env(mockEvents),
  'POST /api/events/simulate': env({ events: mockEvents.slice(2), summary: { total: 1, allowed: 1, denied: 0 }, alertsCreated: [], app: mockApps[0], trustScore: { appId: 'app_01', score: 94, level: 'high', explanation: ['No penalties'] }, recommendations: [] }),
  'GET /api/security/alerts': env(mockAlerts),
  'GET /api/security/score/:appId': env(mockScore()),
  'GET /api/security/recommendations/:appId': env(mockRecommendations),
  'POST /api/security/recommendations/:id/apply': env({ recommendation: { ...mockRecommendations[0], status: 'applied' }, app: mockApps[2] }),
  'PATCH /api/security/alerts/:id/acknowledge': env({ id: 'alt_0001', acknowledged: true }),
  'GET /api/history': env(mockHistory),
  'GET /api/stats': env({ totalApps: 3, allowedRequests: 5, deniedRequests: 0, activeAlerts: 0, averageTrustScore: 91 }),
  'POST /api/demo/reset': env({ reset: true }),
};
export default mockResponses;
