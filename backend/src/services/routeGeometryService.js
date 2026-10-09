const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/driving';

function validateCoordinates(coordinates) {
  return Array.isArray(coordinates) && coordinates.length >= 2 && coordinates.length <= 100
    && coordinates.every((pair) => Array.isArray(pair) && pair.length === 2 && Number.isFinite(Number(pair[0])) && Number.isFinite(Number(pair[1])) && Number(pair[0]) >= -90 && Number(pair[0]) <= 90 && Number(pair[1]) >= -180 && Number(pair[1]) <= 180);
}

async function fetchRoadGeometry(coordinates, fetchImpl = fetch) {
  if (!validateCoordinates(coordinates)) {
    return { source: 'straight_line', coordinates, reason: 'Invalid or insufficient stop coordinates.' };
  }
  const coordinatePath = coordinates.map(([lat, lon]) => `${Number(lon)},${Number(lat)}`).join(';');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetchImpl(`${OSRM_BASE_URL}/${coordinatePath}?overview=full&geometries=geojson`, { signal: controller.signal });
    if (!response.ok) throw new Error(`OSRM returned HTTP ${response.status}`);
    const body = await response.json();
    const geometry = body.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(geometry) || geometry.length < 2) throw new Error('OSRM returned no route geometry');
    return { source: 'osrm', coordinates: geometry.map(([lon, lat]) => [lat, lon]) };
  } catch (error) {
    return { source: 'straight_line', coordinates, reason: error.name === 'AbortError' ? 'Road geometry request timed out.' : error.message };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { fetchRoadGeometry, validateCoordinates };
