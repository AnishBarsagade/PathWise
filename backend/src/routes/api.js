const express = require("express");

const { getHealth } = require("../controllers/healthController");
const { optimizeRoutes } = require("../controllers/optimizationController");
const { getRealtimeData } = require("../controllers/realtimeController");

const {
  getOptimizationHistory,
  getOptimizationById,
  getReroutingHistory,
} = require("../controllers/historyController");

const { login, signup, getMe } = require("../controllers/authController");

const validateOptimizationInput = require("../middleware/validateOptimizationInput");
const authMiddleware = require("../middleware/authMiddleware");
const { rerouteRoutes } = require("../controllers/reroutingController");

const router = express.Router();

// Health
router.get("/health", getHealth);

// Authentication
router.post("/auth/signup", signup);
router.post("/auth/login", login);
router.get("/auth/me", authMiddleware, getMe);

// Realtime data
router.get("/realtime-data", getRealtimeData);

// Optimization
router.post("/optimize", validateOptimizationInput, optimizeRoutes);

// Optimization history
router.get("/optimization/history", getOptimizationHistory);
router.get("/optimization/:id", getOptimizationById);

// Dynamic rerouting
router.get("/rerouting/history", getReroutingHistory);
router.post("/reroute", rerouteRoutes);


module.exports = router;
