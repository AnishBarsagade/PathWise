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
    let inputData = req.body || {};

    // A no-payload run is data-driven once persistent logistics records exist.
    // Retain CSV defaults only for a clean database, preserving the established demo.
    const hasCustomInput = Array.isArray(inputData.deliveries) || Array.isArray(inputData.vehicles);
    if (!hasCustomInput) {
      const savedInput = dbService.getOptimizationInputFromDatabase();
      if (savedInput.deliveries.length || savedInput.vehicles.length) {
        if (!savedInput.deliveries.length || !savedInput.vehicles.length) {
          const error = new Error('No eligible saved deliveries or no available vehicles exist for optimization.');
          error.statusCode = 400;
          error.error = 'Optimization input unavailable';
          throw error;
        }
        inputData = { ...savedInput, source: 'database' };
      }
    }

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
    result.ahp_weights = AHP_WEIGHTS;
    result.delivery_records = Array.isArray(inputData.deliveries) ? inputData.deliveries : [];
    result.vehicle_records = Array.isArray(inputData.vehicles) ? inputData.vehicles : [];
    result.eligible_vehicle_ids = result.vehicle_records.map((vehicle) => vehicle.vehicle_id);
    result.eligible_vehicle_count = result.eligible_vehicle_ids.length;
    const considered = Array.isArray(inputData.deliveries) ? inputData.deliveries.map((d) => String(d.delivery_id)) : [];
    if (considered.length) {
      const served = new Set(result.routes.flatMap((route) => route.route.filter((stop) => stop !== 'DEPOT')));
      result.deliveries_considered = considered.length;
      result.unserved_delivery_ids = considered.filter((id) => !served.has(id));
      result.deliveries_unserved = result.unserved_delivery_ids.length;
    }

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
    result.input_source = inputData.source || (hasCustomInput ? 'request' : 'default_csv');

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function compareOptimization(req, res, next) {
  try {
    let inputData = req.body || {};
    const hasCustomInput = Array.isArray(inputData.deliveries) || Array.isArray(inputData.vehicles);
    if (!hasCustomInput) {
      const savedInput = dbService.getOptimizationInputFromDatabase();
      if (savedInput.deliveries.length || savedInput.vehicles.length) {
        inputData = { ...savedInput, source: 'database' };
      }
    }
    inputData.compare = true;
    const result = await pythonOptimizerService.runOptimization(inputData);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  optimizeRoutes,
  compareOptimization,
  getAhpWeights: (req, res) => res.status(200).json({ weights: AHP_WEIGHTS }),
};
