/**
 * PathWise Real-Time GPS Tracking Socket.IO Service
 *
 * Manages WebSocket connections for live driver tracking and admin dispatch monitoring.
 * Enforces JWT authentication, rider vehicle assignment authorization, coordinate validation,
 * route deviation detection, and live admin broadcasting.
 */

const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const config = require("../config/env");
const dbService = require("./dbService");
const { evaluateRouteDeviation } = require("./deviationService");

let io = null;

/**
 * Initializes Socket.IO on the provided HTTP server.
 *
 * @param {import("http").Server} httpServer
 * @returns {Server}
 */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: [
        config.CORS_ORIGIN,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
      ].filter(Boolean),
      credentials: true,
      methods: ["GET", "POST"],
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  // Authentication Middleware for all Socket.IO connections
  io.use((socket, next) => {
    try {
      const authHeader =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization;

      if (!authHeader) {
        return next(
          new Error("Authentication error: Token missing from connection handshake")
        );
      }

      const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : authHeader;

      jwt.verify(token, config.JWT_SECRET, (err, decoded) => {
        if (err || !decoded) {
          return next(
            new Error("Authentication error: Invalid or expired JWT token")
          );
        }

        // Fetch fresh user record from SQLite
        const user = dbService.findUserById(decoded.id);
        if (!user) {
          return next(
            new Error("Authentication error: User account does not exist")
          );
        }

        socket.user = {
          id: user.id,
          name: user.name || user.email,
          email: user.email,
          role: user.role,
        };

        next();
      });
    } catch (err) {
      next(new Error(`Authentication error: ${err.message}`));
    }
  });

  // Socket Connection Lifecycle
  io.on("connection", (socket) => {
    const user = socket.user;

    // Join role-specific channels
    if (user.role === "admin") {
      socket.join("admins");
    } else {
      socket.join("drivers");
      socket.join(`driver:${user.id}`);
    }

    // -----------------------------------------------------------
    // 1. START TRACKING SESSION
    // -----------------------------------------------------------
    socket.on("tracking:start", async (payload = {}, callback) => {
      try {
        const { vehicle_id } = payload;
        if (!vehicle_id) {
          const err = { error: "Validation Error", message: "vehicle_id is required" };
          socket.emit("tracking:error", err);
          if (typeof callback === "function") callback(err);
          return;
        }

        // Authorization check: Riders can only start tracking for their assigned vehicle
        if (user.role === "rider") {
          const assignedRiderId = dbService.getRiderByVehicleId(vehicle_id);
          if (String(assignedRiderId) !== String(user.id)) {
            const err = {
              error: "Forbidden",
              message: `You are not assigned to vehicle ${vehicle_id}`,
            };
            socket.emit("tracking:error", err);
            if (typeof callback === "function") callback(err);
            return;
          }
        }

        const session = dbService.startTrackingSession({
          vehicle_id,
          driver_id: user.id,
        });

        // Broadcast to admin dashboard
        io.to("admins").emit("vehicle:status_change", {
          vehicle_id,
          tracking_status: "tracking",
          driver_id: user.id,
          driver_name: user.name,
          started_at: session.start_time,
        });

        socket.emit("tracking:started", session);
        if (typeof callback === "function") callback({ success: true, session });
      } catch (err) {
        const errorResp = { error: "Server Error", message: err.message };
        socket.emit("tracking:error", errorResp);
        if (typeof callback === "function") callback(errorResp);
      }
    });

    // -----------------------------------------------------------
    // 2. STOP TRACKING SESSION
    // -----------------------------------------------------------
    socket.on("tracking:stop", async (payload = {}, callback) => {
      try {
        const { vehicle_id } = payload;
        if (!vehicle_id) {
          const err = { error: "Validation Error", message: "vehicle_id is required" };
          socket.emit("tracking:error", err);
          if (typeof callback === "function") callback(err);
          return;
        }

        if (user.role === "rider") {
          const assignedRiderId = dbService.getRiderByVehicleId(vehicle_id);
          if (String(assignedRiderId) !== String(user.id)) {
            const err = {
              error: "Forbidden",
              message: `You are not assigned to vehicle ${vehicle_id}`,
            };
            socket.emit("tracking:error", err);
            if (typeof callback === "function") callback(err);
            return;
          }
        }

        const stopped = dbService.stopTrackingSession({
          vehicle_id,
          driver_id: user.id,
        });

        // Broadcast to admin dashboard
        io.to("admins").emit("vehicle:status_change", {
          vehicle_id,
          tracking_status: "idle",
          driver_id: user.id,
          driver_name: user.name,
          stopped_at: stopped.stopped_at,
        });

        socket.emit("tracking:stopped", stopped);
        if (typeof callback === "function") callback({ success: true, stopped });
      } catch (err) {
        const errorResp = { error: "Server Error", message: err.message };
        socket.emit("tracking:error", errorResp);
        if (typeof callback === "function") callback(errorResp);
      }
    });

    // -----------------------------------------------------------
    // 3. RECEIVE LIVE GPS PING (gps:update)
    // -----------------------------------------------------------
    socket.on("gps:update", async (data = {}, callback) => {
      try {
        const {
          vehicle_id,
          latitude,
          longitude,
          accuracy,
          speed,
          heading,
          session_id,
          timestamp,
        } = data;

        // Validation: Required vehicle_id
        if (!vehicle_id) {
          const err = { error: "Validation Error", message: "vehicle_id is required" };
          socket.emit("gps:error", err);
          if (typeof callback === "function") callback(err);
          return;
        }

        // Authorization: Verify rider assignment
        if (user.role === "rider") {
          const assignedRiderId = dbService.getRiderByVehicleId(vehicle_id);
          if (String(assignedRiderId) !== String(user.id)) {
            const err = {
              error: "Forbidden",
              message: `Unauthorized: You are not assigned to vehicle '${vehicle_id}'`,
            };
            socket.emit("gps:error", err);
            if (typeof callback === "function") callback(err);
            return;
          }
        }

        // Validation: Coordinates range & numeric type
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
          const err = {
            error: "Validation Error",
            message: `Invalid GPS coordinates: latitude (${latitude}) and longitude (${longitude}) must be valid finite numbers within bounds.`,
          };
          socket.emit("gps:error", err);
          if (typeof callback === "function") callback(err);
          return;
        }

        const acc = Math.max(0, Number(accuracy) || 0);
        const spd = Math.max(0, Number(speed) || 0);
        const hdg = Number(heading) || 0;

        // Fetch planned complete road network route & prior location for deviation comparison
        const plannedRoute = await dbService.getPlannedRouteWithRoadGeometry(vehicle_id);
        const prevLocation = dbService.getVehicleLocation(vehicle_id);
        const prevConsecutive = prevLocation ? prevLocation.consecutive_deviations : 0;
        const prevIsDeviated = prevLocation ? Boolean(prevLocation.is_deviated) : false;

        // Evaluate deviation using Turf.js calculation against complete road network
        const deviation = evaluateRouteDeviation({
          latitude: lat,
          longitude: lon,
          accuracy: acc,
          routeCoordinates: plannedRoute.waypoints || [],
          thresholdMeters: 100,
          previousConsecutiveDeviations: prevConsecutive,
          previousIsDeviated: prevIsDeviated,
          timestamp,
        });

        // Record ping in SQLite (validates coordinates, accuracy & rejects duplicates/outdated readings)
        const pingRecord = dbService.recordGpsPing({
          vehicle_id,
          driver_id: user.id,
          session_id,
          latitude: lat,
          longitude: lon,
          accuracy: acc,
          speed: spd,
          heading: hdg,
          deviation_distance_m: deviation.deviation_distance_m,
          is_deviated: deviation.is_deviated ? 1 : 0,
          consecutive_deviations: deviation.consecutive_deviations,
          timestamp,
        });

        if (pingRecord.rejected) {
          const err = { error: "Ping Rejected", message: pingRecord.reason };
          socket.emit("gps:error", err);
          if (typeof callback === "function") callback(err);
          return;
        }

        // Response payload for admins
        const livePayload = {
          vehicle_id,
          session_id: pingRecord.session_id || session_id || null,
          driver_id: user.id,
          driver_name: user.name,
          latitude: lat,
          longitude: lon,
          accuracy: acc,
          speed: spd,
          heading: hdg,
          timestamp: pingRecord.recorded_at,
          tracking_status: "tracking",
          deviation: {
            is_deviated: deviation.is_deviated,
            deviation_distance_m: deviation.deviation_distance_m,
            accuracy_m: acc,
            consecutive_deviations: deviation.consecutive_deviations,
            status: deviation.status,
            alert_status: deviation.alert_status,
            nearest_point: deviation.nearest_point,
            timestamp: pingRecord.recorded_at,
          },
        };

        // Broadcast to all connected Admins
        io.to("admins").emit("vehicle:update", livePayload);

        // If new deviation declared (>= 3 consecutive pings), record event in SQLite and emit prioritized alert
        if (deviation.is_new_alert) {
          dbService.recordDeviationEvent({
            vehicle_id,
            driver_id: user.id,
            session_id,
            run_id: plannedRoute.run_id,
            deviation_distance_m: deviation.deviation_distance_m,
            threshold_m: deviation.threshold_m,
            consecutive_pings: deviation.consecutive_deviations,
            latitude: lat,
            longitude: lon,
            is_simulated: 0,
          });

          io.to("admins").emit("alert:deviation", {
            vehicle_id,
            driver_name: user.name,
            distance_m: deviation.deviation_distance_m,
            alert_status: deviation.alert_status,
            latitude: lat,
            longitude: lon,
            timestamp: pingRecord.recorded_at,
          });
        } else if (deviation.is_deviated) {
          // Ongoing deviation: update DB distance without duplicate alert spam
          dbService.recordDeviationEvent({
            vehicle_id,
            driver_id: user.id,
            session_id,
            run_id: plannedRoute.run_id,
            deviation_distance_m: deviation.deviation_distance_m,
            threshold_m: deviation.threshold_m,
            consecutive_pings: deviation.consecutive_deviations,
            latitude: lat,
            longitude: lon,
            is_simulated: 0,
          });
        }

        // If vehicle has returned to acceptable corridor, resolve deviation event in DB and emit resolution event
        if (deviation.was_resolved) {
          dbService.resolveDeviationEvent(vehicle_id);
          io.to("admins").emit("alert:deviation_resolved", {
            vehicle_id,
            driver_name: user.name,
            timestamp: pingRecord.recorded_at,
            message: `Vehicle ${vehicle_id} has returned to the planned route corridor`,
          });
        }

        // Acknowledge back to driver
        socket.emit("gps:ack", {
          success: true,
          timestamp: pingRecord.recorded_at,
          deviation_distance_m: deviation.deviation_distance_m,
          is_deviated: deviation.is_deviated,
        });

        if (typeof callback === "function") {
          callback({ success: true, data: livePayload });
        }
      } catch (err) {
        const errorResp = { error: "Processing Error", message: err.message };
        socket.emit("gps:error", errorResp);
        if (typeof callback === "function") callback(errorResp);
      }
    });

    socket.on("disconnect", (reason) => {
      // If driver disconnects, we keep the last known position in SQLite
      // Driver status remains 'tracking' until explicitly stopped or after TTL
    });
  });

  return io;
}

/**
 * Returns the initialized Socket.IO server instance.
 * @returns {Server|null}
 */
function getIO() {
  return io;
}

module.exports = {
  initSocket,
  getIO,
};

