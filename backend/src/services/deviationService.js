/**
 * PathWise Route Deviation Detection Engine
 *
 * Compares incoming GPS telemetry coordinates against the vehicle's planned route geometry
 * using Turf.js nearestPointOnLine geodesic calculations.
 *
 * Requirements & Specification:
 * 1. Uses Turf.js `turf.nearestPointOnLine` with the vehicle's own planned route geometry.
 * 2. GeoJSON coordinates [longitude, latitude] and meters distance units.
 * 3. Distance tiers:
 *    - <= 50m: On-route ('ON_ROUTE')
 *    - 50m - 100m: Warning / corridor caution ('WARNING')
 *    - > 100m: Potential deviation ('DEVIATION_SUSPECTED', or 'DEVIATION_ALERT' after 3 consecutive pings)
 * 4. Anti-jitter accuracy gate: Initial maximum acceptable accuracy is 50m (accuracy > 50m ignored).
 * 5. Persistence: Requires at least 3 consecutive qualifying out-of-route readings before declaring deviation.
 * 6. Counter reset: Immediately resets the consecutive counter to 0 when the vehicle returns within route corridor (<= 100m).
 * 7. Duplicate alert avoidance: Suppresses duplicate alert generation when a vehicle remains deviated across ticks.
 * 8. Returns deviation distance, GPS accuracy, status, timestamp, and nearest point on line.
 */

const turf = require("@turf/turf");
const {
  MAX_ACCEPTABLE_ACCURACY_METERS,
  isValidAccuracy,
  isValidCoordinate,
  toTurfLngLat,
  toLeafletLatLng,
  normalizeRouteCoordinates,
  haversineDistanceMeters,
} = require("../utils/geoUtils");

const DISTANCE_ON_ROUTE_METERS = 50;
const DISTANCE_WARNING_METERS = 100;
const DEFAULT_DEVIATION_THRESHOLD_METERS = 100;
const CONSECUTIVE_DEVIATION_ALERT_COUNT = 3;

/**
 * Calculates perpendicular / minimum distance from a GPS point to a route polyline in meters
 * using Turf.js `nearestPointOnLine`.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @param {Array} routeCoordinates - Array of [lat, lon] or GeoJSON coordinates
 * @returns {{ distance_m: number, nearest_point: [number, number]|null }}
 */
function turfNearestPointOnRoute(latitude, longitude, routeCoordinates) {
  const ptCoord = toTurfLngLat([latitude, longitude]);
  if (!ptCoord) return { distance_m: 0, nearest_point: null };
  const pt = turf.point(ptCoord);

  const turfCoords = normalizeRouteCoordinates(routeCoordinates, "turf");
  if (!turfCoords || turfCoords.length === 0) {
    return { distance_m: 0, nearest_point: null };
  }

  // If only 1 waypoint exists
  if (turfCoords.length === 1) {
    const singlePt = turf.point(turfCoords[0]);
    const dist = turf.distance(pt, singlePt, { units: "meters" });
    return {
      distance_m: Math.round(dist * 10) / 10,
      nearest_point: toLeafletLatLng(turfCoords[0]),
    };
  }

  const line = turf.lineString(turfCoords);
  const snapped = turf.nearestPointOnLine(line, pt, { units: "meters" });

  let distanceMeters;
  if (snapped.properties && Number.isFinite(snapped.properties.dist)) {
    distanceMeters = snapped.properties.dist;
  } else {
    distanceMeters = turf.distance(pt, snapped, { units: "meters" });
  }

  const nearestCoord = snapped.geometry?.coordinates;
  const nearestLeaflet = nearestCoord ? toLeafletLatLng(nearestCoord) : null;

  return {
    distance_m: Math.round(distanceMeters * 10) / 10,
    nearest_point: nearestLeaflet,
  };
}

/**
 * Legacy distance to route helper.
 */
function turfDistanceToRouteMeters(latitude, longitude, routeCoordinates) {
  const { distance_m } = turfNearestPointOnRoute(latitude, longitude, routeCoordinates);
  return distance_m;
}

/**
 * Legacy segment distance utility for backward compatibility.
 */
