# E.D.I.T.H. API Contracts (AUTHORITATIVE)
Base: `http://localhost:4000`. Envelope on every response:
Success `{ "success": true, "data": {}, "message": "..." }` | Error `{ "success": false, "error": { "code": "APP_NOT_FOUND", "message": "..." } }`
HTTP: 200 ok, 400 VALIDATION_ERROR/RESOURCE_INVALID, 403 RESET_DISABLED, 404 APP_NOT_FOUND/RECOMMENDATION_NOT_FOUND/FINDING_NOT_FOUND/POLICY_NOT_FOUND/INCIDENT_NOT_FOUND, 503 DATABASE_UNAVAILABLE, 500 INTERNAL_ERROR.
Note: a DENIED access request is a successful API call (200) whose `data.event.status` is `denied`.
Schemas: see `shared/contracts.js` + `TEAM_DATA_CONTRACT.md`. Examples below are abbreviated.

| # | Method URL | Owner |
|---|---|---|
| 1 | GET /api/health | M1 |
| 2 | GET /api/apps | M2 |
| 3 | GET /api/apps/:id | M2 |
| 4 | PATCH /api/apps/:id/permissions | M2 |
| 5 | PATCH /api/apps/:id/status | M2 |
| 6 | GET /api/events | M3 |
| 7 | POST /api/events/simulate | M3 (calls M1 `processAccessRequest`) |
| 8 | GET /api/security/alerts | M4 |
| 9 | GET /api/security/score/:appId | M4 |
| 10 | GET /api/security/recommendations/:appId | M4 |
| 11 | POST /api/security/recommendations/:id/apply | M4 (calls M2 service) |
| 12 | PATCH /api/security/alerts/:id/acknowledge | M4 |
| 13 | GET /api/history | M3 |
| 14 | GET /api/stats | M1 (aggregates) |
| 15 | POST /api/demo/reset | M1 (restores seed; for judges) |
| 16 | GET /api/posture/overview | M1 + M4 (aggregates) |
| 17 | GET /api/posture/applications | M1 + M4 |
| 18 | GET /api/posture/applications/:appId | M1 + M4 |
| 19 | GET /api/posture/findings | M1 + M4 |
| 20 | GET /api/posture/findings/:id | M1 + M4 |
| 21 | POST /api/posture/findings/:id/acknowledge | M1 + M4 |
| 22 | POST /api/posture/findings/:id/resolve | M1 + M4 |
| 23 | GET /api/posture/trends | M1 + M4 |
| 24 | GET /api/posture/runtime-events | M1 + M3 |
| 25 | GET /api/posture/incidents[/:eventId] | M1 + M3 + M4 |
| 26 | GET/PATCH /api/posture/policies[/:ruleId] | M1 + M4 |

## 1 GET /api/health
Resp when connected `data: { "status":"ok","uptime":12.3,"simulated":true,"database":"ok" }`. Returns 503 `DATABASE_UNAVAILABLE` when MongoDB is disconnected.

## 2 GET /api/apps
Purpose: list apps. Query: `status?`. Resp `data: Application[]` (trustScore current, trustLevel derived).

## 3 GET /api/apps/:id
Resp `data: Application`. Errors: 404 APP_NOT_FOUND.

## 4 PATCH /api/apps/:id/permissions
Body `{ "resource":"location","enabled":false }`. Validation: resource in RESOURCE_TYPES, enabled boolean.
Side effects: updates permission (`grantedAt` set on enable), `updatedAt`, history `permission_granted|permission_revoked`.
Resp `data: Application`. Errors: 400, 404.

## 5 PATCH /api/apps/:id/status
Body `{ "status":"suspended" }` (`active|suspended`). Side effects: history `app_suspended|app_reactivated`. Resp `data: Application`.

## 6 GET /api/events
Query: `appId?`, `resource?`, `status?` (allowed|denied), `suspicious?` (true|false), `limit?` (default 50, max 200), `offset?` (default 0). Newest first.
Resp `data: AccessEvent[]`.

