/**
 * PathWise Frontend Geographic Coordinate Utilities
 *
 * Provides standardized coordinate validation and conversions for Leaflet and Turf:
 * - Leaflet format: [latitude, longitude]
 * - GeoJSON / Turf format: [longitude, latitude]
 *
 * Auto-detects input orientation to ensure coordinates are NEVER reversed twice.
 */

export const MAX_ACCEPTABLE_ACCURACY_METERS = 50;

export function isValidCoordinate(lat, lon, checkZeroIsland = true) {
  const nLat = Number(lat);
  const nLon = Number(lon);

  if (!Number.isFinite(nLat) || !Number.isFinite(nLon)) return false;
  if (nLat < -90 || nLat > 90 || nLon < -180 || nLon > 180) return false;
  if (checkZeroIsland && Math.abs(nLat) < 0.000001 && Math.abs(nLon) < 0.000001) return false;

  return true;
}

export function isValidAccuracy(accuracy, maxAcceptable = MAX_ACCEPTABLE_ACCURACY_METERS) {
  const acc = Number(accuracy);
  return Number.isFinite(acc) && acc > 0 && acc <= maxAcceptable;
}

export function toLeafletLatLng(coord) {
  if (!coord) return null;
  let lat, lon;

  if (Array.isArray(coord) && coord.length >= 2) {
    const a = Number(coord[0]);
    const b = Number(coord[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;

    if (Math.abs(a) > 90 && Math.abs(b) <= 90) {
      lat = b;
      lon = a;
    } else if (Math.abs(b) > 90 && Math.abs(a) <= 90) {
      lat = a;
      lon = b;
    } else if (a > 60 && a < 100 && b > 5 && b < 40) {
      lat = b;
      lon = a;
    } else {
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

export function toTurfLngLat(coord) {
  const leaflet = toLeafletLatLng(coord);
  if (!leaflet) return null;
  return [leaflet[1], leaflet[0]];
}

export function normalizeRouteCoordinates(coords, format = "leaflet") {
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
      if (Math.abs(prev[0] - pt[0]) > 0.0000001 || Math.abs(prev[1] - pt[1]) > 0.0000001) {
        result.push(pt);
      }
    }
  }

  return result;
}

