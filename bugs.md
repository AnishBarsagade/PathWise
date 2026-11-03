# PathWise — Bug Tracker
> **Format:** Log bugs as they are discovered. Never fix silently — always log first.

---

## Bug Status Legend
| Symbol | Meaning |
|--------|---------|
| 🔴 OPEN | Identified, not yet fixed |
| 🟡 IN PROGRESS | Being worked on |
| 🟢 FIXED | Verified fix in place |
| ⚫ WONTFIX | Accepted risk / deferred |

---

## Active Bugs

### BUG-001 — Stale `dist/` committed to repo
| Field | Value |
|-------|-------|
| **Status** | 🔴 OPEN |
| **Severity** | Medium |
| **File** | `frontend/dist/` (entire folder) |
| **Discovered** | 2026-11-01 (audit) |
| **Description** | The production build output (`dist/`) is committed to the git repository with stale asset hash names (`index-D-vsPx5y.css`, `index-Dyt6w1nr.js`). This will cause confusion in CI and may serve outdated code. |
| **Fix** | Add `dist/` to `.gitignore`; remove from tracking via `git rm -r --cached frontend/dist/` |
| **Fixed By** | — |
| **Fixed On** | — |

---

### BUG-002 — Python path fallback uses `'python'` (fails on Windows venv setups)
| Field | Value |
|-------|-------|
| **Status** | 🔴 OPEN |
| **Severity** | High |
| **File** | `backend/src/config/env.js` (line: `PYTHON_PATH: process.env.PYTHON_PATH \|\| 'python'`) |
| **Discovered** | 2026-11-01 (audit) |
| **Description** | On Windows, `python` is often not in PATH or points to the wrong installation. The config file already has `VENV_PATH_1` and `VENV_PATH_2` constants prepared (pointing to `.venv/Scripts/python.exe`) but they are not wired into the `PYTHON_PATH` fallback chain. Results in `Python execution failure` error on the `/optimize` endpoint for users without `PYTHON_PATH` set in `.env`. |
| **Fix** | Update `env.js` to: check `VENV_PATH_1`, then `VENV_PATH_2`, then fallback to `'python'` using `fs.existsSync()` |
| **Fixed By** | — |
| **Fixed On** | — |

---

### BUG-003 — Garbled UTF-8 character in `Map.jsx` status string
| Field | Value |
|-------|-------|
| **Status** | 🔴 OPEN |
| **Severity** | Low |
| **File** | `frontend/src/components/Map.jsx` |
| **Discovered** | 2026-11-01 (audit) |
| **Description** | The geometryStatus string contains a garbled character sequence (`'Loading road geometry???'`). Likely caused by a file encoding mismatch when the file was saved (emoji converted to replacement characters). Visible as broken characters in the map loading UI. |
| **Fix** | Replace the garbled characters with the correct emoji or text: `'Loading road geometry…'` or `'Loading road geometry ⏳'` |
| **Fixed By** | — |
| **Fixed On** | — |

---

### BUG-004 — Nested `<Routes>` in `App.jsx` incompatible with React Router v7
| Field | Value |
|-------|-------|
| **Status** | 🔴 OPEN |
| **Severity** | Medium |
| **File** | `frontend/src/App.jsx` |
| **Discovered** | 2026-11-01 (audit) |
| **Description** | The outer `<Routes>` has a catch-all `path="*"` that renders a layout div containing another nested `<Routes>`. React Router v7 changed how nested routes work. This pattern can cause: incorrect route matching, re-renders of the layout on every child navigation, and potential "No routes matched" warnings in console. Should use the `<Outlet>` + layout route pattern instead. |
| **Fix** | Refactor to use a layout route component: extract the Navbar+Sidebar wrapper into `AppLayout.jsx`, use `<Route element={<AppLayout />}>` as parent, nest child routes inside using `<Outlet />`. |
| **Fixed By** | — |
| **Fixed On** | — |

---

### BUG-005 — History endpoints missing auth headers in frontend
| Field | Value |
|-------|-------|
| **Status** | 🔴 OPEN |
| **Severity** | Low |
| **File** | `frontend/src/services/api.js` |
| **Discovered** | 2026-11-01 (audit) |
| **Description** | `getOptimizationHistory()` and `getOptimizationById()` do not pass auth headers. Backend currently has no auth guard on these endpoints, but if guards are added later, the frontend will silently get 401 errors. Inconsistent posture vs other endpoints. |
| **Fix** | Add `headers: getAuthHeaders({ Accept: 'application/json' })` to both functions. |
| **Fixed By** | — |
| **Fixed On** | — |

---

### BUG-006 — Traffic data is a hardcoded demo model with no disclosure in UI
| Field | Value |
|-------|-------|
| **Status** | 🔴 OPEN |
| **Severity** | Medium |
| **File** | `backend/src/services/realtimeService.js` |
| **Discovered** | 2026-11-01 (audit) |
| **Description** | `DEMO_TRAFFIC` is a static object with `source: 'fallback'`. The API response includes this without prominently surfacing the "demo" nature to the user. Weather is live (Open-Meteo), but traffic is not — presenting them together may mislead users or evaluators. |
| **Fix** | In `RouteOptimizer.jsx` and `DynamicRerouting.jsx`, render a badge `"Traffic: Demo Model"` next to the traffic score to set clear expectations. |
| **Fixed By** | — |
| **Fixed On** | — |

---

### BUG-007 — Auth token not passed to `rerouteRoute()` in DynamicRerouting
| Field | Value |
|-------|-------|
| **Status** | 🔴 OPEN |
| **Severity** | Medium |
| **File** | `frontend/src/pages/DynamicRerouting.jsx` (line ~187) |
| **Discovered** | 2026-11-01 (audit) |
| **Description** | `rerouteRoute(payload)` is called without a token argument. The function signature is `rerouteRoute(payload, token = null)`. The backend uses `optionalAuthMiddleware` — unauthenticated calls still work now, but if the middleware is tightened to require auth, this will silently break. |
| **Fix** | Import `useAuth` in `DynamicRerouting.jsx`, destructure `token`, pass it: `rerouteRoute(payload, token)`. |
| **Fixed By** | — |
| **Fixed On** | — |

---

## Resolved Bugs

| ID | Description | Fixed On | Fixed By |
|----|-------------|----------|----------|
| — | — | — | — |

---

## How to Add a Bug
Copy this template and paste it under "Active Bugs":

```markdown
### BUG-XXX — Short description
| Field | Value |
|-------|-------|
| **Status** | 🔴 OPEN |
| **Severity** | High / Medium / Low |
| **File** | path/to/file.jsx (line number if known) |
| **Discovered** | YYYY-MM-DD |
| **Description** | Detailed description of the bug and its impact. |
| **Fix** | Proposed fix or investigation steps. |
| **Fixed By** | — |
| **Fixed On** | — |
```

