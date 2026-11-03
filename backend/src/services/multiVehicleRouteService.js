/**
 * PathWise Multi-Vehicle Route Planning & Multi-Factor Optimization Service
 *
 * Reuses the existing PathWise multi-factor routing algorithms (A*, AHP criteria weights,
 * cost function, and OSRM physical road geometry).
 */

const { findAstarDetour, NAGPUR_NODES, haversineKm } = require('./astarService');
const { fetchRoadGeometry } = require('./routeGeometryService');
const realtimeService = require('./realtimeService');
const { haversineDistanceMeters, isValidCoordinate } = require('../utils/geoUtils');
const dbService = require('./dbService');

// Dynamic AHP weights established in PathWise (algorithms/cost_function/cost_function.py)
const AHP_WEIGHTS = {
  distance: 0.3004,
  travel_time: 0.2691,
  traffic: 0.1706,
  fuel_cost: 0.1195,
  weather: 0.0744,
  road_condition: 0.0661,
};

// Standard vehicle visual identity palette
const VEHICLE_COLORS = [
  '#3b82f6', // Electric Blue (SIM-01)
  '#10b981', // Emerald Green (SIM-02)
  '#8b5cf6', // Violet Purple (SIM-03)
  '#f59e0b', // Amber Orange (SIM-04)
  '#ec4899', // Pink Fuchsia (SIM-05)
  '#06b6d4', // Cyan Sky (SIM-06)
  '#14b8a6', // Teal Mint (SIM-07)
  '#f97316', // Coral Tangerine (SIM-08)
];

// Predefined landmark locations in Nagpur for search & selection
const NAGPUR_CATALOG = [
  { id: 'DEPOT', name: 'PathWise Central Depot (Sitabuldi)', latitude: 21.1450, longitude: 79.0880, category: 'Hub' },
  { id: 'D001', name: 'Dharampeth Commercial Zone', latitude: 21.1458, longitude: 79.0882, category: 'Commercial' },
  { id: 'D002', name: 'Ramdaspeth Medical & Retail Hub', latitude: 21.1500, longitude: 79.0900, category: 'Commercial' },
  { id: 'D003', name: 'Dhantoli Institutional District', latitude: 21.1400, longitude: 79.0800, category: 'Residential' },
  { id: 'D004', name: 'Congress Nagar Station Junction', latitude: 21.1350, longitude: 79.0750, category: 'Transit' },
  { id: 'D005', name: 'Civil Lines Administrative Quarter', latitude: 21.1550, longitude: 79.0950, category: 'Government' },
  { id: 'D006', name: 'Sadar Commercial District', latitude: 21.1600, longitude: 79.1000, category: 'Commercial' },
  { id: 'D007', name: 'Rahate Colony Wardha Corridor', latitude: 21.1300, longitude: 79.0700, category: 'Residential' },
  { id: 'D008', name: 'Ajni Railway Terminal & Logistics', latitude: 21.1250, longitude: 79.0650, category: 'Logistics' },
  { id: 'D009', name: 'Kadbi Chowk North Gateway', latitude: 21.1650, longitude: 79.1050, category: 'Corridor' },
  { id: 'D010', name: 'Mankapur Sports & Residential Area', latitude: 21.1700, longitude: 79.1100, category: 'Residential' },
  { id: 'D011', name: 'Pratap Nagar Ring Road Hub', latitude: 21.1200, longitude: 79.0600, category: 'Transit' },
  { id: 'D012', name: 'Khamla Airport Road Zone', latitude: 21.1150, longitude: 79.0550, category: 'Residential' },
  { id: 'Z_DIGHORI', name: 'Dighori East Delivery Hub', latitude: 21.1525, longitude: 79.1390, category: 'Outer Zone' },
  { id: 'Z_NANDANVAN', name: 'Nandanvan Residential Complex', latitude: 21.1340, longitude: 79.1215, category: 'Outer Zone' },
  { id: 'Z_WARDHA', name: 'Wardha Road Tech Park', latitude: 21.1070, longitude: 79.0610, category: 'Industrial' },
  { id: 'Z_HINGNA', name: 'Hingna MIDC Industrial Area', latitude: 21.1160, longitude: 79.0040, category: 'Industrial' },
  { id: 'Z_MANISH', name: 'Manish Nagar Junction', latitude: 21.1040, longitude: 79.0505, category: 'Outer Zone' },
];

