const fs = require('fs');
const path = require('path');
const dbService = require('../services/dbService');
const pythonOptimizerService = require('../services/pythonOptimizerService');

const VALID_INCIDENT_TYPES = [
  'Traffic Congestion',
  'Road Closure',
  'Weather',
  'Accident',
];

let defaultDeliveriesMap = null;

/**
 * Loads default deliveries map from CSV for fallback coordinate/weight lookup.
 */
function getDefaultDeliveriesMap() {
  if (defaultDeliveriesMap) return defaultDeliveriesMap;
  try {
    const csvPath = path.resolve(__dirname, '../../../data/deliveries.csv');
    const content = fs.readFileSync(csvPath, 'utf8').trim();
    const lines = content.split('\n');
    const map = {};
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length >= 6) {
        map[parts[0].trim()] = {
          delivery_id: parts[0].trim(),
          location: parts[1].trim(),
          latitude: parseFloat(parts[2]),
          longitude: parseFloat(parts[3]),
          weight: parseInt(parts[4], 10),
          priority: parts[5].trim(),
        };
      }
    }
    defaultDeliveriesMap = map;
    return map;
  } catch (err) {
    console.error('[Rerouting] Failed to load default deliveries CSV:', err.message);
    return {};
  }
}

/**
 * Controller to handle dynamic scenario-based rerouting.
 * POST /api/reroute
 */
