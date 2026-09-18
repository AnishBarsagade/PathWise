const pythonOptimizerService = require('../services/pythonOptimizerService');

async function optimizeRoutes(req, res, next) {
  try {
    const inputData = req.body || {};
    const result = await pythonOptimizerService.runOptimization(inputData);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  optimizeRoutes,
};
