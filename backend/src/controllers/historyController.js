const dbService = require('../services/dbService');

/**
 * Controller to fetch optimization run history.
 * GET /api/optimization/history
 */
async function getOptimizationHistory(req, res, next) {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const history = dbService.getOptimizationHistory(limit);
    res.status(200).json(history);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller to fetch a specific optimization run by ID.
 * GET /api/optimization/:id
 */
async function getOptimizationById(req, res, next) {
  try {
    const { id } = req.params;
    const run = dbService.getOptimizationRunById(id);

    if (!run) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Optimization run with ID '${id}' was not found.`,
      });
    }

    res.status(200).json(run);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller to fetch rerouting event history.
 * GET /api/rerouting/history
 */
async function getReroutingHistory(req, res, next) {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const history = dbService.getReroutingHistory(limit);
    res.status(200).json(history);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getOptimizationHistory,
  getOptimizationById,
  getReroutingHistory,
};
