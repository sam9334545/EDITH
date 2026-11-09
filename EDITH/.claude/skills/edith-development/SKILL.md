---
name: edith-development
description: Implement, integrate and test the E.D.I.T.H. hackathon project (Enhanced Digital Identity, Trust & Heuristics) - a simulated app-permission monitoring platform with React/Vite frontend and Express backend. Use whenever a developer asks to build, continue, fix, integrate or test any E.D.I.T.H. module (permissions, monitoring, security engine, frontend, Runtime Guard, advanced features), or asks for MVP status.
---

# E.D.I.T.H. Development Skill

Adaptive Application Trust and Runtime Security Platform. Simulated environment: three+ fake apps request resources; the backend decides, logs, scores, alerts, recommends. The frontend NEVER decides access.

## When a developer asks you to implement something: WRITE CODE. Do not produce another plan.

### Mandatory procedure every invocation
1. **Inspect repo**: `git branch --show-current`, `git status`, `ls`, read `shared/contracts.js` and the files you will touch. Never edit before reading.
2. **Identify member + ownership** from branch name (table below). Only edit files you own; for others, export a function / use the documented contract or mock. If a change needs a non-owned file, tell the developer who owns it.
3. **Identify phase** (see Phases) by running the checklist in `references/testing-checklist.md`.
4. **Follow contracts**: field names, enums, envelopes come only from `shared/contracts.js`, `shared/API_CONTRACTS.md`. Never invent JSON shapes. Never rename shared fields. Contract changes need team agreement (`shared/TEAM_DATA_CONTRACT.md`).
5. **Implement functional code**, minimal diffs, no blind rewrites, no new dependencies unless essential.
6. **Run tests**: start backend, curl the endpoints you touched, `npm run build` for frontend, run any unit tests. Show real output.
7. **Report**: files modified, functionality VERIFIED (with evidence), remaining tasks. Never call anything complete that was not run.

## Ownership
| Member | Branch | Owns |
|---|---|---|
| M1 Backend lead/integration | feature/backend-core | backend/server.js, app.js, store/, config/, routes/index.js, middleware, `processAccessRequest` orchestration, merges |
| M2 Apps & permissions | feature/permissions | app routes/controllers, permission routes/controllers, `services/permissionService.js` (`checkPermission`, grant/revoke, suspend/reactivate) |
| M3 Monitoring & history | feature/monitoring | event + history routes/controllers, `services/eventService.js`, `historyService.js` |
| M4 Security engine | feature/security-engine | `services/anomalyDetection.js`, `trustScore.js`, `recommendations.js`, `securityService.js`, security routes/controller |
| M5 Frontend | feature/frontend | everything in `frontend/` (routing, layout, pages, components, hooks, `services/api.js`) |
Shared files (`shared/*`, `seedData.js`): single owner = M1; changes via PR with team sign-off.

If branch is unknown/main/integration: ask which member the developer is, or act as M1.

## Phases (never skip a gate)
0. Setup: monorepo, contracts, seed, mocks, branches.
1. MVP: 7 mandatory features (permissions, monitoring, trust score, suspicious detection, recommendations, access control, history).
2. Integration + E2E demo scenario (`references/testing-checklist.md`).
3. **MVP GATE**: all checklist items pass. Stabilize (Part 16 of the master spec: duplicates, score bounds, state consistency, error handling).
4. Advanced, strictly in order after gate and not after hour 6: Runtime Guard (P1) -> Behavioural DNA -> Adaptive Trust (P1) -> CNAPP-inspired posture (P2) -> Explainability (P2) -> What-if simulator (P2) -> Analytics (P3). Details: `references/advanced-features.md`.

If a developer asks for an advanced feature while the gate fails: say which items fail, fix those first. If they insist, still refuse to skip; offer to fix the gate.

## Core rules
- Pipeline (exact order) in `references/architecture.md`; every access request goes through `processAccessRequest`. Revoked permission => always DENIED in every mode.
- Response envelope always `{success,data,message}` / `{success:false,error:{code,message}}`.
- ISO 8601 timestamps. Deterministic IDs and seed; no `Math.random` in security logic.
- Security functions are pure where possible (input -> output), no hidden state.
- Missing teammate module: write a temporary stub with the identical contract, marked `// STUB: replace with Mx implementation`.
- Honest claims: UI/docs say "simulated monitoring". Runtime Guard is RASP-inspired middleware; posture view is CNAPP-inspired. Never claim OS-level interception, cloud scanning, or ML.
- Deliverables outrank features: feature freeze at hour 6; PPT/video/submission protected.

## References (read as needed)
- `references/problem-statement.md` - official requirements
- `references/architecture.md` - layers, pipeline, function contracts
- `references/api-contracts.md` - endpoint summary (authoritative: `shared/API_CONTRACTS.md`)
- `references/data-schemas.md` - entity summary (authoritative: `shared/contracts.js`)
- `references/security-engine.md` - rules, trust score, recommendations
- `references/team-workflow.md` - git commands, milestones, fallbacks, PPT/video
- `references/advanced-features.md` - gated roadmap
- `references/testing-checklist.md` - MVP gate + E2E demo with expected numbers
