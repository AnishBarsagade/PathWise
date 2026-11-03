# PathWise — Codebase Audit
> **Generated:** 2026-11-01 · **Auditor:** Lead Systems Engineer (Antigravity)

---

## 1. Complete File Tree

```
PathWise/
├── prd.md                              ← [NEW] Product Requirements Document
├── audit.md                            ← [NEW] This file
├── implementation_plan.md              ← [NEW] Roadmap tracker
├── task_today.md                       ← [NEW] Daily task tracker
├── bugs.md                             ← [NEW] Bug tracker
├── testing.md                          ← [NEW] Test tracker
├── README.md
│
├── algorithms/                         ← Python algorithm engine
│   ├── __init__.py
│   ├── ahp/
│   │   ├── __init__.py
│   │   └── ahp.py                      ← AHP 6-factor matrix & weight computation
│   ├── astar/
│   │   ├── astar.py                    ← A* pathfinding for detour calculation
│   │   └── test_astar.py
│   ├── cost_function/
│   │   ├── __init__.py
│   │   ├── cost_function.py            ← Composite multi-factor cost formula
│   │   └── test_cost_function.py
│   └── vrp/
│       ├── __init__.py
│       ├── vrp_solver.py               ← Google OR-Tools CVRP solver (main engine)
│       ├── test_vrp.py
│       └── test_priority.py
│
├── backend/
│   ├── package.json                    ← Node.js backend deps (Express, SQLite, JWT, bcrypt)
│   ├── .env                            ← (not tracked) — PORT, JWT_SECRET, PYTHON_PATH, etc.
│   └── src/
│       ├── server.js                   ← Express app entry point
│       ├── config/
│       │   └── env.js                  ← Config loader (dotenv, paths)
│       ├── controllers/
│       │   ├── astarController.js      ← POST /astar/detour
│       │   ├── authController.js       ← POST /auth/login, /auth/signup, GET /auth/me
│       │   ├── healthController.js     ← GET /health
│       │   ├── historyController.js    ← GET /optimization/history, /:id, /rerouting/history
│       │   ├── logisticsController.js  ← CRUD /deliveries, /vehicles, /dashboard/stats, /demo/seed
│       │   ├── optimizationController.js ← POST /optimize, /optimize/compare, GET /ahp/weights
│       │   ├── realtimeController.js   ← GET /realtime-data
│       │   ├── reroutingController.js  ← POST /reroute
│       │   ├── riderController.js      ← GET/POST/DELETE /rider/assignments, PATCH /deliveries/:id/status
│       │   └── routeGeometryController.js ← POST /route-geometry
│       ├── data/
│       │   └── (SQLite DB init handled by dbService.js)
│       ├── middleware/
│       │   ├── adminMiddleware.js      ← Role-based guard (requires admin)
│       │   ├── authMiddleware.js       ← JWT verify + optionalAuthMiddleware
│       │   ├── errorHandler.js         ← Centralized error response formatter
│       │   └── validateOptimizationInput.js ← Input sanitizer for /optimize
│       ├── routes/
│       │   └── api.js                  ← Single route file — all endpoints mounted here
│       └── services/
│           ├── astarService.js         ← A* detour calculation service
│           ├── dbService.js            ← SQLite connection + schema init + helpers
│           ├── pythonOptimizerService.js ← spawn() Python VRP, stdin/stdout JSON bridge
│           ├── realtimeService.js      ← Open-Meteo weather fetch + 10-min cache
│           └── routeGeometryService.js ← OSRM road geometry fetch
│   └── tests/
│       ├── auth.test.js
│       ├── health.test.js
│       ├── logistics.test.js
│       ├── optimize.test.js
│       ├── persistence.test.js
│       ├── realtime.test.js
│       ├── reroute.test.js
│       ├── reroute_advanced.test.js
│       └── routeGeometry.test.js
│
├── data/
│   ├── deliveries.csv                  ← Default delivery dataset (Nagpur zones)
│   ├── vehicles.csv                    ← Default vehicle fleet dataset
│   └── pathwise.db                     ← SQLite database (auto-created)
│
├── docs/
│   ├── PathWise_Feature_Report.html    ← Feature report (HTML)
│   ├── PROJECT_REPORT.md
│   └── VIVA_PRESENTATION_GUIDE.md
│
└── frontend/
    ├── package.json                    ← React 19 + Vite 8 + Tailwind v4 + Leaflet
    ├── vite.config.js                  ← Vite config (proxy /api → localhost:3000)
    ├── eslint.config.js
    ├── index.html
    ├── README.md
    ├── dist/                           ← Production build output (committed)
    │   ├── index.html
    │   └── assets/
    │       ├── index-D-vsPx5y.css
    │       └── index-Dyt6w1nr.js
    └── src/
        ├── App.jsx                     ← Root router: public + nested protected layout
        ├── App.css
        ├── main.jsx
        ├── index.css
        ├── components/
        │   ├── Map.jsx                 ← Leaflet map with OSRM route geometry
        │   ├── Navbar.jsx              ← Top navigation bar
        │   ├── ProtectedRoute.jsx      ← Route guard (role-aware)
        │   └── Sidebar.jsx             ← Left nav sidebar
        ├── context/
        │   └── AuthContext.jsx         ← JWT auth context, localStorage persistence
        ├── pages/
        │   ├── Landing.jsx             ← Public landing/hero page
        │   ├── Login.jsx               ← Login form
        │   ├── Signup.jsx              ← Signup form
        │   ├── Dashboard.jsx           ← KPI analytics + latest run snapshot
        │   ├── RouteOptimizer.jsx      ← VRP optimizer form + live map
        │   ├── Results.jsx             ← Optimization output with map + charts
        │   ├── AHP.jsx                 ← AHP weight visualizer
        │   ├── CostFunction.jsx        ← Multi-factor cost formula explorer
        │   ├── DynamicRerouting.jsx    ← Incident configuration + rerouting engine
        │   ├── Deliveries.jsx          ← Delivery CRUD management
        │   ├── Fleet.jsx               ← Vehicle CRUD + rider assignment
        │   ├── OptimizationHistory.jsx ← Historical run list
        │   └── RiderDashboard.jsx      ← Rider-specific delivery status view
        └── services/
            └── api.js                  ← Unified API client (all fetch functions)
```

