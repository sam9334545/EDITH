# Data Schemas (summary)
Authoritative: `shared/contracts.js` (enums/config/validators) and `shared/TEAM_DATA_CONTRACT.md` (field tables + JSON examples).
Entities: Application, Permission (`{enabled,grantedAt,lastAccessedAt}`), AccessEvent, SecurityAlert, Recommendation, ActivityHistory, TrustScoreHistory. Timestamps ISO 8601. IDs `prefix_0001`. Additive optional fields only; never rename.
