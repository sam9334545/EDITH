# Security engine integration contract

The security modules are independent of store construction. M1 supplies the
central store and its clock when connecting the access pipeline.

## Pipeline call

After M3 creates and persists the access event, M1 should collect events for the
same application (including the current event) and call:

```js
const securityResult = processSecurityEvent(event, app, recentEvents, { store, clock });
```

`processSecurityEvent(event, app, recentEvents, { store, clock })`:

- Runs the pure `analyzeEvent(event, app, recentEvents)`.
- Persists new/deduplicated alerts through `store.getState()` and
  `store.nextId('alt')`.
- Updates the current event's `suspicious` and `alertId` fields when findings
  exist.
- Returns `{ suspicious, findings, alertsCreated, alertsMerged }`.
- `alertsCreated` are the only alerts to pass to trust-score calculation;
  merged alerts must not add another penalty.

Use the existing pipeline order: create event -> analyze/persist alerts ->
calculate trust using only `alertsCreated` -> generate recommendations ->
record history -> return the standardized response. Allowed and denied events
must both take this path.

The current event may already be present in `recentEvents`; detection
deduplicates it by ID and still includes it if absent.

## Router registration

`createSecurityRouter({ Router, store })` returns an Express router mounted at
`/api/security`. M1 can register it in the M1-owned route index as:

```js
import express from 'express';
import securityRouter from '../routes/securityRoutes.js';

router.use('/security', securityRouter({ Router: express.Router, store }));
```

The registered endpoints are `GET /alerts` and
`PATCH /alerts/:id/acknowledge`.

The current shared `ERROR_CODES` does not include `ALERT_NOT_FOUND`. M1 must add
that code to `shared/contracts.js` and document it in
`shared/API_CONTRACTS.md` so the 404 response follows the shared error contract.
