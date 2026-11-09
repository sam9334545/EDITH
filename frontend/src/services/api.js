const API_BASE = '/api';

/**
 * Generic API request helper respecting standard envelope:
 * { success: true, data: ..., message: ... }
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  try {
    const res = await fetch(url, { ...options, headers });
    const json = await res.json();
    return json;
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: err.message || 'Unable to connect to E.D.I.T.H. backend server',
      },
    };
  }
}

export const api = {
  // Activity History (Feature 7)
  getHistory: (params = {}) => {
    const query = new URLSearchParams();
    if (params.appId) query.set('appId', params.appId);
    if (params.eventType) query.set('eventType', params.eventType);
    if (params.type) query.set('type', params.type);
    if (params.limit) query.set('limit', params.limit);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/history${qs}`);
  },

  getHistorySummary: () => request('/history/summary'),

  // Apps & Permissions
  getApps: (params = {}) => {
    const qs = params.status ? `?status=${params.status}` : '';
    return request(`/apps${qs}`);
  },

  getAppById: (id) => request(`/apps/${id}`),

  updatePermission: (id, resource, enabled) =>
    request(`/apps/${id}/permissions`, {
      method: 'PATCH',
      body: JSON.stringify({ resource, enabled }),
    }),

  updateAppStatus: (id, status) =>
    request(`/apps/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  // Events & Monitoring
  getEvents: (params = {}) => {
    const query = new URLSearchParams();
    if (params.appId) query.set('appId', params.appId);
    if (params.resource) query.set('resource', params.resource);
    if (params.status) query.set('status', params.status);
    if (params.limit) query.set('limit', params.limit);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/events${qs}`);
  },

  simulateEvents: (payload) =>
    request('/events/simulate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Security Engine
  getAlerts: (params = {}) => {
    const query = new URLSearchParams();
    if (params.appId) query.set('appId', params.appId);
    if (params.severity) query.set('severity', params.severity);
    if (params.acknowledged !== undefined) query.set('acknowledged', params.acknowledged);
    if (params.limit) query.set('limit', params.limit);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/security/alerts${qs}`);
  },

  getScore: (appId) => request(`/security/score/${appId}`),

  getRecommendations: (appId, status) => {
    const qs = status ? `?status=${status}` : '';
    return request(`/security/recommendations/${appId}${qs}`);
  },

  applyRecommendation: (id) =>
    request(`/security/recommendations/${id}/apply`, {
      method: 'POST',
    }),

  acknowledgeAlert: (id) =>
    request(`/security/alerts/${id}/acknowledge`, {
      method: 'PATCH',
    }),

  // Dashboard & Stats
  getStats: () => request('/stats'),

  // Demo Control
  resetDemo: () =>
    request('/demo/reset', {
      method: 'POST',
    }),
};

export default api;
