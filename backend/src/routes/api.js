const express = require("express");

const { getHealth } = require("../controllers/healthController");
const { optimizeRoutes, getAhpWeights } = require("../controllers/optimizationController");
const { getRealtimeData } = require("../controllers/realtimeController");

const {
  getOptimizationHistory,
  getOptimizationById,
  getReroutingHistory,
} = require("../controllers/historyController");

const { login, signup, getMe } = require("../controllers/authController");

const validateOptimizationInput = require("../middleware/validateOptimizationInput");
const authMiddleware = require("../middleware/authMiddleware");
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

// Optimization
router.get('/ahp/weights', getAhpWeights);
router.post('/route-geometry', getRouteGeometries);
router.post("/optimize", validateOptimizationInput, optimizeRoutes);

// Optimization history
router.get("/optimization/history", getOptimizationHistory);
router.get("/optimization/:id", getOptimizationById);

// Dynamic rerouting
router.get("/rerouting/history", getReroutingHistory);
router.post("/reroute", rerouteRoutes);


module.exports = router;
