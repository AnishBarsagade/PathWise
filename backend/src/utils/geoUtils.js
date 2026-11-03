/**
 * PathWise Geographic Coordinate Utilities
 *
 * Provides standardized, bidirectional conversions and strict validations between:
 * - Leaflet format: [latitude, longitude]
 * - GeoJSON / Turf.js format: [longitude, latitude]
 * - Object formats: { lat, lon }, { latitude, longitude }
 *
 * Rules:
 * - Latitude bounds: [-90, 90]
 * - Longitude bounds: [-180, 180]
 * - Auto-detection prevents double reversal
 * - Accuracy gate default: 50 meters
 */

const MAX_ACCEPTABLE_ACCURACY_METERS = 50;

/**
 * Validates that latitude and longitude are valid finite numbers within bounds.
 * Excludes (0,0) uninitialized GPS default fix if checkZeroIsland is true.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {boolean} [checkZeroIsland=true]
 * @returns {boolean}
 */
function isValidCoordinate(lat, lon, checkZeroIsland = true) {
  const nLat = Number(lat);
  const nLon = Number(lon);

  if (!Number.isFinite(nLat) || !Number.isFinite(nLon)) {
    return false;
  }

  if (nLat < -90 || nLat > 90 || nLon < -180 || nLon > 180) {
    return false;
  }

  if (checkZeroIsland && Math.abs(nLat) < 0.000001 && Math.abs(nLon) < 0.000001) {
    return false;
  }

  return true;
}

/**
 * Validates GPS accuracy in meters.
 * Rejects non-positive or poor accuracy exceeding maxAcceptable.
 *
 * @param {number} accuracy
 * @param {number} [maxAcceptable=50]
 * @returns {boolean}
 */
function isValidAccuracy(accuracy, maxAcceptable = MAX_ACCEPTABLE_ACCURACY_METERS) {
  const acc = Number(accuracy);
  return Number.isFinite(acc) && acc > 0 && acc <= maxAcceptable;
}

/**
 * Validates telemetry timestamp.
 * Checks parseability, rejects timestamps in future (>15s drift) or ancient timestamps (>30 days).
 *
 * @param {string|number|Date} timestamp
 * @param {number} [maxAgeMs=2592000000]
 * @returns {boolean}
 */
function isValidTimestamp(timestamp, maxAgeMs = 2592000000) {
  if (!timestamp) return false;
  const time = new Date(timestamp).getTime();
  if (Number.isNaN(time)) return false;

  const now = Date.now();
  // Allow up to 15 seconds clock skew into the future
  if (time > now + 15000) return false;
  // Reject timestamps older than maxAgeMs
  if (time < now - maxAgeMs) return false;

  return true;
}

/**
 * Converts any coordinate representation into Leaflet [latitude, longitude].
 * Safely auto-detects whether input is already [lat, lon] or GeoJSON [lon, lat],
 * ensuring coordinates are NEVER reversed twice.
 *
 * @param {Array<number>|Object} coord
 * @returns {[number, number]|null} [latitude, longitude] or null if invalid
 */
function toLeafletLatLng(coord) {
  if (!coord) return null;

  let lat, lon;

  if (Array.isArray(coord) && coord.length >= 2) {
    const a = Number(coord[0]);
    const b = Number(coord[1]);

    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;

    // Detection logic:
    // If first number is outside [-90, 90], it CANNOT be latitude -> it is [longitude, latitude]
    if (Math.abs(a) > 90 && Math.abs(b) <= 90) {
      lat = b;
      lon = a;
    }
    // If second number is outside [-90, 90] but first is inside -> already [latitude, longitude]
    else if (Math.abs(b) > 90 && Math.abs(a) <= 90) {
      lat = a;
      lon = b;
    }
    // For India / Nagpur region (lat ~21.1, lon ~79.1):
    // If first number is around 79 and second around 21 -> it is [lon, lat]
    else if (a > 60 && a < 100 && b > 5 && b < 40) {
      lat = b;
      lon = a;
    }
    // Standard Leaflet assumption: [lat, lon]
    else {
      lat = a;
      lon = b;
    }
  } else if (typeof coord === "object") {
    lat = Number(coord.lat ?? coord.latitude);
    lon = Number(coord.lon ?? coord.lng ?? coord.longitude);
  } else {
    return null;
  }

  if (!isValidCoordinate(lat, lon, false)) return null;
  return [Number(lat), Number(lon)];
}

/**
 * Converts any coordinate representation into GeoJSON / Turf.js [longitude, latitude].
 * Safely auto-detects input orientation to NEVER reverse twice.
 *
 * @param {Array<number>|Object} coord
 * @returns {[number, number]|null} [longitude, latitude] or null if invalid
 */
function toTurfLngLat(coord) {
  const leaflet = toLeafletLatLng(coord);
  if (!leaflet) return null;
  // Leaflet is [lat, lon], so Turf is [lon, lat]
  return [leaflet[1], leaflet[0]];
}

/**
 * Normalizes an array of coordinates into the requested format ('leaflet' or 'turf').
 * Removes consecutive duplicate points to protect polyline and segment algorithms.
 *
 * @param {Array} coords
 * @param {'leaflet'|'turf'} [format='leaflet']
 * @returns {Array<[number, number]>}
 */
function normalizeRouteCoordinates(coords, format = "leaflet") {
  if (!Array.isArray(coords)) return [];

  const converter = format === "turf" ? toTurfLngLat : toLeafletLatLng;
  const result = [];

  for (let i = 0; i < coords.length; i++) {
    const pt = converter(coords[i]);
    if (!pt) continue;

    if (result.length === 0) {
      result.push(pt);
    } else {
      const prev = result[result.length - 1];
      // Skip duplicate consecutive coordinates
      if (Math.abs(prev[0] - pt[0]) > 0.0000001 || Math.abs(prev[1] - pt[1]) > 0.0000001) {
        result.push(pt);
      }
    }
  }

  return result;
}

/**
 * Fast geodesic Haversine distance between two coordinates in meters.
 */
function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

module.exports = {
  MAX_ACCEPTABLE_ACCURACY_METERS,
  isValidCoordinate,
  isValidAccuracy,
  isValidTimestamp,
  toLeafletLatLng,
  toTurfLngLat,
  normalizeRouteCoordinates,
  haversineDistanceMeters,
};

