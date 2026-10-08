const realtimeService = require('../services/realtimeService');

/**
 * Controller to fetch current real-time environmental data (weather & traffic).
 * GET /api/realtime-data
 */
async function getRealtimeData(req, res, next) {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const data = await realtimeService.getRealtimeData(forceRefresh);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getRealtimeData,
};
