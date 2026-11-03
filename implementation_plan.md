# PathWise — Implementation Plan
> **Generated:** 2026-11-01 · **Methodology:** Vibe Coding (disciplined, incremental, no feature drift)

---

## Rules of Engagement
1. **One checkbox at a time.** Complete, test, and mark before moving to the next.
2. **Reference `audit.md`** before touching any file — know the blast radius.
3. **Update `task_today.md`** every session. Update this file when a task is complete.
4. **Log bugs in `bugs.md`** the moment they are discovered — never fix-in-place silently.
5. **Cross-reference `testing.md`** — no task is complete without a passing test or manual verification step.

---

## Phase 0 — Already Built ✅ (Confirmed by Audit)

### Core Infrastructure
- [x] Express backend with JWT auth, SQLite DB, error handler
- [x] Python VRP engine (OR-Tools CVRP) invoked via stdin/stdout JSON bridge
- [x] AHP 6-factor weight computation (`ahp.py`)
- [x] Multi-factor cost function (`cost_function.py`)
- [x] A* pathfinding detour engine (`astar.py`)
- [x] Open-Meteo real-time weather integration with 10-min cache
- [x] OSRM route geometry service
- [x] Backend test suite (Jest + Supertest): 9 test files

### Auth & Access Control
- [x] JWT login/signup flow
- [x] `authMiddleware` + `adminMiddleware`
- [x] `AuthContext` with localStorage persistence and expiry detection
- [x] `ProtectedRoute` with `requiredRole` prop

### Frontend Pages (all routed in `App.jsx`)
- [x] Landing page
- [x] Login / Signup pages
- [x] Dashboard — KPI stats, zone chart, fleet composition, latest run snapshot
- [x] Route Optimizer — manual input + DB load + optimization trigger
- [x] Results page — map, route cards, allocation table, factor contribution chart
- [x] AHP visualizer page
- [x] Cost Function explorer page
- [x] Dynamic Rerouting — full incident form + result diff + history log
- [x] Deliveries CRUD management
- [x] Fleet management + rider assignment
- [x] Rider Dashboard
- [x] Optimization History list

### API Layer
- [x] All API client functions in `frontend/src/services/api.js`
- [x] Unified `logisticsRequest` helper
- [x] Auth header injection via `getAuthHeaders()`

---

## Phase 1 — Critical Bug Fixes 🔴 (Do First)

> These must be fixed before any new feature development. They affect correctness and stability.

- [ ] **BUG-001** Fix: Add `frontend/dist/` to `.gitignore` — prevent committing stale build artifacts
- [ ] **BUG-002** Fix: Update `backend/src/config/env.js` to auto-detect venv Python path on Windows (`VENV_PATH_1`, `VENV_PATH_2` already prepared in config — wire it up)
- [ ] **BUG-003** Fix: Repair garbled UTF-8 in `Map.jsx` geometryStatus string (`'Loading road geometry…'`)
- [ ] **BUG-004** Fix: Refactor `App.jsx` nested `<Routes>` — move inner protected routes to a proper layout component pattern compatible with React Router v7
- [ ] **BUG-007** Fix: Pass auth token to `rerouteRoute()` in `DynamicRerouting.jsx` using `useAuth()` context

---

## Phase 2 — UX Polish & Global Components 🟡

> Raise the perceived quality bar before the next demo or submission.

### 2.1 Global Error & Loading States
- [ ] Create `components/Toast.jsx` — dismissible toast notification component (success, error, info)
- [ ] Replace all inline `message` state banners in Dashboard, Fleet, Deliveries with Toast
- [ ] Create `components/Skeleton.jsx` — loading skeleton placeholders
- [ ] Apply Skeleton to Dashboard KPI cards while `loading === true`
- [ ] Apply Skeleton to Optimization History list while fetching
- [ ] Create `components/ErrorBoundary.jsx` — React error boundary wrapping main routes
- [ ] Add global 404 page component and route (`<Route path="*">`)

### 2.2 Sidebar Mobile Responsiveness
- [ ] Add hamburger toggle button to `Navbar.jsx` (visible on `< lg` screens)
- [ ] Add slide-in/out animation to `Sidebar.jsx` (controlled by toggle state — use GSAP already installed)
- [ ] Pass sidebar open/close state via context or prop-drilling to Navbar + Sidebar
- [ ] Test collapse/expand at 375px, 768px, 1024px breakpoints

### 2.3 Accessibility Pass
- [ ] Add `aria-label` to all icon-only buttons (Navbar, Sidebar, Results, DynamicRerouting)
- [ ] Ensure all form inputs have associated `<label>` elements (Login, Signup, RouteOptimizer)
- [ ] Add `role="alert"` to error message banners
- [ ] Test tab order on Login and RouteOptimizer forms

---

## Phase 3 — Route Optimizer Enhancements 🟡

### 3.1 Map-Click to Add Delivery
- [ ] Extend `Map.jsx` to accept an optional `onMapClick` callback prop
- [ ] In `RouteOptimizer.jsx`, pass `onMapClick` that appends a new delivery row with the clicked lat/lng
- [ ] Show a crosshair cursor on the map when in "add delivery" mode
- [ ] Add a toggle button "Click map to place delivery" that enables/disables map-click mode