async function rerouteRoutes(req, res, next) {
  try {
    const { run_id, vehicle_id, incident_type, incident_details } = req.body || {};

    // 1. Validate required fields
    if (!run_id) {
      return res.status(400).json({
        error: 'Missing run_id',
        message: 'Optimization run ID (run_id) is required.',
      });
    }

    if (!vehicle_id) {
      return res.status(400).json({
        error: 'Missing vehicle_id',
        message: 'Vehicle ID (vehicle_id) is required.',
      });
    }

    if (!incident_type) {
      return res.status(400).json({
        error: 'Missing incident_type',
        message: `Incident type is required. Valid types: ${VALID_INCIDENT_TYPES.join(', ')}.`,
      });
    }

    const matchedIncidentType = VALID_INCIDENT_TYPES.find(
      (t) => t.toLowerCase() === String(incident_type).trim().toLowerCase()
    );

    if (!matchedIncidentType) {
      return res.status(400).json({
        error: 'Invalid incident_type',
        message: `Incident type must be one of: ${VALID_INCIDENT_TYPES.join(', ')}.`,
      });
    }

    // 2. Retrieve the optimization run
    const run = dbService.getOptimizationRunById(run_id);
    if (!run) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Optimization run with ID '${run_id}' was not found.`,
      });
    }

    // 3. Find the selected vehicle route
    const routes = run.routes || (run.result && run.result.routes) || [];
    const routeObj = routes.find((r) => r.vehicle_id === vehicle_id);
    if (!routeObj) {
      return res.status(400).json({
        error: 'Vehicle Not Found',
        message: `Vehicle '${vehicle_id}' has no assigned route in optimization run '${run_id}'.`,
      });
    }

    const original_route = Array.isArray(routeObj.route) ? routeObj.route : [];
    const originalStops = original_route.filter((s) => s !== 'DEPOT');

    if (originalStops.length === 0) {
      return res.status(400).json({
        error: 'Invalid Route',
        message: `Vehicle '${vehicle_id}' has no delivery stops to reroute.`,
      });
    }

    // 4. Parse and validate incident details
    const details =
      typeof incident_details === 'object' && incident_details !== null
        ? { ...incident_details }
        : { location: String(incident_details || '') };

    let location = details.location ? String(details.location).trim() : '';
    const severity = details.severity ? String(details.severity).trim() : 'High';

    if (location && !originalStops.includes(location)) {
      return res.status(400).json({
        error: 'Invalid Incident Location',
        message: `Incident location '${location}' is not an active delivery stop for vehicle '${vehicle_id}'. Active stops: ${originalStops.join(', ')}.`,
      });
    }

    // Default to the first delivery stop if none provided
    if (!location) {
      location = originalStops[0];
      details.location = location;
    }

    details.severity = severity;

    const originalCost = Number(routeObj.cost) || 0.0;
    let rerouted_route = [];
    let reroutedCost = originalCost;
    let reason = '';
    const extraMetrics = {};

    // 5. Generate rerouted route based on incident scenario
    if (matchedIncidentType === 'Road Closure') {
      // Road closure at target location -> bypass/defer stop
      const remainingStops = originalStops.filter((s) => s !== location);

      if (remainingStops.length === 0) {
        rerouted_route = ['DEPOT', 'DEPOT'];
        reroutedCost = 0.0;
        reason = `Road Closure at ${location} (${severity} severity): Access corridor blocked. Delivery deferred to next cycle; vehicle directed to return to depot.`;
      } else {
        let solverRecalculated = false;
        try {
          const deliveriesLookup = {
            ...getDefaultDeliveriesMap(),
            ...(run.input_config && Array.isArray(run.input_config.deliveries)
              ? Object.fromEntries(run.input_config.deliveries.map((d) => [d.delivery_id, d]))
              : {}),
          };

          const remainingDeliveryObjects = remainingStops.map((id) => {
            return (
              deliveriesLookup[id] || {
                delivery_id: id,
                latitude: 21.1458,
                longitude: 79.0882,
                weight: 100,
                priority: 'Medium',
              }
            );
          });

          const solverPayload = {
            deliveries: remainingDeliveryObjects,
            vehicles: [
              {
                vehicle_id: vehicle_id,
                capacity: routeObj.capacity || 500,
                fuel_cost: 10.0,
              },
            ],
          };

          const solverResult = await pythonOptimizerService.runOptimization(solverPayload);
          if (solverResult && Array.isArray(solverResult.routes) && solverResult.routes[0]) {
            rerouted_route = solverResult.routes[0].route;
            reroutedCost = Number(solverResult.routes[0].cost) || Number(solverResult.total_cost) || 0.0;
            solverRecalculated = true;
          }
        } catch (_) {
          // Graceful fallback to sequential remaining stops
        }

        if (!solverRecalculated) {
          rerouted_route = ['DEPOT', ...remainingStops, 'DEPOT'];
          reroutedCost = Number((originalCost * (remainingStops.length / originalStops.length)).toFixed(4));
        }

        reason = `Road Closure at ${location} (${severity} severity): Access corridor obstructed. Delivery bypassed and deferred to secondary dispatch cycle; route re-sequenced for remaining ${remainingStops.length} stops.`;
        extraMetrics.bypassed_stops = [location];
      }
    } else if (matchedIncidentType === 'Traffic Congestion') {
      // Peak-hour congestion -> reschedule stop to end of delivery cycle
      const remainingStops = originalStops.filter((s) => s !== location);
      if (originalStops[originalStops.length - 1] === location && originalStops.length > 1) {
        rerouted_route = ['DEPOT', location, ...remainingStops, 'DEPOT'];
      } else {
        rerouted_route = ['DEPOT', ...remainingStops, location, 'DEPOT'];
      }

      const mult = severity.toLowerCase() === 'high' ? 1.15 : severity.toLowerCase() === 'medium' ? 1.08 : 1.04;
      reroutedCost = Number((originalCost * mult).toFixed(4));
      const delayMinutes = severity.toLowerCase() === 'high' ? 18 : severity.toLowerCase() === 'medium' ? 10 : 5;

      reason = `Traffic Congestion at ${location} (${severity} severity): Heavy congestion along primary corridor. Stop rescheduled to the end of the route cycle to bypass peak-hour bottleneck.`;
      extraMetrics.delay_estimate_minutes = delayMinutes;
    } else if (matchedIncidentType === 'Accident') {
      // Traffic collision -> safe perimeter detour applied
      const remainingStops = originalStops.filter((s) => s !== location);
      rerouted_route = ['DEPOT', ...remainingStops, location, 'DEPOT'];

      const mult = severity.toLowerCase() === 'high' ? 1.12 : 1.06;
      reroutedCost = Number((originalCost * mult).toFixed(4));
      const delayMinutes = severity.toLowerCase() === 'high' ? 15 : 8;

      reason = `Traffic Accident near ${location} (${severity} severity): Emergency response obstruction. Route resequenced with perimeter detour around the collision zone.`;
      extraMetrics.delay_estimate_minutes = delayMinutes;
    } else if (matchedIncidentType === 'Weather') {
      // Adverse weather -> prioritize accessible stops before storm sector
      const remainingStops = originalStops.filter((s) => s !== location);
      rerouted_route = ['DEPOT', ...remainingStops, location, 'DEPOT'];

      const mult = severity.toLowerCase() === 'high' ? 1.14 : 1.07;
      reroutedCost = Number((originalCost * mult).toFixed(4));

      reason = `Adverse Weather at ${location} (${severity} severity): Localized waterlogging/hazard. Deliveries reordered to service accessible stops first before navigating storm sector.`;
    }

    const costDelta = Number((reroutedCost - originalCost).toFixed(4));

    const metrics = {
      original_cost: originalCost,
      rerouted_cost: reroutedCost,
      cost_delta: costDelta,
      original_stops_count: originalStops.length,
      rerouted_stops_count: rerouted_route.filter((s) => s !== 'DEPOT').length,
      incident_location: location,
      severity: severity,
      status: 'Rerouted Successfully',
      ...extraMetrics,
    };

    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const createdAt = new Date().toISOString();

    // 6. Persist rerouting event in SQLite
    dbService.saveReroutingEvent({
      event_id: eventId,
      run_id: run_id,
      vehicle_id: vehicle_id,
      created_at: createdAt,
      incident_type: matchedIncidentType,
      incident_details: details,
      original_route: original_route,
      rerouted_route: rerouted_route,
      metrics: metrics,
      reason: reason,
    });

    // 7. Return structured response
    res.status(200).json({
      event_id: eventId,
      run_id: run_id,
      vehicle_id: vehicle_id,
      created_at: createdAt,
      incident_type: matchedIncidentType,
      incident_details: details,
      original_route: original_route,
      rerouted_route: rerouted_route,
      metrics: metrics,
      reason: reason,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  rerouteRoutes,
  VALID_INCIDENT_TYPES,
};
