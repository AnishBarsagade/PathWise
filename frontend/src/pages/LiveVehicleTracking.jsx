import { toLeafletLatLng, isValidCoordinate, isValidAccuracy } from "../utils/geoUtils";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { useAuth } from "../context/AuthContext";
import { getSocket } from "../services/socket";
import {
  getTrackingVehicles,
  getVehicleLocationTrail,
  getPlannedRouteForVehicle,
  getSimulationRoutes,
  getSimulationStatus,
  createSimulatedVehicle,
  startBackendSimulation,
  setSimulationSpeed,
  triggerSimulationDeviation,
  resumeSimulationRoute,
  triggerSimulationBreakdown,
  stopBackendSimulation,
  postGpsPing,
  startTrackingSession,
  stopTrackingSession,
  getRiderAssignments,
} from "../services/api";

// Fix for default Leaflet marker icon paths in bundled React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const NAGPUR_DEPOT = [21.145, 79.088];

/**
 * Smooth map centering component
 */
function MapRecenter({ center, zoom = 13 }) {
  const map = useMap();
  useEffect(() => {
    if (center && Array.isArray(center) && Number.isFinite(center[0]) && Number.isFinite(center[1])) {
      map.flyTo(center, zoom, { duration: 0.8 });
    }
  }, [center, zoom, map]);
  return null;
}

/**
 * Creates custom Leaflet DivIcons with heading rotation and pulsating halos
 */
