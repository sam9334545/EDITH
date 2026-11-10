import { api } from './api.js';

export const incidentService = {
  getIncident: (eventId) => api.getPostureIncident(eventId),
  getIncidents: (params = {}) => api.getPostureIncidents({ limit: 100, ...params }),
  getFinding: (findingId) => api.getPostureFinding(findingId),
  getFindings: (params = {}) => api.getPostureFindings({ limit: 100, ...params }),
  getPolicies: () => api.getPosturePolicies(),
  acknowledgeAlert: (alertId) => api.acknowledgeAlert(alertId),
  acknowledgeFinding: (findingId) => api.acknowledgeFinding(findingId),
  resolveFinding: (findingId) => api.resolveFinding(findingId),
};
