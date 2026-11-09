# Team Workflow
Branches: `main` (final) <- `integration` <- `feature/backend-core|permissions|monitoring|security-engine|frontend`. PRs always target `integration`.

## Commands
```bash
# M1 once
mkdir EDITH && cd EDITH && git init -b main
git add . && git commit -m "chore: scaffold, contracts, seed"
git remote add origin REPOSITORY_URL && git push -u origin main
git checkout -b integration && git push -u origin integration
# everyone
git clone REPOSITORY_URL && cd EDITH
git checkout integration && git pull origin integration
git checkout -b feature/permissions        # your branch
# work, then
git add <your files> && git commit -m "feat(permissions): grant/revoke API"
git push -u origin feature/permissions
gh pr create --base integration --head feature/permissions --title "feat: permissions" --body "Closes milestone M2-1; tested with curl"
# review (M1)
gh pr checkout 12 && npm test; gh pr review 12 --approve; gh pr merge 12 --squash
# stay in sync (every 30-45 min and before each PR)
git fetch origin && git rebase origin/integration     # or: git merge origin/integration
# conflict: edit files, git add <file>, git rebase --continue (or git commit for merge); never force-push shared branches
# final (M1, hour 8)
git checkout main && git merge --no-ff integration && git push origin main && git tag v1.0
```
## Conflict avoidance
One owner per file; touch only owned files; shared/ only via M1; small PRs every ~45 min; pull before starting; route registration only in `routes/index.js` (M1) - feature members export a router (`export default router`).

## Milestones (9 h)
| Time | M1 | M2 | M3 | M4 | M5 |
|---|---|---|---|---|---|
| 0:00-0:30 | repo, contracts, seed, mocks, branches | read contracts | read contracts | read contracts | Vite setup |
| 0:30-2:30 | server, store, envelope, `/health`, pipeline skeleton w/ stubs | apps+permission routes, `checkPermission` | events, simulate, history | rules, score, recs (unit-tested pure funcs) | shell, sidebar, 8 pages on mock JSON |
| 2:30-3:30 | register routes, integration test | PR merged | PR merged | PR merged | `api.js` real calls |
| 3:30-5:00 | wire M4 into pipeline | apply-rec service | filters | alerts/score/recs routes | live dashboard, alerts, score UI |
| 5:00-6:00 | E2E script + gate | fixes | fixes | fixes | Demo control, polish. **FEATURE FREEZE hr 6** |
| 6:00-7:15 | PPT (all; M5 leads design) |
| 7:15-8:00 | 3-min video |
| 8:00-9:00 | final test on clean clone, submit |
Fallback: delayed module -> stub with identical contract; M5 stays on `shared/mockResponses.js` until endpoint ready (`USE_MOCKS` flag in api.js).

## PPT (8-10 slides)
1 Title/team 2 Problem 3 Gap 4 Solution 5 Architecture 6 Seven features 7 Security engine & trust score 8 Runtime Guard & vision (label as roadmap unless built) 9 Demo results + stack 10 Impact & future scope.
## Video (3:00)
0:00 intro/problem; 0:25 registry+permissions; 0:55 monitoring; 1:30 suspicious detection (Demo button); 2:05 trust score+recs; 2:35 revoke+denied; 2:50 close. Demo only working features; mark simulated and future scope.
