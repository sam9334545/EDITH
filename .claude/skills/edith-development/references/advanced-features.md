# Advanced Features (GATED: only after MVP checklist passes and before hour 6; else document as future scope)
Order: P1 Runtime Guard -> P1 Behavioural DNA -> P1 Adaptive Trust -> P2 CNAPP-inspired posture -> P2 Explainable intelligence -> P2 What-if simulator -> P3 Analytics. Reuse existing pipeline/store; no duplicate systems; extend contracts additively; update API_CONTRACTS.md, mockResponses.js, tests; keep MVP backward compatible.

## 1 Runtime Guard (RASP-inspired middleware, simulated)
Insert a guard step in `processAccessRequest` (before step 6): validate app -> status -> permission -> behavioural inspection -> policy evaluation -> decision ALLOW|BLOCK -> log -> alerts/score.
Modes (`monitor|protect|strict`, switchable via API/UI): Monitor logs/alerts, blocks only mandatory permission denials; Protect also blocks per runtime policies (e.g. LOCATION_RATE_LIMIT); Strict also blocks suspended apps and any high-severity policy violation. A revoked permission is ALWAYS denied.
Decision: `{decisionId, appId, eventId, decision, reason, policyTriggered, enforcementMode, severity, timestamp}`. Do not claim system-call monitoring.
Acceptance: every request passes guard; unauthorized + suspended blocked; behavioural policies in Protect/Strict; every decision logged and explainable.
## 2 Behavioural DNA: per-app/resource baseline `{appId,resource,averageAccessFrequency,expectedUsagePattern,baselineWindow,updatedAt}` from historical events (deterministic stats; not ML); deviation detection + explanation feeds guard and trust.
## 3 Adaptive Trust: extends score with permission profile, deviations, blocks, repeated violations, configurable recovery; each change records previous/new score, triggering event, penalty/adjustment, reason.
## 4 CNAPP-inspired posture: excessive/unused/risky-combo permission intelligence, config posture, workload behaviour from existing data, risk prioritization (trust, exposure, anomalies, critical alerts, violations; no double counting), dashboard with filters. Not cloud scanning.
## 5 Explainable intelligence: incident detail answering what/app/resource/expected/observed/rule/decision/score impact/user action (deterministic templates).
## 6 What-if simulator: read-only computation on a deep copy of state; never mutates real state.
## 7 Analytics: trust history charts, resource distribution, timelines, block stats, export report - reuse existing APIs.