function createCustomVehicleIcon(vehicle) {
  const isSimulated = Boolean(vehicle.is_simulated);
  const isDeviated = Boolean(vehicle.is_deviated);
  const isBreakdown = vehicle.tracking_status === "breakdown" || vehicle.vehicle_operational_status === "maintenance";
  const isDisconnected = vehicle.tracking_status === "offline" || vehicle.tracking_status === "disconnected";
  const isTracking = vehicle.tracking_status === "tracking";

  let bgColor = "#0ea5e9"; // Cyan/Blue
  let glowColor = "rgba(14, 165, 233, 0.4)";
  let badgeLabel = vehicle.vehicle_id;

  if (isBreakdown) {
    bgColor = "#dc2626"; // Red
    glowColor = "rgba(220, 38, 38, 0.5)";
    badgeLabel = `⚠️ ${vehicle.vehicle_id}`;
  } else if (isDeviated) {
    bgColor = "#ea580c"; // Orange
    glowColor = "rgba(234, 88, 12, 0.5)";
    badgeLabel = `🚨 ${vehicle.vehicle_id}`;
  } else if (isSimulated) {
    bgColor = "#8b5cf6"; // Purple
    glowColor = "rgba(139, 92, 246, 0.5)";
    badgeLabel = `⚡ ${vehicle.vehicle_id}`;
  } else if (isDisconnected) {
    bgColor = "#64748b"; // Slate Grey
    glowColor = "transparent";
  }

  const opacity = isDisconnected ? "0.6" : "1.0";
  const heading = Number(vehicle.heading) || 0;

  return L.divIcon({
    className: "custom-tracking-marker",
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 46px; height: 46px; opacity: ${opacity};">
        ${
          isTracking && !isDisconnected
            ? `<div style="position: absolute; width: 44px; height: 44px; border-radius: 50%; background: ${glowColor}; animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>`
            : ""
        }
        <div style="position: relative; z-index: 10; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 10px; background: ${bgColor}; border: 2px solid white; box-shadow: 0 4px 14px rgba(0,0,0,0.45); transform: rotate(${heading}deg); transition: transform 0.3s ease;">
          <span style="font-size: 14px; color: white;">${isBreakdown ? "🛑" : isSimulated ? "🤖" : "🚚"}</span>
        </div>
        <div style="position: absolute; top: -14px; background: rgba(5,8,22,0.92); border: 1px solid rgba(255,255,255,0.25); padding: 1px 6px; border-radius: 6px; font-size: 9px; font-weight: 800; color: white; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.5);">
          ${badgeLabel}
        </div>
      </div>
    `,
    iconSize: [46, 46],
    iconAnchor: [23, 23],
    popupAnchor: [0, -22],
  });
}

const LiveVehicleTracking = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  // Fleet & Selection state
  const [vehicles, setVehicles] = useState([]);
  const [loadingFleet, setLoadingFleet] = useState(true);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState("all"); // 'all' | 'real' | 'simulated' | 'disconnected'

  // Route & Trail state
  const [plannedRoute, setPlannedRoute] = useState(null); // { stops, waypoints }
  const [traveledTrails, setTraveledTrails] = useState({});
  const [mapZoom, setMapZoom] = useState(13); // [[lat, lon], ...]

  // Vehicle History Drawer
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyTrailData, setHistoryTrailData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Alerts
  const [deviationAlerts, setDeviationAlerts] = useState([]);

  // Map view
  const [mapCenter, setMapCenter] = useState(NAGPUR_DEPOT);

  // -------------------------------------------------------------
  // INTEGRATED DRIVER GPS BROADCAST & HUD STATE
  // -------------------------------------------------------------
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [socketStatus, setSocketStatus] = useState("disconnected");
  const [gpsSensorStatus, setGpsSensorStatus] = useState("idle"); // 'idle' | 'active' | 'denied' | 'error'
  const [gpsErrorMsg, setGpsErrorMsg] = useState("");
  const [broadcastPingsCount, setBroadcastPingsCount] = useState(0);

  const watchIdRef = useRef(null);
  const socketRef = useRef(null);

  // -------------------------------------------------------------
  // SIMULATION MODE STATE
  // -------------------------------------------------------------
  const [showSimPanel, setShowSimPanel] = useState(false);
  const [simRoutes, setSimRoutes] = useState([]);
  const [simStatus, setSimStatus] = useState({ simulations: [] });
  const [newSimVehicleId, setNewSimVehicleId] = useState("");
  const [selectedSimRouteIdx, setSelectedSimRouteIdx] = useState(0);
  const [simSpeedMultiplier, setSimSpeedMultiplier] = useState(1);
  const [isCreatingSimVehicle, setIsCreatingSimVehicle] = useState(false);

  // 1. Initial Load of Fleet and Assigned Rider Vehicle
  const fetchFleet = async () => {
    try {
      setLoadingFleet(true);
      const res = await getTrackingVehicles(token);
      const list = res.vehicles || [];
      setVehicles(list);

      // If rider, look up assigned vehicle and select it by default
      if (user?.role === "rider") {
        try {
          const riderData = await getRiderAssignments(null, token);
          if (riderData?.vehicle?.vehicle_id) {
            setSelectedVehicleId(riderData.vehicle.vehicle_id);
            const found = list.find((v) => v.vehicle_id === riderData.vehicle.vehicle_id);
            if (found && Number.isFinite(found.latitude) && found.latitude !== 0) {
              setMapCenter([found.latitude, found.longitude]);
            }
            return;
          }
        } catch (_) {}
      }

      // Default select first available vehicle
      if (list.length > 0 && !selectedVehicleId) {
        setSelectedVehicleId(list[0].vehicle_id);
        if (Number.isFinite(list[0].latitude) && list[0].latitude !== 0) {
          setMapCenter([list[0].latitude, list[0].longitude]);
        }
      }
    } catch (err) {
      console.error("Failed to load tracking vehicles:", err);
    } finally {
      setLoadingFleet(false);
    }
  };

  const fetchSimulationState = async () => {
    try {
      const [statusRes, routesRes] = await Promise.all([
        getSimulationStatus(token).catch(() => ({ simulations: [] })),
        getSimulationRoutes(token).catch(() => ({ routes: [] })),
      ]);
      setSimStatus(statusRes || { simulations: [] });
      setSimRoutes(routesRes?.routes || []);
    } catch (err) {
      console.error("Failed to load simulation state:", err);
    }
  };

  useEffect(() => {
    fetchFleet();
    fetchSimulationState();
  }, [token]);

  // 2. Setup Socket.IO for Live Updates and Broadcasting
  useEffect(() => {
    if (!token) return;

    setSocketStatus("connecting");
    const socket = getSocket(token);
    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketStatus("connected");
    });

    socket.on("disconnect", () => {
      setSocketStatus("disconnected");
    });

    socket.on("connect_error", () => {
      setSocketStatus("disconnected");
    });

    socket.on("gps:ack", () => {
      setBroadcastPingsCount((prev) => prev + 1);
    });

    // Telemetry updates from real drivers or simulations
    socket.on("vehicle:update", (update) => {
      setVehicles((prev) => {
        const exists = prev.some((v) => v.vehicle_id === update.vehicle_id);
        if (!exists) {
          return [
            ...prev,
            {
              vehicle_id: update.vehicle_id,
              driver_name: update.driver_name,
              latitude: update.latitude,
              longitude: update.longitude,
              accuracy: update.accuracy,
              speed: update.speed,
              heading: update.heading,
              tracking_status: update.tracking_status || "tracking",
              is_deviated: update.deviation?.is_deviated ? 1 : 0,
              deviation_distance_m: update.deviation?.deviation_distance_m || 0,
              consecutive_deviations: update.deviation?.consecutive_deviations || 0,
              is_simulated: update.is_simulated || 0,
              last_ping_at: update.timestamp,
            },
          ];
        }

        return prev.map((v) => {
          if (v.vehicle_id === update.vehicle_id) {
            return {
              ...v,
              latitude: update.latitude,
              longitude: update.longitude,
              accuracy: update.accuracy,
              speed: update.speed,
              heading: update.heading,
              tracking_status: update.tracking_status || "tracking",
              is_deviated: update.deviation?.is_deviated ? 1 : 0,
              deviation_distance_m: update.deviation?.deviation_distance_m || 0,
              consecutive_deviations: update.deviation?.consecutive_deviations || 0,
              is_simulated: update.is_simulated !== undefined ? update.is_simulated : v.is_simulated,
              last_ping_at: update.timestamp,
              driver_name: update.driver_name || v.driver_name,
            };
          }
          return v;
        });
      });

      const pt = toLeafletLatLng([update.latitude, update.longitude]);
      if (pt && (!update.accuracy || update.accuracy <= 50)) {
        setTraveledTrails((prev) => {
          const vehicleTrail = prev[update.vehicle_id] || [];
          if (vehicleTrail.length > 0) {
            const last = vehicleTrail[vehicleTrail.length - 1];
            if (Math.abs(last[0] - pt[0]) < 0.0000001 && Math.abs(last[1] - pt[1]) < 0.0000001) {
              return prev;
            }
          }
          return {
            ...prev,
            [update.vehicle_id]: [...vehicleTrail, pt],
          };
        });
      }
    });

    socket.on("alert:deviation", (alert) => {
      setDeviationAlerts((prev) => {
        const remaining = prev.filter((a) => a.vehicle_id !== alert.vehicle_id);
        return [
          {
            id: `${Date.now()}_${alert.vehicle_id}`,
            ...alert,
          },
          ...remaining.slice(0, 9),
        ];
      });
    });

    socket.on("alert:deviation_resolved", (resData) => {
      setDeviationAlerts((prev) => prev.filter((a) => a.vehicle_id !== resData.vehicle_id));
    });

    socket.on("vehicle:breakdown", (breakdown) => {
      setVehicles((prev) =>
        prev.map((v) =>
          v.vehicle_id === breakdown.vehicle_id
            ? { ...v, tracking_status: "breakdown", speed: 0, vehicle_operational_status: "maintenance" }
            : v
        )
      );
    });

    socket.on("vehicle:status_change", (statusData) => {
      setVehicles((prev) =>
        prev.map((v) =>
          v.vehicle_id === statusData.vehicle_id
            ? {
                ...v,
                tracking_status: statusData.tracking_status,
                is_simulated: statusData.is_simulated !== undefined ? statusData.is_simulated : v.is_simulated,
              }
            : v
        )
      );
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("gps:ack");
      socket.off("vehicle:update");
      socket.off("alert:deviation");
      socket.off("alert:deviation_resolved");
      socket.off("vehicle:breakdown");
      socket.off("vehicle:status_change");
    };
  }, [token, selectedVehicleId]);

  // 3. Load Planned Route and Traveled GPS Trail for Selected Vehicle (Isolated by Session & Vehicle)
  useEffect(() => {
    if (!selectedVehicleId) {
      setPlannedRoute(null);
      return;
    }

    let isMounted = true;
    async function loadPolylines() {
      try {
        setPlannedRoute(null);
        const [plannedRes, trailRes] = await Promise.all([
          getPlannedRouteForVehicle(selectedVehicleId, token).catch(() => null),
          getVehicleLocationTrail(selectedVehicleId, { limit: 500 }, token).catch(() => ({ trail: [] })),
        ]);

        if (isMounted) {
          if (plannedRes) {
            setPlannedRoute(plannedRes);
          }
          const validPoints = (trailRes?.trail || [])
            .map((p) => toLeafletLatLng([p.latitude, p.longitude]))
            .filter(Boolean);

          setTraveledTrails((prev) => ({
            ...prev,
            [selectedVehicleId]: validPoints,
          }));
        }
      } catch (err) {
        console.error("Failed to load polylines:", err);
      }
    }

    loadPolylines();
    return () => {
      isMounted = false;
    };
  }, [selectedVehicleId, token]);

  // 4. Live Driver GPS Broadcast Handlers (navigator.geolocation.watchPosition)
  const handleStartDriverBroadcast = () => {
    if (!selectedVehicleId) {
      alert("Please select a vehicle to broadcast telemetry for.");
      return;
    }

    setGpsErrorMsg("");

    if (!navigator.geolocation) {
      setGpsSensorStatus("error");
      setGpsErrorMsg("Geolocation is not supported by your browser. You can use Simulation Mode instead.");
      return;
    }

    // Start session in backend
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("tracking:start", { vehicle_id: selectedVehicleId });
    } else {
      startTrackingSession(selectedVehicleId, token).catch(() => {});
    }

    setIsBroadcasting(true);
    setGpsSensorStatus("active");

    const options = {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 10000,
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsSensorStatus("active");
        setGpsErrorMsg("");

        const payload = {
          vehicle_id: selectedVehicleId,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy || 5,
          speed: pos.coords.speed ? Math.max(0, pos.coords.speed * 3.6) : 0, // m/s to km/h
          heading: pos.coords.heading || 0,
          timestamp: new Date().toISOString(),
        };

        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit("gps:update", payload);
        } else {
          postGpsPing(payload, token).catch(() => {});
        }
      },
      (err) => {
        console.warn("GPS sensor error:", err);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsSensorStatus("denied");
          setGpsErrorMsg("Location permission denied. Please allow location permissions in your browser or switch to Simulation Mode.");
        } else {
          setGpsSensorStatus("error");
          setGpsErrorMsg(`GPS sensor error: ${err.message}. Retrying satellite fix...`);
        }
      },
      options
    );
  };

  const handleStopDriverBroadcast = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (selectedVehicleId) {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("tracking:stop", { vehicle_id: selectedVehicleId });
      } else {
        stopTrackingSession(selectedVehicleId, token).catch(() => {});
      }
    }

    setIsBroadcasting(false);
    setGpsSensorStatus("idle");
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // 5. Simulation Action Handlers
  const handleCreateSimVehicle = async (e) => {
    e.preventDefault();
    try {
      setIsCreatingSimVehicle(true);
      const vId = newSimVehicleId.trim() || `SIM-0${vehicles.filter((v) => v.is_simulated).length + 1}`;
      await createSimulatedVehicle(
        {
          vehicle_id: vId,
          model: "Virtual Cargo Van",
          driver_name: `Sim Bot (${vId})`,
          configured_capacity_kg: 500,
        },
        token
      );
      setNewSimVehicleId("");
      await fetchFleet();
      setSelectedVehicleId(vId);
      alert(`Simulated vehicle '${vId}' created and added to fleet!`);
    } catch (err) {
      alert("Could not create simulated vehicle: " + err.message);
    } finally {
      setIsCreatingSimVehicle(false);
    }
  };

  const handleStartSim = async (vehicleId) => {
    try {
      const selectedRoute = simRoutes[selectedSimRouteIdx];
      const payload = {
        vehicle_id: vehicleId,
        route_coords: selectedRoute?.waypoints || [],
        speed_multiplier: simSpeedMultiplier,
        run_id: selectedRoute?.run_id || null,
      };

      await startBackendSimulation(payload, token);
      await fetchSimulationState();
      await fetchFleet();
      if (selectedRoute?.waypoints && selectedRoute.waypoints.length >= 2) {
        setPlannedRoute({
          vehicle_id: vehicleId,
          run_id: selectedRoute.run_id,
          waypoints: selectedRoute.waypoints,
          stops: selectedRoute.stops || selectedRoute.stop_coordinates || [],
        });
      }
    } catch (err) {
      alert("Could not start simulation: " + err.message);
    }
  };

  const handleStopSim = async (vehicleId) => {
    try {
      await stopBackendSimulation(vehicleId, token);
      await fetchSimulationState();
      await fetchFleet();
    } catch (err) {
      alert("Could not stop simulation: " + err.message);
    }
  };

  const handleSimSpeedChange = async (vehicleId, multiplier) => {
    try {
      setSimSpeedMultiplier(multiplier);
      await setSimulationSpeed(vehicleId, multiplier, token);
      await fetchSimulationState();
    } catch (err) {
      console.warn("Speed change error:", err);
    }
  };

  const handleSimDeviate = async (vehicleId) => {
    try {
      await triggerSimulationDeviation(vehicleId, token);
      await fetchSimulationState();
    } catch (err) {
      alert("Could not trigger route deviation: " + err.message);
    }
  };

  const handleSimResume = async (vehicleId) => {
    try {
      await resumeSimulationRoute(vehicleId, token);
      await fetchSimulationState();
    } catch (err) {
      alert("Could not resume normal corridor: " + err.message);
    }
  };

  const handleSimBreakdown = async (vehicleId) => {
    try {
      await triggerSimulationBreakdown(vehicleId, token);
      await fetchSimulationState();
      await fetchFleet();
    } catch (err) {
      alert("Could not simulate breakdown: " + err.message);
    }
  };

  const handleOpenHistoryModal = async (vehicleId) => {
    try {
      setShowHistoryModal(true);
      setLoadingHistory(true);
      const res = await getVehicleLocationTrail(vehicleId, 250, token);
      setHistoryTrailData(res.trail || []);
    } catch (err) {
      alert("Failed to load history: " + err.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Filter & Search Vehicles
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        v.vehicle_id.toLowerCase().includes(q) ||
        (v.driver_name && v.driver_name.toLowerCase().includes(q)) ||
        (v.model && v.model.toLowerCase().includes(q));

      if (!matchSearch) return false;

      if (filterTab === "real") return !v.is_simulated;
      if (filterTab === "simulated") return Boolean(v.is_simulated);
      if (filterTab === "disconnected") {
        return v.tracking_status === "offline" || v.tracking_status === "disconnected";
      }
      return true;
    });
  }, [vehicles, searchQuery, filterTab]);

  const currentSelectedVehicle = vehicles.find((v) => v.vehicle_id === selectedVehicleId);
  const activeSimRecord = (simStatus.simulations || []).find((s) => s.vehicle_id === selectedVehicleId);

  const handleSelectVehicle = (v) => {
    setSelectedVehicleId(v.vehicle_id);
    const coords = toLeafletLatLng([v.latitude, v.longitude]);
    if (coords) {
      setMapCenter(coords);
      setMapZoom(14);
    }
  };

  return (
    <div className="space-y-6">
      {/* -------------------------------------------------------------
          1. UNIFIED HEADER WITH SYSTEM HEALTH STATUS
      ------------------------------------------------------------- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white lg:text-3xl">
              Live GPS Tracking & Driver HUD
            </h1>
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-0.5 text-xs font-semibold text-cyan-300">
              Unified Console
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-400">
            Real-time fleet tracking, live driver sensor telemetry HUD, and interactive simulation lab in one unified interface.
          </p>
        </div>

        {/* Action Buttons & Sensor Indicators */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Socket Badge */}
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                socketStatus === "connected"
                  ? "bg-emerald-400 animate-pulse"
                  : socketStatus === "connecting"
                  ? "bg-amber-400 animate-ping"
                  : "bg-rose-500"
              }`}
            />
            <span className="capitalize font-semibold text-gray-200">{socketStatus}</span>
          </div>

          {/* GPS Broadcast Control Button */}
          {!isBroadcasting ? (
            <button
              type="button"
              onClick={handleStartDriverBroadcast}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500 transition"
            >
              <span>🛰️</span>
              <span>Start Driver Broadcast</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStopDriverBroadcast}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-600/20 hover:bg-rose-500 transition"
            >
              <span>🛑</span>
              <span>Stop Broadcast</span>
            </button>
          )}

          {/* Simulation Mode Toggle */}
          <button
            type="button"
            onClick={() => setShowSimPanel(!showSimPanel)}
            className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold transition ${
              showSimPanel
                ? "border-purple-400 bg-purple-500/20 text-purple-200"
                : "border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20"
            }`}
          >
            <span>🤖</span>
            <span>{showSimPanel ? "Close Simulation" : "Simulation Lab"}</span>
          </button>

          <Link
            to="/multi-vehicle-planner"
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-2.5 text-xs font-bold text-cyan-300 hover:bg-cyan-500/20 transition"
          >
            <span>🗺️</span>
            <span>Multi-Vehicle Planner</span>
          </Link>

          <button
            type="button"
            onClick={() => {
              fetchFleet();
              fetchSimulationState();
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-semibold text-gray-300 hover:bg-white/10"
          >
            ↻
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------
          2. SEAMLESS DRIVER HUD TELEMETRY METRICS DECK
      ------------------------------------------------------------- */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 shadow-2xl backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between border-b border-white/5 pb-2.5">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-bold uppercase tracking-wider text-cyan-300">
              Live Driver Telemetry HUD
            </span>
            <span className="text-xs text-gray-400 font-medium">
              — Active Focus: <b className="text-white">{selectedVehicleId || "None"}</b>
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="text-gray-400">
              Sensor State:{" "}
              <b
                className={
                  gpsSensorStatus === "active"
                    ? "text-emerald-400"
                    : gpsSensorStatus === "denied"
                    ? "text-rose-400"
                    : "text-gray-300"
                }
              >
                {gpsSensorStatus === "active" ? "Broadcasting Live GPS" : gpsSensorStatus}
              </b>
            </span>
            {isBroadcasting && (
              <span className="rounded-lg bg-cyan-400/20 px-2.5 py-0.5 font-bold text-cyan-300 text-[11px]">
                {broadcastPingsCount} pings sent
              </span>
            )}
          </div>
        </div>

        {/* HUD Telemetry Cards Grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {/* Latitude */}
          <div className="rounded-2xl border border-white/5 bg-slate-950/60 p-3.5 text-center">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Latitude
            </span>
            <div className="mt-1 font-mono text-lg font-bold text-cyan-300">
              {currentSelectedVehicle?.latitude
                ? Number(currentSelectedVehicle.latitude).toFixed(5)
                : "—"}
            </div>
          </div>

          {/* Longitude */}
          <div className="rounded-2xl border border-white/5 bg-slate-950/60 p-3.5 text-center">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Longitude
            </span>
            <div className="mt-1 font-mono text-lg font-bold text-cyan-300">
              {currentSelectedVehicle?.longitude
                ? Number(currentSelectedVehicle.longitude).toFixed(5)
                : "—"}
            </div>
          </div>

          {/* Speed */}
          <div className="rounded-2xl border border-white/5 bg-slate-950/60 p-3.5 text-center">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Velocity
            </span>
            <div className="mt-1 text-lg font-bold text-white">
              {Math.round(currentSelectedVehicle?.speed || 0)} <span className="text-xs text-gray-400">km/h</span>
            </div>
          </div>

          {/* Accuracy */}
          <div className="rounded-2xl border border-white/5 bg-slate-950/60 p-3.5 text-center">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              GPS Accuracy
            </span>
            <div className="mt-1 text-lg font-bold text-emerald-400">
              ±{Math.round(currentSelectedVehicle?.accuracy || 5)} <span className="text-xs">m</span>
            </div>
          </div>

          {/* Route Compliance */}
          <div className="rounded-2xl border border-white/5 bg-slate-950/60 p-3.5 text-center">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Corridor Offset
            </span>
            <div
              className={`mt-1 text-lg font-bold ${
                currentSelectedVehicle?.is_deviated ? "text-rose-400" : "text-emerald-300"
              }`}
            >
              {currentSelectedVehicle?.is_deviated
                ? `+${Math.round(currentSelectedVehicle.deviation_distance_m)}m`
                : "0m (On Path)"}
            </div>
          </div>

          {/* Last Ping Timestamp */}
          <div className="rounded-2xl border border-white/5 bg-slate-950/60 p-3.5 text-center">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Last GPS Update
            </span>
            <div className="mt-1 font-mono text-xs text-gray-300">
              {currentSelectedVehicle?.last_ping_at
                ? new Date(currentSelectedVehicle.last_ping_at).toLocaleTimeString()
                : "Awaiting Fix"}
            </div>
          </div>
        </div>
      </div>

      {/* Sensor Error Alert */}
      {gpsErrorMsg && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div className="flex-1 text-xs">
              <strong className="font-bold">GPS Alert:</strong> {gpsErrorMsg}
            </div>
          </div>
        </div>
      )}

      {/* Critical Deviation / Breakdown Banner */}
      {deviationAlerts.length > 0 && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 shadow-xl backdrop-blur-md">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="text-2xl animate-bounce">🚨</span>
              <div>
                <h3 className="font-bold text-sm text-rose-200">
                  Route Corridor Deviation Detected on Vehicle {deviationAlerts[0].vehicle_id}
                </h3>
                <p className="mt-0.5 text-xs text-rose-300/80">
                  Vehicle is deviated by <b>{Math.round(deviationAlerts[0].distance_m)} meters</b> from the planned delivery corridor.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to={`/dynamic-rerouting?vehicle=${deviationAlerts[0].vehicle_id}`}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-rose-500/30 hover:bg-rose-600 transition"
              >
                Initiate Dynamic Rerouting →
              </Link>
              <button
                type="button"
                onClick={() => setDeviationAlerts([])}
                className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/10"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          3. SIMULATION LAB DRAWER
      ------------------------------------------------------------- */}
      {showSimPanel && (
        <div className="rounded-3xl border border-purple-500/30 bg-purple-950/20 p-5 shadow-2xl backdrop-blur-md">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-purple-500/20 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">⚡</span>
                <h2 className="text-base font-bold text-white">GPS Vehicle Simulation Workbench</h2>
                <span className="rounded bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-300">
                  2s Update Engine
                </span>
              </div>
              <p className="mt-0.5 text-xs text-gray-300">
                Dispatch virtual delivery vans, test edge conditions like breakdowns & route deviations in real time.
              </p>
            </div>

            <form onSubmit={handleCreateSimVehicle} className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="ID (e.g. SIM-01)"
                value={newSimVehicleId}
                onChange={(e) => setNewSimVehicleId(e.target.value)}
                className="w-28 rounded-xl border border-purple-400/30 bg-slate-900/80 px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-400"
              />
              <button
                type="submit"
                disabled={isCreatingSimVehicle}
                className="rounded-xl bg-purple-600 px-3.5 py-1.5 text-xs font-bold text-white shadow hover:bg-purple-500 transition"
              >
                + Add Sim Van
              </button>
            </form>
          </div>

          {currentSelectedVehicle ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {/* Route Selector */}
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3.5">
                <label className="text-[11px] font-semibold text-gray-300">
                  Planned Route Corridor for {currentSelectedVehicle.vehicle_id}:
                </label>
                <select
                  value={selectedSimRouteIdx}
                  onChange={(e) => {
                    const newIdx = Number(e.target.value);
                    setSelectedSimRouteIdx(newIdx);
                    const selRoute = simRoutes[newIdx];
                    if (selRoute?.waypoints && selRoute.waypoints.length >= 2) {
                      setPlannedRoute({
                        vehicle_id: selRoute.vehicle_id || currentSelectedVehicle.vehicle_id,
                        run_id: selRoute.run_id,
                        waypoints: selRoute.waypoints,
                        stops: selRoute.stops || selRoute.stop_coordinates || [],
                      });
                    }
                  }}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400"
                >
                  {simRoutes.map((r, i) => (
                    <option key={i} value={i}>
                      Run {r.run_id?.substring(0, 8)} · {r.stop_count} stops ({r.vehicle_id || "V001"})
                    </option>
                  ))}
                  {simRoutes.length === 0 && (
                    <option value={0}>Nagpur Physical Road Corridor (Loop)</option>
                  )}
                </select>
              </div>

              {/* Speed Multiplier */}
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3.5">
                <label className="text-[11px] font-semibold text-gray-300">
                  Simulation Speed Multiplier:
                </label>
                <div className="mt-2 flex gap-1.5">
                  {[0.5, 1, 2, 5, 10].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleSimSpeedChange(currentSelectedVehicle.vehicle_id, m)}
                      className={`flex-1 rounded-xl py-1 text-xs font-bold transition ${
                        simSpeedMultiplier === m
                          ? "bg-purple-500 text-white shadow"
                          : "border border-white/10 bg-white/5 text-gray-400 hover:text-white"
                      }`}
                    >
                      {m}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Triggers */}
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3.5 flex flex-col justify-center gap-2">
                <div className="flex gap-2">
                  {!activeSimRecord ? (
                    <button
                      type="button"
                      onClick={() => handleStartSim(currentSelectedVehicle.vehicle_id)}
                      className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-2 text-xs font-bold text-white shadow hover:opacity-90"
                    >
                      ▶ Start Movement
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStopSim(currentSelectedVehicle.vehicle_id)}
                      className="flex-1 rounded-xl bg-slate-700 py-2 text-xs font-bold text-white hover:bg-slate-600"
                    >
                      ⏹ Pause / Stop
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleSimBreakdown(currentSelectedVehicle.vehicle_id)}
                    className="flex-1 rounded-xl border border-rose-500/40 bg-rose-500/20 py-2 text-xs font-bold text-rose-200 hover:bg-rose-500/30"
                  >
                    🛑 Breakdown
                  </button>
                </div>

                <div className="flex gap-2">
                  {activeSimRecord?.is_deviated_simulated ? (
                    <button
                      type="button"
                      onClick={() => handleSimResume(currentSelectedVehicle.vehicle_id)}
                      className="flex-1 rounded-xl border border-emerald-500/40 bg-emerald-500/20 py-1.5 text-xs font-bold text-emerald-300"
                    >
                      ✓ Return to Corridor
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSimDeviate(currentSelectedVehicle.vehicle_id)}
                      className="flex-1 rounded-xl border border-amber-500/40 bg-amber-500/20 py-1.5 text-xs font-bold text-amber-200"
                    >
                      ⚡ Simulate Deviation (&gt;150m)
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* -------------------------------------------------------------
          4. MAIN SPLIT INTERACTION: LEAFLET MAP & FLEET SELECTION
      ------------------------------------------------------------- */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Leaflet Map (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div
            className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#040817] shadow-2xl"
            style={{ height: "620px" }}
          >
            <MapContainer center={mapCenter} zoom={mapZoom} className="h-full w-full">
              <MapRecenter center={mapCenter} zoom={mapZoom} />

              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Central Depot Marker */}
              <Marker position={NAGPUR_DEPOT}>
                <Popup>
                  <div className="text-xs">
                    <b>PathWise Central Depot</b>
                    <br />
                    Nagpur Distribution Center
                  </div>
                </Popup>
              </Marker>

              {/* Planned Route Polyline (Royal Blue) */}
              {plannedRoute?.waypoints && plannedRoute.waypoints.length >= 2 && (
                <Polyline
                  positions={plannedRoute.waypoints}
                  pathOptions={{
                    color: "#2563eb", // Royal Blue
                    weight: 4,
                    dashArray: "6, 6",
                    opacity: 0.85,
                  }}
                >
                  <Popup>
                    <div className="text-xs">
                      <b style={{ color: "#2563eb" }}>Planned Scheduled Route</b> ({selectedVehicleId})
                      <br />
                      {plannedRoute.stops?.length || 0} scheduled delivery stops
                    </div>
                  </Popup>
                </Polyline>
              )}

              {/* Actual Traveled GPS Trail (Emerald Green - Isolated by Vehicle & Session) */}
              {traveledTrails[selectedVehicleId] && traveledTrails[selectedVehicleId].length >= 2 && (
                <Polyline
                  positions={traveledTrails[selectedVehicleId]}
                  pathOptions={{
                    color: "#10b981", // Emerald Green
                    weight: 4,
                    opacity: 0.95,
                  }}
                >
                  <Popup>
                    <div className="text-xs">
                      <b style={{ color: "#10b981" }}>Actual Traveled Route (GPS Trail)</b> ({selectedVehicleId})
                      <br />
                      {traveledTrails[selectedVehicleId].length} verified coordinate pings
                    </div>
                  </Popup>
                </Polyline>
              )}

              {/* Planned Delivery Stop Pins */}
              {(plannedRoute?.stops || []).map((stop, i) => {
                if (stop.delivery_id === "DEPOT") return null;
                const lat = Number(stop.latitude);
                const lon = Number(stop.longitude);
                if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

                return (
                  <CircleMarker
                    key={stop.delivery_id || i}
                    center={[lat, lon]}
                    radius={6}
                    pathOptions={{ color: "#2563eb", fillColor: "#3b82f6", fillOpacity: 0.9 }}
                  >
                    <Popup>
                      <div className="text-xs">
                        <b>Stop: {stop.delivery_id}</b>
                        <br />
                        {stop.recipient_name} ({stop.location})
                        <br />
                        Priority: {stop.priority}
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}

              {/* Vehicle Markers */}
              {vehicles.map((v) => {
                const lat = Number(v.latitude);
                const lon = Number(v.longitude);
                if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) {
                  return null;
                }

                return (
                  <Marker
                    key={v.vehicle_id}
                    position={[lat, lon]}
                    icon={createCustomVehicleIcon(v)}
                    eventHandlers={{
                      click: () => handleSelectVehicle(v),
                    }}
                  >
                    <Popup>
                      <div className="p-1 text-xs">
                        <div className="flex items-center justify-between gap-3 border-b pb-1">
                          <b className="text-sm font-bold">{v.vehicle_id}</b>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                              v.is_deviated
                                ? "bg-red-500/20 text-red-700"
                                : v.tracking_status === "tracking"
                                ? "bg-emerald-500/20 text-emerald-700"
                                : "bg-slate-500/20 text-slate-700"
                            }`}
                          >
                            {v.is_simulated ? "SIMULATED" : v.tracking_status}
                          </span>
                        </div>

                        <div className="mt-1.5 space-y-0.5">
                          <div>
                            <b>Driver:</b> {v.driver_name || "Unassigned"}
                          </div>
                          <div>
                            <b>Speed:</b> {Math.round(v.speed || 0)} km/h
                          </div>
                          <div>
                            <b>Accuracy:</b> ±{Math.round(v.accuracy || 5)}m
                          </div>
                          {v.is_deviated ? (
                            <div className="font-bold text-red-600">
                              ⚠️ Deviation: {Math.round(v.deviation_distance_m)}m off corridor
                            </div>
                          ) : null}
                          <div className="text-[10px] text-gray-500">
                            Last Ping: {v.last_ping_at ? new Date(v.last_ping_at).toLocaleTimeString() : "N/A"}
                          </div>
                        </div>

                        <div className="mt-2.5 pt-1.5 border-t border-gray-200 flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenHistoryModal(v.vehicle_id)}
                            className="rounded bg-slate-800 text-white px-2 py-1 text-[10px] font-semibold"
                          >
                            View Telemetry Trail
                          </button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>

            {/* Map Legend Overlay */}
            <div className="absolute bottom-4 left-4 z-[1000] rounded-2xl border border-white/10 bg-slate-950/85 p-3 text-[11px] text-gray-200 backdrop-blur-md shadow-2xl">
              <div className="font-bold uppercase tracking-wider text-[9px] text-gray-400 mb-2">Visual Map Legend</div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-block w-4 h-1 border-t-2 border-dashed border-blue-500" />
                <span>Planned Route Corridor (Blue Polyline)</span>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-block w-4 h-1 bg-emerald-500 rounded" />
                <span>Actual Traveled Route (Green Polyline)</span>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-sky-400" />
                <span>Active Real Vehicle</span>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-purple-500" />
                <span>Simulated Vehicle [SIM]</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-500 opacity-60" />
                <span>Disconnected / Offline</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Fleet Selection & Selected HUD Card (1 Col) */}
        <div className="space-y-4">
          {/* Selected Vehicle Info Card */}
          {currentSelectedVehicle ? (
            <div
              className={`rounded-3xl border p-5 shadow-xl backdrop-blur-md transition ${
                currentSelectedVehicle.is_deviated
                  ? "border-rose-500/40 bg-rose-950/20"
                  : currentSelectedVehicle.is_simulated
                  ? "border-purple-400/30 bg-purple-950/20"
                  : "border-sky-400/30 bg-sky-950/20"
              }`}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">{currentSelectedVehicle.vehicle_id}</h3>
                    {currentSelectedVehicle.is_simulated ? (
                      <span className="rounded bg-purple-500/30 px-2 py-0.5 text-[9px] font-bold text-purple-200 border border-purple-400/30">
                        SIMULATED
                      </span>
                    ) : null}
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                        currentSelectedVehicle.is_deviated
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : currentSelectedVehicle.tracking_status === "tracking"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-gray-500/20 text-gray-300 border border-white/10"
                      }`}
                    >
                      {currentSelectedVehicle.tracking_status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {currentSelectedVehicle.manufacturer} {currentSelectedVehicle.model} ({currentSelectedVehicle.vehicle_class})
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenHistoryModal(currentSelectedVehicle.vehicle_id)}
                    className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-gray-300 hover:bg-white/10 transition"
                    title="View Telemetry Trail History"
                  >
                    Trail ◷
                  </button>

                  {currentSelectedVehicle.is_deviated ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/dynamic-rerouting?vehicle=${currentSelectedVehicle.vehicle_id}`)}
                      className="rounded-xl bg-rose-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-600 transition shadow-lg shadow-rose-500/20"
                    >
                      Reroute ↻
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Telemetry Snapshot Details */}
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                  <span className="text-[10px] text-gray-400">Driver</span>
                  <div className="mt-0.5 font-bold text-white truncate">
                    {currentSelectedVehicle.driver_name || "Unassigned"}
                  </div>
                </div>

                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                  <span className="text-[10px] text-gray-400">Speed</span>
                  <div className="mt-0.5 font-bold text-cyan-300">
                    {Math.round(currentSelectedVehicle.speed || 0)} km/h
                  </div>
                </div>

                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                  <span className="text-[10px] text-gray-400">Accuracy</span>
                  <div className="mt-0.5 font-bold text-emerald-400">
                    ±{Math.round(currentSelectedVehicle.accuracy || 5)} m
                  </div>
                </div>

                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                  <span className="text-[10px] text-gray-400">Offset</span>
                  <div
                    className={`mt-0.5 font-bold ${
                      currentSelectedVehicle.is_deviated ? "text-rose-400" : "text-emerald-400"
                    }`}
                  >
                    {Math.round(currentSelectedVehicle.deviation_distance_m || 0)} m
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Fleet Vehicle Selection Panel */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 shadow-xl">
            {/* Search */}
            <div className="relative mb-3">
              <input
                type="text"
                placeholder="Search vehicle ID, driver..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-2 text-xs text-gray-500 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex rounded-xl border border-white/10 bg-white/5 p-1 text-[11px]">
              <button
                type="button"
                onClick={() => setFilterTab("all")}
                className={`flex-1 rounded-lg py-1 font-semibold transition ${
                  filterTab === "all" ? "bg-cyan-500 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                All ({vehicles.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab("real")}
                className={`flex-1 rounded-lg py-1 font-semibold transition ${
                  filterTab === "real" ? "bg-cyan-500 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                Real ({vehicles.filter((v) => !v.is_simulated).length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab("simulated")}
                className={`flex-1 rounded-lg py-1 font-semibold transition ${
                  filterTab === "simulated" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                Sim ({vehicles.filter((v) => v.is_simulated).length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab("disconnected")}
                className={`flex-1 rounded-lg py-1 font-semibold transition ${
                  filterTab === "disconnected" ? "bg-slate-700 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                Offline
              </button>
            </div>

            {/* Scrollable Vehicle List */}
            <div className="mt-3.5 max-h-[360px] overflow-y-auto space-y-2 pr-1">
              {filteredVehicles.map((v) => {
                const isSelected = v.vehicle_id === selectedVehicleId;
                const isTracking = v.tracking_status === "tracking";
                const isDeviated = Boolean(v.is_deviated);
                const isBreakdown = v.tracking_status === "breakdown";
                const isSim = Boolean(v.is_simulated);

                return (
                  <div
                    key={v.vehicle_id}
                    onClick={() => handleSelectVehicle(v)}
                    className={`cursor-pointer rounded-2xl border p-3.5 transition ${
                      isSelected
                        ? isSim
                          ? "border-purple-400/60 bg-purple-500/10 shadow-lg shadow-purple-950/40"
                          : "border-cyan-400/60 bg-cyan-400/10 shadow-lg shadow-cyan-950/40"
                        : "border-white/5 bg-white/[0.015] hover:border-white/10 hover:bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            isBreakdown
                              ? "bg-rose-500 animate-bounce"
                              : isDeviated
                              ? "bg-amber-400 animate-ping"
                              : isTracking
                              ? isSim
                                ? "bg-purple-400 animate-pulse"
                                : "bg-sky-400 animate-pulse"
                              : "bg-gray-600"
                          }`}
                        />
                        <h4 className="text-sm font-bold text-white">{v.vehicle_id}</h4>
                        {isSim && (
                          <span className="text-[9px] font-bold text-purple-300 bg-purple-500/20 px-1.5 py-0.2 rounded border border-purple-400/30">
                            SIM
                          </span>
                        )}
                        <span className="text-xs text-gray-400 truncate max-w-[90px]">
                          {v.model}
                        </span>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize ${
                          isBreakdown
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            : isDeviated
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : isTracking
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-gray-500/20 text-gray-400 border border-white/5"
                        }`}
                      >
                        {isBreakdown ? "Breakdown" : isDeviated ? "Deviated" : isTracking ? `${Math.round(v.speed || 0)} km/h` : "Offline"}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                      <span className="truncate max-w-[130px]">
                        👤 {v.driver_name || "Unassigned"}
                      </span>
                      {isDeviated ? (
                        <span className="text-rose-400 font-semibold">
                          +{Math.round(v.deviation_distance_m)}m off route
                        </span>
                      ) : (
                        <span className="text-[10px]">
                          ±{Math.round(v.accuracy || 5)}m
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------
          5. INDIVIDUAL VEHICLE TELEMETRY HISTORY MODAL
      ------------------------------------------------------------- */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#060b1c] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white">
                  Telemetry History & Trail: {selectedVehicleId}
                </h3>
                <p className="text-xs text-gray-400">
                  Persisted SQLite GPS breadcrumb records received for this vehicle.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/10"
              >
                ✕ Close
              </button>
            </div>

            <div className="mt-4 max-h-[420px] overflow-y-auto">
              {loadingHistory ? (
                <div className="p-8 text-center text-xs text-gray-400">Loading telemetry breadcrumbs...</div>
              ) : historyTrailData.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-500">
                  No GPS breadcrumbs recorded yet for vehicle {selectedVehicleId}.
                </div>
              ) : (
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="border-b border-white/10 text-[10px] uppercase text-gray-500 sticky top-0 bg-[#060b1c]">
                    <tr>
                      <th className="py-2">Time</th>
                      <th className="py-2">Latitude</th>
                      <th className="py-2">Longitude</th>
                      <th className="py-2">Speed</th>
                      <th className="py-2">Accuracy</th>
                      <th className="py-2">Offset</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                    {historyTrailData.map((pt, i) => (
                      <tr key={pt.id || i} className="hover:bg-white/[0.02]">
                        <td className="py-2 text-gray-400">
                          {new Date(pt.recorded_at).toLocaleTimeString()}
                        </td>
                        <td className="py-2 text-cyan-300">{Number(pt.latitude).toFixed(5)}</td>
                        <td className="py-2 text-cyan-300">{Number(pt.longitude).toFixed(5)}</td>
                        <td className="py-2 text-white">{Math.round(pt.speed || 0)} km/h</td>
                        <td className="py-2 text-emerald-400">±{Math.round(pt.accuracy || 0)}m</td>
                        <td className="py-2">
                          {pt.is_deviated ? (
                            <span className="text-rose-400 font-bold">+{Math.round(pt.deviation_distance_m)}m</span>
                          ) : (
                            <span className="text-gray-500">{Math.round(pt.deviation_distance_m || 0)}m</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveVehicleTracking;
