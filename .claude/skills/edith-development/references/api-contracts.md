# API Contracts (summary)
Authoritative: `shared/API_CONTRACTS.md` (full request/response/validation/side effects). Do not duplicate or diverge; read that file before touching any endpoint.
Endpoints: GET /api/health; GET /api/apps; GET /api/apps/:id; PATCH /api/apps/:id/permissions; PATCH /api/apps/:id/status; GET /api/events; POST /api/events/simulate; GET /api/security/alerts; GET /api/security/score/:appId; GET /api/security/recommendations/:appId; POST /api/security/recommendations/:id/apply; PATCH /api/security/alerts/:id/acknowledge; GET /api/history; GET /api/stats; POST /api/demo/reset.
Envelope: `{success,data,message}` / `{success:false,error:{code,message}}`.
