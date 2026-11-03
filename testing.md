# PathWise — Testing Tracker
> **Generated:** 2026-11-01 · **Policy:** No task is complete without verification

---

## Testing Policy

> **Rule:** Every implementation task in `implementation_plan.md` must have a corresponding test or manual verification record in this file before the task checkbox is marked `[x]`.

| Test Type | Tool | When to Use |
|-----------|------|-------------|
| Backend unit | Jest + Supertest | All new API endpoints |
| Python unit | Python `unittest` | Any change to algorithm files |
| Frontend component | Vitest + RTL | Any new component (Phase 8+) |
| Manual smoke test | Browser DevTools | UX changes, bug fixes |
| E2E | Playwright | Full user flows (Phase 8) |

---

## Backend Test Suite Status

Location: `backend/tests/`  
Command: `npm test` (from `backend/` directory)

| Test File | Coverage Area | Last Run | Status |
|-----------|--------------|----------|--------|
| `auth.test.js` | `/auth/login`, `/auth/signup`, `/auth/me` | — | ⬜ Not run this session |
| `health.test.js` | `GET /health` | — | ⬜ Not run |
| `logistics.test.js` | `/deliveries`, `/vehicles`, `/demo/seed` | — | ⬜ Not run |
| `optimize.test.js` | `POST /optimize`, `POST /optimize/compare` | — | ⬜ Not run |
| `persistence.test.js` | SQLite run persistence | — | ⬜ Not run |
| `realtime.test.js` | `GET /realtime-data`, Open-Meteo | — | ⬜ Not run |
| `reroute.test.js` | `POST /reroute` | — | ⬜ Not run |
| `reroute_advanced.test.js` | Advanced rerouting scenarios | — | ⬜ Not run |
| `routeGeometry.test.js` | `POST /route-geometry` | — | ⬜ Not run |

---

## Python Algorithm Test Status

Location: `algorithms/`  
Command: `python -m pytest algorithms/` or run each test file directly

| Test File | Coverage Area | Last Run | Status |
|-----------|--------------|----------|--------|
| `algorithms/astar/test_astar.py` | A* pathfinding | — | ⬜ Not run |
| `algorithms/cost_function/test_cost_function.py` | Cost formula | — | ⬜ Not run |
| `algorithms/vrp/test_vrp.py` | VRP solver correctness | — | ⬜ Not run |
| `algorithms/vrp/test_priority.py` | Priority-weighted routing | — | ⬜ Not run |

---

## Frontend Test Status

> **Note:** No frontend test framework is currently installed. Scheduled for Phase 8.

| Framework | Status |
|-----------|--------|
| Vitest | ❌ Not installed |
| @testing-library/react | ❌ Not installed |
| Playwright | ❌ Not installed |

---

## Manual Verification Log

> Record manual tests here when automated tests don't yet exist.

### Template
```
**Date:** YYYY-MM-DD
**Tester:** [name or "self"]
**Feature / Bug:** [description]
**Steps:**
1. ...
2. ...
**Expected:** ...
**Actual:** ...
**Result:** ✅ PASS / ❌ FAIL
**Notes:** ...
```

---

### Session: 2026-11-01 (Initial Audit)

**Date:** 2026-11-01  
**Tester:** Antigravity (static analysis)  
**Feature:** Full codebase audit  
**Steps:** Read all source files, trace import chains, identify issues  
**Result:** ✅ Audit complete — 7 bugs identified (see `bugs.md`)  
**Notes:** No runtime tests executed. Backend and Python tests need to be run as first action next session.

---

## Verification Checklist Per Task

When completing any task from `implementation_plan.md`, verify ALL that apply:

### For Backend Changes
- [ ] `npm test` passes in `backend/` directory
- [ ] No new `console.error` in terminal during test run
- [ ] Manually tested endpoint with curl or API client (Postman / Hoppscotch)
- [ ] Verified auth-protected endpoint rejects requests without token

### For Frontend Changes
- [ ] `pnpm run dev` starts without errors in browser console
- [ ] No TypeScript / prop-type warnings in console
- [ ] Feature works with a logged-in admin account
- [ ] Feature works (or gracefully degrades) with a logged-in rider account
- [ ] Tested at 375px (mobile), 768px (tablet), 1280px (desktop)

### For Bug Fixes
- [ ] Bug is reproducible before the fix
- [ ] Bug is NOT reproducible after the fix
- [ ] No regression on adjacent features
- [ ] Bug marked 🟢 FIXED in `bugs.md`

### For Algorithm Changes
- [ ] All Python unit tests pass
- [ ] Optimization result JSON structure unchanged (or documented change)
- [ ] Backend test `optimize.test.js` still passes

---

## Performance Benchmarks (Target vs Actual)

| Scenario | Target | Actual | Date Measured |
|----------|--------|--------|---------------|
| VRP solve, 10 deliveries | < 5 s | — | — |
| VRP solve, 30 deliveries | < 5 s | — | — |
| VRP solve, 100 deliveries | < 30 s | — | — |
| API `/optimize` end-to-end | < 10 s | — | — |
| API `/dashboard/stats` | < 500 ms | — | — |
| API `/deliveries` (paginated) | < 300 ms | — | — |
| Map render (10 routes) | < 2 s | — | — |

---

## How to Run All Tests

```bash
# 1. Backend tests (from project root)
cd backend
npm test

# 2. Python algorithm tests (from project root)
python -m pytest algorithms/ -v
# or individually:
python -m unittest algorithms.astar.test_astar
python -m unittest algorithms.cost_function.test_cost_function
python -m unittest algorithms.vrp.test_vrp

# 3. Frontend lint check
cd frontend
pnpm run lint

# 4. Frontend build check (ensures no import errors)
pnpm run build
```