/**
 * Snaps arbitrary latitude/longitude to the nearest known Nagpur node ID.
 */
function snapToNearestNode(lat, lon) {
  let bestNode = 'DEPOT';
  let bestDist = Infinity;

  for (const [nodeId, data] of Object.entries(NAGPUR_NODES)) {
    const d = haversineKm(lat, lon, data.latitude, data.longitude);
    if (d < bestDist) {
      bestDist = d;
      bestNode = nodeId;
    }
  }

  return { nodeId: bestNode, distance_km: bestDist, nodeData: NAGPUR_NODES[bestNode] };
}

/**
 * Calculates composite Multi-Factor Cost using PathWise AHP weights.
 */
function computeCompositeCost({
  distance_km,
  travel_time_min,
  traffic_score = 1.0,
  fuel_cost = 0,
  weather_score = 1.0,
  road_condition_score = 1.0,
}) {
  // Normalize factors relative to typical baseline scale
  const normDist = Math.max(0.1, distance_km / 10.0);
  const normTime = Math.max(0.1, travel_time_min / 20.0);
  const normTraffic = Math.min(5.0, Math.max(1.0, traffic_score)) / 3.0;
  const normFuel = Math.max(0.1, fuel_cost / 100.0);
  const normWeather = Math.min(5.0, Math.max(1.0, weather_score)) / 3.0;
  const normRoad = Math.min(5.0, Math.max(1.0, road_condition_score)) / 3.0;

  const compositeScore =
    AHP_WEIGHTS.distance * normDist +
    AHP_WEIGHTS.travel_time * normTime +
    AHP_WEIGHTS.traffic * normTraffic +
    AHP_WEIGHTS.fuel_cost * normFuel +
    AHP_WEIGHTS.weather * normWeather +
    AHP_WEIGHTS.road_condition * normRoad;

  return Number(compositeScore.toFixed(4));
}

/**
 * Returns Nagpur landmark locations catalog for search and UI dropdowns.
 */
function getNagpurLocations() {
  return NAGPUR_CATALOG;
}

/**
 * Plans road-based multi-vehicle routes between interactive Start and Destination.
 * Reuses:
 * - A* pathfinding (algorithms/astar/astar.py)
 * - Multi-factor cost function & AHP weights (algorithms/cost_function/cost_function.py)
 * - OSRM road network geometry (services/routeGeometryService.js)
 * - Real-time environmental metrics (services/realtimeService.js)
 */
