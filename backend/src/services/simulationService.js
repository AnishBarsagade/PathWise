/**
 * PathWise GPS Vehicle Simulation Engine
 *
 * Manages virtual vehicle dispatch and real-time movement along planned routes.
 *
 * Capabilities:
 * - 2-second telemetry ticks matching real-time dispatch intervals.
 * - Dynamic interpolation along dense road geometry / waypoint sequences.
 * - Configurable speed multipliers (1x, 2x, 5x, 10x).
 * - On-demand Route Deviation simulation (>150m off corridor).
 * - On-demand Vehicle Breakdown simulation (emergency stop & maintenance status).
 * - Real-time Socket.IO emission to 'admins' room with [SIMULATED] tags.
 * - SQLite telemetry logging with is_simulated = 1.
 */

const dbService = require("./dbService");
const defaultRoadCorridor = require("../data/defaultRoadCorridor.json");
let cachedRouteGeometries = {};
try {
  cachedRouteGeometries = require("../data/cachedRouteGeometries.json");
} catch (_) {}
const { evaluateRouteDeviation } = require("./deviationService");
const { getIO } = require("./socketService");

// Map of active simulations: vehicle_id -> SimulationInstance
const activeSimulations = new Map();

/**
 * Linearly interpolates between two [lat, lon] coordinates.
 */
function interpolateCoord(p1, p2, fraction) {
  return [
    p1[0] + (p2[0] - p1[0]) * fraction,
    p1[1] + (p2[1] - p1[1]) * fraction,
  ];
}

/**
 * Calculates heading in degrees between two coordinates.
 */
function calculateHeading(p1, p2) {
  const dLon = (p2[1] - p1[1]) * Math.PI / 180;
  const lat1 = p1[0] * Math.PI / 180;
  const lat2 = p2[0] * Math.PI / 180;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const brng = Math.atan2(y, x) * 180 / Math.PI;
  return (brng + 360) % 360;
}

/**
 * Adds perpendicular offset in meters to simulate route deviation.
 */
function addPerpendicularOffset(lat, lon, heading, offsetMeters = 200) {
  // Angle perpendicular to heading
  const perpHeading = (heading + 90) % 360;
  const perpRad = perpHeading * Math.PI / 180;

  // Degrees per meter approximate
  const dLat = (offsetMeters * Math.cos(perpRad)) / 110540;
  const dLon = (offsetMeters * Math.sin(perpRad)) / (111320 * Math.cos(lat * Math.PI / 180));

  return [lat + dLat, lon + dLon];
}

/**
 * Prepares dense interpolation points along route waypoints.
 */
function densifyRoutePoints(waypoints, targetTotalPoints = 50) {
  if (!Array.isArray(waypoints) || waypoints.length < 2) {
    return waypoints || [];
  }

  const result = [];
  const segments = waypoints.length - 1;

  for (let i = 0; i < segments; i++) {
    const p1 = waypoints[i];
    const p2 = waypoints[i + 1];
    result.push(p1);

    const dLat = (p2[0] - p1[0]) * 110540;
    const dLon = (p2[1] - p1[1]) * (111320 * Math.cos(p1[0] * Math.PI / 180));
    const distM = Math.sqrt(dLat * dLat + dLon * dLon);

    // If segment between road nodes exceeds 30m, add sub-points along that street line
    if (distM > 30) {
      const steps = Math.min(15, Math.ceil(distM / 25));
      for (let k = 1; k < steps; k++) {
        result.push(interpolateCoord(p1, p2, k / steps));
      }
    }
  }
  result.push(waypoints[waypoints.length - 1]);
  return result;
}

/**
 * Starts a simulation instance for a vehicle along planned coordinates.
 */
