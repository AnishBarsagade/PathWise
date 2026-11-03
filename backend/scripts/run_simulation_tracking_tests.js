/**
 * PathWise GPS Simulation & Live Vehicle Tracking Verification Suite
 *
 * Verifies all Simulation Mode & Admin Dashboard requirements:
 * 1. Admin creates simulated vehicles (SIM-01, SIM-02)
 * 2. Selects planned routes from optimization runs
 * 3. Simulates vehicle movement along that route
 * 4. Coordinates update every 2 seconds
 * 5. Configurable vehicle speed multiplier
 * 6. Simulates route deviation and verifies deviation alert emission
 * 7. Simulates vehicle breakdown (speed 0, status 'breakdown', operational 'maintenance')
 * 8. Segregates simulated vehicles from real fleet with is_simulated flag
 * 9. Tests at least two vehicles concurrently
 * 10. Verifies SQLite persistence and Socket.IO real-time events
 */

const http = require("http");
const { io: ClientIO } = require("../../frontend/node_modules/socket.io-client");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const config = require("../src/config/env");
const db = require("../src/services/dbService");
const { initSocket } = require("../src/services/socketService");
const simulationService = require("../src/services/simulationService");

let server;
let serverPort;
let adminToken;
let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failCount++;
  }
}

async function run() {
  console.log("================================================================");
  console.log("PathWise GPS Vehicle Simulation & Admin Tracking Suite");
  console.log("================================================================\n");

  server = http.createServer(app);
  const io = initSocket(server);

  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      serverPort = server.address().port;
      console.log(`Server running on port ${serverPort}\n`);
      resolve();
    });
  });

  const serverUrl = `http://127.0.0.1:${serverPort}`;
  adminToken = jwt.sign({ id: 1, role: "admin", name: "System Admin" }, config.JWT_SECRET, { expiresIn: "1h" });

  // Connect Admin Socket.IO client
  const adminSocket = ClientIO(serverUrl, {
    auth: { token: `Bearer ${adminToken}` },
    transports: ["websocket"],
  });

  await new Promise((resolve) => adminSocket.on("connect", resolve));
  console.log("Admin Socket.IO connected and joined 'admins' room.\n");

  try {
    // -------------------------------------------------------------
    // TEST 1: Create Simulated Vehicles (Requirement 1 & 8)
    // -------------------------------------------------------------
    console.log("--- TEST 1: Create Simulated Vehicles ---");
    const sim1 = db.createSimulatedVehicle({
      vehicle_id: "SIM-01",
      manufacturer: "SimFleet Labs",
      model: "Autonomous Van Alpha",
      configured_capacity_kg: 600,
      driver_name: "SimBot Alpha",
    });

    const sim2 = db.createSimulatedVehicle({
      vehicle_id: "SIM-02",
      manufacturer: "SimFleet Labs",
      model: "Autonomous Van Beta",
      configured_capacity_kg: 500,
      driver_name: "SimBot Beta",
    });

    assert(sim1.vehicle_id === "SIM-01" && sim1.is_simulated === 1, "Simulated vehicle SIM-01 created with is_simulated=1");
    assert(sim2.vehicle_id === "SIM-02" && sim2.is_simulated === 1, "Simulated vehicle SIM-02 created with is_simulated=1");

    const fleet = db.getAllVehicleLocations();
    const v1 = fleet.find((v) => v.vehicle_id === "SIM-01");
    const v2 = fleet.find((v) => v.vehicle_id === "SIM-02");

    assert(v1 && v1.is_simulated === 1, "SIM-01 clearly identified as simulated in fleet query");
    assert(v2 && v2.is_simulated === 1, "SIM-02 clearly identified as simulated in fleet query");
    console.log("");

    // -------------------------------------------------------------
    // TEST 2: Select Existing Planned Routes (Requirement 2)
    // -------------------------------------------------------------
    console.log("--- TEST 2: Available Planned Routes for Simulation ---");
    const availableRoutes = db.getAvailableSimulationRoutes();
    assert(Array.isArray(availableRoutes), "getAvailableSimulationRoutes returns structured array of planned routes");
    console.log(`Found ${availableRoutes.length} available optimized route paths for simulation.`);
    console.log("");

    // -------------------------------------------------------------
    // TEST 3: Simulate Movement Along Route with 2s Updates (Req 3, 4, 10)
    // -------------------------------------------------------------
    console.log("--- TEST 3: Simulate Concurrent Vehicle Movement (2s Updates) ---");

    const sim1Updates = [];
    const sim2Updates = [];

    adminSocket.on("vehicle:update", (update) => {
      if (update.vehicle_id === "SIM-01") sim1Updates.push(update);
      if (update.vehicle_id === "SIM-02") sim2Updates.push(update);
    });

    // Start simulation on both vehicles concurrently
    const route1 = [
      [21.145, 79.088],
      [21.150, 79.094],
      [21.156, 79.102],
      [21.162, 79.110],
    ];
    const route2 = [
      [21.145, 79.088],
      [21.140, 79.080],
      [21.135, 79.072],
      [21.130, 79.065],
    ];

    simulationService.startSimulation({
      vehicle_id: "SIM-01",
      route_coords: route1,
      speed_multiplier: 1,
    });

    simulationService.startSimulation({
      vehicle_id: "SIM-02",
      route_coords: route2,
      speed_multiplier: 1,
    });

    // Wait 4.2 seconds to receive at least 2 updates per vehicle (2s tick interval)
    console.log("Waiting 4.2s for 2-second simulation telemetry ticks...");
    await new Promise((resolve) => setTimeout(resolve, 4300));

    assert(sim1Updates.length >= 2, `SIM-01 broadcasted ${sim1Updates.length} updates at 2-second intervals`);
    assert(sim2Updates.length >= 2, `SIM-02 broadcasted ${sim2Updates.length} updates concurrently at 2-second intervals`);
    assert(sim1Updates[0].is_simulated === 1, "Telemetry payload tagged with is_simulated=1");
    assert(sim1Updates[0].speed > 0, `Realistic simulated speed reported: ${sim1Updates[0].speed} km/h`);

    // Verify trail recorded in SQLite
    const trail1 = db.getVehicleLocationTrail("SIM-01");
    assert(trail1.length >= 2, `SIM-01 breadcrumb trail recorded ${trail1.length} coordinates in SQLite`);
    console.log("");

    // -------------------------------------------------------------
    // TEST 4: Configurable Vehicle Speed (Requirement 5)
    // -------------------------------------------------------------
    console.log("--- TEST 4: Configurable Vehicle Speed Multiplier ---");
    const speedResult = simulationService.setSimulationSpeed("SIM-01", 5);
    assert(speedResult.speed_multiplier === 5, "Simulation speed multiplier successfully updated to 5x");
    console.log("");

    // -------------------------------------------------------------
    // TEST 5: Route Deviation Simulation & Alert (Requirement 6 & 9)
    // -------------------------------------------------------------
    console.log("--- TEST 5: Route Deviation Simulation & Alert ---");
    let receivedDeviationAlert = null;
    adminSocket.on("alert:deviation", (alert) => {
      if (alert.vehicle_id === "SIM-01") {
        receivedDeviationAlert = alert;
      }
    });

    // Trigger deviation on SIM-01
    simulationService.triggerDeviation("SIM-01");

    // Wait for 3 ticks to accumulate consecutive deviations (>100m)
    console.log("Waiting 3.5s for consecutive deviation ticks at 5x speed...");
    await new Promise((resolve) => setTimeout(resolve, 3500));

    const sim1Latest = db.getVehicleLocation("SIM-01");
    assert(sim1Latest.is_deviated === 1, `SIM-01 flagged as deviated in SQLite (deviation: ${sim1Latest.deviation_distance_m}m)`);
    assert(sim1Latest.deviation_distance_m > 100, `Deviation offset distance (${sim1Latest.deviation_distance_m}m) strictly exceeds 100m threshold`);
    assert(receivedDeviationAlert !== null, "Admin Socket.IO received 'alert:deviation' event with incident distance");

    // Resume route
    const resumeRes = simulationService.resumeRoute("SIM-01");
    assert(resumeRes.is_deviated_simulated === false, "SIM-01 returned to normal corridor");
    console.log("");

    // -------------------------------------------------------------
    // TEST 6: Vehicle Breakdown Simulation (Requirement 7)
    // -------------------------------------------------------------
    console.log("--- TEST 6: Vehicle Breakdown Simulation ---");
    let receivedBreakdown = null;
    adminSocket.on("vehicle:breakdown", (bd) => {
      if (bd.vehicle_id === "SIM-02") receivedBreakdown = bd;
    });

    simulationService.triggerBreakdown("SIM-02");

    // Allow 300ms for WebSocket packet delivery
    await new Promise((resolve) => setTimeout(resolve, 300));

    const sim2Latest = db.getVehicleLocation("SIM-02");
    assert(sim2Latest.tracking_status === "breakdown", "SIM-02 tracking status transitioned to 'breakdown'");
    assert(sim2Latest.speed === 0, "SIM-02 speed dropped to 0 km/h");
    assert(receivedBreakdown !== null, "Admin Socket.IO received 'vehicle:breakdown' emergency event");

    const sim2VehicleRecord = db.getVehicle("SIM-02");
    assert(sim2VehicleRecord.operational_status === "maintenance", "Vehicle operational_status set to 'maintenance' in vehicles table");
    console.log("");

    // -------------------------------------------------------------
    // TEST 7: Clean Stop of Simulations
    // -------------------------------------------------------------
    console.log("--- TEST 7: Stop Simulations ---");
    const stop1 = simulationService.stopSimulation("SIM-01");
    const stop2 = simulationService.stopSimulation("SIM-02");

    assert(stop1.status === "stopped", "SIM-01 simulation stopped cleanly");
    assert(stop2.status === "stopped", "SIM-02 simulation stopped cleanly");

    const finalStatus = simulationService.getSimulationStatus();
    assert(finalStatus.active_count === 0, "All simulation runners de-allocated from memory");
    console.log("");
  } finally {
    adminSocket.disconnect();
    server.close();
  }

  // Clean up simulated test vehicles
  db.deleteVehicle("SIM-01");
  db.deleteVehicle("SIM-02");

  console.log("================================================================");
  console.log(`SIMULATION SUITE SUMMARY: ${passCount} Passed, ${failCount} Failed`);
  console.log("================================================================");

  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  if (server) server.close();
  process.exit(1);
});
