const astarService = require('../services/astarService');

async function getAstarDetour(req, res, next) {
  try {
    const { start, goal, closed_edges, traffic_multipliers, avoid_nodes } = req.body || {};
    if (!start || !goal) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Both start and goal node identifiers are required (e.g. DEPOT, D001).',
      });
    }

    const result = await astarService.findAstarDetour({
      start: String(start).trim().toUpperCase(),
      goal: String(goal).trim().toUpperCase(),
      closed_edges: Array.isArray(closed_edges) ? closed_edges : [],
      traffic_multipliers: typeof traffic_multipliers === 'object' ? traffic_multipliers : {},
      avoid_nodes: Array.isArray(avoid_nodes) ? avoid_nodes : [],
    });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { getAstarDetour };