function startSimulation({
  vehicle_id,
  route_coords = [],
  speed_multiplier = 1,
  run_id = null,
  is_point_to_point = false,
  model = null,
  color = null,
}) {
  // If already simulating, stop previous instance
  stopSimulation(vehicle_id);

  // If no coordinates provided or fewer than 20 points, resolve complete physical road geometry
  let pathPoints = route_coords;

  if (!Array.isArray(pathPoints) || pathPoints.length < 20) {
    if (cachedRouteGeometries[vehicle_id]?.waypoints?.length >= 20) {
      pathPoints = cachedRouteGeometries[vehicle_id].waypoints;
    } else {
      const planned = dbService.getPlannedRouteForVehicle(vehicle_id);
      if (planned && planned.waypoints && planned.waypoints.length >= 20) {
        pathPoints = planned.waypoints;
      }
    }
  }

  // Fallback to verified Nagpur physical road corridor if route is still missing or insufficient
  if (!Array.isArray(pathPoints) || pathPoints.length < 2) {
    pathPoints = defaultRoadCorridor;
  }

  const densePath = densifyRoutePoints(pathPoints, 50);

  // Ensure vehicle exists in DB (creates simulated vehicle if absent)
  if (vehicle_id && (String(vehicle_id).startsWith("SIM") || !dbService.getVehicleById(vehicle_id))) {
    dbService.createSimulatedVehicle({
      vehicle_id,
      manufacturer: "PathWise Simulation",
      model: model || "Autonomous Carrier",
      configured_capacity_kg: 500,
      driver_name: `Sim Driver (${vehicle_id})`,
    });
  }

  // Find or assign driver user
  const riderId = dbService.getRiderByVehicleId(vehicle_id) || 1;
  const driverUser = dbService.findUserById(riderId) || { id: riderId, name: `Sim Driver (${vehicle_id})` };

  // Initialize tracking session
  const session = dbService.startTrackingSession({
    vehicle_id,
    driver_id: driverUser.id,
  });

  // Precompute cumulative distances along densePath
  let pathDistKm = 0;
  for (let i = 0; i < densePath.length - 1; i++) {
    const dLat = (densePath[i + 1][0] - densePath[i][0]) * 110.54;
    const dLon = (densePath[i + 1][1] - densePath[i][1]) * (111.32 * Math.cos(densePath[i][0] * Math.PI / 180));
    pathDistKm += Math.sqrt(dLat * dLat + dLon * dLon);
  }
  const totalPathDistanceKm = Number(Math.max(0.1, pathDistKm).toFixed(2));

  const simState = {
    vehicle_id,
    driver_id: driverUser.id,
    driver_name: driverUser.name,
    run_id,
    densePath,
    originalWaypoints: pathPoints,
    currentIndex: 0,
    speedMultiplier: Number(speed_multiplier) || 1,
    isDeviatedRequested: false,
    isBreakdown: false,
    is_point_to_point: Boolean(is_point_to_point),
    model: model || "Simulated Carrier",
    color: color || "#3b82f6",
    total_distance_km: totalPathDistanceKm,
    distance_travelled_km: 0,
    remaining_distance_km: totalPathDistanceKm,
    progress_percent: 0,
    eta_seconds: Math.round((totalPathDistanceKm / 40) * 3600),
    timer: null,
    started_at: new Date().toISOString(),
    status: "running",
  };

  // Execution tick runs every 2 seconds (configurable step by speed multiplier)
  const tickIntervalMs = 2000;

  const runTick = () => {
    if (simState.isBreakdown || simState.isPaused || simState.status === "completed") {
      return;
    }

    const path = simState.densePath;
    const isAtEnd = simState.is_point_to_point && simState.currentIndex >= path.length - 1;
    const idx = isAtEnd ? path.length - 1 : (simState.currentIndex % path.length);
    const nextIdx = (idx + 1) % path.length;

    let [currLat, currLon] = path[idx];
    const nextPt = isAtEnd ? path[idx] : path[nextIdx];
    const heading = calculateHeading([currLat, currLon], nextPt);

    // Compute progress metrics
    const frac = path.length > 1 ? Math.min(1.0, idx / (path.length - 1)) : 1.0;
    const distTravelled = Number((simState.total_distance_km * frac).toFixed(2));
    const distRemaining = Number(Math.max(0, simState.total_distance_km - distTravelled).toFixed(2));
    const progressPercent = Math.min(100, Math.round(frac * 100));

    simState.distance_travelled_km = distTravelled;
    simState.remaining_distance_km = distRemaining;
    simState.progress_percent = progressPercent;

    // If deviation requested, add 220m perpendicular offset
    if (simState.isDeviatedRequested) {
      const [devLat, devLon] = addPerpendicularOffset(currLat, currLon, heading, 220);
      currLat = devLat;
      currLon = devLon;
    }

    // Base simulated speed ~35-50 km/h with organic jitter
    const baseSpeedKmh = 35 + (idx % 5) * 3 + Math.random() * 4;
    const effectiveSpeed = Math.round(baseSpeedKmh * Math.min(simState.speedMultiplier, 3));

    // Evaluate deviation against original corridor using Turf.js
    const prevLocation = dbService.getVehicleLocation(vehicle_id);
    const prevCount = prevLocation ? prevLocation.consecutive_deviations : 0;
    const prevIsDeviated = prevLocation ? Boolean(prevLocation.is_deviated) : false;

    const deviation = evaluateRouteDeviation({
      latitude: currLat,
      longitude: currLon,
      accuracy: 6, // High simulated GPS accuracy
      routeCoordinates: simState.originalWaypoints,
      thresholdMeters: 100,
      previousConsecutiveDeviations: prevCount,
      previousIsDeviated: prevIsDeviated,
    });

    // Record in SQLite with is_simulated = 1
    const pingRecord = dbService.recordGpsPing({
      vehicle_id,
      driver_id: simState.driver_id,
      session_id: session.session_id,
      latitude: currLat,
      longitude: currLon,
      accuracy: 6,
      speed: effectiveSpeed,
      heading,
      deviation_distance_m: deviation.deviation_distance_m,
      is_deviated: deviation.is_deviated ? 1 : 0,
      consecutive_deviations: deviation.consecutive_deviations,
      is_simulated: 1,
    });

    // Broadcast live over Socket.IO to admins
    const io = getIO();
    if (io) {
      const etaSeconds = effectiveSpeed > 0 ? Math.round((distRemaining / effectiveSpeed) * 3600) : 0;
      simState.eta_seconds = etaSeconds;

      const livePayload = {
        vehicle_id,
        driver_id: simState.driver_id,
        driver_name: `${simState.driver_name} [SIM]`,
        model: simState.model,
        color: simState.color,
        latitude: currLat,
        longitude: currLon,
        accuracy: 6,
        speed: isAtEnd ? 0 : effectiveSpeed,
        heading,
        timestamp: pingRecord.recorded_at,
        tracking_status: isAtEnd ? "completed" : "tracking",
        is_simulated: 1,
        total_distance_km: simState.total_distance_km,
        distance_travelled_km: distTravelled,
        remaining_distance_km: distRemaining,
        progress_percent: progressPercent,
        eta_seconds: etaSeconds,
        deviation: {
          is_deviated: deviation.is_deviated,
          deviation_distance_m: deviation.deviation_distance_m,
          consecutive_deviations: deviation.consecutive_deviations,
          alert_status: deviation.alert_status,
        },
      };

      io.to("admins").emit("vehicle:update", livePayload);

      // Trigger deviation alert event if newly declared (>= 3 consecutive pings)
      if (deviation.is_new_alert) {
        dbService.recordDeviationEvent({
          vehicle_id,
          driver_id: simState.driver_id,
          session_id: session.session_id,
          run_id: simState.run_id,
          deviation_distance_m: deviation.deviation_distance_m,
          threshold_m: deviation.threshold_m,
          consecutive_pings: deviation.consecutive_deviations,
          latitude: currLat,
          longitude: currLon,
          is_simulated: 1,
        });

        io.to("admins").emit("alert:deviation", {
          vehicle_id,
          driver_name: `${simState.driver_name} [SIM]`,
          distance_m: deviation.deviation_distance_m,
          alert_status: deviation.alert_status,
          latitude: currLat,
          longitude: currLon,
          is_simulated: 1,
          timestamp: pingRecord.recorded_at,
        });
      } else if (deviation.is_deviated) {
        dbService.recordDeviationEvent({
          vehicle_id,
          driver_id: simState.driver_id,
          session_id: session.session_id,
          run_id: simState.run_id,
          deviation_distance_m: deviation.deviation_distance_m,
          threshold_m: deviation.threshold_m,
          consecutive_pings: deviation.consecutive_deviations,
          latitude: currLat,
          longitude: currLon,
          is_simulated: 1,
        });
      }

      if (deviation.was_resolved) {
        dbService.resolveDeviationEvent(vehicle_id);
        io.to("admins").emit("alert:deviation_resolved", {
          vehicle_id,
          driver_name: `${simState.driver_name} [SIM]`,
          timestamp: pingRecord.recorded_at,
          message: `Vehicle ${vehicle_id} has returned to the planned route corridor`,
        });
      }
    }

    if (isAtEnd) {
      simState.status = "completed";
      if (simState.timer) {
        clearInterval(simState.timer);
        simState.timer = null;
      }
      if (io) {
        io.to("admins").emit("vehicle:completed", {
          vehicle_id,
          total_distance_km: simState.total_distance_km,
          timestamp: pingRecord.recorded_at,
        });
      }
      return;
    }

    // Advance position by speed step
    const stepIncrement = Math.max(1, Math.round(simState.speedMultiplier));
    simState.currentIndex += stepIncrement;
  };

  simState.runTick = runTick;
  runTick();
  const initialInterval = Math.max(400, Math.round(2000 / simState.speedMultiplier));
  simState.timer = setInterval(runTick, initialInterval);

  activeSimulations.set(vehicle_id, simState);

  // Notify admin room
  const io = getIO();
  if (io) {
    io.to("admins").emit("vehicle:status_change", {
      vehicle_id,
      tracking_status: "tracking",
      is_simulated: 1,
      driver_name: simState.driver_name,
    });
  }

  return {
    vehicle_id,
    status: "running",
    speed_multiplier: simState.speedMultiplier,
    points_count: densePath.length,
    started_at: simState.started_at,
  };
}

