/**
 * PathWise Frontend API Client Service
 *
 * Communicates with the Express backend API (/api) to execute health checks
 * and multi-factor VRP route optimizations.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

function getAuthHeaders(customHeaders = {}) {
  const headers = { ...customHeaders };
  if (!headers["Authorization"]) {
    const token = typeof localStorage !== "undefined" ? localStorage.getItem("pathwise_token") : null;
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }
  return headers;
}

/**
 * Helper to process fetch responses, handle status codes, and extract error details.
 * @param {Response} response - Fetch API Response object
 * @returns {Promise<any>} Parsed JSON response
 */
async function handleResponse(response) {
  let data;
  const contentType = response.headers.get("content-type");

  if (contentType && contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch (parseError) {
      throw new Error(
        `Failed to parse server response as JSON: ${parseError.message}`,
        { cause: parseError }
      );
    }
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    if (response.status === 401) {
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem("pathwise_token");
          localStorage.removeItem("pathwise_user");
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("pathwise_auth_expired", { detail: { message: "Session expired" } }));
        }
      } catch {
        // Ignore session clearing errors in headless environments
      }
    }

    // Extract server-provided error title or message if available
    const serverMessage =
      (data && typeof data === "object" && (data.message || data.error)) ||
      (typeof data === "string" && data) ||
      `HTTP request failed with status ${response.status} (${response.statusText})`;

    const error = new Error(serverMessage);
    error.status = response.status;
    error.statusText = response.statusText;
    error.data = data;
    throw error;
  }

  return data;
}

/**
 * Checks backend API health and connectivity.
 * @returns {Promise<{ status: string, service: string }>}
 */
export async function checkHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    return await handleResponse(response);
  } catch (error) {
    if (
      error.name === "TypeError" &&
      error.message.toLowerCase().includes("fetch")
    ) {
      const connError = new Error(
        "Unable to connect to PathWise backend server. Please verify the backend is running on port 3000.",
      );
      connError.cause = error;
      throw connError;
    }
    throw error;
  }
}

/**
 * Triggers the multi-factor VRP optimization engine.
 * @param {Object} [payload={}] - Optional custom deliveries and vehicles payload.
 *                                Pass empty object {} to optimize default demo datasets.
 * @returns {Promise<{ routes: Array<{ vehicle_id: string, route: string[], load: number, capacity: number, cost: number }>, total_cost: number, total_load: number }>}
 */
export async function runOptimization(payload = {}, token = null) {
  try {
    const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await fetch(`${API_BASE_URL}/optimize`, {
      method: "POST",
      headers: getAuthHeaders({
        "Content-Type": "application/json",
        Accept: "application/json",
        ...authHeaders,
      }),
      body: JSON.stringify(payload),
    });

    return await handleResponse(response);
  } catch (error) {
    if (
      error.name === "TypeError" &&
      error.message.toLowerCase().includes("fetch")
    ) {
      const connError = new Error(
        "Unable to connect to PathWise backend server. Please verify the backend is running on port 3000.",
      );
      connError.cause = error;
      throw connError;
    }
    throw error;
  }
}

/**
 * Fetches current real-time environmental data (weather & traffic).
 * @param {boolean} [refresh=false] - If true, bypasses the backend cache
 * @returns {Promise<Object>}
 */
export async function getRealtimeData(refresh = false) {
  try {
    const url = refresh
      ? `${API_BASE_URL}/realtime-data?refresh=true`
      : `${API_BASE_URL}/realtime-data`;
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    return await handleResponse(response);
  } catch (error) {
    if (
      error.name === "TypeError" &&
      error.message.toLowerCase().includes("fetch")
    ) {
      const connError = new Error(
        "Unable to connect to PathWise backend server. Please verify the backend is running on port 3000.",
      );
      connError.cause = error;
      throw connError;
    }
    throw error;
  }
}

export async function getAhpWeights() {
  const response = await fetch(`${API_BASE_URL}/ahp/weights`, { headers: { Accept: 'application/json' } });
  return handleResponse(response);
}

