# E.D.I.T.H. API Contracts (AUTHORITATIVE)
Base: `http://localhost:4000`. Envelope on every response:
Success `{ "success": true, "data": {}, "message": "..." }` | Error `{ "success": false, "error": { "code": "APP_NOT_FOUND", "message": "..." } }`
HTTP: 200 ok, 400 VALIDATION_ERROR/RESOURCE_INVALID, 404 APP_NOT_FOUND/RECOMMENDATION_NOT_FOUND, 500 INTERNAL_ERROR.
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

## 1 GET /api/health
Resp `data: { "status":"ok","uptime":12.3,"simulated":true }`

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
Query: `appId?`, `resource?`, `status?` (allowed|denied), `suspicious?` (true|false), `limit?` (default 50, max 200). Newest first.
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
Query: `appId?`, `severity?`, `acknowledged?`, `limit?`. Resp `data: SecurityAlert[]` newest first.

## 9 GET /api/security/score/:appId
Resp `data: { "appId","score","level","history": TrustScoreHistory[], "explanation": string[] }`. 404 APP_NOT_FOUND.

## 10 GET /api/security/recommendations/:appId
Query `status?`. Resp `data: Recommendation[]`.

## 11 POST /api/security/recommendations/:id/apply
Body none. Applies `suggestedAction` (revoke_permission -> M2 revoke; suspend_app -> suspend). Marks `applied`. History `recommendation_applied` + permission/app event. Resp `data: { recommendation, app }`. Idempotent: re-apply returns 200 unchanged.

## 12 PATCH /api/security/alerts/:id/acknowledge
Sets `acknowledged:true`. Resp `data: SecurityAlert`.

## 13 GET /api/history
Query `appId?`, `type?` (ACTIVITY_EVENT_TYPES), `limit?` (default 100). Resp `data: ActivityHistory[]` newest first.

## 14 GET /api/stats
Resp `data: { "totalApps":3,"allowedRequests":0,"deniedRequests":0,"activeAlerts":0,"averageTrustScore":92 }` (activeAlerts = unacknowledged).

## 15 POST /api/demo/reset
Reloads deterministic seed. Resp `data: { "reset": true }`.

## Advanced (add ONLY after MVP gate; extend, never break)
`GET/PATCH /api/guard/mode` `{mode: monitor|protect|strict}`, `GET /api/guard/decisions`, `GET /api/security/posture`, `POST /api/simulator/what-if` (read-only). Define their schemas in contracts.js when built.
