/**
 * PathWise Frontend Socket.IO Client Service
 *
 * Provides real-time bidirectional WebSocket connectivity with auto-reconnection,
 * JWT authentication handshake, and event subscription helpers.
 */

import { io } from "socket.io-client";

let socket = null;

/**
 * Resolves the Socket.IO server URL based on the environment.
 */
function getSocketUrl() {
  const customUrl = import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_BASE_URL;
  if (customUrl && customUrl.startsWith("http")) {
    // If VITE_API_BASE_URL is http://localhost:3000/api, connect to http://localhost:3000
    return customUrl.replace(/\/api\/?$/, "");
  }
  if (typeof window !== "undefined") {
    // In dev with Vite proxy or same-host deployment
    return window.location.origin.includes("5173")
      ? "http://localhost:3000"
      : window.location.origin;
  }
  return "http://localhost:3000";
}

/**
 * Initializes or retrieves the singleton Socket.IO connection.
 *
 * @param {string} [tokenOverride] - Optional JWT token override
 * @returns {import("socket.io-client").Socket}
 */
export function getSocket(tokenOverride = null) {
  const token =
    tokenOverride ||
    (typeof localStorage !== "undefined"
      ? localStorage.getItem("pathwise_token")
      : null);

  if (socket && socket.connected) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
  }

  const socketUrl = getSocketUrl();

  socket = io(socketUrl, {
    auth: {
      token: token ? `Bearer ${token}` : "",
    },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
    transports: ["websocket", "polling"],
  });

  return socket;
}

/**
 * Disconnects the active Socket.IO connection.
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

