/**
 * PathWise Simulation Controller
 *
 * Exposes administration endpoints for creating virtual vehicles, selecting
 * planned routes, adjusting speed multipliers, and triggering deviation/breakdown events.
 */

const simulationService = require("../services/simulationService");
const dbService = require("../services/dbService");

async function getStatus(req, res, next) {
  try {
    const status = simulationService.getSimulationStatus();
    return res.status(200).json(status);
  } catch (err) {
    next(err);
  }
}

async function getAvailableRoutes(req, res, next) {
  try {
    const routes = dbService.getAvailableSimulationRoutes();
    return res.status(200).json({
      total: routes.length,
      routes,
    });
  } catch (err) {
    next(err);
  }
}

async function createVehicle(req, res, next) {
  try {
    const { vehicle_id, manufacturer, model, configured_capacity_kg, driver_name } = req.body || {};
    const created = dbService.createSimulatedVehicle({
      vehicle_id,
      manufacturer,
      model,
      configured_capacity_kg,
      driver_name,
    });
    return res.status(201).json({
      message: "Simulated vehicle created successfully.",
      vehicle: created,
    });
  } catch (err) {
    next(err);
  }
}

async function start(req, res, next) {
  try {
    const { vehicle_id, route_coords, speed_multiplier, run_id } = req.body || {};
    if (!vehicle_id) {
      return res.status(400).json({
        error: "Validation Error",
        message: "vehicle_id is required to start simulation.",
      });
    }

    const sim = simulationService.startSimulation({
      vehicle_id,
      route_coords,
      speed_multiplier,
      run_id,
    });

    return res.status(200).json({
      message: `Simulation started for vehicle ${vehicle_id}.`,
      simulation: sim,
    });
  } catch (err) {
    next(err);
  }
}

async function setSpeed(req, res, next) {
  try {
    const { vehicle_id, multiplier } = req.body || {};
    if (!vehicle_id) {
      return res.status(400).json({ error: "Validation Error", message: "vehicle_id is required." });
    }
    const result = simulationService.setSimulationSpeed(vehicle_id, multiplier);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function triggerDeviate(req, res, next) {
  try {
    const { vehicle_id } = req.body || {};
    if (!vehicle_id) {
      return res.status(400).json({ error: "Validation Error", message: "vehicle_id is required." });
    }
    const result = simulationService.triggerDeviation(vehicle_id);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function resume(req, res, next) {
  try {
    const { vehicle_id } = req.body || {};
    if (!vehicle_id) {
      return res.status(400).json({ error: "Validation Error", message: "vehicle_id is required." });
    }
    const result = simulationService.resumeRoute(vehicle_id);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function triggerBreakdownIncident(req, res, next) {
  try {
    const { vehicle_id } = req.body || {};
    if (!vehicle_id) {
      return res.status(400).json({ error: "Validation Error", message: "vehicle_id is required." });
    }
    const result = simulationService.triggerBreakdown(vehicle_id);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function pause(req, res, next) {
  try {
    const { vehicle_id } = req.body || {};
    if (!vehicle_id) {
      return res.status(400).json({ error: "Validation Error", message: "vehicle_id is required." });
    }
    const result = simulationService.pauseSimulation(vehicle_id);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function resumeMovement(req, res, next) {
  try {
    const { vehicle_id } = req.body || {};
    if (!vehicle_id) {
      return res.status(400).json({ error: "Validation Error", message: "vehicle_id is required." });
    }
    const result = simulationService.resumeSimulationMovement(vehicle_id);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function stop(req, res, next) {
  try {
    const { vehicle_id } = req.body || {};
    if (!vehicle_id) {
      return res.status(400).json({ error: "Validation Error", message: "vehicle_id is required." });
    }
    const result = simulationService.stopSimulation(vehicle_id);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getStatus,
  getAvailableRoutes,
  createVehicle,
  start,
  setSpeed,
  triggerDeviate,
  resume,
  pause,
  resumeMovement,
  triggerBreakdownIncident,
  stop,
};