/**
 * Adjusts simulation speed multiplier (e.g. 1, 2, 5, 10).
 */
function setSimulationSpeed(vehicle_id, multiplier) {
  const sim = activeSimulations.get(vehicle_id);
  if (!sim) {
    throw new Error(`No active simulation found for vehicle '${vehicle_id}'`);
  }
  sim.speedMultiplier = Math.max(0.5, Math.min(Number(multiplier) || 1, 10));
  if (sim.timer && typeof sim.runTick === "function") {
    clearInterval(sim.timer);
    const tickIntervalMs = Math.max(400, Math.round(2000 / sim.speedMultiplier));
    sim.timer = setInterval(sim.runTick, tickIntervalMs);
  }
  return { vehicle_id, speed_multiplier: sim.speedMultiplier };
}

/**
 * Triggers route deviation simulation (>150m off route corridor).
 */
function triggerDeviation(vehicle_id) {
  const sim = activeSimulations.get(vehicle_id);
  if (!sim) {
    throw new Error(`No active simulation found for vehicle '${vehicle_id}'`);
  }
  sim.isDeviatedRequested = true;
  if (typeof sim.runTick === "function") {
    sim.runTick();
  }
  return {
    vehicle_id,
    is_deviated_simulated: true,
    message: `Route deviation triggered for ${vehicle_id}. Off-route offset applied.`,
  };
}

