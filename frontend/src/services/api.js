/**
 * PathWise Frontend API Client Service
 *
 * Communicates with the Express backend API (/api) to execute health checks
 * and multi-factor VRP route optimizations.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

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
      );
    }
  } else {
    data = await response.text();
  }

  if (!response.ok) {
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
export async function runOptimization(payload = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}/optimize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
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
export async function rerouteRoute(payload) {
  try {
    const response = await fetch(`${API_BASE_URL}/reroute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
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

export async function signupUser({ name, email, password }) {
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
    }),
  });

  return await handleResponse(response);
}

async function logisticsRequest(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, { method, headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return handleResponse(response);
}
export const getDashboardStats = () => logisticsRequest('/dashboard/stats');
export const getDeliveries = (query = '') => logisticsRequest(`/deliveries${query ? `?${query}` : ''}`);
export const saveDelivery = (item, token, isUpdate = false) => logisticsRequest(isUpdate ? `/deliveries/${encodeURIComponent(item.delivery_id)}` : '/deliveries', { method: isUpdate ? 'PUT' : 'POST', body: item, token });
export const removeDelivery = (id, token) => logisticsRequest(`/deliveries/${encodeURIComponent(id)}`, { method: 'DELETE', token });
export const getVehicles = (query = '') => logisticsRequest(`/vehicles${query ? `?${query}` : ''}`);
export const saveVehicle = (item, token) => logisticsRequest(item.vehicle_id ? `/vehicles/${encodeURIComponent(item.vehicle_id)}` : '/vehicles', { method: item.vehicle_id ? 'PUT' : 'POST', body: item, token });
export const removeVehicle = (id, token) => logisticsRequest(`/vehicles/${encodeURIComponent(id)}`, { method: 'DELETE', token });
export const loadDemoDataset = (token) => logisticsRequest('/demo/seed', { method: 'POST', token });
export default {
  checkHealth,
  runOptimization,
  getRealtimeData,
  getAhpWeights,
  getRouteGeometries,
  getOptimizationHistory,
  getOptimizationById,
  getReroutingHistory,
  rerouteRoute,
  loginAdmin,
  getAuthMe,
  signupUser,
  getDashboardStats, getDeliveries, saveDelivery, removeDelivery, getVehicles, saveVehicle, removeVehicle, loadDemoDataset,
};