export async function getRouteGeometries(routes) {
  const response = await fetch(`${API_BASE_URL}/route-geometry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ routes }),
  });
  return handleResponse(response);
}

/**
 * Retrieves the history of past optimization runs.
 * @param {number} [limit=50]
 * @returns {Promise<Array<Object>>}
 */
export async function getOptimizationHistory(limit = 50) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/optimization/history?limit=${limit}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      },
    );
    return await handleResponse(response);
  } catch (error) {
    if (
      error.name === "TypeError" &&
      error.message.toLowerCase().includes("fetch")
    ) {
      const connError = new Error(
        "Unable to connect to PathWise backend server. Please verify the backend is running on port 3000.",
      );
      connError.cause = error;
      throw connError;
    }
    throw error;
  }
}

/**
 * Retrieves detailed information for a specific optimization run by ID.
 * @param {string} runId
 * @returns {Promise<Object>}
 */
export async function getOptimizationById(runId) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/optimization/${encodeURIComponent(runId)}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      },
    );
    return await handleResponse(response);
  } catch (error) {
    if (
      error.name === "TypeError" &&
      error.message.toLowerCase().includes("fetch")
    ) {
      const connError = new Error(
        "Unable to connect to PathWise backend server. Please verify the backend is running on port 3000.",
      );
      connError.cause = error;
      throw connError;
    }
    throw error;
  }
}

/**
 * Retrieves the history of dynamic rerouting events.
 * @param {number} [limit=50]
 * @returns {Promise<Array<Object>>}
 */
export async function getReroutingHistory(limit = 50) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/rerouting/history?limit=${limit}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      },
    );
    return await handleResponse(response);
  } catch (error) {
    if (
      error.name === "TypeError" &&
      error.message.toLowerCase().includes("fetch")
    ) {
      const connError = new Error(
        "Unable to connect to PathWise backend server. Please verify the backend is running on port 3000.",
      );
      connError.cause = error;
      throw connError;
    }
    throw error;
  }
}

/**
 * Authenticates an administrator.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ message: string, token: string, user: { id: number, email: string, role: string } }>}
 */
export async function loginAdmin(email, password) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    return await handleResponse(response);
  } catch (error) {
    if (
      error.name === "TypeError" &&
      error.message.toLowerCase().includes("fetch")
    ) {
      const connError = new Error(
        "Unable to connect to PathWise backend server. Please verify the backend is running on port 3000.",
      );
      connError.cause = error;
      throw connError;
    }
    throw error;
  }
}

/**
 * Returns the authenticated admin's profile.
 * @param {string} token - JWT token
 * @returns {Promise<{ id: number, email: string, role: string, created_at: string }>}
 */
export async function getAuthMe(token) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    return await handleResponse(response);
  } catch (error) {
    if (
      error.name === "TypeError" &&
      error.message.toLowerCase().includes("fetch")
    ) {
      const connError = new Error(
        "Unable to connect to PathWise backend server. Please verify the backend is running on port 3000.",
      );
      connError.cause = error;
      throw connError;
    }
    throw error;
  }
}

/**
 * Dispatches dynamic rerouting for a vehicle and incident scenario.
 * @param {Object} payload - { run_id, vehicle_id, incident_type, incident_details }
 * @returns {Promise<Object>}
 */
export async function rerouteRoute(payload, token = null) {
  try {
    const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await fetch(`${API_BASE_URL}/reroute`, {
      method: "POST",
      headers: getAuthHeaders({
        "Content-Type": "application/json",
        Accept: "application/json",
        ...authHeaders,
      }),
      body: JSON.stringify(payload),
    });

    return await handleResponse(response);
  } catch (error) {
    if (
      error.name === "TypeError" &&
      error.message.toLowerCase().includes("fetch")
    ) {
      const connError = new Error(
        "Unable to connect to PathWise backend server. Please verify the backend is running on port 3000.",
      );
      connError.cause = error;
      throw connError;
    }
    throw error;
  }
}

export async function getRiderAssignments(userId = null, token = null) {
  const path = userId ? `/rider/assignments/${encodeURIComponent(userId)}` : `/rider/assignments`;
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: getAuthHeaders({
      Accept: "application/json",
      ...authHeaders,
    }),
  });
  return await handleResponse(response);
}

export const loginUser = loginAdmin;

export async function signupUser({ name, email, password, confirmPassword }) {
  const response = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      name,
      email,
      password,
      confirmPassword,
    }),
  });

  return await handleResponse(response);
}

async function logisticsRequest(path, { method = 'GET', body, token } = {}) {
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetch(`${API_BASE_URL}${path}`, { method, headers: getAuthHeaders({ Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...authHeaders }), ...(body ? { body: JSON.stringify(body) } : {}) });
  return handleResponse(response);
}
export const getDashboardStats = () => logisticsRequest('/dashboard/stats');
export const getDeliveries = (query = '') => logisticsRequest(`/deliveries${query ? `?${query}` : ''}`);
export const saveDelivery = (item, token, isUpdate = false) => logisticsRequest(isUpdate ? `/deliveries/${encodeURIComponent(item.delivery_id)}` : '/deliveries', { method: isUpdate ? 'PUT' : 'POST', body: item, token });
export const removeDelivery = (id, token) => logisticsRequest(`/deliveries/${encodeURIComponent(id)}`, { method: 'DELETE', token });
export const updateDeliveryStatus = (id, status, token) => logisticsRequest(`/deliveries/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status }, token });
export const getVehicles = (query = '') => logisticsRequest(`/vehicles${query ? `?${query}` : ''}`);
export const saveVehicle = (item, token) => logisticsRequest(item.vehicle_id ? `/vehicles/${encodeURIComponent(item.vehicle_id)}` : '/vehicles', { method: item.vehicle_id ? 'PUT' : 'POST', body: item, token });
export const removeVehicle = (id, token) => logisticsRequest(`/vehicles/${encodeURIComponent(id)}`, { method: 'DELETE', token });
export const loadDemoDataset = (token) => logisticsRequest('/demo/seed', { method: 'POST', token });
export const getRiders = (token) => logisticsRequest('/riders', { token });
export const assignRiderToVehicle = (userId, vehicleId, token) => logisticsRequest('/rider/assignments', { method: 'POST', body: { user_id: userId, vehicle_id: vehicleId }, token });
export const unassignRiderFromVehicle = (userId, vehicleId = '', token) => logisticsRequest(`/rider/assignments/${encodeURIComponent(userId)}${vehicleId ? `/${encodeURIComponent(vehicleId)}` : ''}`, { method: 'DELETE', token });
export const compareOptimization = (payload = {}, token) => logisticsRequest('/optimize/compare', { method: 'POST', body: payload, token });
export const getAstarDetour = (payload = {}, token) => logisticsRequest('/astar/detour', { method: 'POST', body: payload, token });