/**
 * Resumes normal on-corridor path after deviation.
 */
function resumeRoute(vehicle_id) {
  const sim = activeSimulations.get(vehicle_id);
  if (!sim) {
    throw new Error(`No active simulation found for vehicle '${vehicle_id}'`);
  }
  sim.isDeviatedRequested = false;
  return {
    vehicle_id,
    is_deviated_simulated: false,
    message: `Vehicle ${vehicle_id} returned to planned corridor.`,
  };
}

/**
 * Triggers simulated vehicle breakdown.
 */
function triggerBreakdown(vehicle_id) {
  const sim = activeSimulations.get(vehicle_id);
  if (!sim) {
    throw new Error(`No active simulation found for vehicle '${vehicle_id}'`);
  }

  sim.isBreakdown = true;
  sim.status = "breakdown";
  if (sim.timer) { clearInterval(sim.timer); sim.timer = null; }

  // Update vehicle in database
  const db = dbService.getDb();
  const now = new Date().toISOString();
  db.prepare("UPDATE vehicles SET operational_status = 'maintenance', updated_at = ? WHERE vehicle_id = ?").run(now, vehicle_id);
  db.prepare("UPDATE vehicle_locations SET tracking_status = 'breakdown', speed = 0, last_ping_at = ? WHERE vehicle_id = ?").run(now, vehicle_id);

  // Broadcast breakdown incident over Socket.IO
  const io = getIO();
  if (io) {
    io.to("admins").emit("vehicle:breakdown", {
      vehicle_id,
      driver_name: `${sim.driver_name} [SIM]`,
      incident_type: "Vehicle Breakdown / Engine Failure",
      operational_status: "maintenance",
      timestamp: now,
      message: `SIMULATION INCIDENT: Vehicle ${vehicle_id} reported mechanical breakdown. Speed 0 km/h.`,
    });

    io.to("admins").emit("vehicle:status_change", {
      vehicle_id,
      tracking_status: "breakdown",
      is_simulated: 1,
    });
  }

  return {
    vehicle_id,
    status: "breakdown",
    message: `Breakdown simulated for ${vehicle_id}. Operational status set to maintenance.`,
  };
}