### 3.2 Export Results
- [ ] Add "Export CSV" button to `Results.jsx` — generates a CSV of vehicle routes, stops, load, cost
- [ ] Add "Copy JSON" button to Results page — copies raw result JSON to clipboard
- [ ] (Optional) Add "Print / Save PDF" using browser `window.print()` with a print stylesheet

---

## Phase 4 — Analytics & Reporting 🟢

### 4.1 Analytics Dashboard
- [ ] Create `pages/Analytics.jsx` — aggregate KPI trends over time
- [ ] Add route `/analytics` to `App.jsx` (protected, admin)
- [ ] Add Analytics link to `Sidebar.jsx`
- [ ] Implement chart: "Total Cost per Optimization Run" (line chart using CSS/SVG — no new lib)
- [ ] Implement chart: "Deliveries Served Rate per Run" (line chart)
- [ ] Implement chart: "Fleet Utilization per Run" (grouped bar chart)
- [ ] Backend: add `GET /analytics/summary` endpoint returning aggregated run statistics
- [ ] Wire frontend to new endpoint

### 4.2 Run Comparison View
- [ ] In `OptimizationHistory.jsx`, add multi-select checkboxes for runs
- [ ] Add "Compare Selected" button — navigates to a comparison view
- [ ] Create `pages/RunComparison.jsx` — side-by-side stat cards for 2-3 selected runs
- [ ] Add route `/compare` to `App.jsx`

---

## Phase 5 — Real-Time & Notifications 🟢

### 5.1 Notification Bell (Admin)
- [ ] Create `components/NotificationBell.jsx` — icon with badge count in Navbar
- [ ] Track notification state in context: new deliveries added, optimization completed
- [ ] Dropdown panel showing last 5 notifications
- [ ] Mark-as-read on click

### 5.2 Rider Live Update Polling
- [ ] In `RiderDashboard.jsx`, add auto-refresh polling every 30 seconds using `setInterval` in `useEffect`
- [ ] Add "Last updated at HH:MM" timestamp to RiderDashboard header
- [ ] Add manual "Refresh" button

---

## Phase 6 — Configuration & Settings Page 🟢

- [ ] Create `pages/Settings.jsx`
- [ ] Add route `/settings` (admin only)
- [ ] Add Settings link to Sidebar
- [ ] Section: **AHP Weight Override** — sliders for 6 factors, POST updated weights to backend
- [ ] Backend: add `POST /ahp/weights` endpoint to accept custom override weights
- [ ] Section: **Depot Location** — lat/lng inputs that update the default depot in config
- [ ] Section: **Solver Parameters** — time limit slider, solver strategy dropdown
- [ ] Section: **User Management** — table of users (admin can see email, role); promote rider→admin button

---

## Phase 7 — Production Hardening 🟢

- [ ] Add `express-rate-limit` to backend: 10 req/min on `/auth/login`, 5 req/min on `/optimize`
- [ ] Add `.env.example` file with all required variables documented
- [ ] Add startup validation: check required env vars exist before server binds port
- [ ] Replace `console.log` in backend with `winston` logger (structured JSON output)
- [ ] Split `backend/src/routes/api.js` into domain route files (`auth.routes.js`, `logistics.routes.js`, etc.)
- [ ] Add `helmet` middleware to Express for security headers
- [ ] Create `docker-compose.yml` for local dev (node service + python venv volume)
- [ ] Create `Dockerfile` for the backend

---

## Phase 8 — Testing Coverage 🟢

- [ ] Add `vitest` + `@testing-library/react` to frontend dev dependencies
- [ ] Write unit tests for `AuthContext` (login, logout, expiry)
- [ ] Write unit tests for `api.js` (mock fetch, verify error handling)
- [ ] Write component test for `ProtectedRoute` (redirects when no token)
- [ ] Write component test for `Map.jsx` (renders with valid/invalid deliveries)
- [ ] Set up Playwright for E2E testing
- [ ] Write E2E: login flow → optimize route → view results
- [ ] Write E2E: rider login → update delivery status
- [ ] Create `GitHub Actions` CI workflow: lint + backend Jest + Python pytest on push

---

## Progress Summary

| Phase | Status | Completion |
|-------|--------|------------|
| 0 — Core Build | ✅ Done | 100% |
| 1 — Critical Bugs | 🔴 Not Started | 0% |
| 2 — UX Polish | 🟡 Not Started | 0% |
| 3 — Optimizer Enhancements | 🟡 Not Started | 0% |
| 4 — Analytics | 🟢 Not Started | 0% |
| 5 — Real-Time & Notifications | 🟢 Not Started | 0% |
| 6 — Settings Page | 🟢 Not Started | 0% |
| 7 — Production Hardening | 🟢 Not Started | 0% |
| 8 — Testing Coverage | 🟢 Not Started | 0% |

**Overall: ~50% complete** (Phase 0 done, Phases 1-8 pending)

