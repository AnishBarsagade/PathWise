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
  `);

  // Migration for existing databases:
  // Older PathWise databases do not have the "name" column.
  const columns = database.prepare(`PRAGMA table_info(users)`).all();

  const hasNameColumn = columns.some((column) => column.name === "name");

  if (!hasNameColumn) {
    database.exec(`ALTER TABLE users ADD COLUMN name TEXT`);
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

  const deliveries = database.prepare(`
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
  listDeliveries, getDelivery, saveDelivery, deleteDelivery,
  listVehicles, getVehicle, saveVehicle, deleteVehicle, seedDemoData,
  getDashboardStats, getOptimizationInputFromDatabase,
};
