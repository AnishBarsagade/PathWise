const { isValidCoordinate, isValidAccuracy, isValidTimestamp, toLeafletLatLng } = require('../utils/geoUtils');
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const bcrypt = require("bcrypt");

// Resolve database path: defaults to data/pathwise.db in the project root
const defaultDbPath = path.resolve(__dirname, "../../../data/pathwise.db");
const dbPath = process.env.DATABASE_PATH || defaultDbPath;

// Ensure target directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db = null;

function getDb() {
  if (!db) {
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    initSchema(db);
  }
  return db;
}

function initSchema(database) {
  // 1. Table for optimization runs
  database.exec(`
    CREATE TABLE IF NOT EXISTS optimization_runs (
      run_id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      input_config TEXT,
      ahp_weights TEXT,
      realtime_source TEXT,
      realtime_timestamp TEXT,
      realtime_data TEXT,
      routes TEXT NOT NULL,
      total_cost REAL NOT NULL,
      total_load INTEGER NOT NULL,
      priority_summary TEXT,
      result_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_optimization_runs_created_at
    ON optimization_runs (created_at DESC);
  `);

  // 2. Table for dynamic rerouting events
  database.exec(`
    CREATE TABLE IF NOT EXISTS rerouting_events (
      event_id TEXT PRIMARY KEY,
      run_id TEXT,
      vehicle_id TEXT,
      created_at TEXT NOT NULL,
      incident_type TEXT,
      incident_details TEXT,
      original_route TEXT,
      rerouted_route TEXT,
      metrics TEXT,
      reason TEXT,
      FOREIGN KEY (run_id) REFERENCES optimization_runs(run_id)
    );

    CREATE INDEX IF NOT EXISTS idx_rerouting_events_created_at
    ON rerouting_events (created_at DESC);
  `);

  // 3. Table for users
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'rider',
      created_at TEXT NOT NULL
    );
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS vehicles (
      vehicle_id TEXT PRIMARY KEY, manufacturer TEXT NOT NULL, model TEXT NOT NULL,
      variant TEXT, vehicle_class TEXT NOT NULL, fuel_type TEXT,
      registration_identifier TEXT UNIQUE, configured_capacity_kg REAL NOT NULL,
      manufacturer_rated_payload_kg REAL, availability INTEGER NOT NULL DEFAULT 1,
      operational_status TEXT NOT NULL DEFAULT 'available', is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS deliveries (
      delivery_id TEXT PRIMARY KEY, recipient_name TEXT NOT NULL, parcel_category TEXT NOT NULL,
      weight REAL NOT NULL, priority TEXT NOT NULL, location TEXT NOT NULL, zone TEXT NOT NULL,
      latitude REAL NOT NULL, longitude REAL NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
      assigned_vehicle_id TEXT, is_demo INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL, FOREIGN KEY (assigned_vehicle_id) REFERENCES vehicles(vehicle_id)
    );
    CREATE INDEX IF NOT EXISTS idx_deliveries_filters ON deliveries(status, priority, zone);
    CREATE INDEX IF NOT EXISTS idx_vehicles_filters ON vehicles(availability, vehicle_class);

    CREATE TABLE IF NOT EXISTS rider_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      vehicle_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id)
    );
    CREATE INDEX IF NOT EXISTS idx_rider_assignments_user ON rider_assignments(user_id);
    CREATE INDEX IF NOT EXISTS idx_rider_assignments_vehicle ON rider_assignments(vehicle_id);

    CREATE TABLE IF NOT EXISTS tracking_sessions (
      session_id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL,
      driver_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      start_time TEXT NOT NULL,
      end_time TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id),
      FOREIGN KEY (driver_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_tracking_sessions_vehicle ON tracking_sessions(vehicle_id, status);

    CREATE TABLE IF NOT EXISTS vehicle_locations (
      vehicle_id TEXT PRIMARY KEY,
      driver_id INTEGER,
      session_id TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      accuracy REAL,
      speed REAL,
      heading REAL,
      tracking_status TEXT NOT NULL DEFAULT 'offline',
      is_deviated INTEGER NOT NULL DEFAULT 0,
      deviation_distance_m REAL DEFAULT 0,
      consecutive_deviations INTEGER DEFAULT 0,
      last_ping_at TEXT NOT NULL,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id),
      FOREIGN KEY (driver_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS gps_location_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      vehicle_id TEXT NOT NULL,
      driver_id INTEGER NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      accuracy REAL,
      speed REAL,
      heading REAL,
      deviation_distance_m REAL DEFAULT 0,
      is_deviated INTEGER DEFAULT 0,
      recorded_at TEXT NOT NULL,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id),
      FOREIGN KEY (driver_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_gps_history_vehicle ON gps_location_history(vehicle_id, recorded_at DESC);

    CREATE TABLE IF NOT EXISTS route_deviation_events (
      event_id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL,
      driver_id INTEGER,
      session_id TEXT,
      run_id TEXT,
      deviation_distance_m REAL NOT NULL,
      threshold_m REAL NOT NULL DEFAULT 100,
      consecutive_pings INTEGER NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      resolved_at TEXT,
      is_simulated INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id),
      FOREIGN KEY (driver_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_route_deviation_events_vehicle ON route_deviation_events(vehicle_id, status);
    CREATE INDEX IF NOT EXISTS idx_route_deviation_events_created ON route_deviation_events(created_at DESC);
  `);

  // Migration for existing databases:
  // Older PathWise databases do not have the "name" column.
  const columns = database.prepare(`PRAGMA table_info(users)`).all();

  const hasNameColumn = columns.some((column) => column.name === "name");

  if (!hasNameColumn) {
    database.exec(`ALTER TABLE users ADD COLUMN name TEXT`);
  }

  // Simulation support migration
  const locCols = database.prepare("PRAGMA table_info(vehicle_locations)").all();
  if (!locCols.some((c) => c.name === "is_simulated")) {
    database.exec("ALTER TABLE vehicle_locations ADD COLUMN is_simulated INTEGER NOT NULL DEFAULT 0");
  }
  const histCols = database.prepare("PRAGMA table_info(gps_location_history)").all();
  if (!histCols.some((c) => c.name === "is_simulated")) {
    database.exec("ALTER TABLE gps_location_history ADD COLUMN is_simulated INTEGER NOT NULL DEFAULT 0");
  }

  // Seed default admin account
  seedAdminUser(database);
}

/**
 * Seeds the default administrator account if it does not exist.
 */
function seedAdminUser(database) {
  const existing = database
    .prepare("SELECT id FROM users WHERE email = ?")
    .get("admin@pathwise.com");

  if (!existing) {
    const hash = bcrypt.hashSync("PathWise@123", 10);

    database
      .prepare(
        `
        INSERT INTO users (
          name,
          email,
          password_hash,
          role,
          created_at
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      )
      .run(
        "PathWise Admin",
        "admin@pathwise.com",
        hash,
        "admin",
        new Date().toISOString(),
      );
  }

  // Also seed default demo rider account if it does not exist
  let rider = database
    .prepare("SELECT id FROM users WHERE email = ?")
    .get("rider@pathwise.com");

  if (!rider) {
    const riderHash = bcrypt.hashSync("PathWise@123", 10);
    const result = database
      .prepare(
        `
        INSERT INTO users (
          name,
          email,
          password_hash,
          role,
          created_at
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      )
      .run(
        "Rahul Sharma (Rider)",
        "rider@pathwise.com",
        riderHash,
        "rider",
        new Date().toISOString(),
      );

    rider = { id: result.lastInsertRowid };
  }

  // Ensure rider is assigned to an active vehicle in fleet
  if (rider) {
    const hasAssignment = database.prepare("SELECT id FROM rider_assignments WHERE user_id = ?").get(rider.id);
    if (!hasAssignment) {
      let vehicle = database.prepare("SELECT vehicle_id FROM vehicles WHERE vehicle_id = 'V001'").get();
      if (!vehicle) {
        vehicle = database.prepare("SELECT vehicle_id FROM vehicles ORDER BY vehicle_id ASC LIMIT 1").get();
      }
      if (vehicle) {
        database
          .prepare("INSERT INTO rider_assignments (user_id, vehicle_id, created_at) VALUES (?, ?, ?)")
          .run(rider.id, vehicle.vehicle_id, new Date().toISOString());
      }
    }
  }
}

/**
 * Find a user by email.
 */
function findUserByEmail(email) {
  const database = getDb();

  return (
    database.prepare("SELECT * FROM users WHERE email = ?").get(email) || null
  );
}

/**
 * Find a user by id.
 */
function findUserById(id) {
  const database = getDb();

  return (
    database
      .prepare(
        `
        SELECT
          id,
          name,
          email,
          role,
          created_at
        FROM users
        WHERE id = ?
      `,
      )
      .get(id) || null
  );
}

/**
 * Create a new user.
 * Public signup users are always created as Riders.
 */
function createUser({ name, email, passwordHash, role = "rider" }) {
  const database = getDb();

  const stmt = database.prepare(`
    INSERT INTO users (
      name,
      email,
      password_hash,
      role,
      created_at
    )
    VALUES (?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    name,
    email,
    passwordHash,
    role,
    new Date().toISOString(),
  );

  return findUserById(result.lastInsertRowid);
}

/**
 * Persists an optimization execution result to SQLite.
 */
function saveOptimizationRun({
  run_id,
  created_at,
  input_config,
  ahp_weights,
  realtime_source,
  realtime_timestamp,
  realtime_data,
  routes,
  total_cost,
  total_load,
  priority_summary,
  result_json,
}) {
  const database = getDb();

  const stmt = database.prepare(`
    INSERT INTO optimization_runs (
      run_id,
      created_at,
      input_config,
      ahp_weights,
      realtime_source,
      realtime_timestamp,
      realtime_data,
      routes,
      total_cost,
      total_load,
      priority_summary,
      result_json
    ) VALUES (
      @run_id,
      @created_at,
      @input_config,
      @ahp_weights,
      @realtime_source,
      @realtime_timestamp,
      @realtime_data,
      @routes,
      @total_cost,
      @total_load,
      @priority_summary,
      @result_json
    )
  `);

  stmt.run({
    run_id,
    created_at: created_at || new Date().toISOString(),
    input_config:
      typeof input_config === "object"
        ? JSON.stringify(input_config)
        : input_config || "{}",
    ahp_weights:
      typeof ahp_weights === "object"
        ? JSON.stringify(ahp_weights)
        : ahp_weights || "{}",
    realtime_source: realtime_source || "fallback",
    realtime_timestamp: realtime_timestamp || new Date().toISOString(),
    realtime_data:
      typeof realtime_data === "object"
        ? JSON.stringify(realtime_data)
        : realtime_data || "{}",
    routes:
      typeof routes === "object" ? JSON.stringify(routes) : routes || "[]",
    total_cost: Number(total_cost) || 0.0,
    total_load: Number(total_load) || 0,
    priority_summary:
      typeof priority_summary === "object"
        ? JSON.stringify(priority_summary)
        : priority_summary || "{}",
    result_json:
      typeof result_json === "object"
        ? JSON.stringify(result_json)
        : result_json || "{}",
  });

  // Stamp assigned_vehicle_id on deliveries for served stops
  try {
    const routeList = typeof routes === "string" ? JSON.parse(routes) : (Array.isArray(routes) ? routes : []);
    const updateDeliv = database.prepare("UPDATE deliveries SET assigned_vehicle_id = ?, status = CASE WHEN status = 'pending' THEN 'assigned' ELSE status END WHERE delivery_id = ?");
    for (const r of routeList) {
      if (r && r.vehicle_id && Array.isArray(r.route)) {
        for (const stop of r.route) {
          if (stop && stop !== "DEPOT") {
            updateDeliv.run(r.vehicle_id, stop);
          }
        }
      }
    }
  } catch (_) {}

  return run_id;
}

/**
 * Retrieve list of past optimization runs.
 */
function getOptimizationHistory(limit = 50) {
  const database = getDb();

  const stmt = database.prepare(`
    SELECT
      run_id,
      created_at,
      realtime_source,
      realtime_timestamp,
      total_cost,
      total_load,
      priority_summary,
      routes
    FROM optimization_runs
    ORDER BY created_at DESC
    LIMIT ?
  `);

  const rows = stmt.all(limit);

  return rows.map((row) => ({
    run_id: row.run_id,
    created_at: row.created_at,
    realtime_source: row.realtime_source,
    realtime_timestamp: row.realtime_timestamp,
    total_cost: row.total_cost,
    total_load: row.total_load,
    priority_summary: row.priority_summary
      ? JSON.parse(row.priority_summary)
      : null,
    routes: row.routes ? JSON.parse(row.routes) : [],
  }));
}

/**
 * Retrieve full details for a single optimization run by ID.
 */
function getOptimizationRunById(runId) {
  const database = getDb();

  const stmt = database.prepare(`
    SELECT * FROM optimization_runs WHERE run_id = ?
  `);

  const row = stmt.get(runId);

  if (!row) return null;

  const result = row.result_json ? JSON.parse(row.result_json) : {};
  // Older runs predate map metadata. Their persisted input is the only safe
  // source to use; never substitute today's delivery dataset for an old run.
  if (!Array.isArray(result.delivery_records) && Array.isArray(row.input_config ? JSON.parse(row.input_config).deliveries : null)) {
    result.delivery_records = JSON.parse(row.input_config).deliveries;
  }
  if (!Array.isArray(result.vehicle_records) && Array.isArray(row.input_config ? JSON.parse(row.input_config).vehicles : null)) {
    result.vehicle_records = JSON.parse(row.input_config).vehicles;
  }
  if (!result.ahp_weights) result.ahp_weights = row.ahp_weights ? JSON.parse(row.ahp_weights) : {};

  return {
    run_id: row.run_id,
    created_at: row.created_at,
    input_config: row.input_config ? JSON.parse(row.input_config) : {},
    ahp_weights: row.ahp_weights ? JSON.parse(row.ahp_weights) : {},
    realtime_source: row.realtime_source,
    realtime_timestamp: row.realtime_timestamp,
    realtime_data: row.realtime_data ? JSON.parse(row.realtime_data) : {},
    routes: row.routes ? JSON.parse(row.routes) : [],
    total_cost: row.total_cost,
    total_load: row.total_load,
    priority_summary: row.priority_summary
      ? JSON.parse(row.priority_summary)
      : null,
    result,
  };
}

/**
 * Persists a dynamic rerouting event.
 */
function saveReroutingEvent({
  event_id,
  run_id,
  vehicle_id,
  created_at,
  incident_type,
  incident_details,
  original_route,
  rerouted_route,
  metrics,
  reason,
}) {
  const database = getDb();

  const stmt = database.prepare(`
    INSERT INTO rerouting_events (
      event_id,
      run_id,
      vehicle_id,
      created_at,
      incident_type,
      incident_details,
      original_route,
      rerouted_route,
      metrics,
      reason
    ) VALUES (
      @event_id,
      @run_id,
      @vehicle_id,
      @created_at,
      @incident_type,
      @incident_details,
      @original_route,
      @rerouted_route,
      @metrics,
      @reason
    )
  `);

  stmt.run({
    event_id,
    run_id: run_id || null,
    vehicle_id: vehicle_id || "V001",
    created_at: created_at || new Date().toISOString(),
    incident_type: incident_type || "unspecified",
    incident_details:
      typeof incident_details === "object"
        ? JSON.stringify(incident_details)
        : incident_details || "{}",
    original_route:
      typeof original_route === "object"
        ? JSON.stringify(original_route)
        : original_route || "[]",
    rerouted_route:
      typeof rerouted_route === "object"
        ? JSON.stringify(rerouted_route)
        : rerouted_route || "[]",
    metrics:
      typeof metrics === "object" ? JSON.stringify(metrics) : metrics || "{}",
    reason: reason || "",
  });

  return event_id;
}

/**
 * Retrieve list of past dynamic rerouting events.
 */
function getReroutingHistory(limit = 50) {
  const database = getDb();

  const stmt = database.prepare(`
    SELECT * FROM rerouting_events
    ORDER BY created_at DESC
    LIMIT ?
  `);

  const rows = stmt.all(limit);

  return rows.map((row) => ({
    event_id: row.event_id,
    run_id: row.run_id,
    vehicle_id: row.vehicle_id,
    created_at: row.created_at,
    incident_type: row.incident_type,
    incident_details: row.incident_details
      ? JSON.parse(row.incident_details)
      : {},
    original_route: row.original_route ? JSON.parse(row.original_route) : [],
    rerouted_route: row.rerouted_route ? JSON.parse(row.rerouted_route) : [],
    metrics: row.metrics ? JSON.parse(row.metrics) : {},
    reason: row.reason,
  }));
}

/**
 * Clear history (for testing purposes).
 */
function clearHistory() {
  const database = getDb();

  database.exec(`
    DELETE FROM rerouting_events;
    DELETE FROM optimization_runs;
    DELETE FROM rider_assignments;
    DELETE FROM route_deviation_events;
    DELETE FROM vehicle_locations;
    DELETE FROM gps_location_history;
    DELETE FROM tracking_sessions;
  `);
}

/**
 * Close database connection.
 */
function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

const DELIVERY_COLUMNS = ['delivery_id','recipient_name','parcel_category','weight','priority','location','zone','latitude','longitude','status','assigned_vehicle_id','is_demo'];
const VEHICLE_COLUMNS = ['vehicle_id','manufacturer','model','variant','vehicle_class','fuel_type','registration_identifier','configured_capacity_kg','manufacturer_rated_payload_kg','availability','operational_status','is_demo'];

function listDeliveries({ search = '', priority, status, zone, vehicle_id, limit = 100, offset = 0 } = {}) {
  const where = [], params = [];
  if (search) { where.push('(delivery_id LIKE ? OR recipient_name LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  for (const [field, value] of [['priority', priority], ['status', status], ['zone', zone], ['assigned_vehicle_id', vehicle_id]]) {
    if (value) { where.push(`${field} = ?`); params.push(value); }
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const database = getDb();
  const total = database.prepare(`SELECT COUNT(*) AS count FROM deliveries ${clause}`).get(...params).count;
  const records = database.prepare(`SELECT * FROM deliveries ${clause} ORDER BY delivery_id LIMIT ? OFFSET ?`).all(...params, Math.min(Number(limit) || 100, 250), Number(offset) || 0);
  return { records, total };
}
function getDelivery(id) { return getDb().prepare('SELECT * FROM deliveries WHERE delivery_id = ?').get(id) || null; }
function saveDelivery(item, existing = false) {
  const now = new Date().toISOString(), database = getDb();
  if (existing) {
    database.prepare(`UPDATE deliveries SET recipient_name=@recipient_name, parcel_category=@parcel_category, weight=@weight, priority=@priority, location=@location, zone=@zone, latitude=@latitude, longitude=@longitude, status=@status, assigned_vehicle_id=@assigned_vehicle_id, updated_at=@updated_at WHERE delivery_id=@delivery_id`).run({ ...item, assigned_vehicle_id: item.assigned_vehicle_id || null, updated_at: now });
  } else database.prepare(`INSERT INTO deliveries (${DELIVERY_COLUMNS.join(',')},created_at,updated_at) VALUES (@delivery_id,@recipient_name,@parcel_category,@weight,@priority,@location,@zone,@latitude,@longitude,@status,@assigned_vehicle_id,@is_demo,@created_at,@updated_at)`).run({ ...item, assigned_vehicle_id: item.assigned_vehicle_id || null, is_demo: item.is_demo || 0, created_at: now, updated_at: now });
  return getDelivery(item.delivery_id);
}
function deleteDelivery(id) { return getDb().prepare('DELETE FROM deliveries WHERE delivery_id = ?').run(id).changes > 0; }
function updateDeliveryStatus(id, status) {
  const now = new Date().toISOString();
  const database = getDb();
  const result = database.prepare('UPDATE deliveries SET status = ?, updated_at = ? WHERE delivery_id = ?').run(status, now, id);
  if (result.changes === 0) return null;
  return getDelivery(id);
}
function listRiders() {
  const database = getDb();
  return database.prepare("SELECT id, name, email, role, created_at FROM users WHERE role = 'rider' ORDER BY name ASC").all();
}
function listVehicles({ manufacturer, vehicle_class, availability, min_capacity } = {}) {
  const where = [], params = [];
  if (manufacturer) { where.push('manufacturer = ?'); params.push(manufacturer); }
  if (vehicle_class) { where.push('vehicle_class = ?'); params.push(vehicle_class); }
  if (availability !== undefined && availability !== '') { where.push('availability = ?'); params.push(Number(availability) ? 1 : 0); }
  if (min_capacity) { where.push('configured_capacity_kg >= ?'); params.push(Number(min_capacity)); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return getDb().prepare(`SELECT * FROM vehicles ${clause} ORDER BY vehicle_id`).all(...params);
}
function getVehicle(id) { return getDb().prepare('SELECT * FROM vehicles WHERE vehicle_id = ?').get(id) || null; }
function saveVehicle(item, existing = false) {
  const now = new Date().toISOString(), database = getDb();
  const alreadyExists = existing && Boolean(getVehicle(item.vehicle_id));
  const payload = {
    variant: null,
    fuel_type: null,
    registration_identifier: null,
    manufacturer_rated_payload_kg: null,
    availability: 1,
    operational_status: 'available',
    is_demo: 0,
    ...item,
    updated_at: now,
  };
  if (alreadyExists) database.prepare(`UPDATE vehicles SET manufacturer=@manufacturer, model=@model, variant=@variant, vehicle_class=@vehicle_class, fuel_type=@fuel_type, registration_identifier=@registration_identifier, configured_capacity_kg=@configured_capacity_kg, manufacturer_rated_payload_kg=@manufacturer_rated_payload_kg, availability=@availability, operational_status=@operational_status, updated_at=@updated_at WHERE vehicle_id=@vehicle_id`).run(payload);
  else database.prepare(`INSERT INTO vehicles (${VEHICLE_COLUMNS.join(',')},created_at,updated_at) VALUES (@vehicle_id,@manufacturer,@model,@variant,@vehicle_class,@fuel_type,@registration_identifier,@configured_capacity_kg,@manufacturer_rated_payload_kg,@availability,@operational_status,@is_demo,@created_at,@updated_at)`).run({ ...payload, created_at: now });
  return getVehicle(item.vehicle_id);
}
function deleteVehicle(id) {
  const database = getDb();
  const used = database.prepare('SELECT COUNT(*) AS count FROM deliveries WHERE assigned_vehicle_id = ?').get(id).count;
  if (used) return { deleted: false, reason: 'Vehicle has assigned deliveries.' };
  database.prepare('DELETE FROM rider_assignments WHERE vehicle_id = ?').run(id);
  database.prepare('DELETE FROM route_deviation_events WHERE vehicle_id = ?').run(id);
  database.prepare('DELETE FROM vehicle_locations WHERE vehicle_id = ?').run(id);
  database.prepare('DELETE FROM gps_location_history WHERE vehicle_id = ?').run(id);
  database.prepare('DELETE FROM tracking_sessions WHERE vehicle_id = ?').run(id);
  return { deleted: database.prepare('DELETE FROM vehicles WHERE vehicle_id = ?').run(id).changes > 0 };
}
function seedDemoData({ deliveries, vehicles }) {
  const database = getDb(), now = new Date().toISOString(); let created = 0, skipped = 0;
  const insertVehicle = database.prepare(`INSERT OR IGNORE INTO vehicles (${VEHICLE_COLUMNS.join(',')},created_at,updated_at) VALUES (@vehicle_id,@manufacturer,@model,@variant,@vehicle_class,@fuel_type,@registration_identifier,@configured_capacity_kg,@manufacturer_rated_payload_kg,@availability,@operational_status,@is_demo,@created_at,@updated_at)`);
  const insertDelivery = database.prepare(`INSERT OR IGNORE INTO deliveries (${DELIVERY_COLUMNS.join(',')},created_at,updated_at) VALUES (@delivery_id,@recipient_name,@parcel_category,@weight,@priority,@location,@zone,@latitude,@longitude,@status,@assigned_vehicle_id,@is_demo,@created_at,@updated_at)`);
  const insertAll = database.transaction(() => { for (const row of vehicles) (insertVehicle.run({ ...row, created_at: now, updated_at: now }).changes ? created++ : skipped++); for (const row of deliveries) (insertDelivery.run({ ...row, assigned_vehicle_id: null, created_at: now, updated_at: now }).changes ? created++ : skipped++); });
  insertAll(); return { created, skipped, failed: 0 };
}
function getDashboardStats() {
  const database = getDb(); const one = (sql, ...args) => database.prepare(sql).get(...args).count;
  const latest = database.prepare('SELECT run_id, created_at, total_load, priority_summary, routes FROM optimization_runs ORDER BY created_at DESC LIMIT 1').get();
  let latest_run = null;
  if (latest) { const summary = JSON.parse(latest.priority_summary || '{}'); latest_run = { run_id: latest.run_id, created_at: latest.created_at, served: summary.total_served || 0, unserved: Math.max(0, (summary.total_deliveries || 0) - (summary.total_served || 0)), routes: JSON.parse(latest.routes || '[]').length }; }
  return { total_deliveries: one('SELECT COUNT(*) AS count FROM deliveries'), total_vehicles: one('SELECT COUNT(*) AS count FROM vehicles'), available_vehicles: one("SELECT COUNT(*) AS count FROM vehicles WHERE availability=1 AND operational_status='available'"), pending_deliveries: one("SELECT COUNT(*) AS count FROM deliveries WHERE status='pending'"), completed_deliveries: one("SELECT COUNT(*) AS count FROM deliveries WHERE status='completed'"), high_priority_deliveries: one("SELECT COUNT(*) AS count FROM deliveries WHERE priority='High'"), vehicles_by_class: database.prepare('SELECT vehicle_class, COUNT(*) AS count FROM vehicles GROUP BY vehicle_class').all(), deliveries_by_zone: database.prepare('SELECT zone, COUNT(*) AS count FROM deliveries GROUP BY zone ORDER BY zone').all(), latest_run };
}
function getOptimizationInputFromDatabase() {
  return { deliveries: getDb().prepare("SELECT delivery_id, recipient_name, parcel_category, weight, priority, location, zone, latitude, longitude, status, assigned_vehicle_id FROM deliveries WHERE status IN ('pending','assigned')").all(), vehicles: getDb().prepare("SELECT vehicle_id, manufacturer, model, variant, vehicle_class, configured_capacity_kg AS capacity, availability, operational_status, 10.0 AS fuel_cost FROM vehicles WHERE availability=1 AND operational_status='available'").all() };
}

/**
 * Assign a rider to a vehicle.
 */
function assignRiderToVehicle(userId, vehicleId) {
  const database = getDb();
  // Clear any existing assignment for this user or vehicle
  database.prepare('DELETE FROM rider_assignments WHERE user_id = ? OR vehicle_id = ?').run(userId, vehicleId);
  database.prepare(`
    INSERT INTO rider_assignments (user_id, vehicle_id, created_at)
    VALUES (?, ?, ?)
  `).run(userId, vehicleId, new Date().toISOString());
  return getRiderAssignments(userId);
}

/**
 * Get assignments for a given rider.
 * Returns assigned vehicle, deliveries, and active route from latest run.
 * If unassigned, returns an empty state object.
 */
function getRiderAssignments(userId) {
  const database = getDb();
  const assignment = database.prepare(`
    SELECT ra.id, ra.user_id, ra.vehicle_id, ra.created_at,
           v.manufacturer, v.model, v.variant, v.vehicle_class, v.configured_capacity_kg, v.operational_status
    FROM rider_assignments ra
    LEFT JOIN vehicles v ON ra.vehicle_id = v.vehicle_id
    WHERE ra.user_id = ?
    ORDER BY ra.created_at DESC
    LIMIT 1
  `).get(userId);

  if (!assignment) {
    return {
      user_id: Number(userId),
      vehicle: null,
      deliveries: [],
      routes: [],
      message: 'No vehicle or deliveries currently assigned to this rider.',
    };
  }

  let deliveries = database.prepare(`
    SELECT * FROM deliveries WHERE assigned_vehicle_id = ?
  `).all(assignment.vehicle_id);

  // Retrieve assigned route from latest optimization run if available
  const latestRun = database.prepare(`
    SELECT run_id, routes FROM optimization_runs ORDER BY created_at DESC LIMIT 1
  `).get();

  let assignedRoute = null;
  if (latestRun && latestRun.routes) {
    try {
      const parsedRoutes = JSON.parse(latestRun.routes);
      assignedRoute = parsedRoutes.find((r) => r.vehicle_id === assignment.vehicle_id) || null;
    } catch (_) {}
  }

  // If deliveries weren't explicitly stamped with assigned_vehicle_id, but the assigned route has stops:
  if (deliveries.length === 0 && assignedRoute && Array.isArray(assignedRoute.route)) {
    const stopIds = assignedRoute.route.filter((s) => s !== 'DEPOT');
    if (stopIds.length > 0) {
      const placeholders = stopIds.map(() => '?').join(',');
      deliveries = database.prepare(`SELECT * FROM deliveries WHERE delivery_id IN (${placeholders})`).all(...stopIds);
    }
  }

  // Fallback: If still no deliveries, and vehicle is V001 (demo vehicle), fetch first 3-4 demo deliveries
  if (deliveries.length === 0 && assignment.vehicle_id === 'V001') {
    deliveries = database.prepare(`SELECT * FROM deliveries LIMIT 4`).all();
  }

  return {
    user_id: Number(userId),
    vehicle: {
      vehicle_id: assignment.vehicle_id,
      manufacturer: assignment.manufacturer,
      model: assignment.model,
      variant: assignment.variant,
      vehicle_class: assignment.vehicle_class,
      capacity: assignment.configured_capacity_kg,
      operational_status: assignment.operational_status,
    },
    deliveries,
    route: assignedRoute,
    routes: assignedRoute ? [assignedRoute] : [],
    run_id: latestRun ? latestRun.run_id : null,
    message: 'Active assignments loaded.',
  };
}

/**
 * Find rider assigned to a vehicle.
 */
function getRiderByVehicleId(vehicleId) {
  const database = getDb();
  const row = database.prepare('SELECT user_id FROM rider_assignments WHERE vehicle_id = ? ORDER BY created_at DESC LIMIT 1').get(vehicleId);
  return row ? row.user_id : null;
}

/**
 * Remove rider assignment.
 */
function deleteRiderAssignment(userId, vehicleId) {
  const database = getDb();
  if (vehicleId) {
    return database.prepare('DELETE FROM rider_assignments WHERE user_id = ? AND vehicle_id = ?').run(userId, vehicleId).changes > 0;
  }
  return database.prepare('DELETE FROM rider_assignments WHERE user_id = ?').run(userId).changes > 0;
}


/**
 * Start a GPS tracking session for a vehicle and driver.
 */
function startTrackingSession({ vehicle_id, driver_id }) {
  const database = getDb();
  const now = new Date().toISOString();
  const sessionId = "SESS_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);

  database.prepare(`
    UPDATE tracking_sessions
    SET status = 'completed', end_time = ?, updated_at = ?
    WHERE vehicle_id = ? AND status = 'active'
  `).run(now, now, vehicle_id);

  database.prepare(`
    INSERT INTO tracking_sessions (session_id, vehicle_id, driver_id, status, start_time, created_at, updated_at)
    VALUES (?, ?, ?, 'active', ?, ?, ?)
  `).run(sessionId, vehicle_id, driver_id, now, now, now);

  database.prepare(`
    UPDATE vehicles SET operational_status = 'in_transit', updated_at = ? WHERE vehicle_id = ?
  `).run(now, vehicle_id);

  database.prepare(`
    INSERT INTO vehicle_locations (vehicle_id, driver_id, session_id, latitude, longitude, accuracy, speed, heading, tracking_status, is_deviated, deviation_distance_m, consecutive_deviations, last_ping_at)
    VALUES (?, ?, ?, 21.145, 79.088, 0, 0, 0, 'tracking', 0, 0, 0, ?)
    ON CONFLICT(vehicle_id) DO UPDATE SET
      driver_id = excluded.driver_id,
      session_id = excluded.session_id,
      tracking_status = 'tracking',
      last_ping_at = excluded.last_ping_at
  `).run(vehicle_id, driver_id, sessionId, now);

  return { session_id: sessionId, vehicle_id, driver_id, status: 'active', start_time: now };
}

/**
 * Stop a tracking session.
 */
function stopTrackingSession({ vehicle_id, driver_id }) {
  const database = getDb();
  const now = new Date().toISOString();

  database.prepare(`
    UPDATE tracking_sessions
    SET status = 'completed', end_time = ?, updated_at = ?
    WHERE vehicle_id = ? AND status = 'active'
  `).run(now, now, vehicle_id);

  database.prepare(`
    UPDATE vehicle_locations
    SET tracking_status = 'idle', last_ping_at = ?
    WHERE vehicle_id = ?
  `).run(now, vehicle_id);

  database.prepare(`
    UPDATE vehicles SET operational_status = 'available', updated_at = ? WHERE vehicle_id = ?
  `).run(now, vehicle_id);

  return { vehicle_id, status: 'idle', stopped_at: now };
}

/**
 * Record a validated GPS ping and update latest snapshot.
 */
function recordGpsPing({
  vehicle_id,
  driver_id,
  session_id = null,
  latitude,
  longitude,
  accuracy = 0,
  speed = 0,
  heading = 0,
  deviation_distance_m = 0,
  is_deviated = 0,
  consecutive_deviations = 0,
  is_simulated = 0,
  timestamp = null,
}) {
  const database = getDb();
  const now = new Date().toISOString();
  const pingTimestamp = timestamp || now;

  const lat = Number(latitude);
  const lon = Number(longitude);
  const acc = Number(accuracy) || 0;
  const spd = Number(speed) || 0;
  const hdg = Number(heading) || 0;

  // Validation: Coordinates range & finiteness
  if (!isValidCoordinate(lat, lon, false)) {
    return {
      rejected: true,
      reason: "Invalid coordinates: latitude and longitude must be finite numbers within valid geographical ranges",
      recorded_at: now,
    };
  }

  let activeSessionId = session_id;
  if (!activeSessionId) {
    const active = database.prepare(`
      SELECT session_id FROM tracking_sessions
      WHERE vehicle_id = ? AND status = 'active'
      ORDER BY created_at DESC LIMIT 1
    `).get(vehicle_id);
    activeSessionId = active ? active.session_id : null;
  }

  // Rejection of duplicate and outdated readings
  if (activeSessionId) {
    const latestPing = database.prepare(`
      SELECT id, recorded_at, latitude, longitude
      FROM gps_location_history
      WHERE vehicle_id = ? AND session_id = ?
      ORDER BY recorded_at DESC, id DESC LIMIT 1
    `).get(vehicle_id, activeSessionId);

    if (latestPing) {
      const prevTime = new Date(latestPing.recorded_at).getTime();
      const currTime = new Date(pingTimestamp).getTime();

      // Reject if timestamp is older than or equal to previous recorded timestamp for this session
      if (currTime <= prevTime) {
        return {
          rejected: true,
          reason: "Duplicate or outdated timestamp: incoming ping is older than or equal to last recorded reading",
          recorded_at: latestPing.recorded_at,
        };
      }

      // Reject if identical coordinates within 500ms jitter window
      const latDiff = Math.abs(Number(latestPing.latitude) - lat);
      const lonDiff = Math.abs(Number(latestPing.longitude) - lon);
      if (latDiff < 0.0000001 && lonDiff < 0.0000001 && (currTime - prevTime) < 500) {
        return {
          rejected: true,
          reason: "Duplicate identical coordinate reading within 500ms",
          recorded_at: latestPing.recorded_at,
        };
      }
    }
  }

  database.prepare(`
    INSERT INTO gps_location_history (
      session_id, vehicle_id, driver_id, latitude, longitude,
      accuracy, speed, heading, deviation_distance_m, is_deviated, is_simulated, recorded_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    activeSessionId,
    vehicle_id,
    driver_id,
    lat,
    lon,
    acc,
    spd,
    hdg,
    Number(deviation_distance_m) || 0,
    is_deviated ? 1 : 0,
    is_simulated ? 1 : 0,
    pingTimestamp
  );

  database.prepare(`
    INSERT INTO vehicle_locations (
      vehicle_id, driver_id, session_id, latitude, longitude,
      accuracy, speed, heading, tracking_status, is_deviated,
      deviation_distance_m, consecutive_deviations, is_simulated, last_ping_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'tracking', ?, ?, ?, ?, ?)
    ON CONFLICT(vehicle_id) DO UPDATE SET
      driver_id = excluded.driver_id,
      session_id = COALESCE(excluded.session_id, vehicle_locations.session_id),
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      accuracy = excluded.accuracy,
      speed = excluded.speed,
      heading = excluded.heading,
      tracking_status = 'tracking',
      is_deviated = excluded.is_deviated,
      deviation_distance_m = excluded.deviation_distance_m,
      consecutive_deviations = excluded.consecutive_deviations,
      is_simulated = excluded.is_simulated,
      last_ping_at = excluded.last_ping_at
  `).run(
    vehicle_id,
    driver_id,
    activeSessionId,
    lat,
    lon,
    acc,
    spd,
    hdg,
    is_deviated ? 1 : 0,
    Number(deviation_distance_m) || 0,
    Number(consecutive_deviations) || 0,
    is_simulated ? 1 : 0,
    pingTimestamp
  );

  return {
    vehicle_id,
    driver_id,
    session_id: activeSessionId,
    latitude: lat,
    longitude: lon,
    accuracy: acc,
    speed: spd,
    heading: hdg,
    tracking_status: 'tracking',
    is_deviated: Boolean(is_deviated),
    deviation_distance_m: Number(deviation_distance_m) || 0,
    consecutive_deviations: Number(consecutive_deviations) || 0,
    is_simulated: is_simulated ? 1 : 0,
    recorded_at: pingTimestamp,
  };
}

/**
 * Get current telemetry and status for a single vehicle.
 */
function getVehicleLocation(vehicleId) {
  const database = getDb();
  return database.prepare(`
    SELECT vl.*, u.name AS driver_name, u.email AS driver_email,
           v.manufacturer, v.model, v.registration_identifier, v.vehicle_class
    FROM vehicle_locations vl
    LEFT JOIN users u ON vl.driver_id = u.id
    LEFT JOIN vehicles v ON vl.vehicle_id = v.vehicle_id
    WHERE vl.vehicle_id = ?
  `).get(vehicleId) || null;
}

/**
 * Get all fleet vehicles with their current tracking status and latest coordinates.
 */
function getAllVehicleLocations() {
  const database = getDb();
  return database.prepare(`
    SELECT
      v.vehicle_id,
      v.manufacturer,
      v.model,
      v.registration_identifier,
      v.vehicle_class,
      v.configured_capacity_kg,
      v.operational_status AS vehicle_operational_status,
      COALESCE(vl.tracking_status, 'offline') AS tracking_status,
      vl.latitude,
      vl.longitude,
      vl.accuracy,
      vl.speed,
      vl.heading,
      COALESCE(vl.is_deviated, 0) AS is_deviated,
      COALESCE(vl.deviation_distance_m, 0) AS deviation_distance_m,
      COALESCE(vl.consecutive_deviations, 0) AS consecutive_deviations,
      COALESCE(vl.is_simulated, v.is_demo, 0) AS is_simulated,
      vl.last_ping_at,
      u.id AS driver_id,
      u.name AS driver_name,
      u.email AS driver_email
    FROM vehicles v
    LEFT JOIN vehicle_locations vl ON v.vehicle_id = vl.vehicle_id
    LEFT JOIN rider_assignments ra ON v.vehicle_id = ra.vehicle_id
    LEFT JOIN users u ON COALESCE(vl.driver_id, ra.user_id) = u.id
    ORDER BY v.vehicle_id ASC
  `).all();
}

/**
 * Get recent breadcrumb trail coordinates for a vehicle.
 */
function getVehicleLocationTrail(vehicleId, options = 200) {
  const database = getDb();
  let limit = 500;
  let sessionId = null;

  if (typeof options === "number") {
    limit = options;
  } else if (typeof options === "object" && options !== null) {
    limit = Number(options.limit) || 500;
    sessionId = options.session_id || options.sessionId || null;
  }

  // Look up active or most recent session for this vehicle if not explicitly supplied
  if (!sessionId) {
    const active = database.prepare(`
      SELECT session_id FROM tracking_sessions
      WHERE vehicle_id = ? AND status = 'active'
      ORDER BY created_at DESC LIMIT 1
    `).get(vehicleId);

    if (active) {
      sessionId = active.session_id;
    } else {
      const recent = database.prepare(`
        SELECT session_id FROM tracking_sessions
        WHERE vehicle_id = ?
        ORDER BY created_at DESC LIMIT 1
      `).get(vehicleId);
      sessionId = recent ? recent.session_id : null;
    }
  }

  let rows = [];
  if (sessionId) {
    rows = database.prepare(`
      SELECT id, session_id, vehicle_id, latitude, longitude, accuracy, speed, heading,
             deviation_distance_m, is_deviated, is_simulated, recorded_at
      FROM gps_location_history
      WHERE vehicle_id = ? AND session_id = ?
      ORDER BY recorded_at ASC, id ASC
      LIMIT ?
    `).all(vehicleId, sessionId, Math.min(Number(limit) || 500, 2000));
  } else {
    rows = database.prepare(`
      SELECT id, session_id, vehicle_id, latitude, longitude, accuracy, speed, heading,
             deviation_distance_m, is_deviated, is_simulated, recorded_at
      FROM gps_location_history
      WHERE vehicle_id = ?
      ORDER BY recorded_at ASC, id ASC
      LIMIT ?
    `).all(vehicleId, Math.min(Number(limit) || 500, 2000));
  }

  // Filter invalid coordinates and poor accuracy readings (> 50m) to preserve clean polylines
  return rows.filter((r) => {
    const lat = Number(r.latitude);
    const lon = Number(r.longitude);
    const acc = Number(r.accuracy);
    return (
      isValidCoordinate(lat, lon, false) &&
      (acc === null || acc === undefined || Number.isNaN(acc) || acc <= 50)
    );
  });
}

/**
 * Cache for intermediate planned road geometry.
 */
const plannedRoadGeometryCache = new Map();

let defaultRoadCorridor = [];
try {
  defaultRoadCorridor = require("../data/defaultRoadCorridor.json");
} catch (_) {}

let cachedRouteGeometries = {};
try {
  cachedRouteGeometries = require("../data/cachedRouteGeometries.json");
} catch (_) {}

/**
 * Checks whether a vehicle ID belongs to a simulated vehicle.
 */
function isSimulatedVehicle(vehicleId) {
  if (!vehicleId) return false;
  if (String(vehicleId).startsWith("SIM")) return true;
  try {
    const loc = getVehicleLocation(vehicleId);
    return Boolean(loc && loc.is_simulated);
  } catch (_) {
    return false;
  }
}

/**
 * Get planned route stops and coordinates for a vehicle from the latest optimization run.
 * Always resolves full physical road geometry so vehicles strictly follow streets.
 */
function getPlannedRouteForVehicle(vehicleId) {
  const database = getDb();
  const latestRun = database.prepare(`
    SELECT run_id, routes, result_json FROM optimization_runs ORDER BY created_at DESC LIMIT 1
  `).get();

  const depot = { delivery_id: 'DEPOT', location: 'PathWise Central Depot', latitude: 21.145, longitude: 79.088 };

  // 1. If pre-cached OSRM road geometry is available for this vehicle:
  if (cachedRouteGeometries[vehicleId] && Array.isArray(cachedRouteGeometries[vehicleId].waypoints) && cachedRouteGeometries[vehicleId].waypoints.length >= 2) {
    const cached = cachedRouteGeometries[vehicleId];
    return {
      vehicle_id: vehicleId,
      run_id: cached.run_id || latestRun?.run_id || null,
      stops: (cached.stops || []).map((id) => (id === 'DEPOT' ? depot : { delivery_id: id, location: id, latitude: 21.145, longitude: 79.088 })),
      waypoints: cached.waypoints,
      road_geometry: cached.road_geometry || cached.waypoints,
      geometry_source: 'osrm',
    };
  }

  // 2. If it is a simulated vehicle (SIM-01, SIM-02, etc.):
  if (isSimulatedVehicle(vehicleId)) {
    return {
      vehicle_id: vehicleId,
      run_id: latestRun?.run_id || null,
      stops: [
        depot,
        { delivery_id: 'D-LOOP', location: 'Nagpur Central Delivery Loop', latitude: 21.161155, longitude: 79.104245 },
        depot,
      ],
      waypoints: defaultRoadCorridor && defaultRoadCorridor.length >= 2 ? defaultRoadCorridor : [[21.145, 79.088]],
      road_geometry: defaultRoadCorridor && defaultRoadCorridor.length >= 2 ? defaultRoadCorridor : [[21.145, 79.088]],
      geometry_source: 'road_corridor_default',
    };
  }

  if (!latestRun || !latestRun.routes) {
    return {
      vehicle_id: vehicleId,
      run_id: null,
      stops: [depot],
      waypoints: defaultRoadCorridor && defaultRoadCorridor.length >= 2 ? defaultRoadCorridor : [[21.145, 79.088]],
      road_geometry: defaultRoadCorridor && defaultRoadCorridor.length >= 2 ? defaultRoadCorridor : [[21.145, 79.088]],
      geometry_source: 'road_corridor_default',
    };
  }

  let assignedRoute = null;
  try {
    const routes = JSON.parse(latestRun.routes);
    assignedRoute = routes.find((r) => r.vehicle_id === vehicleId);
  } catch (_) {}

  if (!assignedRoute || !Array.isArray(assignedRoute.route)) {
    return {
      vehicle_id: vehicleId,
      run_id: latestRun.run_id,
      stops: [depot],
      waypoints: defaultRoadCorridor && defaultRoadCorridor.length >= 2 ? defaultRoadCorridor : [[21.145, 79.088]],
      road_geometry: defaultRoadCorridor && defaultRoadCorridor.length >= 2 ? defaultRoadCorridor : [[21.145, 79.088]],
      geometry_source: 'road_corridor_default',
    };
  }

  const stopIds = assignedRoute.route;
  const deliveryPlaceholders = stopIds.filter((s) => s !== 'DEPOT');
  let deliveries = [];
  if (deliveryPlaceholders.length > 0) {
    const ph = deliveryPlaceholders.map(() => '?').join(',');
    deliveries = database.prepare(`SELECT delivery_id, recipient_name, location, latitude, longitude, priority, status FROM deliveries WHERE delivery_id IN (${ph})`).all(...deliveryPlaceholders);
  }
  const delivMap = new Map(deliveries.map((d) => [d.delivery_id, d]));

  const stops = stopIds.map((id) => {
    if (id === 'DEPOT') return depot;
    const d = delivMap.get(id);
    return d || { delivery_id: id, location: id, latitude: 21.145, longitude: 79.088 };
  });

  const stopWaypoints = stops.map((s) => [Number(s.latitude), Number(s.longitude)]);

  // Check if we have cached intermediate road geometry for this vehicle & run
  const cacheKey = `${vehicleId}_${latestRun.run_id}_${stopIds.join(',')}`;
  const cached = plannedRoadGeometryCache.get(cacheKey);

  const waypoints = cached && cached.waypoints && cached.waypoints.length >= 2
    ? cached.waypoints
    : (defaultRoadCorridor && defaultRoadCorridor.length >= 2 ? defaultRoadCorridor : stopWaypoints);

  return {
    vehicle_id: vehicleId,
    run_id: latestRun.run_id,
    route_details: assignedRoute,
    stops,
    waypoints,
    road_geometry: waypoints,
    geometry_source: cached?.geometry_source || (waypoints === defaultRoadCorridor ? 'road_corridor_default' : 'stop_sequence'),
  };
}

/**
 * Resolves complete road network geometry for a vehicle using routeGeometryService and caches it.
 */
async function getPlannedRouteWithRoadGeometry(vehicleId) {
  const base = getPlannedRouteForVehicle(vehicleId);
  if (!base) return base;

  // If base already contains dense physical road coordinates (>= 20 points), return immediately
  if (base.waypoints && base.waypoints.length >= 20) {
    return base;
  }

  if (!base.stops || base.stops.length < 2) {
    return {
      ...base,
      waypoints: defaultRoadCorridor && defaultRoadCorridor.length >= 2 ? defaultRoadCorridor : base.waypoints,
      road_geometry: defaultRoadCorridor && defaultRoadCorridor.length >= 2 ? defaultRoadCorridor : base.road_geometry,
      geometry_source: 'road_corridor_default',
    };
  }

  const cacheKey = `${vehicleId}_${base.run_id}_${base.stops.map(s => s.delivery_id).join(',')}`;
  if (plannedRoadGeometryCache.has(cacheKey)) {
    const cached = plannedRoadGeometryCache.get(cacheKey);
    return {
      ...base,
      waypoints: cached.waypoints,
      road_geometry: cached.road_geometry,
      geometry_source: cached.geometry_source,
    };
  }

  const stopCoords = base.stops.map((s) => [Number(s.latitude), Number(s.longitude)]);

  try {
    const { fetchRoadGeometry } = require("./routeGeometryService");
    const geomResult = await fetchRoadGeometry(stopCoords);

    const roadCoords = (geomResult && Array.isArray(geomResult.coordinates) && geomResult.coordinates.length >= 20)
      ? geomResult.coordinates
      : (defaultRoadCorridor && defaultRoadCorridor.length >= 2 ? defaultRoadCorridor : stopCoords);

    const source = geomResult?.source === 'osrm' ? 'osrm' : 'road_corridor_default';

    plannedRoadGeometryCache.set(cacheKey, {
      waypoints: roadCoords,
      road_geometry: roadCoords,
      geometry_source: source,
    });

    return {
      ...base,
      waypoints: roadCoords,
      road_geometry: roadCoords,
      geometry_source: source,
    };
  } catch (_) {
    return {
      ...base,
      waypoints: defaultRoadCorridor && defaultRoadCorridor.length >= 2 ? defaultRoadCorridor : base.waypoints,
      road_geometry: defaultRoadCorridor && defaultRoadCorridor.length >= 2 ? defaultRoadCorridor : base.road_geometry,
      geometry_source: 'road_corridor_default',
    };
  }
}


/**
 * Creates or registers a simulated vehicle.
 */
function createSimulatedVehicle({ vehicle_id, manufacturer, model, configured_capacity_kg, driver_name }) {
  const database = getDb();
  const now = new Date().toISOString();
  const vId = vehicle_id || ("SIM-" + Math.random().toString(36).substring(2, 6).toUpperCase());

  const existing = database.prepare("SELECT * FROM vehicles WHERE vehicle_id = ?").get(vId);
  if (!existing) {
    database.prepare(`
      INSERT INTO vehicles (
        vehicle_id, manufacturer, model, variant, vehicle_class, fuel_type,
        registration_identifier, configured_capacity_kg, availability,
        operational_status, is_demo, created_at, updated_at
      ) VALUES (?, ?, ?, 'Simulation', 'van', 'Electric', ?, ?, 1, 'available', 1, ?, ?)
    `).run(
      vId,
      manufacturer || "Simulated Fleet",
      model || "Virtual Cargo EV",
      "SIM-" + vId,
      Number(configured_capacity_kg) || 500,
      now,
      now
    );
  }

  // Create simulated driver user if driver_name provided
  const dName = driver_name || ("Sim Driver (" + vId + ")");
  const driverEmail = "sim." + vId.toLowerCase() + "@pathwise.internal";
  let driverUser = database.prepare("SELECT * FROM users WHERE email = ?").get(driverEmail);
  if (!driverUser) {
    const res = database.prepare(`
      INSERT INTO users (name, email, password_hash, role, created_at)
      VALUES (?, ?, 'simulated_hash', 'rider', ?)
    `).run(dName, driverEmail, now);
    driverUser = { id: res.lastInsertRowid, name: dName, email: driverEmail };
  }

  // Assign driver to vehicle
  assignRiderToVehicle(driverUser.id, vId);

  // Initialize location record as simulated
  database.prepare(`
    INSERT INTO vehicle_locations (
      vehicle_id, driver_id, latitude, longitude, accuracy, speed, heading,
      tracking_status, is_deviated, deviation_distance_m, consecutive_deviations, is_simulated, last_ping_at
    )
    VALUES (?, ?, 21.145, 79.088, 5, 0, 0, 'idle', 0, 0, 0, 1, ?)
    ON CONFLICT(vehicle_id) DO UPDATE SET
      driver_id = excluded.driver_id,
      is_simulated = 1,
      last_ping_at = excluded.last_ping_at
  `).run(vId, driverUser.id, now);

  return {
    vehicle_id: vId,
    driver: driverUser,
    is_simulated: 1,
    status: "created",
  };
}

/**
 * Returns available planned routes from optimization runs suitable for simulation.
 */
function getAvailableSimulationRoutes() {
  const database = getDb();
  const runs = database.prepare(`
    SELECT run_id, created_at, total_cost, routes
    FROM optimization_runs
    ORDER BY created_at DESC
    LIMIT 10
  `).all();

  const results = [];
  const depot = { delivery_id: "DEPOT", location: "Nagpur Central Depot", latitude: 21.145, longitude: 79.088 };

  for (const r of runs) {
    try {
      const parsedRoutes = JSON.parse(r.routes || "[]");
      for (const pr of parsedRoutes) {
        if (pr && Array.isArray(pr.route) && pr.route.length > 0) {
          const stopIds = pr.route.filter((s) => s !== "DEPOT");
          let deliveries = [];
          if (stopIds.length > 0) {
            const ph = stopIds.map(() => "?").join(",");
            deliveries = database.prepare(`SELECT delivery_id, location, latitude, longitude FROM deliveries WHERE delivery_id IN (${ph})`).all(...stopIds);
          }
          const delivMap = new Map(deliveries.map((d) => [d.delivery_id, d]));

          const stopCoords = pr.route.map((id) => {
            if (id === "DEPOT") return [depot.latitude, depot.longitude];
            const d = delivMap.get(id);
            return d ? [Number(d.latitude), Number(d.longitude)] : [depot.latitude, depot.longitude];
          });

          // Look up complete physical road geometry from cache or default corridor
          const cachedRoute = cachedRouteGeometries[pr.vehicle_id];
          const roadPoints = (cachedRoute && Array.isArray(cachedRoute.waypoints) && cachedRoute.waypoints.length >= 2)
            ? cachedRoute.waypoints
            : (defaultRoadCorridor && defaultRoadCorridor.length >= 2 ? defaultRoadCorridor : stopCoords);

          results.push({
            run_id: r.run_id,
            vehicle_id: pr.vehicle_id,
            created_at: r.created_at,
            route: pr.route,
            stop_count: pr.route.length,
            load: pr.load,
            capacity: pr.capacity,
            cost: pr.cost,
            waypoints: roadPoints,
            road_geometry: roadPoints,
            stop_coordinates: stopCoords,
          });
        }
      }
    } catch (_) {}
  }

  return results;
}


/**
 * Records a route deviation event in SQLite.
 * If an active event already exists for this vehicle, updates its latest distance,
 * consecutive pings, and coordinates without creating duplicate active records.
 */
function recordDeviationEvent({
  vehicle_id,
  driver_id = null,
  session_id = null,
  run_id = null,
  deviation_distance_m,
  threshold_m = 100,
  consecutive_pings = 3,
  latitude,
  longitude,
  is_simulated = 0,
}) {
  const database = getDb();
  const now = new Date().toISOString();

  // Check for existing active deviation event for this vehicle
  const existingActive = database
    .prepare(
      `SELECT * FROM route_deviation_events WHERE vehicle_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`
    )
    .get(vehicle_id);

  if (existingActive) {
    database
      .prepare(
        `UPDATE route_deviation_events
         SET deviation_distance_m = ?, consecutive_pings = ?, latitude = ?, longitude = ?
         WHERE event_id = ?`
      )
      .run(
        Number(deviation_distance_m),
        Number(consecutive_pings),
        Number(latitude),
        Number(longitude),
        existingActive.event_id
      );

    return {
      event_id: existingActive.event_id,
      vehicle_id,
      driver_id: existingActive.driver_id,
      deviation_distance_m: Number(deviation_distance_m),
      consecutive_pings: Number(consecutive_pings),
      status: "active",
      is_new_record: false,
      created_at: existingActive.created_at,
    };
  }

  // Insert fresh active deviation event
  const event_id = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  database
    .prepare(
      `INSERT INTO route_deviation_events (
        event_id, vehicle_id, driver_id, session_id, run_id,
        deviation_distance_m, threshold_m, consecutive_pings,
        latitude, longitude, status, created_at, is_simulated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
    )
    .run(
      event_id,
      vehicle_id,
      driver_id,
      session_id,
      run_id,
      Number(deviation_distance_m),
      Number(threshold_m),
      Number(consecutive_pings),
      Number(latitude),
      Number(longitude),
      now,
      is_simulated ? 1 : 0
    );

  return {
    event_id,
    vehicle_id,
    driver_id,
    session_id,
    run_id,
    deviation_distance_m: Number(deviation_distance_m),
    threshold_m: Number(threshold_m),
    consecutive_pings: Number(consecutive_pings),
    latitude: Number(latitude),
    longitude: Number(longitude),
    status: "active",
    is_new_record: true,
    created_at: now,
  };
}

/**
 * Resolves active deviation events for a vehicle when it returns to route corridor.
 */
function resolveDeviationEvent(vehicle_id) {
  const database = getDb();
  const now = new Date().toISOString();

  const info = database
    .prepare(
      `UPDATE route_deviation_events
       SET status = 'resolved', resolved_at = ?
       WHERE vehicle_id = ? AND status = 'active'`
    )
    .run(now, vehicle_id);

  return {
    vehicle_id,
    resolved_count: info.changes,
    resolved_at: now,
  };
}

/**
 * Gets the current active deviation event for a vehicle, if any.
 */
function getActiveDeviationEvent(vehicle_id) {
  const database = getDb();
  return (
    database
      .prepare(
        `SELECT * FROM route_deviation_events WHERE vehicle_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`
      )
      .get(vehicle_id) || null
  );
}

/**
 * Lists recorded deviation events with optional vehicle filtering.
 */
function listDeviationEvents({ vehicle_id = null, limit = 50 } = {}) {
  const database = getDb();
  if (vehicle_id) {
    return database
      .prepare(
        `SELECT * FROM route_deviation_events WHERE vehicle_id = ? ORDER BY created_at DESC LIMIT ?`
      )
      .all(vehicle_id, Math.min(Number(limit) || 50, 200));
  }
  return database
    .prepare(
      `SELECT * FROM route_deviation_events ORDER BY created_at DESC LIMIT ?`
    )
    .all(Math.min(Number(limit) || 50, 200));
}

module.exports = {
  getDb,
  dbPath,
  saveOptimizationRun,
  getOptimizationHistory,
  getOptimizationRunById,
  saveReroutingEvent,
  getReroutingHistory,
  clearHistory,
  closeDb,
  findUserByEmail,
  findUserById,
  createUser,
  assignRiderToVehicle,
  getRiderAssignments,
  getRiderByVehicleId,
  deleteRiderAssignment,
  listDeliveries, getDelivery, saveDelivery, deleteDelivery, updateDeliveryStatus,
  listVehicles, getVehicle, saveVehicle, deleteVehicle, seedDemoData,
  getDashboardStats, getOptimizationInputFromDatabase, listRiders,
  startTrackingSession,
  stopTrackingSession,
  recordGpsPing,
  getVehicleLocation,
  getAllVehicleLocations,
  getVehicleLocationTrail,
  getPlannedRouteForVehicle,
  getPlannedRouteWithRoadGeometry,
  createSimulatedVehicle,
  getAvailableSimulationRoutes,
  recordDeviationEvent,
  resolveDeviationEvent,
  getActiveDeviationEvent,
  listDeviationEvents,
};
