/**
 * PathWise Real-Time Data Service
 *
 * Provides real-time environmental context for route optimization:
 * 1. Weather: Live data from Open-Meteo API (free, no API key required)
 * 2. Traffic: Baseline demonstration / fallback provider (explicitly labelled)
 *
 * Implements 10-minute in-memory caching and graceful fallback on external API failure.
 */

const NAGPUR_COORDINATES = {
  latitude: 21.1458,
  longitude: 79.0882,
};

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

let cachedWeather = null;
let cacheTimestamp = 0;
let cacheExpiresAt = 0;

/**
 * Fallback values used when external services are unreachable or offline
 */
const FALLBACK_WEATHER = {
  score: 2.0,
  condition: 'Fair (Fallback)',
  temperature: 28.0,
  temperature_unit: '°C',
  relative_humidity: 50,
  weather_code: 1,
  wind_speed: 10.0,
  precipitation: 0.0,
  source: 'fallback',
};

const DEMO_TRAFFIC = {
  score: 3.0,
  status: 'Moderate',
  source: 'fallback',
  description: 'Baseline demonstration traffic model for Nagpur urban delivery sector',
};

/**
 * Maps WMO weather interpretation code to description and 1.0 - 5.0 cost score.
 * 1.0 = Optimal / Clear, 5.0 = Severe hazard / storm
 */
function interpretWeatherCode(code, precipitation = 0, windSpeed = 0) {
  let condition = 'Unknown';
  let score = 2.0;

  switch (code) {
    case 0:
      condition = 'Clear sky';
      score = 1.0;
      break;
    case 1:
      condition = 'Mainly clear';
      score = 1.2;
      break;
    case 2:
      condition = 'Partly cloudy';
      score = 1.5;
      break;
    case 3:
      condition = 'Overcast';
      score = 2.0;
      break;
    case 45:
    case 48:
      condition = 'Fog / Mist';
      score = 2.5;
      break;
    case 51:
    case 53:
    case 55:
      condition = 'Drizzle';
      score = 2.8;
      break;
    case 61:
    case 63:
      condition = 'Rain (Moderate)';
      score = 3.2;
      break;
    case 65:
      condition = 'Heavy rain';
      score = 4.0;
      break;
    case 71:
    case 73:
    case 75:
      condition = 'Snowfall';
      score = 4.2;
      break;
    case 80:
    case 81:
      condition = 'Rain showers';
      score = 3.5;
      break;
    case 82:
      condition = 'Violent rain showers';
      score = 4.3;
      break;
    case 95:
      condition = 'Thunderstorm';
      score = 4.5;
      break;
    case 96:
    case 99:
      condition = 'Thunderstorm with hail';
      score = 5.0;
      break;
    default:
      condition = 'Fair';
      score = 2.0;
  }

  // Adjust for high precipitation or strong wind if present
  if (precipitation > 5) {
    score = Math.min(5.0, score + 0.5);
  }
  if (windSpeed > 35) {
    score = Math.min(5.0, score + 0.3);
  }

  return { condition, score: Number(score.toFixed(2)) };
}

/**
 * Fetch live current weather from Open-Meteo API
 */
async function fetchOpenMeteoWeather() {
  const { latitude, longitude } = NAGPUR_COORDINATES;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Open-Meteo HTTP error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    if (!data.current) {
      throw new Error('Open-Meteo response missing "current" payload');
    }

    const current = data.current;
    const { condition, score } = interpretWeatherCode(
      current.weather_code,
      current.precipitation,
      current.wind_speed_10m
    );

    return {
      score,
      condition,
      temperature: current.temperature_2m,
      temperature_unit: '°C',
      relative_humidity: current.relative_humidity_2m,
      weather_code: current.weather_code,
      wind_speed: current.wind_speed_10m,
      precipitation: current.precipitation,
      source: 'Open-Meteo',
    };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Get unified real-time environmental data with 10-minute caching.
 * @param {boolean} forceRefresh - If true, bypasses the in-memory cache
 * @returns {Promise<Object>} Formatted real-time data
 */
async function getRealtimeData(forceRefresh = false) {
  const now = Date.now();

  // Check cache validity
  if (!forceRefresh && cachedWeather && now < cacheExpiresAt) {
    return {
      status: 'success',
      source: cachedWeather.source === 'Open-Meteo' ? 'live' : 'fallback',
      cached: true,
      timestamp: new Date(cacheTimestamp).toISOString(),
      weather: { ...cachedWeather },
      traffic: { ...DEMO_TRAFFIC },
    };
  }

  // Fetch fresh weather
  let weatherResult;
  let source = 'live';
  const fetchTime = Date.now();

  try {
    weatherResult = await fetchOpenMeteoWeather();
    cachedWeather = weatherResult;
    cacheTimestamp = fetchTime;
    cacheExpiresAt = fetchTime + CACHE_TTL_MS;
  } catch (err) {
    // Graceful fallback on network/API failure
    source = 'fallback';
    weatherResult = {
      ...FALLBACK_WEATHER,
      error_message: err.message,
    };
    // Cache the fallback briefly (2 minutes) to prevent immediate repeated failed network calls
    cachedWeather = weatherResult;
    cacheTimestamp = fetchTime;
    cacheExpiresAt = fetchTime + 2 * 60 * 1000;
  }

  return {
    status: 'success',
    source,
    cached: false,
    timestamp: new Date(fetchTime).toISOString(),
    weather: weatherResult,
    traffic: { ...DEMO_TRAFFIC },
  };
}

/**
 * Clear the in-memory cache (for test isolation)
 */
function clearCache() {
  cachedWeather = null;
  cacheTimestamp = 0;
  cacheExpiresAt = 0;
}

module.exports = {
  getRealtimeData,
  clearCache,
  interpretWeatherCode,
  NAGPUR_COORDINATES,
  FALLBACK_WEATHER,
  DEMO_TRAFFIC,
};
