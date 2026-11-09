# E.D.I.T.H. - Enhanced Digital Identity, Trust & Heuristics
Adaptive Application Trust and Runtime Security Platform (hackathon MVP). **All monitoring is simulated**: fake apps request fake resources through our backend; no OS-level interception, cloud scanning or ML is claimed. Layers: permission governance (CIEM-inspired), runtime protection (RASP-inspired, roadmap), security posture (CNAPP-inspired, roadmap).

## Seven mandatory features
Centralized permissions - Access monitoring - Trust score - Suspicious activity detection - Recommendations - Access control (grant/revoke/suspend) - Activity history.

## Run
```bash
git clone REPOSITORY_URL && cd EDITH
cd backend && npm install && npm start      # http://localhost:4000/api/health
cd ../frontend && npm install && npm run dev # http://localhost:5173
```
Backend and frontend are ESM (`"type":"module"`); frontend imports `@shared/contracts.js` via Vite alias.

## Demo
Open the app -> Simulation panel -> "Run Demo Scenario" (resets seed, runs the 7-step scenario; expected Fitness score 94 -> 79 -> 71 -> 63).

## Docs
`shared/contracts.js`, `shared/API_CONTRACTS.md`, `shared/TEAM_DATA_CONTRACT.md`, `.claude/skills/edith-development/` (Claude Code skill; invoke it when implementing your branch).

## Team
M1 backend-core - M2 permissions - M3 monitoring - M4 security-engine - M5 frontend. PRs target `integration`.