## 7 POST /api/events/simulate
Body `{ "appId":"app_01","resource":"location","reason":"Background location request","count":25 }` (`count` default 1, 1-100; `reason` default "Simulated request").
Behaviour: runs `processAccessRequest` `count` times; simulated timestamps spaced 2000 ms apart starting at `startTime` (optional ISO, default now) so 25 requests fit in 48 s.
Side effects: events, alerts, trust score, recommendations, history (full pipeline).
Resp `data`:
```json
{ "events": [ AccessEvent ], "summary": { "total":25,"allowed":25,"denied":0 },
  "alertsCreated": [ SecurityAlert ], "app": Application,
  "trustScore": { "appId":"app_01","score":79,"level":"moderate","explanation":["..."] },
  "recommendations": [ Recommendation ] }
```

## 8 GET /api/security/alerts
Query: `appId?`, `severity?`, `type?`, `acknowledged?`, `limit?`. Resp `data: SecurityAlert[]` newest first.

## 9 GET /api/security/score/:appId
Resp `data: { "appId","score","level","history": TrustScoreHistory[], "explanation": string[] }`. 404 APP_NOT_FOUND.

## 10 GET /api/security/recommendations/:appId
Query `status?`. Resp `data: Recommendation[]`.

## 11 POST /api/security/recommendations/:id/apply
Body none. Applies `suggestedAction` (revoke_permission -> M2 revoke; suspend_app -> suspend). Marks `applied`. History `recommendation_applied` + permission/app event. Resp `data: { recommendation, app }`. Idempotent: re-apply returns 200 unchanged.

## 12 PATCH /api/security/alerts/:id/acknowledge
Sets `acknowledged:true`. Resp `data: SecurityAlert`.

## 13 GET /api/history
Query `appId?`, `type?` (ACTIVITY_EVENT_TYPES), `limit?` (default 100), `offset?` (default 0). Resp `data: ActivityHistory[]` newest first.

## 14 GET /api/stats
Resp `data: { "totalApps":15,"allowedRequests":0,"deniedRequests":0,"activeAlerts":0,"averageTrustScore":92 }` in a fresh seeded demo (activeAlerts = unacknowledged).

## 15 POST /api/demo/reset
Reloads deterministic seed only when `NODE_ENV=development` and `ALLOW_DEMO_RESET=true`; otherwise returns 403 `RESET_DISABLED`. Resp `data: { "reset": true }`.

## 16-26 CNAPP-inspired application posture (simulated)
Posture endpoints use persisted application, permission, event, alert, and trust-history records. They do not scan cloud infrastructure or operating-system activity.

- `GET /api/posture/overview?days=7|30` returns backend-derived summary cards, risk and trust-score distributions, runtime counts, and permission analytics.
- `GET /api/posture/applications?appId=&riskLevel=&category=` returns application posture, score explanation, unique event accounting, trends, and recommended actions. `GET /api/posture/applications/:appId` adds findings, alerts, and recent events.
- `GET /api/posture/findings?appId=&severity=&status=&findingType=&resource=&from=&to=&limit=&offset=` returns `{items,total,limit,offset}`. Dates must be valid ISO 8601 strings.
- `GET /api/posture/findings/:id` returns a finding. `POST .../:id/acknowledge` acknowledges linked alerts as well. `POST .../:id/resolve` records a resolution; active permission findings must first be remediated.
- `GET /api/posture/trends?days=7|30` returns daily runtime, trust-change, and violation series.
- `GET /api/posture/runtime-events` and `GET /api/posture/incidents` accept application, decision/severity, date, and pagination filters. Incidents are derived once per unique access-event ID and link to any related alerts.
- `GET /api/posture/policies` lists rules. `PATCH /api/posture/policies/:ruleId` accepts one or more of `{enabled,threshold,weight,severity,recommendedAction}`.
- All endpoints retain the standard response envelope. IDs link back to the existing application/event/alert records.
- `npm run seed` idempotently adds 15 explicitly fictional demo apps, historical simulated events, policies, alerts, trust history, and activity history. Demo reset removes only records explicitly marked as demo and remains disabled outside development with `ALLOW_DEMO_RESET=true`.
- Posture risk starts from the existing trust score. Alert-linked events are already represented in that score and are not penalized again; additional event penalties use unique, unlinked event IDs.
- The project remains a single-user simulated demo. No authentication or user/role model is currently provided.

## Advanced (add ONLY after MVP gate; extend, never break)
`GET/PATCH /api/guard/mode` `{mode: monitor|protect|strict}`, `GET /api/guard/decisions`, `GET /api/security/posture`, `POST /api/simulator/what-if` (read-only). Define their schemas in contracts.js when built.