/**
 * Retrieves all fleet vehicles with live tracking status, coordinates, and driver.
 */
export async function getTrackingVehicles(token = null) {
  const authHeaders = token ? { Authorization: "Bearer " + token } : {};
  const response = await fetch(API_BASE_URL + "/tracking/vehicles", {
    method: "GET",
    headers: getAuthHeaders({ Accept: "application/json", ...authHeaders }),
  });
  return handleResponse(response);
}

/**
 * Retrieves live tracking snapshot for a specific vehicle.
 */
export async function getVehicleTrackingStatus(vehicleId, token = null) {
  const authHeaders = token ? { Authorization: "Bearer " + token } : {};
  const response = await fetch(API_BASE_URL + "/tracking/vehicles/" + vehicleId, {
    method: "GET",
    headers: getAuthHeaders({ Accept: "application/json", ...authHeaders }),
  });
  return handleResponse(response);
}

/**
 * Retrieves the breadcrumb trail history for a vehicle.
 */
export async function getVehicleLocationTrail(vehicleId, options = 500, token = null) {
  const authHeaders = token ? { Authorization: "Bearer " + token } : {};
  let query = "?limit=500";
  if (typeof options === "number") {
    query = `?limit=${options}`;
  } else if (typeof options === "object" && options !== null) {
    const params = new URLSearchParams();
    if (options.limit) params.set("limit", options.limit);
    if (options.session_id) params.set("session_id", options.session_id);
    query = `?${params.toString()}`;
  }
  const response = await fetch(API_BASE_URL + "/tracking/history/" + vehicleId + query, {
    method: "GET",
    headers: getAuthHeaders({ Accept: "application/json", ...authHeaders }),
  });
  return handleResponse(response);
}

/**
 * Retrieves planned route stops and waypoints for a vehicle.
 */
export async function getPlannedRouteForVehicle(vehicleId, token = null) {
  const authHeaders = token ? { Authorization: "Bearer " + token } : {};
  const response = await fetch(API_BASE_URL + "/tracking/planned-route/" + vehicleId, {
    method: "GET",
    headers: getAuthHeaders({ Accept: "application/json", ...authHeaders }),
  });
  return handleResponse(response);
}