---

## 2. Import / Path Audit

### 2.1 Frontend Imports

| File | Import | Status |
|------|--------|--------|
| `App.jsx` | All page components | ✅ All resolve correctly |
| `Results.jsx` | `../components/Map` | ✅ OK |
| `RouteOptimizer.jsx` | `../components/Map`, `../services/api` | ✅ OK |
| `Dashboard.jsx` | `../services/api`, `../context/AuthContext` | ✅ OK |
| `DynamicRerouting.jsx` | `../services/api`, `react-router-dom` | ✅ OK |
| `Map.jsx` | `leaflet/dist/leaflet.css`, `react-leaflet` | ✅ OK |
| All pages | `../services/api` | ✅ All named exports exist |

### 2.2 Backend Imports

| File | Import | Status |
|------|--------|--------|
| `routes/api.js` | All controllers | ✅ All resolve |
| `routes/api.js` | `../middleware/authMiddleware` (both `default` + `{ optionalAuthMiddleware }`) | ✅ OK |
| `pythonOptimizerService.js` | `../config/env` | ✅ OK |
| `dbService.js` | `better-sqlite3`, `bcrypt`, `path`, `fs` | ✅ OK |
| `realtimeService.js` | No external deps (uses native `fetch`) | ✅ OK |
| `routeGeometryService.js` | Likely fetches OSRM API | ⚠️ Needs sandbox-safe fallback verification |

### 2.3 Python Algorithm Imports

| File | Import | Status |
|------|--------|--------|
| `vrp_solver.py` | `ortools`, `pandas`, local `cost_function` | ✅ Triple-fallback import chain OK |
| `cost_function.py` | Standard libs | ✅ OK |
| `ahp.py` | Standard libs / numpy | ✅ OK |
| `astar.py` | Standard libs | ✅ OK |

---

## 3. Issues & Observations Found During Audit

### 🔴 HIGH PRIORITY

| ID | File | Issue | Impact |
|----|------|-------|--------|
| BUG-001 | `frontend/dist/` | Built output committed to repo — stale hash filenames (`index-D-vsPx5y.css`, `index-Dyt6w1nr.js`) | CI confusion; should be in `.gitignore` |
| BUG-002 | `backend/src/config/env.js` | `PYTHON_PATH` defaults to `'python'` — on Windows this is often `python3` or a venv path | Python spawn failure on clean installs |
| BUG-003 | `Map.jsx` | Garbled UTF-8 character in geometryStatus string (`'Loading road geometry???'`) — likely encoding issue during file save | Cosmetic but visible to users |

