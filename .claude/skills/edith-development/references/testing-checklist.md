# MVP Completion Gate (all must pass before advanced work)
Run: `cd backend && npm start`; `curl localhost:4000/api/...`; `cd frontend && npm run build`.
- [ ] GET /api/apps returns >=3 apps
- [ ] Permissions display correctly (UI matches API)
- [ ] PATCH permissions enabled:true works
- [ ] PATCH permissions enabled:false works
- [ ] PATCH status suspended/active works
- [ ] Suspended app request -> status denied, denialReason app_suspended
- [ ] Allowed request recorded in /api/events
- [ ] Denied request recorded in /api/events
- [ ] 11th location request in 60 s creates excessive_access alert
- [ ] Disabled-permission request creates unauthorized_resource alert
- [ ] GET /api/security/alerts lists them
- [ ] Trust score changes match penalties; GET /api/security/score has explanation
- [ ] Scores always within 0-100 (test with repeated alerts)
- [ ] Recommendations generated, each has alertId
- [ ] POST /recommendations/:id/apply works (revoke/suspend)
- [ ] /api/history shows events, alerts, permission changes
- [ ] Frontend loads real data (no mocks), all buttons functional
- [ ] No duplicate events/alerts on repeat clicks of Simulate
- [ ] Fresh clone: `npm install` + start instructions in README work
- [ ] E2E demo below passes

## E2E demo (after POST /api/demo/reset; Fitness = app_01, score 94)
Simulated clock: the Demo button passes explicit `startTime` values: T, T+120s, T+240s, T+300s (T = demo start) so 60 s / 300 s windows are deterministic. Events within a call are 2 s apart.
| Step | Action | Expected |
|---|---|---|
| 1 | location x3 at T | 3 allowed, no alert, score 94 |
| 2 | location x25 at T+120s | 25 allowed; ONE excessive_access alert (high) fired at 11th event; requests 12-25 appended to it; score 79 (moderate); rec "Restrict location" |
| 3 | contacts x1 at T+240s | denied (permission_disabled); unauthorized_resource alert (medium); score 71 (moderate); rec "Keep contacts disabled" |
| 4 | UI shows score explanation | "-15 excessive_access", "-8 unauthorized_resource" |
| 5 | apply rec "Restrict location" | location.enabled=false; history permission_revoked + recommendation_applied |
| 6 | location x1 at T+300s | denied (permission_disabled), event recorded; new alert unauthorized_resource (resource location, medium); score 63 (moderate). R4 does NOT fire (only 2 denials in 5 min) |
| 7 | GET /api/history | access_allowed/denied events, alert_created x3, recommendation_applied, permission_revoked, trust_score_changed x3 |
Final: Fitness score **63**, 3 alerts, all scores within 0-100. If implemented algorithms give different numbers, fix code or contracts - never fudge the demo.
