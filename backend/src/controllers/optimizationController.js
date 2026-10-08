const pythonOptimizerService = require('../services/pythonOptimizerService');
const dbService = require('../services/dbService');
const realtimeService = require('../services/realtimeService');

const AHP_WEIGHTS = {
  distance: 0.3004,
  travel_time: 0.2691,
  traffic: 0.1706,
  fuel_cost: 0.1195,
  weather: 0.0744,
  road_condition: 0.0661,
};

async function optimizeRoutes(req, res, next) {
  try {
    const inputData = req.body || {};

    // 1. Fetch current real-time environmental snapshot
    let realtimeData;
    try {
      realtimeData = await realtimeService.getRealtimeData();
    } catch (_) {
      realtimeData = {
        source: 'fallback',
        timestamp: new Date().toISOString(),
        weather: realtimeService.FALLBACK_WEATHER,
        traffic: realtimeService.DEMO_TRAFFIC,
      };
    }

    // 2. Execute Python multi-factor VRP solver
    const result = await pythonOptimizerService.runOptimization(inputData);

    // 3. Generate unique run ID and persist to SQLite
    const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const createdAt = new Date().toISOString();

    try {
      dbService.saveOptimizationRun({
        run_id: runId,
        created_at: createdAt,
        input_config: inputData,
        ahp_weights: AHP_WEIGHTS,
        realtime_source: realtimeData.source || 'fallback',
        realtime_timestamp: realtimeData.timestamp || createdAt,
        realtime_data: realtimeData,
        routes: result.routes,
        total_cost: result.total_cost,
        total_load: result.total_load,
        priority_summary: result.priority_summary || null,
        result_json: result,
      });
    } catch (dbErr) {
      console.error('[DB Persistence Warning]', dbErr.message);
    }

    // 4. Attach run metadata without breaking existing response contract
    result.run_id = runId;
    result.created_at = createdAt;
    result.realtime = realtimeData;

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  optimizeRoutes,
};
