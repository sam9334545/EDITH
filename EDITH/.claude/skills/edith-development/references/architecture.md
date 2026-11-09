# Architecture
Layers share ONE store (apps, events, alerts, recommendations, history, trust history):
L1 Permission Governance (CIEM-inspired) -> L2 Runtime Protection (RASP-inspired, advanced) -> L3 Security Posture (CNAPP-inspired, advanced).
```
React (Vite) --fetch--> Express routes -> controllers -> services -> in-memory store (+ optional data/state.json)
```
Monorepo: `shared/` (contracts) | `backend/` | `frontend/`. Root package.json may use npm workspaces. Backend port 4000, frontend 5173, CORS allows 5173. All monitoring is **SIMULATED** (show a "Simulated environment" badge in UI).

## Store (M1) `backend/store/index.js`
`getState()`, `resetToSeed()`, `nextId(prefix)`, collections: `apps, events, alerts, recommendations, history, trustHistory`, `clock.now()` (ISO; overridable for simulation). Optional persistence: write `data/state.json` on change, load if present, `/api/demo/reset` restores seed.

## Access pipeline - `processAccessRequest(payload)` (M1, `services/accessPipeline.js`)
1 receive -> 2 validate (`validateAccessPayload`; throw VALIDATION_ERROR) -> 3 find app (APP_NOT_FOUND) -> 4 status check -> 5 `checkPermission` -> 6 decide allowed/denied -> 7 create event (M3) -> 8 `analyzeEvent` (M4) -> 9 create/dedupe alerts -> 10 `calculateTrustScore` (writes app.trustScore + trust history) -> 11 `generateRecommendations` -> 12 history entries -> 13 return result.
Step 4/5 order: suspended is checked first (denialReason `app_suspended`), then permission (`permission_disabled`). Allowed events update `permissions[r].lastAccessedAt`.

## Function contracts
| Function | Owner / file | Input | Returns | Errors | Side effects |
|---|---|---|---|---|---|
| `checkPermission(app,resource)` | M2 `permissionService.js` | Application, resource | `{allowed:boolean, reason:'ok'\|'app_suspended'\|'permission_disabled'}` | RESOURCE_INVALID | none (pure) |
| `createEvent({app,resource,reason,timestamp,decision})` | M3 `eventService.js` | see left | AccessEvent | VALIDATION_ERROR | pushes to store.events, history `access_allowed/denied` |
| `analyzeEvent(event,app,recentEvents)` | M4 `anomalyDetection.js` | AccessEvent, Application, AccessEvent[] (same app, incl. current, any status) | `{suspicious:boolean, findings:[{ruleId,alertType,severity,message,relatedEventIds}]}` | none | none (pure) |
| `calculateTrustScore(app,recentEvents,alerts)` | M4 `trustScore.js` | app, events, new alerts | `{previousScore,newScore,level,penalty,explanation:string[]}` | none | none (pure; M1 persists) |
| `generateRecommendations(app,alerts,recentEvents)` | M4 `recommendations.js` | app, alerts, events | `Recommendation[]` (no duplicates for same type+resource+pending) | none | none (pure; M1 persists) |
| `processAccessRequest(payload)` | M1 | `{appId,resource,reason?,timestamp?}` | `{event,alertsCreated,app,trustScore,recommendations}` | VALIDATION_ERROR, APP_NOT_FOUND | all of the above |
Stub rule: if a dependency is missing, stub with the same signature (`// STUB`).
Simulated timestamps: `timestamp` optional input; simulate route supplies `start + i*2000ms`.
