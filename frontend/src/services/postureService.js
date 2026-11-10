import { api } from './api.js';

export const postureService = {
  getApplications: (params) => api.getPostureApplications(params),
  getFindings: (params) => api.getPostureFindings(params),
  getFinding: (id) => api.getPostureFinding(id),
  acknowledgeFinding: (id) => api.acknowledgeFinding(id),
  resolveFinding: (id) => api.resolveFinding(id),
  getPolicies: () => api.getPosturePolicies(),
  updatePolicy: (ruleId, body) => api.updatePosturePolicy(ruleId, body),
};
