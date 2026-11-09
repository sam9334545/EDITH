# Security Engine (deterministic, explainable)
Config constants live in `shared/contracts.js` (`TRUST_CONFIG`). Window = events of same app within window ending at the current event's timestamp. Denied events count toward frequency.

| Rule | Condition | Threshold | Severity | Alert type | Penalty | Recommendation |
|---|---|---|---|---|---|---|
| R1 Excessive access | > N requests for same resource (location default; applies to any resource in MVP using same N) in 60 s | >10 / 60 s | high | excessive_access | -15 | restrict_permission (revoke_permission on that resource) |
| R2 Unauthorized resource | request while permission disabled | any | medium | unauthorized_resource | -8 | keep_disabled (suggestedAction none) |
| R3 Suspended app | request while app suspended | any | medium | suspended_app_access | -8 | review (type review_permission, none) |
| R4 Repeated restricted | >=3 denied (permission_disabled) attempts, any resources, in 5 min | 3 | high | repeated_restricted_access | -15 | suspend_app |
| R5 Unusual combination | >=3 distinct SENSITIVE resources requested within 30 s | 3 | high | unusual_resource_combination | -15 | suspend_app |

## Dedupe
Key = `appId|alertType|resource`. If an alert with same key exists with timestamp within 300 s of current event: append event id to its `relatedEventIds`, **no new alert, no new penalty**. Event gets `alertId` of that alert and `suspicious:true`. R4/R5 key uses resource `*`.

## Trust score
- Initial score from seed. Incremental: `newScore = clamp(previous - sum(PENALTY[severity] of NEW alerts), 0, 100)`.
- No recovery in MVP (`RECOVERY_ON_CORRECTIVE_ACTION: 0`); advanced Adaptive Trust adds configurable recovery.
- Per-event penalty only on new alerts (duplicate prevention). Each change writes a TrustScoreHistory row with `changeReason` like `"HIGH alert excessive_access: -15"`.
- Levels: 80-100 high, 60-79 moderate, 40-59 low, 0-39 critical (prototype-defined, not a certification).
- `explanation[]` = list of strings, one per penalty ("-15: excessive_access (alt_0001)") + "Score N = M - ...".

## Recommendations
One per (appId, type, resource) while pending; always carry `alertId`. Applying: `revoke_permission` -> M2 revokes `resource`; `suspend_app` -> suspend. After apply status `applied`.

## Examples (Fitness App starts at 94)
25 location requests in 48 s -> alert at request #11 (high, -15) -> 79; requests 12-25 append to alert (no change).
Contacts attempt (disabled) -> medium -8 -> 71. Third permission_disabled denial within 5 min would fire R4 (-15). The demo has only 2 denials, so R4 stays silent (final 63; see testing-checklist.md).