/**
 * Stops an active simulation for a vehicle.
 */
function stopSimulation(vehicle_id) {
  const sim = activeSimulations.get(vehicle_id);
  if (sim) {
    if (sim.timer) {
      clearInterval(sim.timer);
    }
    activeSimulations.delete(vehicle_id);
    dbService.stopTrackingSession({ vehicle_id, driver_id: sim.driver_id });

    const io = getIO();
    if (io) {
      io.to("admins").emit("vehicle:status_change", {
        vehicle_id,
        tracking_status: "idle",
        is_simulated: 1,
      });
    }
    return { vehicle_id, status: "stopped" };
  }
  return { vehicle_id, status: "not_active" };
}

/**
 * Returns current status of all running simulations.
 */
function getSimulationStatus() {
  const list = [];
  for (const [vId, sim] of activeSimulations.entries()) {
    list.push({
      vehicle_id: vId,
      driver_name: sim.driver_name,
      status: sim.status,
      speed_multiplier: sim.speedMultiplier,
      is_deviated_simulated: sim.isDeviatedRequested,
      is_breakdown: sim.isBreakdown,
      current_step: sim.currentIndex,
      total_points: sim.densePath.length,
      started_at: sim.started_at,
    });
  }
  return {
    active_count: list.length,
    simulations: list,
  };
}


/**
 * Pauses simulated vehicle movement without resetting route progress.
 */
function pauseSimulation(vehicle_id) {
  const sim = activeSimulations.get(vehicle_id);
  if (!sim) {
    throw new Error(`No active simulation found for vehicle '${vehicle_id}'`);
  }
  sim.isPaused = true;
  sim.status = "paused";
  if (sim.timer) {
    clearInterval(sim.timer);
    sim.timer = null;
  }
  const io = getIO();
  if (io) {
    io.to("admins").emit("vehicle:status_change", {
      vehicle_id,
      tracking_status: "paused",
      is_simulated: 1,
    });
  }
  return { vehicle_id, status: "paused", message: `Simulation paused for ${vehicle_id}.` };
}

/**
 * Resumes simulated vehicle movement along the route corridor.
 */
