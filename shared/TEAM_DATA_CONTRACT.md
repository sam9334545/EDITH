# Team Data Contract
**NO MEMBER MAY INVENT THEIR OWN JSON STRUCTURE, RENAME SHARED FIELDS, OR CHANGE AN API RESPONSE FORMAT WITHOUT TEAM AGREEMENT.**

## Authoritative files (single owner: M1)
`shared/contracts.js` (enums, config, validators, envelopes) > `shared/API_CONTRACTS.md` > this file > `backend/data/seedData.js` > `shared/mockResponses.js`. If they conflict, contracts.js wins; fix the others.

## Importing (no duplicated definitions)
Root `package.json` uses plain ESM (`"type":"module"` in backend and frontend).
- Backend: `import { RESOURCE_TYPES, ok, fail } from '../../shared/contracts.js'`
- Frontend: Vite alias in `vite.config.js`: `resolve:{alias:{'@shared':path.resolve(__dirname,'../shared')}}` and `server.fs.allow:['..']`; then `import { ALERT_SEVERITY } from '@shared/contracts.js'`.

## Entities (all timestamps ISO 8601 UTC, ids strings)
**Permission** (object everywhere): `{ enabled:boolean (req), grantedAt:ISO|null, lastAccessedAt:ISO|null }`. Application.permissions has exactly one key per RESOURCE_TYPES.

**Application**: `id` (req, `app_01`), `name` (req), `description` (req), `permissions` (req), `trustScore` (req, int 0-100), `status` (req, active|suspended), `createdAt`, `updatedAt` (req). Additive posture fields: `category`, `expectedPermissions` (resource list), `isDemo`, and `demoId`. Derived on read: `trustLevel`.
```json
{"id":"app_01","name":"FitTrack","description":"Fitness tracking app","permissions":{"location":{"enabled":true,"grantedAt":"2026-11-01T09:00:00.000Z","lastAccessedAt":null},"contacts":{"enabled":false,"grantedAt":null,"lastAccessedAt":null},"camera":{"enabled":false,"grantedAt":null,"lastAccessedAt":null},"microphone":{"enabled":false,"grantedAt":null,"lastAccessedAt":null},"files":{"enabled":true,"grantedAt":"2026-11-01T09:00:00.000Z","lastAccessedAt":null}},"trustScore":94,"trustLevel":"high","status":"active","createdAt":"2026-11-01T09:00:00.000Z","updatedAt":"2026-11-01T09:00:00.000Z"}
```
**AccessEvent**: `id`, `appId`, `resource`(RESOURCE_TYPES), `reason`(string), `timestamp`, `status`(allowed|denied), `suspicious`(bool), `alertId`(string|null), optional `denialReason` (`permission_disabled|app_suspended`).
```json
{"id":"evt_0001","appId":"app_01","resource":"location","reason":"Workout route tracking","timestamp":"2026-11-08T08:00:00.000Z","status":"allowed","suspicious":false,"alertId":null}
```
**SecurityAlert**: `id`,`appId`,`type`(ALERT_TYPES),`severity`,`message`,`timestamp`,`relatedEventIds`(string[], appended on dedupe),`recommendationId`(string|null),`acknowledged`(bool).
```json
{"id":"alt_0001","appId":"app_01","type":"excessive_access","severity":"high","message":"FitTrack made 11 location requests in 60s (limit 10)","timestamp":"2026-11-09T10:00:22.000Z","relatedEventIds":["evt_0010"],"recommendationId":"rec_0001","acknowledged":false}
```
**Recommendation**: `id`,`appId`,`type`(RECOMMENDATION_TYPES),`title`,`description`,`suggestedAction`(SUGGESTED_ACTIONS),`status`(RECOMMENDATION_STATUS),`createdAt`; optional `resource`, `alertId` (traceability: always set when alert-driven).
```json
{"id":"rec_0001","appId":"app_01","type":"restrict_permission","title":"Restrict location access","description":"Excessive location requests detected.","suggestedAction":"revoke_permission","resource":"location","alertId":"alt_0001","status":"pending","createdAt":"2026-11-09T10:00:22.000Z"}
```
**ActivityHistory**: `id`,`appId`,`eventType`(ACTIVITY_EVENT_TYPES),`description`,`timestamp`,`metadata`(object, free-form but include `resource`/`alertId`/`eventId` when relevant).
```json
{"id":"act_0001","appId":"app_01","eventType":"permission_revoked","description":"location permission revoked","timestamp":"2026-11-09T10:05:00.000Z","metadata":{"resource":"location"}}
```
**TrustScoreHistory**: `id`,`appId`,`previousScore`,`newScore`,`changeReason`,`timestamp`; optional `alertId`, `penalty`.
```json
{"id":"ts_0001","appId":"app_01","previousScore":94,"newScore":79,"changeReason":"HIGH alert excessive_access: -15","timestamp":"2026-11-09T10:00:22.000Z","alertId":"alt_0001","penalty":15}
```
ID format: `<prefix>_<zero-padded counter>` (`evt_`,`alt_`,`rec_`,`act_`,`ts_`); app ids `app_01..`. Counters owned by M1 store (`store.nextId(prefix)`).

**SecurityFinding**: `id`, `appId`, `findingKey`, `findingType`, `title`, `severity`, `reason`, `permissionResources`, `relatedEventIds`, `alertIds`, `ruleId`, `recommendedAction`, `status` (`open|acknowledged|resolved`), `detectedAt`, `lastObservedAt`, and `history`. Findings reference existing application, event, and alert records; repeated references to one event must not create repeated risk penalties.

**SecurityPolicy**: `ruleId`, `name`, `description`, `condition`, `severity`, `threshold`, `enabled`, and `recommendedAction`. Policies are configurable in the posture API. Demo policies are marked separately from user-created records.

All demo applications and generated records use an explicit `isDemo` marker. The demo reset must only remove records carrying that marker; never infer demo ownership from an ID or delete unmarked data.

## Adding fields safely
Only additive + optional. Post in team chat, M1 updates contracts.js/API_CONTRACTS.md/mockResponses/seed in one PR, everyone rebases. Never rename/remove/change type.

## Do not modify independently
Enums in contracts.js, response envelope, permission object shape, ID formats, trust config constants, endpoint paths.