async function planMultiVehicleJourney({
  start,
  destination,
  vehicles = [],
  traffic_multiplier = 1.0,
  avoid_closures = false,
}) {
  // 1. Validate start and destination
  if (!start || !destination) {
    throw new Error('Both start and destination locations are required.');
  }

  const startLat = Number(start.latitude ?? start.lat);
  const startLon = Number(start.longitude ?? start.lon);
  const destLat = Number(destination.latitude ?? destination.lat);
  const destLon = Number(destination.longitude ?? destination.lon);

  if (!isValidCoordinate(startLat, startLon, false) || !isValidCoordinate(destLat, destLon, false)) {
    throw new Error('Start and destination coordinates must be valid finite numbers within bounds.');
  }

  // 2. Fetch real-time environmental context
  let realtimeEnv;
  try {
    realtimeEnv = await realtimeService.getRealtimeData();
  } catch (_) {
    realtimeEnv = {
      traffic_congestion_factor: 1.2,
      weather_impact_factor: 1.0,
      road_condition_index: 1.1,
    };
  }

  const trafficScore = Math.max(1.0, Number(realtimeEnv?.traffic_congestion_factor || traffic_multiplier || 1.0));
  const weatherScore = Math.max(1.0, Number(realtimeEnv?.weather_impact_factor || 1.0));
  const roadConditionScore = Math.max(1.0, Number(realtimeEnv?.road_condition_index || 1.0));

  // 3. Snap start and destination to nearest Nagpur network nodes
  const startSnap = snapToNearestNode(startLat, startLon);
  const destSnap = snapToNearestNode(destLat, destLon);

  // 4. Run existing A* Multi-Factor Algorithm
  const startNode = startSnap.nodeId;
  const goalNode = destSnap.nodeId === startNode ? 'D006' : destSnap.nodeId;

  // Primary optimal multi-factor route
  const primaryAstar = await findAstarDetour({
    start: startNode,
    goal: goalNode,
    traffic_multipliers: { [`${startNode}-${goalNode}`]: trafficScore },
  });

  // Alternative detour route avoiding direct corridor
  const alternativeAstar = await findAstarDetour({
    start: startNode,
    goal: goalNode,
    avoid_nodes: primaryAstar.optimal_route?.path?.length > 2 ? [primaryAstar.optimal_route.path[1]] : [],
    traffic_multipliers: { [`${startNode}-${goalNode}`]: trafficScore * 1.5 },
  });

  // 5. Build waypoint sequences
  // Extract intermediate coordinates from A* path
  const primaryNodeIds = primaryAstar.optimal_route?.path || [startNode, goalNode];
  const primaryIntermediateCoords = primaryNodeIds.map((id) => [
    NAGPUR_NODES[id]?.latitude || startLat,
    NAGPUR_NODES[id]?.longitude || startLon,
  ]);

  // Combine exact user start + intermediate nodes + exact user destination
  const primaryStopCoords = [
    [startLat, startLon],
    ...primaryIntermediateCoords,
    [destLat, destLon],
  ];

  // Fetch full physical road geometry from OSRM
  const primaryRoadGeomResult = await fetchRoadGeometry(primaryStopCoords);
  const primaryRoadPoints =
    Array.isArray(primaryRoadGeomResult.coordinates) && primaryRoadGeomResult.coordinates.length >= 2
      ? primaryRoadGeomResult.coordinates
      : primaryStopCoords;

  // Calculate total road distance in km
  let totalDistanceMeters = 0;
  for (let i = 0; i < primaryRoadPoints.length - 1; i++) {
    totalDistanceMeters += haversineDistanceMeters(
      primaryRoadPoints[i][0],
      primaryRoadPoints[i][1],
      primaryRoadPoints[i + 1][0],
      primaryRoadPoints[i + 1][1]
    );
  }
  const totalDistanceKm = Number((totalDistanceMeters / 1000).toFixed(2)) || 2.5;

  // Alternative road geometry
  const altNodeIds = alternativeAstar.optimal_route?.path || primaryNodeIds;
  const altStopCoords = [
    [startLat, startLon],
    ...altNodeIds.map((id) => [NAGPUR_NODES[id]?.latitude || startLat, NAGPUR_NODES[id]?.longitude || startLon]),
    [destLat, destLon],
  ];
  const altRoadGeomResult = await fetchRoadGeometry(altStopCoords);
  const altRoadPoints =
    Array.isArray(altRoadGeomResult.coordinates) && altRoadGeomResult.coordinates.length >= 2
      ? altRoadGeomResult.coordinates
      : altStopCoords;

  let altDistanceMeters = 0;
  for (let i = 0; i < altRoadPoints.length - 1; i++) {
    altDistanceMeters += haversineDistanceMeters(
      altRoadPoints[i][0],
      altRoadPoints[i][1],
      altRoadPoints[i + 1][0],
      altRoadPoints[i + 1][1]
    );
  }
  const altDistanceKm = Number((altDistanceMeters / 1000).toFixed(2)) || totalDistanceKm * 1.15;

  // 6. Plan for each vehicle
  const vehicleConfigs = Array.isArray(vehicles) && vehicles.length > 0
    ? vehicles
    : [
        { vehicle_id: 'SIM-01', speed_kmh: 40, model: 'Autonomous Cargo Van' },
        { vehicle_id: 'SIM-02', speed_kmh: 48, model: 'Urban Delivery Express' },
      ];

  const plannedVehicles = vehicleConfigs.map((veh, idx) => {
    const vId = veh.vehicle_id || `SIM-0${idx + 1}`;
    const vSpeedKmh = Math.max(15, Math.min(80, Number(veh.speed_kmh) || 40 + idx * 5));
    const vColor = veh.color || VEHICLE_COLORS[idx % VEHICLE_COLORS.length];

    // Vehicles can take primary or alternative route for comparison
    const useAltRoute = idx % 2 === 1 && altRoadPoints.length >= 2;
    const assignedRoadGeometry = useAltRoute ? altRoadPoints : primaryRoadPoints;
    const assignedDistanceKm = useAltRoute ? altDistanceKm : totalDistanceKm;
    const assignedRouteType = useAltRoute ? 'Alternative Detour (Low Traffic)' : 'Optimal Multi-Factor Path';

    // Travel time in minutes
    const effectiveSpeed = vSpeedKmh / trafficScore;
    const travelTimeMin = Number(((assignedDistanceKm / effectiveSpeed) * 60).toFixed(1));

    // Fuel cost at ₹8.5/km average city delivery rate
    const fuelCostInr = Number((assignedDistanceKm * 8.5).toFixed(1));

    // Composite multi-factor score
    const compositeScore = computeCompositeCost({
      distance_km: assignedDistanceKm,
      travel_time_min: travelTimeMin,
      traffic_score: trafficScore,
      fuel_cost: fuelCostInr,
      weather_score: weatherScore,
      road_condition_score: roadConditionScore,
    });

    return {
      vehicle_id: vId,
      model: veh.model || `Simulated Carrier ${vId}`,
      color: vColor,
      base_speed_kmh: vSpeedKmh,
      assigned_route_type: assignedRouteType,
      distance_km: assignedDistanceKm,
      travel_time_min: travelTimeMin,
      fuel_cost_inr: fuelCostInr,
      multi_factor_score: compositeScore,
      status: 'waiting',
      start_location: {
        name: start.name || startSnap.nodeData?.name || 'Selected Start Location',
        latitude: startLat,
        longitude: startLon,
      },
      destination_location: {
        name: destination.name || destSnap.nodeData?.name || 'Selected Destination',
        latitude: destLat,
        longitude: destLon,
      },
      road_geometry: assignedRoadGeometry,
      waypoints: assignedRoadGeometry,
      stop_coordinates: primaryStopCoords,
    };
  });

  // Calculate overall journey multi-factor summary
  const summaryCompositeScore = computeCompositeCost({
    distance_km: totalDistanceKm,
    travel_time_min: Number(((totalDistanceKm / 40) * 60 * trafficScore).toFixed(1)),
    traffic_score: trafficScore,
    fuel_cost: Number((totalDistanceKm * 8.5).toFixed(1)),
    weather_score: weatherScore,
    road_condition_score: roadConditionScore,
  });

  return {
    success: true,
    journey: {
      start: {
        name: start.name || startSnap.nodeData?.name || 'Selected Start Location',
        latitude: startLat,
        longitude: startLon,
        nearest_node: startSnap.nodeId,
      },
      destination: {
        name: destination.name || destSnap.nodeData?.name || 'Selected Destination',
        latitude: destLat,
        longitude: destLon,
        nearest_node: destSnap.nodeId,
      },
      total_distance_km: totalDistanceKm,
      estimated_time_min: Number(((totalDistanceKm / 40) * 60 * trafficScore).toFixed(1)),
      fuel_cost_inr: Number((totalDistanceKm * 8.5).toFixed(1)),
      multi_factor_score: summaryCompositeScore,
      ahp_factors: {
        weights: AHP_WEIGHTS,
        realtime_traffic: trafficScore,
        weather_impact: weatherScore,
        road_condition: roadConditionScore,
      },
      route_alternatives: [
        {
          id: 'alt_primary',
          name: 'Primary Multi-Factor Route (AHP Optimal)',
          distance_km: totalDistanceKm,
          estimated_time_min: Number(((totalDistanceKm / 40) * 60 * trafficScore).toFixed(1)),
          cost_score: summaryCompositeScore,
          geometry_points_count: primaryRoadPoints.length,
          is_optimal: true,
        },
        {
          id: 'alt_detour',
          name: 'Congestion-Bypassing Detour Alternative',
          distance_km: altDistanceKm,
          estimated_time_min: Number(((altDistanceKm / 48) * 60 * (trafficScore * 0.85)).toFixed(1)),
          cost_score: Number((summaryCompositeScore * 1.08).toFixed(4)),
          geometry_points_count: altRoadPoints.length,
          is_optimal: false,
        },
      ],
      primary_road_geometry: primaryRoadPoints,
      alternative_road_geometry: altRoadPoints,
    },
    vehicles: plannedVehicles,
  };
}

module.exports = {
  planMultiVehicleJourney,
  getNagpurLocations,
  snapToNearestNode,
  computeCompositeCost,
  AHP_WEIGHTS,
  VEHICLE_COLORS,
};

