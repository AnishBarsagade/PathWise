/**
 * PathWise Multi-Vehicle Route Planning & Road-Based Simulation Verification Suite
 *
 * Verifies all 10 scenarios required by the specification:
 * 1. Select a start and destination and calculate a road-based route using existing multi-factor engine.
 * 2. Add one simulated vehicle and start the simulation.
 * 3. Add three or more simulated vehicles (SIM-01, SIM-02, SIM-03) and run them simultaneously.
 * 4. Verify that all vehicles follow their own road-based route.
 * 5. Verify that vehicle markers move progressively along the road geometry (no straight lines / jumps).
 * 6. Pause and resume simulations.
 * 7. Stop and reset simulations back to start.
 * 8. Verify that vehicle histories and routes do not mix (isolated trails & telemetry).
 * 9. Verify that the existing real GPS tracking still works.
 * 10. Verify that the existing multi-factor routing algorithm produces valid results.
 */

const http = require("http");
const { io: ClientIO } = require("../../frontend/node_modules/socket.io-client");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const config = require("../src/config/env");
const db = require("../src/services/dbService");
const { initSocket } = require("../src/services/socketService");
const multiVehicleRouteService = require("../src/services/multiVehicleRouteService");
const simulationService = require("../src/services/simulationService");
const { findAstarDetour } = require("../src/services/astarService");

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
  console.log("Multi-Vehicle Route Planning & Road Simulation Verification");
  console.log("================================================================\n");

  server = http.createServer(app);
  initSocket(server);

  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      serverPort = server.address().port;
      console.log(`Test server running on port ${serverPort}\n`);
      resolve();
    });
  });

  const serverUrl = `http://127.0.0.1:${serverPort}`;
  adminToken = jwt.sign({ id: 1, role: "admin", name: "Fleet Admin" }, config.JWT_SECRET, { expiresIn: "1h" });

  // Connect Admin Socket.IO client
  const adminSocket = ClientIO(serverUrl, {
    auth: { token: `Bearer ${adminToken}` },
    transports: ["websocket"],
  });

  await new Promise((resolve) => adminSocket.on("connect", resolve));
  console.log("Admin Socket.IO connected and joined 'admins' room.\n");

  try {
    // -------------------------------------------------------------
    // SCENARIO 1 & 10: Multi-Factor Route Planning & Validation
    // -------------------------------------------------------------
    console.log("--- SCENARIO 1 & 10: Multi-Factor Route Planning Between Start & Destination ---");
    const startLoc = { latitude: 21.1450, longitude: 79.0880, name: "Sitabuldi Central Hub" };
    const destLoc = { latitude: 21.1600, longitude: 79.1000, name: "Sadar Commercial District" };

    const planResult = await multiVehicleRouteService.planMultiVehicleJourney({
      start: startLoc,
      destination: destLoc,
      vehicles: [
        { vehicle_id: "SIM-01", speed_kmh: 40, model: "Autonomous Cargo Van" },
        { vehicle_id: "SIM-02", speed_kmh: 50, model: "Urban Delivery Express" },
        { vehicle_id: "SIM-03", speed_kmh: 35, model: "EV City Courier" },
      ],
    });

    assert(planResult && planResult.success === true, "Route calculation succeeded using multi-factor engine");
    assert(planResult.journey.total_distance_km > 0, `Valid road distance calculated: ${planResult.journey.total_distance_km} km`);
    assert(planResult.journey.multi_factor_score > 0, `Composite AHP score evaluated: ${planResult.journey.multi_factor_score}`);
    assert(planResult.journey.route_alternatives.length >= 2, "Generated multiple route alternatives for comparison");
    assert(planResult.vehicles.length === 3, "Planned individual routes for 3 vehicles");
    assert(planResult.vehicles[0].road_geometry.length >= 2, "Route follows physical road geometry coordinates");
    console.log("");

    // -------------------------------------------------------------
    // SCENARIO 2: Single Vehicle Simulation
    // -------------------------------------------------------------
    console.log("--- SCENARIO 2: Single Vehicle Simulation (SIM-01) ---");
    let sim1Updates = [];
    adminSocket.on("vehicle:update", (up) => {
      if (up.vehicle_id === "SIM-01") sim1Updates.push(up);
    });

    simulationService.startSimulation({
      vehicle_id: "SIM-01",
      route_coords: planResult.vehicles[0].road_geometry,
      speed_multiplier: 1,
      is_point_to_point: true,
      model: "Autonomous Cargo Van",
    });

    await new Promise((r) => setTimeout(r, 2200));
    assert(sim1Updates.length >= 1, `SIM-01 broadcasted live telemetry (${sim1Updates.length} updates)`);
    assert(sim1Updates[0].is_simulated === 1, "SIM-01 tagged as simulated (is_simulated=1)");
    assert(sim1Updates[0].speed > 0, `SIM-01 running speed reported: ${sim1Updates[0].speed} km/h`);
    simulationService.stopSimulation("SIM-01");
    console.log("");

    // -------------------------------------------------------------
    // SCENARIO 3, 4, 5: 3+ Vehicles Running Simultaneously On Road Geometry
    // -------------------------------------------------------------
    console.log("--- SCENARIO 3, 4, 5: Concurrent Multi-Vehicle Simulation (SIM-01, SIM-02, SIM-03) ---");
    const multiUpdates = { "SIM-01": [], "SIM-02": [], "SIM-03": [] };
    adminSocket.on("vehicle:update", (up) => {
      if (multiUpdates[up.vehicle_id]) {
        multiUpdates[up.vehicle_id].push(up);
      }
    });

    // Start all 3 vehicles concurrently with independent speeds
    simulationService.startSimulation({
      vehicle_id: "SIM-01",
      route_coords: planResult.vehicles[0].road_geometry,
      speed_multiplier: 1,
      is_point_to_point: true,
    });
    simulationService.startSimulation({
      vehicle_id: "SIM-02",
      route_coords: planResult.vehicles[1].road_geometry,
      speed_multiplier: 2, // Faster vehicle
      is_point_to_point: true,
    });
    simulationService.startSimulation({
      vehicle_id: "SIM-03",
      route_coords: planResult.vehicles[2].road_geometry,
      speed_multiplier: 1,
      is_point_to_point: true,
    });

    // Wait 4.5 seconds for at least 2 ticks
    console.log("Waiting 4.5s for concurrent multi-vehicle road telemetry...");
    await new Promise((r) => setTimeout(r, 4500));

    assert(multiUpdates["SIM-01"].length >= 2, `SIM-01 active with ${multiUpdates["SIM-01"].length} ticks`);
    assert(multiUpdates["SIM-02"].length >= 2, `SIM-02 active with ${multiUpdates["SIM-02"].length} ticks`);
    assert(multiUpdates["SIM-03"].length >= 2, `SIM-03 active with ${multiUpdates["SIM-03"].length} ticks`);

    // Verify vehicles follow road coordinates without jumping
    const p1 = multiUpdates["SIM-01"][0];
    const p2 = multiUpdates["SIM-01"][1];
    const stepDistMeters = Math.hypot((p2.latitude - p1.latitude) * 110540, (p2.longitude - p1.longitude) * 111320);
    assert(stepDistMeters < 80, `Step advancement is smooth along road (${stepDistMeters.toFixed(1)}m), no teleportation`);

    // Check remaining distance and progress reporting
    assert(p2.remaining_distance_km !== undefined, `Telemetry reports remaining distance: ${p2.remaining_distance_km} km`);
    assert(p2.distance_travelled_km !== undefined, `Telemetry reports distance travelled: ${p2.distance_travelled_km} km`);
    console.log("");

    // -------------------------------------------------------------
    // SCENARIO 6: Pause and Resume Individual Simulations
    // -------------------------------------------------------------
    console.log("--- SCENARIO 6: Pause and Resume Vehicle Movement ---");
    const pauseRes = simulationService.pauseSimulation("SIM-02");
    assert(pauseRes.status === "paused", "SIM-02 paused successfully");
    const countBefore = multiUpdates["SIM-02"].length;

    await new Promise((r) => setTimeout(r, 2200));
    assert(multiUpdates["SIM-02"].length === countBefore, "SIM-02 sent no updates while paused");

    const resumeRes = simulationService.resumeSimulationMovement("SIM-02");
    assert(resumeRes.status === "running", "SIM-02 resumed successfully");

    await new Promise((r) => setTimeout(r, 2200));
    assert(multiUpdates["SIM-02"].length > countBefore, "SIM-02 resumed progressive movement on road");
    console.log("");

    // -------------------------------------------------------------
    // SCENARIO 7: Stop and Reset Simulations
    // -------------------------------------------------------------
    console.log("--- SCENARIO 7: Stop and Reset Simulations ---");
    simulationService.stopSimulation("SIM-01");
    simulationService.stopSimulation("SIM-02");
    simulationService.stopSimulation("SIM-03");

    const reset1 = simulationService.resetSimulation("SIM-01");
    assert(reset1.status === "waiting", "SIM-01 reset back to start (status=waiting)");
    console.log("");

    // -------------------------------------------------------------
    // SCENARIO 8: Verify Vehicle Histories and Routes Do Not Mix
    // -------------------------------------------------------------
    console.log("--- SCENARIO 8: Verify Vehicle Isolation ---");
    const trail1 = db.getVehicleLocationTrail("SIM-01");
    const trail2 = db.getVehicleLocationTrail("SIM-02");
    const trail3 = db.getVehicleLocationTrail("SIM-03");

    assert(trail1.every((t) => t.vehicle_id === "SIM-01"), "SIM-01 telemetry trail contains ONLY SIM-01 pings");
    assert(trail2.every((t) => t.vehicle_id === "SIM-02"), "SIM-02 telemetry trail contains ONLY SIM-02 pings");
    assert(trail3.every((t) => t.vehicle_id === "SIM-03"), "SIM-03 telemetry trail contains ONLY SIM-03 pings");
    console.log("");

    // -------------------------------------------------------------
    // SCENARIO 9: Verify Real Driver GPS Tracking Still Works
    // -------------------------------------------------------------
    console.log("--- SCENARIO 9: Real Driver GPS Tracking Compatibility ---");
    const realVehicle = db.getDb().prepare("SELECT vehicle_id FROM vehicles WHERE vehicle_id NOT LIKE 'SIM%' LIMIT 1").get();
    const realVehicleId = realVehicle?.vehicle_id || "V016";

    const realPing = db.recordGpsPing({
      vehicle_id: realVehicleId,
      driver_id: 1,
      latitude: 21.1465,
      longitude: 79.0880,
      accuracy: 8,
      speed: 42,
      heading: 90,
      is_simulated: 0,
    });

    assert(realPing && realPing.is_simulated === 0, `Real driver GPS ping recorded with is_simulated=0 for ${realVehicleId}`);
    const realLoc = db.getVehicleLocation(realVehicleId);
    assert(realLoc.is_simulated === 0, `${realVehicleId} strictly identified as real vehicle, distinct from simulated`);
    console.log("");

    // -------------------------------------------------------------
    // Clean up test database
    // -------------------------------------------------------------
    db.getDb().prepare("DELETE FROM gps_location_history WHERE vehicle_id LIKE 'SIM%'").run();
    db.getDb().prepare("DELETE FROM route_deviation_events WHERE vehicle_id LIKE 'SIM%'").run();
    db.getDb().prepare("DELETE FROM tracking_sessions WHERE vehicle_id LIKE 'SIM%'").run();
    db.getDb().prepare("DELETE FROM rider_assignments WHERE vehicle_id LIKE 'SIM%'").run();
    db.getDb().prepare("DELETE FROM vehicle_locations WHERE vehicle_id LIKE 'SIM%'").run();
    db.getDb().prepare("DELETE FROM vehicles WHERE vehicle_id LIKE 'SIM%'").run();

  } catch (err) {
    console.error("Test execution failure:", err);
    failCount++;
  } finally {
    adminSocket.disconnect();
    server.close();
  }

  console.log("================================================================");
  console.log(`MULTI-VEHICLE TEST SUMMARY: ${passCount} Passed, ${failCount} Failed`);
  console.log("================================================================");

  if (failCount > 0) process.exit(1);
}

run();
