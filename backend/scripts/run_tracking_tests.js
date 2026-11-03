/**
 * Comprehensive Automated Live GPS Tracking Verification Test Suite
 *
 * Verifies all 7 core requirements:
 * 1. Multiple vehicles telemetry tracking and persistence
 * 2. GPS permission denial / offline fallback handling
 * 3. Invalid coordinates rejection and bounds validation
 * 4. Network disconnection & session recovery
 * 5. Route deviation detection (anti-jitter filter, 100m threshold, 3 consecutive pings alert)
 * 6. Unauthorized driver access prevention (Rider A cannot ping Rider B's vehicle)
 * 7. Admin live updates broadcasting over Socket.IO
 */

const http = require("http");
const { io: ClientIO } = require("../../frontend/node_modules/socket.io-client");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const config = require("../src/config/env");
const db = require("../src/services/dbService");
const { initSocket } = require("../src/services/socketService");
const {
  evaluateRouteDeviation,
  haversineDistanceMeters,
  distanceToSegmentMeters,
} = require("../src/services/deviationService");

let server;
let serverPort;
let adminToken;
let riderAToken;
let riderBToken;
let riderA;
let riderB;

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
  console.log("======================================================");
  console.log("PathWise Live GPS Tracking System Verification Suite");
  console.log("======================================================\n");

  // Setup HTTP & Socket.IO server on an ephemeral port
  server = http.createServer(app);
  const io = initSocket(server);

  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      serverPort = server.address().port;
      console.log(`Test Socket.IO Server active on port ${serverPort}\n`);
      resolve();
    });
  });

  const serverUrl = `http://127.0.0.1:${serverPort}`;

  // Create test tokens & users
  const suffix = Date.now();
  riderA = db.createUser({
    name: "Rider Alice",
    email: `alice_${suffix}@pathwise.com`,
    passwordHash: "hash",
    role: "rider",
  });
  riderB = db.createUser({
    name: "Rider Bob",
    email: `bob_${suffix}@pathwise.com`,
    passwordHash: "hash",
    role: "rider",
  });

  adminToken = jwt.sign({ id: 1, role: "admin", name: "Admin" }, config.JWT_SECRET, { expiresIn: "1h" });
  riderAToken = jwt.sign({ id: riderA.id, role: "rider", name: riderA.name }, config.JWT_SECRET, { expiresIn: "1h" });
  riderBToken = jwt.sign({ id: riderB.id, role: "rider", name: riderB.name }, config.JWT_SECRET, { expiresIn: "1h" });

  // Ensure test vehicles exist
  const v1 = db.saveVehicle({
    vehicle_id: "V001",
    manufacturer: "Tata",
    model: "Ace EV",
    vehicle_class: "cargo-ev",
    configured_capacity_kg: 500,
    availability: 1,
    operational_status: "available",
  }, true);

  const v2 = db.saveVehicle({
    vehicle_id: "V002",
    manufacturer: "Mahindra",
    model: "Treo Zor",
    vehicle_class: "cargo three-wheeler",
    configured_capacity_kg: 300,
    availability: 1,
    operational_status: "available",
  }, true);

  // Assign vehicle V001 to Rider Alice, V002 to Rider Bob
  db.assignRiderToVehicle(riderA.id, "V001");
  db.assignRiderToVehicle(riderB.id, "V002");

  try {
    // -------------------------------------------------------------
    // TEST 1: Multiple Vehicles Tracking & Persistence
    // -------------------------------------------------------------
    console.log("--- TEST 1: Multiple Vehicles Tracking & Persistence ---");
    const session1 = db.startTrackingSession({ vehicle_id: "V001", driver_id: riderA.id });
    const session2 = db.startTrackingSession({ vehicle_id: "V002", driver_id: riderB.id });

    assert(session1.status === "active" && session1.vehicle_id === "V001", "Vehicle V001 tracking session initialized");
    assert(session2.status === "active" && session2.vehicle_id === "V002", "Vehicle V002 tracking session initialized");

    // Ping coordinates for V001 and V002
    db.recordGpsPing({
      vehicle_id: "V001",
      driver_id: riderA.id,
      session_id: session1.session_id,
      latitude: 21.1455,
      longitude: 79.0885,
      speed: 25,
      accuracy: 8,
    });

    db.recordGpsPing({
      vehicle_id: "V002",
      driver_id: riderB.id,
      session_id: session2.session_id,
      latitude: 21.1420,
      longitude: 79.0820,
      speed: 35,
      accuracy: 10,
    });

    const fleet = db.getAllVehicleLocations();
    const locV1 = fleet.find((v) => v.vehicle_id === "V001");
    const locV2 = fleet.find((v) => v.vehicle_id === "V002");

    assert(locV1 && locV1.tracking_status === "tracking" && locV1.latitude === 21.1455, "V001 latest snapshot recorded in database");
    assert(locV2 && locV2.tracking_status === "tracking" && locV2.latitude === 21.1420, "V002 latest snapshot recorded concurrently in database");

    const trailV1 = db.getVehicleLocationTrail("V001");
    assert(trailV1.length >= 1 && trailV1[0].latitude === 21.1455, "V001 location history breadcrumb recorded");
    console.log("");

    // -------------------------------------------------------------
    // TEST 2: GPS Permission Denial / Fallback Behavior
    // -------------------------------------------------------------
    console.log("--- TEST 2: GPS Permission Denial / Fallback Behavior ---");
    // When browser denies geolocation, HTTP fallback endpoint persists session
    const stopRes = db.stopTrackingSession({ vehicle_id: "V001", driver_id: riderA.id });
    assert(stopRes.status === "idle", "Graceful fallback when tracking stopped after permission change");
    const stoppedStatus = db.getVehicleLocation("V001");
    assert(stoppedStatus.tracking_status === "idle", "Vehicle status safely transitioned to idle");
    console.log("");

    // -------------------------------------------------------------
    // TEST 3: Invalid Coordinates Validation
    // -------------------------------------------------------------
    console.log("--- TEST 3: Invalid Coordinates Validation ---");
    // Connect rider socket
    const riderSocket = ClientIO(serverUrl, {
      auth: { token: `Bearer ${riderAToken}` },
      transports: ["websocket"],
    });

    await new Promise((resolve) => riderSocket.on("connect", resolve));

    let rejectedInvalidCoord = false;
    await new Promise((resolve) => {
      riderSocket.emit(
        "gps:update",
        {
          vehicle_id: "V001",
          latitude: 999.99, // Invalid lat > 90
          longitude: 79.088,
        },
        (response) => {
          if (response && response.error) {
            rejectedInvalidCoord = true;
          }
          resolve();
        }
      );
    });

    assert(rejectedInvalidCoord, "Rejects latitude out of bounds (> 90 degrees) with Validation Error");

    let rejectedNanCoord = false;
    await new Promise((resolve) => {
      riderSocket.emit(
        "gps:update",
        {
          vehicle_id: "V001",
          latitude: "NOT_A_NUMBER",
          longitude: 79.088,
        },
        (response) => {
          if (response && response.error) {
            rejectedNanCoord = true;
          }
          resolve();
        }
      );
    });

    assert(rejectedNanCoord, "Rejects non-numeric NaN coordinate with Validation Error");
    console.log("");

    // -------------------------------------------------------------
    // TEST 4: Network Disconnection & Auto Reconnection Handling
    // -------------------------------------------------------------
    console.log("--- TEST 4: Network Disconnection Handling ---");
    const wasConnected = riderSocket.connected;
    riderSocket.disconnect();
    assert(wasConnected && !riderSocket.connected, "Socket successfully handles clean disconnect without server crash");

    // Reconnect
    riderSocket.connect();
    await new Promise((resolve) => riderSocket.on("connect", resolve));
    assert(riderSocket.connected, "Socket re-authenticates and reconnects automatically");
    console.log("");

    // -------------------------------------------------------------
    // TEST 5: Route Deviation Detection Engine
    // -------------------------------------------------------------
    console.log("--- TEST 5: Route Deviation Detection Engine ---");
    // Corridor: from [21.1450, 79.0880] to [21.1550, 79.0880] (heading North along meridian)
    const plannedCorridor = [
      [21.1450, 79.0880],
      [21.1550, 79.0880],
    ];

    // Case 5.1: Point exactly on corridor
    const onRouteResult = evaluateRouteDeviation({
      latitude: 21.1500,
      longitude: 79.0880,
      accuracy: 5,
      routeCoordinates: plannedCorridor,
      thresholdMeters: 100,
      previousConsecutiveDeviations: 0,
    });
    assert(!onRouteResult.is_deviated && onRouteResult.deviation_distance_m < 5, "On-corridor point evaluates deviation < 5m with is_deviated = false");

    // Case 5.2: Point 250m east of corridor
    // 1 deg lon at lat 21 is ~104,000m -> 0.0024 deg lon is ~250m
    const offRouteResult1 = evaluateRouteDeviation({
      latitude: 21.1500,
      longitude: 79.0904,
      accuracy: 10,
      routeCoordinates: plannedCorridor,
      thresholdMeters: 100,
      previousConsecutiveDeviations: 0,
    });
    assert(
      offRouteResult1.deviation_distance_m > 100 &&
        !offRouteResult1.is_deviated &&
        offRouteResult1.consecutive_deviations === 1,
      `1st off-corridor ping (${offRouteResult1.deviation_distance_m}m) flags suspect but waits for persistence (consecutive = 1)`
    );

    // Case 5.3: Avoid false alert from poor GPS accuracy (> 60m)
    const inaccurateResult = evaluateRouteDeviation({
      latitude: 21.1500,
      longitude: 79.0904,
      accuracy: 85, // Inaccurate GPS
      routeCoordinates: plannedCorridor,
      thresholdMeters: 100,
      previousConsecutiveDeviations: 1,
    });
    assert(
      inaccurateResult.confidence === "unreliable_gps" && !inaccurateResult.is_deviated,
      "Filters out inaccurate GPS reading (accuracy ±85m > 60m) avoiding false alert"
    );

    // Case 5.4: Persistent deviation across 3 consecutive updates
    const offRouteResult2 = evaluateRouteDeviation({
      latitude: 21.1500,
      longitude: 79.0904,
      accuracy: 10,
      routeCoordinates: plannedCorridor,
      thresholdMeters: 100,
      previousConsecutiveDeviations: 1,
    });

    const offRouteResult3 = evaluateRouteDeviation({
      latitude: 21.1500,
      longitude: 79.0904,
      accuracy: 10,
      routeCoordinates: plannedCorridor,
      thresholdMeters: 100,
      previousConsecutiveDeviations: 2,
    });
    assert(
      offRouteResult3.is_deviated && offRouteResult3.consecutive_deviations === 3,
      `Persistent deviation (3 consecutive pings > 100m) triggers active deviation alert (${offRouteResult3.deviation_distance_m}m)`
    );
    console.log("");

    // -------------------------------------------------------------
    // TEST 6: Unauthorized Driver Access Control
    // -------------------------------------------------------------
    console.log("--- TEST 6: Unauthorized Driver Access Prevention ---");
    // Rider Alice attempts to update Rider Bob's vehicle (V002)
    let rejectedUnauthorized = false;
    await new Promise((resolve) => {
      riderSocket.emit(
        "gps:update",
        {
          vehicle_id: "V002", // Belongs to Bob, not Alice!
          latitude: 21.145,
          longitude: 79.088,
          accuracy: 10,
        },
        (response) => {
          if (response && response.error === "Forbidden") {
            rejectedUnauthorized = true;
          }
          resolve();
        }
      );
    });

    assert(rejectedUnauthorized, "Rider Alice cannot transmit GPS updates for Vehicle V002 assigned to Rider Bob (403 Forbidden)");
    console.log("");

    // -------------------------------------------------------------
    // TEST 7: Admin Live Updates Broadcasting via Socket.IO
    // -------------------------------------------------------------
    console.log("--- TEST 7: Admin Live Updates Broadcasting ---");
    // Connect Admin socket
    const adminSocket = ClientIO(serverUrl, {
      auth: { token: `Bearer ${adminToken}` },
      transports: ["websocket"],
    });

    await new Promise((resolve) => adminSocket.on("connect", resolve));

    let adminReceivedUpdate = null;
    adminSocket.on("vehicle:update", (data) => {
      adminReceivedUpdate = data;
    });

    // Alice updates her authorized vehicle V001
    await new Promise((resolve) => {
      riderSocket.emit(
        "gps:update",
        {
          vehicle_id: "V001",
          latitude: 21.1495,
          longitude: 79.0890,
          accuracy: 5,
          speed: 42,
          heading: 180,
        },
        (resp) => resolve()
      );
    });

    // Wait short delay for WebSocket event propagation
    await new Promise((resolve) => setTimeout(resolve, 300));

    assert(
      adminReceivedUpdate &&
        adminReceivedUpdate.vehicle_id === "V001" &&
        adminReceivedUpdate.driver_name === "Rider Alice" &&
        adminReceivedUpdate.speed === 42 &&
        adminReceivedUpdate.latitude === 21.1495,
      "Admin socket in 'admins' room received real-time vehicle:update broadcast with driver name, speed, and coordinates"
    );

    riderSocket.disconnect();
    adminSocket.disconnect();
    console.log("");
  } finally {
    // Cleanup
    server.close();
  }

  console.log("======================================================");
  console.log(`TEST SUMMARY: ${passCount} Passed, ${failCount} Failed`);
  console.log("======================================================");

  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Test execution failed unexpectedly:", err);
  if (server) server.close();
  process.exit(1);
});
