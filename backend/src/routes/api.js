const express = require("express");

const { getHealth } = require("../controllers/healthController");
const { optimizeRoutes, getAhpWeights, compareOptimization } = require("../controllers/optimizationController");
const { getAstarDetour } = require("../controllers/astarController");
const { getRealtimeData } = require("../controllers/realtimeController");

const {
  getOptimizationHistory,
  getOptimizationById,
  getReroutingHistory,
} = require("../controllers/historyController");

const { login, signup, getMe } = require("../controllers/authController");
const rider = require("../controllers/riderController");
const tracking = require("../controllers/trackingController");
const simulation = require("../controllers/simulationController");
const multiVehicle = require("../controllers/multiVehicleController");

const validateOptimizationInput = require("../middleware/validateOptimizationInput");
const authMiddleware = require("../middleware/authMiddleware");
const { optionalAuthMiddleware } = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");
const { rerouteRoutes } = require("../controllers/reroutingController");
const logistics = require('../controllers/logisticsController');
const { getRouteGeometries } = require('../controllers/routeGeometryController');

const router = express.Router();

// Health
router.get("/health", getHealth);

// Authentication
router.post("/auth/signup", signup);
router.post("/auth/login", login);
router.get("/auth/me", authMiddleware, getMe);

// Rider assignments & directory
router.get("/riders", authMiddleware, adminMiddleware, rider.listRiders);
router.get("/rider/assignments", authMiddleware, rider.getMyAssignments);
router.get("/rider/assignments/:userId", authMiddleware, rider.getRiderAssignmentsById);
router.post("/rider/assignments", authMiddleware, adminMiddleware, rider.assignRider);
router.delete("/rider/assignments/:userId/:vehicleId?", authMiddleware, adminMiddleware, rider.unassignRider);

// Delivery status update (Rider or Admin)
router.patch('/deliveries/:id/status', authMiddleware, rider.updateDeliveryStatus);

// Live GPS Vehicle Tracking
router.get("/tracking/vehicles", authMiddleware, tracking.getAllVehicles);
router.get("/tracking/vehicles/:id", authMiddleware, tracking.getVehicleStatus);
router.get("/tracking/history/:id", authMiddleware, tracking.getVehicleTrail);
router.get("/tracking/planned-route/:id", authMiddleware, tracking.getPlannedRoute);
router.get("/tracking/deviations", authMiddleware, tracking.getDeviationEvents);
router.post("/tracking/ping", authMiddleware, tracking.postGpsPing);
router.post("/tracking/session/start", authMiddleware, tracking.startSession);
router.post("/tracking/session/stop", authMiddleware, tracking.stopSession);

// Simulation Mode (Admin Controlled)
router.get("/simulation/status", authMiddleware, simulation.getStatus);
router.get("/simulation/routes", authMiddleware, simulation.getAvailableRoutes);
router.post("/simulation/vehicles", authMiddleware, adminMiddleware, simulation.createVehicle);
router.post("/simulation/start", authMiddleware, adminMiddleware, simulation.start);
router.post("/simulation/speed", authMiddleware, adminMiddleware, simulation.setSpeed);
router.post("/simulation/deviate", authMiddleware, adminMiddleware, simulation.triggerDeviate);
router.post("/simulation/resume", authMiddleware, adminMiddleware, simulation.resume);
router.post("/simulation/pause", authMiddleware, adminMiddleware, simulation.pause);
router.post("/simulation/resume-movement", authMiddleware, adminMiddleware, simulation.resumeMovement);
router.post("/simulation/breakdown", authMiddleware, adminMiddleware, simulation.triggerBreakdownIncident);
router.post("/simulation/stop", authMiddleware, adminMiddleware, simulation.stop);

// Interactive Multi-Vehicle Route Planning & Road Simulation
router.get("/multi-vehicle/locations", optionalAuthMiddleware, multiVehicle.getLocations);
router.post("/multi-vehicle/plan", optionalAuthMiddleware, multiVehicle.planRoutes);
router.post("/multi-vehicle/simulate/start", authMiddleware, adminMiddleware, multiVehicle.startSimulation);
router.post("/multi-vehicle/simulate/pause", authMiddleware, adminMiddleware, multiVehicle.pauseSimulation);
router.post("/multi-vehicle/simulate/resume", authMiddleware, adminMiddleware, multiVehicle.resumeSimulation);
router.post("/multi-vehicle/simulate/stop", authMiddleware, adminMiddleware, multiVehicle.stopSimulation);
router.post("/multi-vehicle/simulate/reset", authMiddleware, adminMiddleware, multiVehicle.resetSimulation);
router.post("/multi-vehicle/simulate/speed", authMiddleware, adminMiddleware, multiVehicle.setSpeed);

// Persistent synthetic logistics data. Reads are available to the protected UI;
// mutations require an authenticated administrator.
router.get('/dashboard/stats', logistics.dashboardStats);
router.get('/deliveries', logistics.listDeliveries);
router.get('/deliveries/:id', logistics.getDelivery);
router.post('/deliveries', authMiddleware, adminMiddleware, logistics.createDelivery);
router.put('/deliveries/:id', authMiddleware, adminMiddleware, logistics.updateDelivery);
router.delete('/deliveries/:id', authMiddleware, adminMiddleware, logistics.deleteDelivery);
router.get('/vehicles', logistics.listVehicles);
router.get('/vehicles/:id', logistics.getVehicle);
router.post('/vehicles', authMiddleware, adminMiddleware, logistics.createVehicle);
router.put('/vehicles/:id', authMiddleware, adminMiddleware, logistics.updateVehicle);
router.delete('/vehicles/:id', authMiddleware, adminMiddleware, logistics.deleteVehicle);
router.post('/demo/seed', authMiddleware, adminMiddleware, logistics.seedDemo);

// Realtime data
router.get("/realtime-data", getRealtimeData);

// Optimization (Fleet-wide optimization requires Admin authorization)
router.get('/ahp/weights', getAhpWeights);
router.post('/route-geometry', getRouteGeometries);
router.post("/optimize", authMiddleware, adminMiddleware, validateOptimizationInput, optimizeRoutes);
router.post("/optimize/compare", authMiddleware, adminMiddleware, validateOptimizationInput, compareOptimization);

// A* Detour pathfinding
router.post("/astar/detour", optionalAuthMiddleware, getAstarDetour);

// Optimization history
router.get("/optimization/history", getOptimizationHistory);
router.get("/optimization/:id", getOptimizationById);

// Dynamic rerouting
router.get("/rerouting/history", getReroutingHistory);
router.post("/reroute", optionalAuthMiddleware, rerouteRoutes);

module.exports = router;