/**
 * Submits a GPS ping via HTTP REST fallback.
 */
export async function postGpsPing(payload, token = null) {
  const authHeaders = token ? { Authorization: "Bearer " + token } : {};
  const response = await fetch(API_BASE_URL + "/tracking/ping", {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json", Accept: "application/json", ...authHeaders }),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

/**
 * Starts a tracking session for a vehicle.
 */
export async function startTrackingSession(vehicleId, token = null) {
  const authHeaders = token ? { Authorization: "Bearer " + token } : {};
  const response = await fetch(API_BASE_URL + "/tracking/session/start", {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json", Accept: "application/json", ...authHeaders }),
    body: JSON.stringify({ vehicle_id: vehicleId }),
  });
  return handleResponse(response);
}

/**
 * Stops a tracking session for a vehicle.
 */
export async function stopTrackingSession(vehicleId, token = null) {
  const authHeaders = token ? { Authorization: "Bearer " + token } : {};
  const response = await fetch(API_BASE_URL + "/tracking/session/stop", {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json", Accept: "application/json", ...authHeaders }),
    body: JSON.stringify({ vehicle_id: vehicleId }),
  });
  return handleResponse(response);
}


/**
 * SIMULATION API HELPERS
 */
export async function getSimulationStatus(token = null) {
  const authHeaders = token ? { Authorization: "Bearer " + token } : {};
  const response = await fetch(API_BASE_URL + "/simulation/status", {
    method: "GET",
    headers: getAuthHeaders({ Accept: "application/json", ...authHeaders }),
  });
  return handleResponse(response);
}

export async function getSimulationRoutes(token = null) {
  const authHeaders = token ? { Authorization: "Bearer " + token } : {};
  const response = await fetch(API_BASE_URL + "/simulation/routes", {
    method: "GET",
    headers: getAuthHeaders({ Accept: "application/json", ...authHeaders }),
  });
  return handleResponse(response);
}

export async function createSimulatedVehicle(payload, token = null) {
  const authHeaders = token ? { Authorization: "Bearer " + token } : {};
  const response = await fetch(API_BASE_URL + "/simulation/vehicles", {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json", Accept: "application/json", ...authHeaders }),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function startBackendSimulation(payload, token = null) {
  const authHeaders = token ? { Authorization: "Bearer " + token } : {};
  const response = await fetch(API_BASE_URL + "/simulation/start", {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json", Accept: "application/json", ...authHeaders }),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function setSimulationSpeed(vehicleId, multiplier, token = null) {
  const authHeaders = token ? { Authorization: "Bearer " + token } : {};
  const response = await fetch(API_BASE_URL + "/simulation/speed", {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json", Accept: "application/json", ...authHeaders }),
    body: JSON.stringify({ vehicle_id: vehicleId, multiplier }),
  });
  return handleResponse(response);
}

export async function triggerSimulationDeviation(vehicleId, token = null) {
  const authHeaders = token ? { Authorization: "Bearer " + token } : {};
  const response = await fetch(API_BASE_URL + "/simulation/deviate", {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json", Accept: "application/json", ...authHeaders }),
    body: JSON.stringify({ vehicle_id: vehicleId }),
  });
  return handleResponse(response);
}

export async function resumeSimulationRoute(vehicleId, token = null) {
  const authHeaders = token ? { Authorization: "Bearer " + token } : {};
  const response = await fetch(API_BASE_URL + "/simulation/resume", {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json", Accept: "application/json", ...authHeaders }),
    body: JSON.stringify({ vehicle_id: vehicleId }),
  });
  return handleResponse(response);
}

export async function triggerSimulationBreakdown(vehicleId, token = null) {
  const authHeaders = token ? { Authorization: "Bearer " + token } : {};
  const response = await fetch(API_BASE_URL + "/simulation/breakdown", {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json", Accept: "application/json", ...authHeaders }),
    body: JSON.stringify({ vehicle_id: vehicleId }),
  });
  return handleResponse(response);
}

export async function stopBackendSimulation(vehicleId, token = null) {
  const authHeaders = token ? { Authorization: "Bearer " + token } : {};
  const response = await fetch(API_BASE_URL + "/simulation/stop", {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json", Accept: "application/json", ...authHeaders }),
    body: JSON.stringify({ vehicle_id: vehicleId }),
  });
  return handleResponse(response);
}


export async function pauseBackendSimulation(vehicleId, token = null) {
  const authHeaders = token ? { Authorization: "Bearer " + token } : {};
  const response = await fetch(API_BASE_URL + "/simulation/pause", {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json", ...authHeaders }),
    body: JSON.stringify({ vehicle_id: vehicleId }),
  });
  return handleResponse(response);
}

export async function resumeBackendSimulationMovement(vehicleId, token = null) {
  const authHeaders = token ? { Authorization: "Bearer " + token } : {};
  const response = await fetch(API_BASE_URL + "/simulation/resume-movement", {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json", ...authHeaders }),
    body: JSON.stringify({ vehicle_id: vehicleId }),
  });
  return handleResponse(response);
}

export async function getMultiVehicleLocations(token = null) {
  const authHeaders = token ? { Authorization: "Bearer " + token } : {};
  const response = await fetch(API_BASE_URL + "/multi-vehicle/locations", {
    method: "GET",
    headers: getAuthHeaders(authHeaders),
  });
  return handleResponse(response);
}

export async function planMultiVehicleJourney(payload, token = null) {
  const authHeaders = token ? { Authorization: "Bearer " + token } : {};
  const response = await fetch(API_BASE_URL + "/multi-vehicle/plan", {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json", ...authHeaders }),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function startMultiVehicleSimulations(payload, token = null) {
  const authHeaders = token ? { Authorization: "Bearer " + token } : {};
  const response = await fetch(API_BASE_URL + "/multi-vehicle/simulate/start", {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json", ...authHeaders }),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function pauseMultiVehicleSimulations(payload = {}, token = null) {
  const authHeaders = token ? { Authorization: "Bearer " + token } : {};
  const response = await fetch(API_BASE_URL + "/multi-vehicle/simulate/pause", {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json", ...authHeaders }),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function resumeMultiVehicleSimulations(payload = {}, token = null) {
  const authHeaders = token ? { Authorization: "Bearer " + token } : {};
  const response = await fetch(API_BASE_URL + "/multi-vehicle/simulate/resume", {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json", ...authHeaders }),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function stopMultiVehicleSimulations(payload = {}, token = null) {
  const authHeaders = token ? { Authorization: "Bearer " + token } : {};
  const response = await fetch(API_BASE_URL + "/multi-vehicle/simulate/stop", {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json", ...authHeaders }),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function resetMultiVehicleSimulations(payload = {}, token = null) {
  const authHeaders = token ? { Authorization: "Bearer " + token } : {};
  const response = await fetch(API_BASE_URL + "/multi-vehicle/simulate/reset", {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json", ...authHeaders }),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function setMultiVehicleSpeed(payload = {}, token = null) {
  const authHeaders = token ? { Authorization: "Bearer " + token } : {};
  const response = await fetch(API_BASE_URL + "/multi-vehicle/simulate/speed", {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json", ...authHeaders }),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export default {
  checkHealth,
  runOptimization,
  compareOptimization,
  getAstarDetour,
  getRealtimeData,
  getAhpWeights,
  getRouteGeometries,
  getOptimizationHistory,
  getOptimizationById,
  getReroutingHistory,
  rerouteRoute,
  getRiderAssignments,
  loginUser,
  getAuthMe,
  signupUser,
  getDashboardStats, getDeliveries, saveDelivery, removeDelivery, updateDeliveryStatus,
  getVehicles, saveVehicle, removeVehicle, loadDemoDataset,
  getRiders, assignRiderToVehicle, unassignRiderFromVehicle,
  getTrackingVehicles,
  getVehicleTrackingStatus,
  getVehicleLocationTrail,
  getPlannedRouteForVehicle,
  postGpsPing,
  startTrackingSession,
  stopTrackingSession,
  getSimulationStatus,
  getSimulationRoutes,
  createSimulatedVehicle,
  startBackendSimulation,
  setSimulationSpeed,
  triggerSimulationDeviation,
  resumeSimulationRoute,
  triggerSimulationBreakdown,
  stopBackendSimulation,
  pauseBackendSimulation,
  resumeBackendSimulationMovement,
  getMultiVehicleLocations,
  planMultiVehicleJourney,
  startMultiVehicleSimulations,
  pauseMultiVehicleSimulations,
  resumeMultiVehicleSimulations,
  stopMultiVehicleSimulations,
  resetMultiVehicleSimulations,
  setMultiVehicleSpeed,
};