### 🟡 MEDIUM PRIORITY

| ID | File | Issue | Impact |
|----|------|-------|--------|
| BUG-004 | `App.jsx` | Nested `<Routes>` inside the catch-all `path="*"` route — React Router v7 doesn't support this pattern cleanly; may cause mismatched route renders | Routing edge cases |
| BUG-005 | `api.js` (frontend) | `getOptimizationHistory` and other history calls don't send auth headers — backend currently has no auth guard on `/optimization/history` but should be consistent | Inconsistent auth posture |
| BUG-006 | `backend/src/services/realtimeService.js` | Traffic data is a hardcoded demo fallback (`DEMO_TRAFFIC`) with no real integration | Accuracy; user trust if not disclosed |
| BUG-007 | `DynamicRerouting.jsx` | No auth token passed to `rerouteRoute()` call even though `optionalAuthMiddleware` is set server-side | Missed auth context propagation |

### 🟢 LOW PRIORITY / CODE QUALITY

| ID | File | Issue |
|----|------|-------|
| OBS-001 | `frontend/src/services/api.js` | `loginUser` is an alias for `loginAdmin` — naming is confusing for riders vs admins |
| OBS-002 | `RouteOptimizer.jsx` | Default vehicles/deliveries are hardcoded with Nagpur Central coords — should load from DB by default |
| OBS-003 | `backend/src/routes/api.js` | Single monolithic route file — should be split into domain-specific route modules as project grows |
| OBS-004 | All backend controllers | No rate limiting on `/auth/login` or `/api/optimize` — susceptible to brute-force and resource exhaustion |
| OBS-005 | `backend/src/config/env.js` | `JWT_SECRET` fallback is a hardcoded string `'pathwise-dev-secret-key-2026'` — critical to never use in production |
| OBS-006 | `frontend/dist/` | `dist/` should be added to `.gitignore` |

---

## 4. Dependency Health

### Frontend
```
react@19.2.8             ✅ Latest stable
react-router-dom@7.18.3  ✅ Latest stable
tailwindcss@4.3.3        ✅ Latest stable (v4 — breaking changes vs v3, already adopted)
leaflet@1.9.4            ✅ Stable
react-leaflet@5.0.0      ✅ Stable (v5 for React 19)
gsap@3.15.0              ✅ Latest stable
vite@8.2.2               ✅ Latest stable
```

### Backend
```
express@4.21.2           ✅ Stable (v4 LTS)
better-sqlite3@13.0.3    ✅ Latest stable
jsonwebtoken@9.0.3       ✅ Stable
bcrypt@6.0.0             ✅ Latest stable
dotenv@16.4.7            ✅ Latest stable
jest@29.7.0              ✅ Stable LTS
nodemon@3.1.9            ✅ Stable
```

### Python
```
ortools                  ✅ Required (version tied to Python 3.11)
pandas                   ✅ Required
numpy                    ✅ Required (implicit via pandas/ortools)
```

---

## 5. Architecture Diagram

```
Browser (React 19 / Vite)
    │
    │  HTTP /api/*
    ▼
Express Backend (Node.js, port 3000)
    ├── Auth middleware (JWT)
    ├── Admin middleware (role check)
    │
    ├── /optimize → pythonOptimizerService
    │       └── spawn() → vrp_solver.py (OR-Tools + AHP + CostFunction)
    │
    ├── /reroute → reroutingController
    ├── /realtime-data → realtimeService → Open-Meteo API
    ├── /route-geometry → routeGeometryService → OSRM API
    ├── /deliveries, /vehicles → logisticsController → SQLite
    ├── /rider/assignments → riderController → SQLite
    ├── /auth/* → authController → SQLite (users)
    └── /optimization/history → historyController → SQLite
```

---

## 6. File Encoding / Misc Notes

- All frontend files use CRLF (`\r\n`) line endings — consistent with Windows dev environment
- Python files also use CRLF — acceptable but watch for shell scripts
- `dist/` is committed — add to `.gitignore` before next deployment
- No `.env.example` file found — recommend creating one for onboarding

