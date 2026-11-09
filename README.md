# E.D.I.T.H. - Enhanced Digital Identity, Trust & Heuristics
Adaptive Application Trust and Runtime Security Platform (hackathon MVP). **All monitoring is simulated**: fake apps request fake resources through our backend; no OS-level interception, cloud scanning or ML is claimed. Layers: permission governance (CIEM-inspired), runtime protection (RASP-inspired, roadmap), security posture (CNAPP-inspired, roadmap).

## Seven mandatory features
Centralized permissions - Access monitoring - Trust score - Suspicious activity detection - Recommendations - Access control (grant/revoke/suspend) - Activity history.

## Run
Requires Node.js 20.12 or newer.

```bash
git clone REPOSITORY_URL && cd EDITH
cd backend && npm install
# PowerShell: Copy-Item .env.example .env
# Set MONGODB_URI in backend/.env before starting
npm start                                   # http://localhost:4000/api/health
cd ../frontend && npm install && npm run dev # http://localhost:5173
```
Backend and frontend are ESM (`"type":"module"`); frontend imports `@shared/contracts.js` via Vite alias.

## MongoDB Atlas
1. In Atlas **Database Access**, create a database user with `readWrite` access to the E.D.I.T.H. database.
2. In **Network Access**, allow only the backend host's IP address.
3. Use **Connect → Drivers** to copy the Node.js connection string, replace its password placeholder with a URL-encoded password, and use the `edith` database name.
4. Put the URI in `backend/.env` as `MONGODB_URI=...` for local development, or configure `MONGODB_URI` as a secret environment variable in the hosting service. Set `NODE_ENV=production` in production.

Never commit `.env` files or put the URI in frontend configuration. Atlas replica sets support the transactions required by this backend. The backend connects and verifies indexes before listening, then inserts missing seed applications without overwriting existing state.

The demo reset endpoint and `cd backend; npm run db:reset` are disabled unless both `NODE_ENV=development` and `ALLOW_DEMO_RESET=true` are set. Reset removes all records in the configured database; use it only with an isolated development database. `cd backend; npm run db:seed` safely inserts missing initial applications.

Backend tests use an ephemeral single-node replica set and never clean up data in Atlas.

## Demo
Open the app -> Simulation panel -> "Run Demo Scenario" (requires the guarded development reset flag; runs the 7-step scenario; expected Fitness score 94 -> 79 -> 71 -> 63).

## Docs
`shared/contracts.js`, `shared/API_CONTRACTS.md`, `shared/TEAM_DATA_CONTRACT.md`, `.claude/skills/edith-development/` (Claude Code skill; invoke it when implementing your branch).

## Team
M1 backend-core - M2 permissions - M3 monitoring - M4 security-engine - M5 frontend. PRs target `integration`.
