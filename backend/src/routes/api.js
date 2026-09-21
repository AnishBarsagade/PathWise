const express = require('express');
const { getHealth } = require('../controllers/healthController');
const { optimizeRoutes } = require('../controllers/optimizationController');
const validateOptimizationInput = require('../middleware/validateOptimizationInput');

const router = express.Router();

router.get('/health', getHealth);
router.post('/optimize', validateOptimizationInput, optimizeRoutes);

module.exports = router;
