/**
 * PathWise Tracking Controller
 *
 * Provides REST endpoints for live vehicle locations, telemetry history,
 * planned route comparison, and HTTP fallback for GPS pings.
 */

const dbService = require("../services/dbService");
const { evaluateRouteDeviation } = require("../services/deviationService");
const { getIO } = require("../services/socketService");

/**
 * GET /api/tracking/vehicles
 * Returns all fleet vehicles with live tracking status, coordinates, and driver names.
 */
async function getAllVehicles(req, res, next) {
  try {
    const vehicles = dbService.getAllVehicleLocations();
    return res.status(200).json({
      total: vehicles.length,
      vehicles,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/tracking/vehicles/:id
 * Returns current telemetry snapshot for a specific vehicle.
 */
async function getVehicleStatus(req, res, next) {
  try {
    const vehicleId = req.params.id;
    const location = dbService.getVehicleLocation(vehicleId);

    if (!location) {
      return res.status(404).json({
        error: "Not Found",
        message: `Vehicle '${vehicleId}' location data not found.`,
      });
    }

    return res.status(200).json(location);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/tracking/history/:id
 * Returns ordered breadcrumb trail coordinates.
 */
async function getVehicleTrail(req, res, next) {
  try {
    const vehicleId = req.params.id;
    const { limit, session_id } = req.query;
    const trail = dbService.getVehicleLocationTrail(vehicleId, {
      limit: Number(limit) || 500,
      session_id,
    });

    return res.status(200).json({
      vehicle_id: vehicleId,
      session_id: trail[0]?.session_id || session_id || null,
      points_count: trail.length,
      trail,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/tracking/planned-route/:id
 * Returns the planned route stops and geometry for route comparison.
 */
async function getPlannedRoute(req, res, next) {
  try {
    const vehicleId = req.params.id;
    const planned = await dbService.getPlannedRouteWithRoadGeometry(vehicleId);
    return res.status(200).json(planned);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/tracking/ping
 * HTTP REST fallback for submitting a GPS ping.
 */
async function postGpsPing(req, res, next) {
  try {
    const { vehicle_id, latitude, longitude, accuracy, speed, heading, session_id } =
      req.body || {};

    if (!vehicle_id) {
      return res.status(400).json({
        error: "Validation Error",
        message: "vehicle_id is required.",
      });
    }

    // Role check: Rider must be assigned to this vehicle
    if (req.user && req.user.role === "rider") {
      const assignedRiderId = dbService.getRiderByVehicleId(vehicle_id);
      if (String(assignedRiderId) !== String(req.user.id)) {
        return res.status(403).json({
          error: "Forbidden",
          message: `Access denied. You are not assigned to vehicle '${vehicle_id}'.`,
        });
      }
    }

    const lat = Number(latitude);
    const lon = Number(longitude);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      return res.status(400).json({
        error: "Validation Error",
        message: "latitude and longitude must be valid coordinates within bounds.",
      });
    }

    const acc = Math.max(0, Number(accuracy) || 0);
    const spd = Math.max(0, Number(speed) || 0);
    const hdg = Number(heading) || 0;

    // Deviation check using Turf.js calculation against complete road network
    const planned = await dbService.getPlannedRouteWithRoadGeometry(vehicle_id);
    const prevLocation = dbService.getVehicleLocation(vehicle_id);
    const prevCount = prevLocation ? prevLocation.consecutive_deviations : 0;
    const prevIsDeviated = prevLocation ? Boolean(prevLocation.is_deviated) : false;

    const deviation = evaluateRouteDeviation({
      latitude: lat,
      longitude: lon,
      accuracy: acc,
      routeCoordinates: planned.waypoints || [],
      thresholdMeters: 100,
      previousConsecutiveDeviations: prevCount,
      previousIsDeviated: prevIsDeviated,
    });

    const driverId = req.user ? req.user.id : null;
    const record = dbService.recordGpsPing({
      vehicle_id,
      driver_id: driverId,
      session_id,
      latitude: lat,
      longitude: lon,
      accuracy: acc,
      speed: spd,
      heading: hdg,
      deviation_distance_m: deviation.deviation_distance_m,
      is_deviated: deviation.is_deviated ? 1 : 0,
      consecutive_deviations: deviation.consecutive_deviations,
    });

    // Broadcast via Socket.IO if available
    const io = getIO();
    if (io) {
      io.to("admins").emit("vehicle:update", {
        vehicle_id,
        driver_id: driverId,
        driver_name: req.user ? req.user.name : "Driver",
        latitude: lat,
        longitude: lon,
        accuracy: acc,
        speed: spd,
        heading: hdg,
        timestamp: record.recorded_at,
        tracking_status: "tracking",
        deviation: {
          is_deviated: deviation.is_deviated,
          deviation_distance_m: deviation.deviation_distance_m,
          consecutive_deviations: deviation.consecutive_deviations,
          alert_status: deviation.alert_status,
        },
      });

      if (deviation.is_new_alert) {
        dbService.recordDeviationEvent({
          vehicle_id,
          driver_id: driverId,
          session_id,
          run_id: planned.run_id,
          deviation_distance_m: deviation.deviation_distance_m,
          threshold_m: deviation.threshold_m,
          consecutive_pings: deviation.consecutive_deviations,
          latitude: lat,
          longitude: lon,
          is_simulated: 0,
        });

        io.to("admins").emit("alert:deviation", {
          vehicle_id,
          driver_name: req.user ? req.user.name : "Driver",
          distance_m: deviation.deviation_distance_m,
          alert_status: deviation.alert_status,
          latitude: lat,
          longitude: lon,
          timestamp: record.recorded_at,
        });
      } else if (deviation.is_deviated) {
        dbService.recordDeviationEvent({
          vehicle_id,
          driver_id: driverId,
          session_id,
          run_id: planned.run_id,
          deviation_distance_m: deviation.deviation_distance_m,
          threshold_m: deviation.threshold_m,
          consecutive_pings: deviation.consecutive_deviations,
          latitude: lat,
          longitude: lon,
          is_simulated: 0,
        });
      }

      if (deviation.was_resolved) {
        dbService.resolveDeviationEvent(vehicle_id);
        io.to("admins").emit("alert:deviation_resolved", {
          vehicle_id,
          driver_name: req.user ? req.user.name : "Driver",
          timestamp: record.recorded_at,
          message: `Vehicle ${vehicle_id} has returned to the planned route corridor`,
        });
      }
    }

    return res.status(200).json({
      message: "GPS telemetry recorded successfully.",
      record,
      deviation,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/tracking/session/start
 */
async function startSession(req, res, next) {
  try {
    const { vehicle_id } = req.body || {};
    if (!vehicle_id) {
      return res.status(400).json({
        error: "Validation Error",
        message: "vehicle_id is required.",
      });
    }

    if (req.user && req.user.role === "rider") {
      const assignedRiderId = dbService.getRiderByVehicleId(vehicle_id);
      if (String(assignedRiderId) !== String(req.user.id)) {
        return res.status(403).json({
          error: "Forbidden",
          message: `Access denied. You are not assigned to vehicle '${vehicle_id}'.`,
        });
      }
    }

    const session = dbService.startTrackingSession({
      vehicle_id,
      driver_id: req.user.id,
    });

    const io = getIO();
    if (io) {
      io.to("admins").emit("vehicle:status_change", {
        vehicle_id,
        tracking_status: "tracking",
        driver_id: req.user.id,
        driver_name: req.user.name,
      });
    }

    return res.status(200).json({
      message: "Tracking session started.",
      session,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/tracking/session/stop
 */
async function stopSession(req, res, next) {
  try {
    const { vehicle_id } = req.body || {};
    if (!vehicle_id) {
      return res.status(400).json({
        error: "Validation Error",
        message: "vehicle_id is required.",
      });
    }

    if (req.user && req.user.role === "rider") {
      const assignedRiderId = dbService.getRiderByVehicleId(vehicle_id);
      if (String(assignedRiderId) !== String(req.user.id)) {
        return res.status(403).json({
          error: "Forbidden",
          message: `Access denied. You are not assigned to vehicle '${vehicle_id}'.`,
        });
      }
    }

    const stopped = dbService.stopTrackingSession({
      vehicle_id,
      driver_id: req.user.id,
    });

    const io = getIO();
    if (io) {
      io.to("admins").emit("vehicle:status_change", {
        vehicle_id,
        tracking_status: "idle",
        driver_id: req.user.id,
        driver_name: req.user.name,
      });
    }

    return res.status(200).json({
      message: "Tracking session stopped.",
      stopped,
    });
  } catch (error) {
    next(error);
  }
}


/**
 * GET /api/tracking/deviations
 * Retrieves recorded route deviation events.
 */
async function getDeviationEvents(req, res, next) {
  try {
    const { vehicle_id, limit } = req.query;
    const events = dbService.listDeviationEvents({
      vehicle_id: vehicle_id || null,
      limit: limit || 50,
    });
    return res.status(200).json({
      success: true,
      count: events.length,
      data: events,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAllVehicles,
  getVehicleStatus,
  getVehicleTrail,
  getPlannedRoute,
  getDeviationEvents,
  postGpsPing,
  startSession,
  stopSession,
};

