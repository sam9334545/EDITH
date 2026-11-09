const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').trim();
const cleanBaseUrl = rawBaseUrl.replace(/\/+$/, '');
const API_BASE_URL = cleanBaseUrl.endsWith('/api') ? cleanBaseUrl : `${cleanBaseUrl}/api`;

function queryString(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const value = search.toString();
  return value ? `?${value}` : '';
}

async function request(path, { method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Cannot reach the E.D.I.T.H. API. Check that the backend is running on port 4000.');
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(`The API returned an unreadable response (${response.status}).`);
  }

  if (!response.ok || result?.success === false) {
    const message = result?.error?.message || `Request failed with status ${response.status}.`;
    const error = new Error(message);
    error.status = response.status;
    error.code = result?.error?.code;
    throw error;
  }

  if (!result || result.success !== true || !('data' in result)) {
    throw new Error('The API response did not match the documented success envelope.');
  }
  return result.data;
}

export const api = {
  getApps: () => request('/apps'),
  getApp: (id) => request(`/apps/${encodeURIComponent(id)}`),
  updatePermission: (id, resource, enabled) => request(
    `/apps/${encodeURIComponent(id)}/permissions`,
    { method: 'PATCH', body: { resource, enabled } },
  ),
  updateStatus: (id, status) => request(
    `/apps/${encodeURIComponent(id)}/status`,
    { method: 'PATCH', body: { status } },
  ),
  getEvents: (params = {}) => request(`/events${queryString(params)}`),
  simulateEvents: (payload) => request('/events/simulate', { method: 'POST', body: payload }),
  getAlerts: (params = {}) => request(`/security/alerts${queryString(params)}`),
  acknowledgeAlert: (id) => request(
    `/security/alerts/${encodeURIComponent(id)}/acknowledge`,
    { method: 'PATCH' },
  ),
  getTrustScore: (appId) => request(`/security/score/${encodeURIComponent(appId)}`),
  getRecommendations: (appId) => request(`/security/recommendations/${encodeURIComponent(appId)}`),
  applyRecommendation: (id) => request(
    `/security/recommendations/${encodeURIComponent(id)}/apply`,
    { method: 'POST' },
  ),
  getHistory: (params = {}) => request(`/history${queryString(params)}`),
  getStats: () => request('/stats'),
  resetDemo: () => request('/demo/reset', { method: 'POST' }),
};

export { API_BASE_URL };