function resumeSimulationMovement(vehicle_id) {
  const sim = activeSimulations.get(vehicle_id);
  if (!sim) {
    throw new Error(`No active simulation found for vehicle '${vehicle_id}'`);
  }
  sim.isPaused = false;
  sim.status = "running";
  if (!sim.timer && typeof sim.runTick === "function") {
    const tickIntervalMs = Math.max(400, Math.round(2000 / sim.speedMultiplier));
    sim.timer = setInterval(sim.runTick, tickIntervalMs);
  }
  const io = getIO();
  if (io) {
    io.to("admins").emit("vehicle:status_change", {
      vehicle_id,
      tracking_status: "tracking",
      is_simulated: 1,
    });
  }
  return { vehicle_id, status: "running", message: `Simulation resumed for ${vehicle_id}.` };
}

function getSimulationState(vehicle_id) {
  return activeSimulations.get(vehicle_id) || null;
}

/**
 * Resets a vehicle simulation back to starting location (step 0, status waiting).
 */
function resetSimulation(vehicle_id) {
  const sim = activeSimulations.get(vehicle_id);
  if (!sim) {
    return { vehicle_id, status: "waiting", message: "Simulation initialized at start." };
  }

  if (sim.timer) {
    clearInterval(sim.timer);
    sim.timer = null;
  }

  sim.currentIndex = 0;
  sim.status = "waiting";
  sim.isPaused = false;
  sim.isDeviatedRequested = false;
  sim.isBreakdown = false;
  sim.distance_travelled_km = 0;
  sim.remaining_distance_km = sim.total_distance_km;
  sim.progress_percent = 0;

  const startPt = sim.densePath[0] || [21.145, 79.088];

  const io = getIO();
  if (io) {
    io.to("admins").emit("vehicle:update", {
      vehicle_id,
      driver_name: `${sim.driver_name} [SIM]`,
      model: sim.model,
      color: sim.color,
      latitude: startPt[0],
      longitude: startPt[1],
      accuracy: 6,
      speed: 0,
      heading: 0,
      tracking_status: "waiting",
      is_simulated: 1,
      total_distance_km: sim.total_distance_km,
      distance_travelled_km: 0,
      remaining_distance_km: sim.total_distance_km,
      progress_percent: 0,
      eta_seconds: Math.round((sim.total_distance_km / 40) * 3600),
      timestamp: new Date().toISOString(),
      deviation: { is_deviated: false, deviation_distance_m: 0, alert_status: "ON_ROUTE" },
    });

    io.to("admins").emit("vehicle:status_change", {
      vehicle_id,
      tracking_status: "waiting",
      is_simulated: 1,
    });
  }

  return {
    vehicle_id,
    status: "waiting",
    message: `Simulation reset for vehicle ${vehicle_id}.`,
  };
}

/**
 * Starts multi-vehicle simulations in batch.
 */
function batchStartSimulations(simulations = []) {
  const results = [];
  for (const item of simulations) {
    if (item && item.vehicle_id) {
      const res = startSimulation(item);
      results.push(res);
    }
  }
  return results;
}

/**
 * Stops multi-vehicle simulations in batch.
 */
function batchStopSimulations(vehicleIds = []) {
  const results = [];
  for (const vId of vehicleIds) {
    const res = stopSimulation(vId);
    results.push(res);
  }
  return results;
}

/**
 * Resets multi-vehicle simulations in batch.
 */
function batchResetSimulations(vehicleIds = []) {
  const results = [];
  for (const vId of vehicleIds) {
    const res = resetSimulation(vId);
    results.push(res);
  }
  return results;
}

module.exports = {
  startSimulation,
  setSimulationSpeed,
  triggerDeviation,
  resumeRoute,
  pauseSimulation,
  resumeSimulationMovement,
  triggerBreakdown,
  stopSimulation,
  resetSimulation,
  batchStartSimulations,
  batchStopSimulations,
  batchResetSimulations,
  getSimulationStatus,
  getSimulationState,
};
