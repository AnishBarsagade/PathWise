# PathWise — Product Requirements Document (PRD)
> **Version:** 1.0 · **Generated:** 2026-11-01 · **Status:** ~70% Built

---

## 1. Product Overview

**PathWise** is a multi-factor, AI-powered delivery-route optimization system designed for urban logistics in Nagpur, India. It combines Google OR-Tools CVRP (Capacitated Vehicle Routing Problem), AHP (Analytic Hierarchy Process) cost weighting, A* pathfinding for detour calculation, and real-time weather/traffic overlays to produce optimal, dynamically adaptable delivery schedules.

### Target Users
| Role | Description |
|------|-------------|
| **Admin / Dispatcher** | Plans routes, manages fleet, reviews history, triggers rerouting |
| **Rider / Driver** | Views assigned deliveries, updates delivery status |
| **Analyst (future)** | Compares optimization runs, reviews KPI trends |

### Core Proposition
> "One optimization run → optimal routes for the whole fleet, factoring live weather, traffic, road conditions, fuel cost, and priority weights — with one-click dynamic rerouting when incidents occur."

---

## 2. Technical Stack (Confirmed)

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, Vite 8, Tailwind CSS v4, React-Router v7, React-Leaflet 5, GSAP 3 |
| **Backend** | Node.js, Express 4, SQLite (better-sqlite3 13), JWT auth, bcrypt |
| **Python Engine** | Python 3.11, Google OR-Tools, Pandas, NumPy |
| **Algorithms** | VRP Solver, AHP Weighting, A* Detour, Cost Function |
| **Maps** | Leaflet + react-leaflet, Open-Meteo weather API (free, no key), OSRM for road geometry |
| **Database** | SQLite at `data/pathwise.db` |
| **Testing** | Jest + Supertest (backend), Python unittest (algorithms) |

---

## 3. In-Scope Features (Currently Implemented ✅)

### 3.1 Authentication & Authorization
- [x] JWT-based login/signup via `/api/auth/login` and `/api/auth/signup`
- [x] `AuthContext` with localStorage token persistence and auto-expiry detection
- [x] `ProtectedRoute` component with optional `requiredRole="admin"` gate
- [x] `authMiddleware` and `adminMiddleware` on all sensitive endpoints
- [x] Session expiry event dispatched on 401 responses

### 3.2 Dashboard (Operations & Analytics)
- [x] KPI stats: total orders, delivered, pending, high-priority, fleet count, ready vehicles
- [x] Deliveries by Geographical Zone (horizontal progress chart)
- [x] Fleet Composition by Class (gradient bar chart)
- [x] Latest Optimization Run snapshot (run ID, stop fulfillment, routes)
- [x] System Actions quick-launch panel
- [x] Demo data seed button (admin only) calling `/api/demo/seed`
- [x] Live refresh button

### 3.3 Route Optimizer
- [x] Manual vehicle and delivery input forms (add/remove rows)
- [x] Load from DB toggle (pulls pending deliveries & available vehicles)
- [x] Depot lat/lng configuration
- [x] Real-time weather & traffic data overlay via Open-Meteo integration
- [x] POST `/api/optimize` → Python VRP solver pipeline
- [x] POST `/api/optimize/compare` → side-by-side before/after algorithm comparison
- [x] Leaflet map preview of delivery locations pre-optimization
- [x] Redirect to `/results` with result state on success

### 3.4 Optimization Results
- [x] Summary stat cards (deliveries considered, served/unserved, eligible/used vehicles)
- [x] **Leaflet Map** with polyline route visualization per vehicle (road geometry via OSRM)
- [x] Per-vehicle route cards with stop sequence, load, capacity utilization %
- [x] Vehicle Route Allocation table (stops, load, capacity, utilization, cost)
- [x] AHP Factor Contribution bar chart (6 factors: distance, travel_time, traffic, fuel_cost, weather, road_condition)
- [x] Execution Details panel (engine, cost evaluation method, fleet stats)
- [x] Deep-link support: `/results?run=<run_id>` fetches from history

### 3.5 AHP Weight Visualizer
- [x] `/ahp` page displaying current AHP matrix and computed weights
- [x] Fetches from `/api/ahp/weights`

### 3.6 Cost Function Explorer
- [x] `/cost-function` page for multi-factor cost formula exploration

### 3.7 Dynamic Rerouting
- [x] Full incident configuration form (run selection → vehicle selection → incident type → location → severity → notes)
- [x] 4 incident types: Road Closure, Traffic Congestion, Accident, Weather
- [x] POST `/api/reroute` with full payload
- [x] Side-by-side original vs rerouted route diff display
- [x] Cost comparison metrics (original cost, rerouted cost, delta, stops served)
- [x] Rerouting Strategy/Reason text display
- [x] Rerouting history audit log table

### 3.8 Delivery Management
- [x] `/deliveries` page — CRUD table with pagination/filter
- [x] Create, edit, delete delivery records (admin)
- [x] Status update (rider or admin)
- [x] Filter by status, priority, zone

