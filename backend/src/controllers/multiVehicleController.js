/**
 * PathWise Multi-Vehicle Route Planning & Simulation Controller
 *
 * Exposes administration & planning endpoints for interactive map-based
 * multi-vehicle route optimization, road simulation, and fleet telemetry.
 */

const multiVehicleRouteService = require('../services/multiVehicleRouteService');
const simulationService = require('../services/simulationService');
const dbService = require('../services/dbService');

/**
 * GET /api/multi-vehicle/locations
 * Returns Nagpur landmark delivery hubs and locations for map search & autocomplete.
 */
async function getLocations(req, res, next) {
  try {
    const locations = multiVehicleRouteService.getNagpurLocations();
    return res.status(200).json({
      success: true,
      count: locations.length,
      locations,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/multi-vehicle/plan
 * Calculates road-following routes for multiple vehicles using the existing multi-factor routing engine.
 */
async function planRoutes(req, res, next) {
  try {
    const { start, destination, vehicles, traffic_multiplier, avoid_closures } = req.body || {};

    if (!start || !destination) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Both start and destination locations with coordinates are required.',
      });
    }

    const plan = await multiVehicleRouteService.planMultiVehicleJourney({
      start,
      destination,
      vehicles,
      traffic_multiplier,
      avoid_closures,
    });

    return res.status(200).json(plan);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/multi-vehicle/simulate/start
 * Launches concurrent road-based simulations for multiple vehicles.
 */
async function startSimulation(req, res, next) {
  try {
    const { simulations = [], vehicle_id, route_coords, speed_multiplier, model, color } = req.body || {};

    let simItems = [];
    if (Array.isArray(simulations) && simulations.length > 0) {
      simItems = simulations;
    } else if (vehicle_id) {
      simItems = [{ vehicle_id, route_coords, speed_multiplier, model, color, is_point_to_point: true }];
    } else {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Provide vehicle_id or array of simulations to start.',
      });
    }

    const started = [];
    for (const item of simItems) {
      const vId = item.vehicle_id;
      // Ensure vehicle exists in DB as simulated
      dbService.createSimulatedVehicle({
        vehicle_id: vId,
        manufacturer: 'PathWise Multi-Sim',
        model: item.model || 'Autonomous Carrier',
        configured_capacity_kg: item.capacity_kg || 500,
        driver_name: `Virtual Pilot (${vId})`,
      });

      const sim = simulationService.startSimulation({
        vehicle_id: vId,
        route_coords: item.route_coords || item.waypoints || [],
        speed_multiplier: item.speed_multiplier || 1,
        is_point_to_point: item.is_point_to_point !== false,
        model: item.model,
        color: item.color,
      });

      started.push(sim);
    }

    return res.status(200).json({
      success: true,
      message: `Started ${started.length} vehicle simulation(s) along road geometry.`,
      simulations: started,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/multi-vehicle/simulate/pause
 */
async function pauseSimulation(req, res, next) {
  try {
    const { vehicle_id, vehicle_ids = [] } = req.body || {};
    const targets = vehicle_id ? [vehicle_id] : vehicle_ids;

    if (targets.length === 0) {
      // Pause all active simulations
      const status = simulationService.getSimulationStatus();
      for (const s of status.simulations) {
        simulationService.pauseSimulation(s.vehicle_id);
      }
      return res.status(200).json({ success: true, message: 'Paused all active simulations.' });
    }

    const results = targets.map((vId) => simulationService.pauseSimulation(vId));
    return res.status(200).json({ success: true, results });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/multi-vehicle/simulate/resume
 */
async function resumeSimulation(req, res, next) {
  try {
    const { vehicle_id, vehicle_ids = [] } = req.body || {};
    const targets = vehicle_id ? [vehicle_id] : vehicle_ids;

    if (targets.length === 0) {
      // Resume all paused simulations
      const status = simulationService.getSimulationStatus();
      for (const s of status.simulations) {
        if (s.status === 'paused') {
          simulationService.resumeSimulationMovement(s.vehicle_id);
        }
      }
      return res.status(200).json({ success: true, message: 'Resumed all paused simulations.' });
    }

    const results = targets.map((vId) => simulationService.resumeSimulationMovement(vId));
    return res.status(200).json({ success: true, results });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/multi-vehicle/simulate/stop
 */
async function stopSimulation(req, res, next) {
  try {
    const { vehicle_id, vehicle_ids = [] } = req.body || {};
    const targets = vehicle_id ? [vehicle_id] : vehicle_ids;

    if (targets.length === 0) {
      // Stop all active simulations
      const status = simulationService.getSimulationStatus();
      for (const s of status.simulations) {
        simulationService.stopSimulation(s.vehicle_id);
      }
      return res.status(200).json({ success: true, message: 'Stopped all active simulations.' });
    }

    const results = targets.map((vId) => simulationService.stopSimulation(vId));
    return res.status(200).json({ success: true, results });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/multi-vehicle/simulate/reset
 */
async function resetSimulation(req, res, next) {
  try {
    const { vehicle_id, vehicle_ids = [] } = req.body || {};
    const targets = vehicle_id ? [vehicle_id] : vehicle_ids;

    if (targets.length === 0) {
      // Reset all simulations
      const status = simulationService.getSimulationStatus();
      for (const s of status.simulations) {
        simulationService.resetSimulation(s.vehicle_id);
      }
      return res.status(200).json({ success: true, message: 'Reset all active simulations to start position.' });
    }

    const results = targets.map((vId) => simulationService.resetSimulation(vId));
    return res.status(200).json({ success: true, results });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/multi-vehicle/simulate/speed
 */
async function setSpeed(req, res, next) {
  try {
    const { vehicle_id, multiplier = 1 } = req.body || {};
    if (vehicle_id) {
      const resData = simulationService.setSimulationSpeed(vehicle_id, multiplier);
      return res.status(200).json(resData);
    }

    const status = simulationService.getSimulationStatus();
    const results = status.simulations.map((s) => simulationService.setSimulationSpeed(s.vehicle_id, multiplier));
    return res.status(200).json({ success: true, multiplier, results });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getLocations,
  planRoutes,
  startSimulation,
  pauseSimulation,
  resumeSimulation,
  stopSimulation,
  resetSimulation,
  setSpeed,
};

