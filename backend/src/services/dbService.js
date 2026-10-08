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
    result: row.result_json ? JSON.parse(row.result_json) : {},
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
};