### 3.9 Fleet Management
- [x] `/fleet` page — vehicle CRUD table
- [x] Create, edit, delete vehicle records (admin)
- [x] Rider assignment to vehicles (admin)
- [x] Vehicle operational status management

### 3.10 Rider Dashboard
- [x] `/rider` page — filtered view of assigned deliveries
- [x] Mark delivery as in-transit or delivered
- [x] Rider-specific assignment view via `/api/rider/assignments`

### 3.11 Optimization History
- [x] `/optimization-history` page listing all past runs
- [x] Click-through to Results page via deep-link `?run=<id>`

### 3.12 Python Algorithm Engine
- [x] `algorithms/vrp/vrp_solver.py` — Google OR-Tools CVRP with priority scoring
- [x] `algorithms/ahp/ahp.py` — 6-factor AHP matrix and weight computation
- [x] `algorithms/cost_function/cost_function.py` — Composite cost formula
- [x] `algorithms/astar/astar.py` — A* pathfinding for detour calculation
- [x] Python engine invoked via `child_process.spawn` over stdin/stdout JSON bridge
- [x] Algorithm unit tests in each subdirectory

### 3.13 Backend API
- [x] Express server with full REST API at `src/server.js`
- [x] SQLite persistence via `dbService.js` (optimization_runs, rerouting_events, deliveries, vehicles, users, rider_assignments tables)
- [x] Real-time weather via Open-Meteo (10-min cache, graceful fallback)
- [x] Route geometry via OSRM (`routeGeometryService.js`)
- [x] Backend test suite: auth, health, logistics, optimize, persistence, realtime, reroute, routeGeometry (Jest + Supertest)

---

## 4. Out-of-Scope / To-Build (Remaining ~50%)

### 4.1 Polish & Hardening
- [ ] Global 404 / Not Found route page
- [ ] Loading skeleton screens (replace raw "Loading..." text)
- [ ] Toast notification system (replace inline message states)
- [ ] Consistent error boundary component
- [ ] Mobile-responsive Sidebar (hamburger menu for small screens)
- [ ] Accessibility audit (ARIA labels, keyboard navigation, focus traps)

### 4.2 Route Optimizer Enhancements
- [ ] Visual map-click to add delivery coordinates (instead of typing lat/lng)
- [ ] Drag-to-reorder stops in result view
- [ ] Export results as PDF or CSV

### 4.3 Analytics & Reporting
- [ ] Aggregate analytics page: trends over time (cost per run, deliveries served rate)
- [ ] Comparison view: multiple historical runs side-by-side
- [ ] Per-vehicle historical performance chart

### 4.4 Notifications & Real-Time Updates
- [ ] In-app notification bell (admin: new deliveries, completed routes)
- [ ] Rider push/polling for real-time status updates
- [ ] WebSocket or SSE channel for live dispatch board

### 4.5 Map Improvements
- [ ] Cluster markers for dense delivery zones
- [ ] Click-on-marker delivery detail popups with status update
- [ ] Dynamic traffic overlay layer toggle

### 4.6 Settings & Configuration Page
- [ ] AHP weight manual override UI (currently read-only)
- [ ] Depot location editor
- [ ] Optimization parameter tuning (time limit, solver strategy)
- [ ] User management page (admin: list users, change roles)

### 4.7 Testing & CI
- [ ] Frontend unit/component tests (Vitest + React Testing Library)
- [ ] End-to-end tests (Playwright)
- [ ] GitHub Actions CI pipeline
- [ ] Performance benchmark for VRP solver (>20 deliveries stress test)

### 4.8 Production Hardening
- [ ] Rate limiting on auth and optimization endpoints
- [ ] `.env` secrets validation on startup
- [ ] Structured logging (replace `console.log` with winston/pino)
- [ ] Docker Compose for one-command local dev setup
- [ ] CORS hardening for production

---

## 5. Non-Functional Requirements

| NFR | Target |
|-----|--------|
| VRP solve time | < 5 s for ≤ 30 deliveries, < 30 s for ≤ 100 |
| API response time | < 500 ms for read endpoints |
| Auth token TTL | 24 hours (configurable via `JWT_EXPIRES_IN`) |
| Weather cache TTL | 10 minutes live, 2 minutes fallback |
| DB | SQLite (dev); migration path to PostgreSQL (prod future) |
| Browser support | Chrome 120+, Firefox 120+, Edge 120+ |
| UI theme | Dark (`#050816` background), Cyan accent (`#22d3ee`), Tailwind v4 |

---

## 6. Open Questions / Decisions Needed

1. **Map tiles**: Should we switch from public OSM to a metered tile provider for production?  
2. **Traffic data**: Currently a demo/fallback model — integrate real TomTom or Google Maps Traffic API?  
3. **Real-time push**: WebSocket (Socket.io) vs SSE vs polling for rider dashboard?  
4. **Export format**: PDF (react-pdf) vs CSV for optimization results?  
5. **Deployment target**: Vercel + Railway, or full Docker Compose self-hosted?