function distanceToSegmentMeters(plat, plon, alat, alon, blat, blon) {
  const pt = turf.point([plon, plat]);
  const seg = turf.lineString([[alon, alat], [blon, blat]]);
  const snapped = turf.nearestPointOnLine(seg, pt, { units: "meters" });
  return snapped.properties?.dist || 0;
}

/**
 * Evaluates route deviation for an incoming GPS telemetry ping.
 *
 * @param {Object} params
 * @param {number} params.latitude - Vehicle latitude
 * @param {number} params.longitude - Vehicle longitude
 * @param {number} [params.accuracy=0] - GPS accuracy radius in meters
 * @param {Array} params.routeCoordinates - Planned route waypoints / street geometry
 * @param {number} [params.thresholdMeters=100] - Deviation distance threshold in meters
 * @param {number} [params.maxAcceptableAccuracy=50] - Accuracy gate threshold in meters
 * @param {number} [params.previousConsecutiveDeviations=0] - Prior count of consecutive deviations
 * @param {boolean} [params.previousIsDeviated=false] - Whether vehicle was already declared deviated
 * @param {string} [params.timestamp] - Ping timestamp
 *
 * @returns {Object} Deviation evaluation result
 */
function evaluateRouteDeviation({
  latitude,
  longitude,
  accuracy = 0,
  routeCoordinates = [],
  thresholdMeters = DEFAULT_DEVIATION_THRESHOLD_METERS,
  maxAcceptableAccuracy = MAX_ACCEPTABLE_ACCURACY_METERS,
  previousConsecutiveDeviations = 0,
  previousIsDeviated = false,
  timestamp = null,
}) {
  const currentAccuracy = Number(accuracy) || 0;
  const effectiveThreshold = Number(thresholdMeters) || DEFAULT_DEVIATION_THRESHOLD_METERS;
  const prevCount = Math.max(0, Number(previousConsecutiveDeviations) || 0);
  const wasPreviouslyDeviated = Boolean(previousIsDeviated) || prevCount >= CONSECUTIVE_DEVIATION_ALERT_COUNT;
  const currentTimestamp = timestamp || new Date().toISOString();

  // Validate coordinates
  if (!isValidCoordinate(latitude, longitude, false)) {
    return {
      deviation_distance_m: 0,
      accuracy_m: currentAccuracy,
      is_deviated: wasPreviouslyDeviated,
      consecutive_deviations: prevCount,
      is_new_alert: false,
      was_resolved: false,
      confidence: "invalid_coordinate",
      status: "INVALID_GPS",
      alert_status: "INVALID_GPS: Non-finite or out-of-range coordinates",
      reason: "Coordinates are not valid finite numbers within geographical bounds",
      threshold_m: effectiveThreshold,
      timestamp: currentTimestamp,
    };
  }

  // If no planned route or insufficient coordinates (< 2 points)
  if (!Array.isArray(routeCoordinates) || routeCoordinates.length < 2) {
    return {
      deviation_distance_m: 0,
      accuracy_m: currentAccuracy,
      is_deviated: false,
      consecutive_deviations: 0,
      is_new_alert: false,
      was_resolved: false,
      confidence: "low",
      status: "ON_ROUTE",
      alert_status: "ON_ROUTE",
      reason: "Insufficient route coordinates to evaluate deviation",
      threshold_m: effectiveThreshold,
      timestamp: currentTimestamp,
    };
  }

  // Calculate distance to nearest point on planned route using Turf.js
  const { distance_m: distanceMeters, nearest_point } = turfNearestPointOnRoute(
    latitude,
    longitude,
    routeCoordinates
  );

  // 1. Accuracy Filter: Poor accuracy (> 50m) or non-positive reading is ignored
  const isReliableGps = isValidAccuracy(currentAccuracy, maxAcceptableAccuracy);

  if (!isReliableGps) {
    return {
      deviation_distance_m: distanceMeters,
      accuracy_m: currentAccuracy,
      is_deviated: wasPreviouslyDeviated,
      consecutive_deviations: prevCount,
      is_new_alert: false,
      was_resolved: false,
      confidence: "unreliable_gps",
      status: wasPreviouslyDeviated ? "DEVIATION_ALERT" : "ON_ROUTE",
      alert_status: wasPreviouslyDeviated
        ? `DEVIATION_ALERT: Ongoing deviation (${distanceMeters}m), but latest GPS fix is unreliable (±${Math.round(currentAccuracy)}m)`
        : `ON_ROUTE (GPS reading ignored: accuracy ±${Math.round(currentAccuracy)}m exceeds ±${maxAcceptableAccuracy}m gate)`,
      reason: `GPS accuracy (±${Math.round(currentAccuracy)}m) exceeds maximum acceptable threshold (±${maxAcceptableAccuracy}m); reading ignored`,
      threshold_m: effectiveThreshold,
      nearest_point,
      timestamp: currentTimestamp,
    };
  }

  // 2. Distance Tiers:
  // - <= 50m: On-route ('ON_ROUTE')
  // - 50m - 100m: Corridor Warning ('WARNING')
  // - > 100m: Potential deviation ('DEVIATION_SUSPECTED' / 'DEVIATION_ALERT')
  const isOnRoute = distanceMeters <= DISTANCE_ON_ROUTE_METERS;
  const isWarningZone = distanceMeters > DISTANCE_ON_ROUTE_METERS && distanceMeters <= effectiveThreshold;
  const isOutOfCorridor = distanceMeters > effectiveThreshold;

  let newConsecutive = 0;
  let isDeviated = false;
  let isNewAlert = false;
  let wasResolved = false;
  let status = "ON_ROUTE";
  let alertStatus = "ON_ROUTE";

  if (isOutOfCorridor) {
    // Potential deviation
    newConsecutive = prevCount + 1;
    isDeviated = newConsecutive >= CONSECUTIVE_DEVIATION_ALERT_COUNT;

    if (isDeviated) {
      status = "DEVIATION_ALERT";
      alertStatus = `DEVIATION_ALERT: Vehicle is ${distanceMeters}m off planned route (${newConsecutive} consecutive readings)`;

      // Suppress duplicate alert generation: only new if transitioning into deviated state
      if (!wasPreviouslyDeviated) {
        isNewAlert = true;
      }
    } else {
      status = "DEVIATION_SUSPECTED";
      alertStatus = `DEVIATION_SUSPECTED: Vehicle is ${distanceMeters}m off route (${newConsecutive}/${CONSECUTIVE_DEVIATION_ALERT_COUNT} pings)`;
    }
  } else if (isWarningZone) {
    // Warning corridor (50m - 100m)
    // Counter resets because vehicle is within acceptable route corridor (<= 100m)
    newConsecutive = 0;
    isDeviated = false;
    status = "WARNING";
    alertStatus = `CORRIDOR_WARNING: Vehicle is ${distanceMeters}m from route center (within ${effectiveThreshold}m corridor)`;

    if (wasPreviouslyDeviated) {
      wasResolved = true;
    }
  } else {
    // Completely on-route (<= 50m)
    newConsecutive = 0;
    isDeviated = false;
    status = "ON_ROUTE";
    alertStatus = "ON_ROUTE";

    if (wasPreviouslyDeviated) {
      wasResolved = true;
    }
  }

  return {
    deviation_distance_m: distanceMeters,
    accuracy_m: currentAccuracy,
    is_deviated: isDeviated,
    consecutive_deviations: newConsecutive,
    is_new_alert: isNewAlert,
    was_resolved: wasResolved,
    confidence: "high",
    status,
    alert_status: alertStatus,
    threshold_m: effectiveThreshold,
    nearest_point,
    timestamp: currentTimestamp,
  };
}

module.exports = {
  DISTANCE_ON_ROUTE_METERS,
  DISTANCE_WARNING_METERS,
  DEFAULT_DEVIATION_THRESHOLD_METERS,
  MAX_ACCEPTABLE_ACCURACY_METERS,
  CONSECUTIVE_DEVIATION_ALERT_COUNT,
  turfNearestPointOnRoute,
  turfDistanceToRouteMeters,
  distanceToSegmentMeters,
  haversineDistanceMeters,
  evaluateRouteDeviation,
};
