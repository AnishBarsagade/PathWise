/**
 * PathWise Interactive Multi-Vehicle Route Planning & Road-Based Simulation Studio
 *
 * Capabilities:
 * 1. Interactive map-based Start & Destination location selection (click on map or search).
 * 2. Multi-factor route calculation using existing A*, AHP weights, and OSRM physical road geometry.
 * 3. Multi-vehicle fleet dispatch (SIM-01, SIM-02, SIM-03...) with independent road routes & speeds.
 * 4. Progressive road-following movement with distinct visual markers and separate traveled paths.
 * 5. Full simulation controls: Start, Pause, Resume, Stop, Reset, Speed multipliers (0.5x to 10x).
 * 6. Live telemetry streaming with distance travelled, distance remaining, ETA, and progress %.
 * 7. Clean segregation between simulated vehicles and real driver GPS devices.
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { useAuth } from "../context/AuthContext";
import { getSocket } from "../services/socket";
import {
  getMultiVehicleLocations,
  planMultiVehicleJourney,
  startMultiVehicleSimulations,
  pauseMultiVehicleSimulations,
  resumeMultiVehicleSimulations,
  stopMultiVehicleSimulations,
  resetMultiVehicleSimulations,
  setMultiVehicleSpeed,
} from "../services/api";
import { isValidCoordinate } from "../utils/geoUtils";

// Fix default Leaflet marker assets for bundled build
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const NAGPUR_CENTER = [21.1458, 79.0882];

const VEHICLE_PALETTE = [
  { color: "#3b82f6", label: "Electric Blue" },
  { color: "#10b981", label: "Emerald Green" },
  { color: "#8b5cf6", label: "Violet Purple" },
  { color: "#f59e0b", label: "Amber Orange" },
  { color: "#ec4899", label: "Pink Fuchsia" },
  { color: "#06b6d4", label: "Cyan Sky" },
];

/**
 * Helper to auto-recenter map when coordinates change
 */
function MapRecenter({ center, zoom = 13 }) {
  const map = useMap();
  useEffect(() => {
    if (center && isValidCoordinate(center[0], center[1], false)) {
      map.setView(center, zoom, { animate: true });
    }
  }, [center, zoom, map]);
  return null;
}

/**
 * Handles map click events to set Start or Destination location
 */
function MapClickHandler({ selectionMode, onSelectLocation }) {
  useMapEvents({
    click(e) {
      if (selectionMode === "start" || selectionMode === "destination") {
        const { lat, lng } = e.latlng;
        onSelectLocation(selectionMode, Number(lat.toFixed(5)), Number(lng.toFixed(5)));
      }
    },
  });
  return null;
}

/**
 * Creates custom styled HTML DivIcons for Start and Destination pins
 */
function createPinIcon(type) {
  const isStart = type === "start";
  const bg = isStart ? "bg-emerald-500" : "bg-rose-500";
  const ring = isStart ? "ring-emerald-400" : "ring-rose-400";
  const text = isStart ? "START" : "DEST";
  const symbol = isStart ? "🟢" : "🎯";

  return L.divIcon({
    className: "custom-pin-marker",
    html: `
      <div class="relative flex flex-col items-center -translate-x-1/2 -translate-y-full cursor-pointer pointer-events-auto">
        <div class="flex items-center gap-1 px-2 py-0.5 rounded-full ${bg} text-white font-extrabold text-[10px] shadow-lg ring-2 ${ring} ring-offset-2 ring-offset-slate-900">
          <span>${symbol}</span>
          <span>${text}</span>
        </div>
        <div class="w-0.5 h-3 ${bg}"></div>
      </div>
    `,
    iconSize: [60, 36],
    iconAnchor: [30, 36],
  });
}

/**
 * Creates high-visibility vehicle marker with heading rotation and color badge
 */
function createSimVehicleIcon(veh) {
  const color = veh.color || "#3b82f6";
  const heading = Number(veh.heading) || 0;
  const isCompleted = veh.status === "completed" || veh.tracking_status === "completed";
  const isPaused = veh.status === "paused" || veh.tracking_status === "paused";

  const statusBadge = isCompleted ? "✓ DONE" : isPaused ? "⏸ PAUSED" : `${Math.round(veh.speed || 0)} km/h`;

  return L.divIcon({
    className: "custom-sim-vehicle-icon",
    html: `
      <div class="relative flex flex-col items-center -translate-x-1/2 -translate-y-1/2">
        <div class="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-950/90 border border-white/20 text-white font-mono text-[9px] font-bold shadow-md whitespace-nowrap">
          <span class="w-2 h-2 rounded-full" style="background-color: ${color}"></span>
          <span>${veh.vehicle_id}</span>
          <span class="text-gray-400 text-[8px] font-normal">(${statusBadge})</span>
        </div>
        <div class="mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs shadow-lg ring-2 ring-white/80 transition-transform duration-300"
             style="background-color: ${color}; transform: rotate(${heading}deg);">
          ▲
        </div>
      </div>
    `,
    iconSize: [60, 48],
    iconAnchor: [30, 24],
  });
}

const MultiVehiclePlanner = () => {
  const { token } = useAuth();

  // Locations state
  const [locationsCatalog, setLocationsCatalog] = useState([]);
  const [selectionMode, setSelectionMode] = useState(null); // 'start' | 'destination' | null
  const [searchQueryStart, setSearchQueryStart] = useState("");
  const [searchQueryDest, setSearchQueryDest] = useState("");

  const [startLocation, setStartLocation] = useState({
    name: "PathWise Central Depot (Sitabuldi)",
    latitude: 21.1450,
    longitude: 79.0880,
  });

  const [destLocation, setDestLocation] = useState({
    name: "Sadar Commercial District",
    latitude: 21.1600,
    longitude: 79.1000,
  });

  // Multi-vehicle configuration list
  const [vehicles, setVehicles] = useState([
    {
      vehicle_id: "SIM-01",
      model: "Autonomous Cargo Van",
      speed_kmh: 40,
      color: VEHICLE_PALETTE[0].color,
      status: "waiting",
      distance_travelled_km: 0,
      remaining_distance_km: 0,
      progress_percent: 0,
      eta_seconds: 0,
    },
    {
      vehicle_id: "SIM-02",
      model: "Urban Delivery Express",
      speed_kmh: 48,
      color: VEHICLE_PALETTE[1].color,
      status: "waiting",
      distance_travelled_km: 0,
      remaining_distance_km: 0,
      progress_percent: 0,
      eta_seconds: 0,
    },
  ]);

  // Routing and Journey state
  const [isPlanning, setIsPlanning] = useState(false);
  const [plannedJourney, setPlannedJourney] = useState(null);
  const [planError, setPlanError] = useState(null);

  // Simulation execution state
  const [simState, setSimState] = useState("idle"); // 'idle' | 'running' | 'paused' | 'completed'
  const [speedMultiplier, setSpeedMultiplierState] = useState(1);
  const [traveledTrails, setTraveledTrails] = useState({}); // vehicle_id -> array of [lat, lon]
  const [liveVehiclePositions, setLiveVehiclePositions] = useState({}); // vehicle_id -> live telemetry object

  const socketRef = useRef(null);

  // 1. Fetch Nagpur Landmark Catalog on load
  useEffect(() => {
    let isMounted = true;
    async function loadCatalog() {
      try {
        const res = await getMultiVehicleLocations(token).catch(() => ({ locations: [] }));
        if (isMounted && res.locations) {
          setLocationsCatalog(res.locations);
        }
      } catch (err) {
        console.error("Could not load landmark locations catalog:", err);
      }
    }
    loadCatalog();
    return () => { isMounted = false; };
  }, [token]);

  // 2. Setup Socket.IO for real-time telemetry streaming
  useEffect(() => {
    if (!token) return;

    const socket = getSocket(token);
    socketRef.current = socket;

    socket.on("vehicle:update", (update) => {
      if (!update || !update.vehicle_id) return;
      const vId = update.vehicle_id;

      // Update vehicle current position and metrics
      setLiveVehiclePositions((prev) => ({
        ...prev,
        [vId]: {
          ...prev[vId],
          ...update,
        },
      }));

      // Append to traveled trail
      if (isValidCoordinate(update.latitude, update.longitude, false)) {
        setTraveledTrails((prev) => {
          const currentTrail = prev[vId] || [];
          const newPt = [update.latitude, update.longitude];
          return {
            ...prev,
            [vId]: [...currentTrail, newPt],
          };
        });
      }

      // Update vehicle status in state list
      setVehicles((prev) =>
        prev.map((v) => {
          if (v.vehicle_id === vId) {
            return {
              ...v,
              speed_kmh: update.speed ?? v.speed_kmh,
              distance_travelled_km: update.distance_travelled_km ?? v.distance_travelled_km,
              remaining_distance_km: update.remaining_distance_km ?? v.remaining_distance_km,
              progress_percent: update.progress_percent ?? v.progress_percent,
              eta_seconds: update.eta_seconds ?? v.eta_seconds,
              status: update.tracking_status || v.status,
            };
          }
          return v;
        })
      );
    });

    socket.on("vehicle:completed", (data) => {
      if (!data?.vehicle_id) return;
      setVehicles((prev) =>
        prev.map((v) => (v.vehicle_id === data.vehicle_id ? { ...v, status: "completed", progress_percent: 100 } : v))
      );
    });

    socket.on("vehicle:status_change", (data) => {
      if (!data?.vehicle_id) return;
      setVehicles((prev) =>
        prev.map((v) => (v.vehicle_id === data.vehicle_id ? { ...v, status: data.tracking_status || v.status } : v))
      );
    });

    return () => {
      socket.off("vehicle:update");
      socket.off("vehicle:completed");
      socket.off("vehicle:status_change");
    };
  }, [token]);

  // 3. Location click and search handlers
  const handleSelectLocation = (mode, lat, lon, name = null) => {
    const loc = {
      name: name || `Coordinates [${lat}, ${lon}]`,
      latitude: lat,
      longitude: lon,
    };

    if (mode === "start") {
      setStartLocation(loc);
    } else {
      setDestLocation(loc);
    }
    setSelectionMode(null);
    setPlannedJourney(null); // Invalidate previous plan
  };

  const handleResetLocations = () => {
    setStartLocation({
      name: "PathWise Central Depot (Sitabuldi)",
      latitude: 21.1450,
      longitude: 79.0880,
    });
    setDestLocation({
      name: "Sadar Commercial District",
      latitude: 21.1600,
      longitude: 79.1000,
    });
    setPlannedJourney(null);
    setTraveledTrails({});
    setSelectionMode(null);
  };

  // 4. Vehicle addition / removal handlers
  const handleAddVehicle = () => {
    if (vehicles.length >= 8) {
      alert("Maximum 8 concurrent simulated vehicles supported.");
      return;
    }
    const nextIdx = vehicles.length + 1;
    const nextId = `SIM-0${nextIdx}`;
    const nextPalette = VEHICLE_PALETTE[(nextIdx - 1) % VEHICLE_PALETTE.length];

    setVehicles((prev) => [
      ...prev,
      {
        vehicle_id: nextId,
        model: nextIdx % 2 === 0 ? "Urban Delivery Express" : "Autonomous Cargo Van",
        speed_kmh: 35 + nextIdx * 5,
        color: nextPalette.color,
        status: "waiting",
        distance_travelled_km: 0,
        remaining_distance_km: 0,
        progress_percent: 0,
        eta_seconds: 0,
      },
    ]);
  };

  const handleRemoveVehicle = (vId) => {
    if (vehicles.length <= 1) {
      alert("At least one vehicle is required.");
      return;
    }
    setVehicles((prev) => prev.filter((v) => v.vehicle_id !== vId));
    setTraveledTrails((prev) => {
      const copy = { ...prev };
      delete copy[vId];
      return copy;
    });
  };

  const handleUpdateVehicleSpeed = (vId, speed) => {
    const spd = Math.max(15, Math.min(80, Number(speed) || 40));
    setVehicles((prev) => prev.map((v) => (v.vehicle_id === vId ? { ...v, speed_kmh: spd } : v)));
  };

  // 5. Calculate Road-Based Multi-Factor Routes
  const handleCalculateRoutes = async () => {
    try {
      setIsPlanning(true);
      setPlanError(null);

      const payload = {
        start: startLocation,
        destination: destLocation,
        vehicles: vehicles.map((v) => ({
          vehicle_id: v.vehicle_id,
          model: v.model,
          speed_kmh: v.speed_kmh,
          color: v.color,
        })),
      };

      const result = await planMultiVehicleJourney(payload, token);
      if (result && result.journey) {
        setPlannedJourney(result);

        // Update vehicle state with planned distances and ETA
        if (Array.isArray(result.vehicles)) {
          setVehicles((prev) =>
            prev.map((v) => {
              const matched = result.vehicles.find((rv) => rv.vehicle_id === v.vehicle_id);
              if (matched) {
                return {
                  ...v,
                  distance_km: matched.distance_km,
                  remaining_distance_km: matched.distance_km,
                  travel_time_min: matched.travel_time_min,
                  multi_factor_score: matched.multi_factor_score,
                  assigned_route_type: matched.assigned_route_type,
                  road_geometry: matched.road_geometry,
                  status: "waiting",
                };
              }
              return v;
            })
          );
        }

        // Initialize traveled trails as empty
        const initialTrails = {};
        vehicles.forEach((v) => { initialTrails[v.vehicle_id] = []; });
        setTraveledTrails(initialTrails);
      }
    } catch (err) {
      console.error("Multi-factor route calculation error:", err);
      setPlanError(err.message || "Failed to calculate road routes.");
    } finally {
      setIsPlanning(false);
    }
  };

  // 6. Simulation Execution Handlers
  const handleStartSimulation = async () => {
    if (!plannedJourney || !plannedJourney.vehicles) {
      alert("Please calculate road routes first before starting the simulation.");
      return;
    }

    try {
      const simPayloads = plannedJourney.vehicles.map((v) => ({
        vehicle_id: v.vehicle_id,
        route_coords: v.road_geometry,
        speed_multiplier: speedMultiplier,
        model: v.model,
        color: v.color,
        is_point_to_point: true,
      }));

      await startMultiVehicleSimulations({ simulations: simPayloads }, token);
      setSimState("running");
      setVehicles((prev) => prev.map((v) => ({ ...v, status: "running" })));
    } catch (err) {
      alert("Could not start multi-vehicle simulation: " + err.message);
    }
  };

  const handlePauseSimulation = async () => {
    try {
      await pauseMultiVehicleSimulations({}, token);
      setSimState("paused");
      setVehicles((prev) => prev.map((v) => ({ ...v, status: "paused" })));
    } catch (err) {
      alert("Pause simulation failed: " + err.message);
    }
  };

  const handleResumeSimulation = async () => {
    try {
      await resumeMultiVehicleSimulations({}, token);
      setSimState("running");
      setVehicles((prev) => prev.map((v) => ({ ...v, status: "running" })));
    } catch (err) {
      alert("Resume simulation failed: " + err.message);
    }
  };

  const handleStopSimulation = async () => {
    try {
      await stopMultiVehicleSimulations({}, token);
      setSimState("idle");
      setVehicles((prev) => prev.map((v) => ({ ...v, status: "idle" })));
    } catch (err) {
      alert("Stop simulation failed: " + err.message);
    }
  };

  const handleResetSimulation = async () => {
    try {
      await resetMultiVehicleSimulations({}, token);
      setSimState("idle");
      setTraveledTrails({});
      setVehicles((prev) =>
        prev.map((v) => ({
          ...v,
          status: "waiting",
          distance_travelled_km: 0,
          remaining_distance_km: v.distance_km || 0,
          progress_percent: 0,
        }))
      );
    } catch (err) {
      alert("Reset simulation failed: " + err.message);
    }
  };

  const handleSetGlobalSpeed = async (mult) => {
    try {
      setSpeedMultiplierState(mult);
      await setMultiVehicleSpeed({ multiplier: mult }, token);
    } catch (err) {
      console.error("Failed to update speed multiplier:", err);
    }
  };

  // Filtered search results
  const filteredStartCatalog = useMemo(() => {
    if (!searchQueryStart.trim()) return [];
    return locationsCatalog.filter((loc) =>
      loc.name.toLowerCase().includes(searchQueryStart.toLowerCase())
    );
  }, [searchQueryStart, locationsCatalog]);

  const filteredDestCatalog = useMemo(() => {
    if (!searchQueryDest.trim()) return [];
    return locationsCatalog.filter((loc) =>
      loc.name.toLowerCase().includes(searchQueryDest.toLowerCase())
    );
  }, [searchQueryDest, locationsCatalog]);

  return (
    <div className="space-y-6">
      {/* -------------------------------------------------------------
          1. HEADER & NAVIGATION BAR
      ------------------------------------------------------------- */}
      <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.02] p-6 shadow-2xl backdrop-blur-md md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-500 text-xl font-black shadow-lg shadow-cyan-500/20">
              🗺️
            </span>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                Multi-Vehicle Route Planning & Road Simulation
              </h1>
              <p className="text-xs text-gray-400">
                Interactive Map Studio · Multi-Factor A* & AHP Optimization · Real Road Geometry
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Link to Live Fleet Tracking & HUD */}
          <Link
            to="/live-tracking"
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/20 transition shadow-sm"
          >
            <span>📡</span>
            <span>Live Fleet HUD</span>
          </Link>

          <Link
            to="/route-optimizer"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold text-gray-300 hover:bg-white/10 transition"
          >
            <span>↗</span>
            <span>CVRP Solver</span>
          </Link>
        </div>
      </div>

      {/* -------------------------------------------------------------
          2. MAIN STUDIO GRID (LEFT CONTROLS + MAIN MAP & TELEMETRY)
      ------------------------------------------------------------- */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* =========================================================
            LEFT PANEL: LOCATION SELECTION & FLEET CONFIGURATION
        ========================================================= */}
        <div className="space-y-5 lg:col-span-4">
          {/* Card A: Interactive Location Selection */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                  1. Location Selection
                </span>
              </div>
              <button
                type="button"
                onClick={handleResetLocations}
                className="text-[11px] text-gray-400 hover:text-white transition"
              >
                Reset Default
              </button>
            </div>

            {/* Click selection mode indicators */}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setSelectionMode(selectionMode === "start" ? null : "start")}
                className={`flex-1 rounded-xl py-2 px-3 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  selectionMode === "start"
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-300"
                    : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                }`}
              >
                <span>🟢</span>
                <span>{selectionMode === "start" ? "Click Map for Start..." : "Pick Start on Map"}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectionMode(selectionMode === "destination" ? null : "destination")}
                className={`flex-1 rounded-xl py-2 px-3 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  selectionMode === "destination"
                    ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20 ring-2 ring-rose-300"
                    : "border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                }`}
              >
                <span>🎯</span>
                <span>{selectionMode === "destination" ? "Click Map for Dest..." : "Pick Dest on Map"}</span>
              </button>
            </div>

            {selectionMode && (
              <div className="mt-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300 animate-pulse">
                ℹ️ <b>Interactive Mode Active:</b> Click anywhere on the map to set the{" "}
                <span className="font-bold uppercase text-white">{selectionMode}</span> location.
              </div>
            )}

            {/* Start Location Input & Search */}
            <div className="mt-4 space-y-1.5">
              <label className="text-[11px] font-semibold text-gray-300 flex items-center gap-1.5">
                <span>🟢</span>
                <span>Starting Location:</span>
              </label>
              <div className="rounded-xl border border-white/10 bg-slate-950 p-2.5">
                <input
                  type="text"
                  placeholder="Search landmark (e.g. Sitabuldi, Dharampeth...)"
                  value={searchQueryStart}
                  onChange={(e) => setSearchQueryStart(e.target.value)}
                  className="w-full bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none"
                />
                {filteredStartCatalog.length > 0 && (
                  <div className="mt-2 max-h-36 overflow-y-auto divide-y divide-white/5 border-t border-white/10 pt-1">
                    {filteredStartCatalog.map((loc) => (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => {
                          handleSelectLocation("start", loc.latitude, loc.longitude, loc.name);
                          setSearchQueryStart("");
                        }}
                        className="w-full text-left py-1 text-[11px] text-gray-300 hover:text-white hover:bg-white/5 px-1.5 rounded"
                      >
                        {loc.name}
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-1 flex items-center justify-between text-[10px] text-gray-400 font-mono border-t border-white/5 pt-1">
                  <span className="truncate max-w-[200px] text-emerald-300">{startLocation.name}</span>
                  <span>[{startLocation.latitude}, {startLocation.longitude}]</span>
                </div>
              </div>
            </div>

            {/* Destination Location Input & Search */}
            <div className="mt-3 space-y-1.5">
              <label className="text-[11px] font-semibold text-gray-300 flex items-center gap-1.5">
                <span>🎯</span>
                <span>Destination:</span>
              </label>
              <div className="rounded-xl border border-white/10 bg-slate-950 p-2.5">
                <input
                  type="text"
                  placeholder="Search landmark (e.g. Sadar, Civil Lines, Ajni...)"
                  value={searchQueryDest}
                  onChange={(e) => setSearchQueryDest(e.target.value)}
                  className="w-full bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none"
                />
                {filteredDestCatalog.length > 0 && (
                  <div className="mt-2 max-h-36 overflow-y-auto divide-y divide-white/5 border-t border-white/10 pt-1">
                    {filteredDestCatalog.map((loc) => (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => {
                          handleSelectLocation("destination", loc.latitude, loc.longitude, loc.name);
                          setSearchQueryDest("");
                        }}
                        className="w-full text-left py-1 text-[11px] text-gray-300 hover:text-white hover:bg-white/5 px-1.5 rounded"
                      >
                        {loc.name}
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-1 flex items-center justify-between text-[10px] text-gray-400 font-mono border-t border-white/5 pt-1">
                  <span className="truncate max-w-[200px] text-rose-300">{destLocation.name}</span>
                  <span>[{destLocation.latitude}, {destLocation.longitude}]</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card B: Multi-Vehicle Fleet Configuration */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                  2. Fleet Vehicles ({vehicles.length})
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddVehicle}
                className="inline-flex items-center gap-1 rounded-xl bg-purple-600/30 border border-purple-500/40 px-2.5 py-1 text-[11px] font-bold text-purple-200 hover:bg-purple-600/50 transition"
              >
                <span>+</span>
                <span>Add Vehicle</span>
              </button>
            </div>

            {/* Vehicles Cards List */}
            <div className="mt-3 space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
              {vehicles.map((v) => (
                <div
                  key={v.vehicle_id}
                  className="rounded-2xl border border-white/5 bg-slate-950/70 p-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0 shadow"
                        style={{ backgroundColor: v.color }}
                      ></span>
                      <b className="font-mono text-sm text-white">{v.vehicle_id}</b>
                      <span className="text-[10px] text-gray-400 truncate max-w-[120px]">{v.model}</span>
                    </div>

                    {vehicles.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveVehicle(v.vehicle_id)}
                        className="text-gray-500 hover:text-rose-400 text-xs px-1"
                        title="Remove vehicle"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="mt-2.5 flex items-center justify-between text-[11px] border-t border-white/5 pt-2">
                    <span className="text-gray-400">Target Speed:</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="range"
                        min="20"
                        max="70"
                        step="5"
                        value={v.speed_kmh}
                        onChange={(e) => handleUpdateVehicleSpeed(v.vehicle_id, e.target.value)}
                        className="w-20 accent-cyan-400 h-1 bg-white/10 rounded cursor-pointer"
                      />
                      <span className="font-bold text-cyan-300 font-mono w-14 text-right">
                        {v.speed_kmh} km/h
                      </span>
                    </div>
                  </div>

                  {v.distance_km && (
                    <div className="mt-1 flex items-center justify-between text-[10px] text-gray-400">
                      <span>Route: <b className="text-gray-200">{v.assigned_route_type || "AHP Optimal"}</b></span>
                      <span>Score: <b className="text-emerald-400 font-mono">{v.multi_factor_score}</b></span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Calculate Multi-Factor Routes Button */}
            <div className="mt-4">
              <button
                type="button"
                onClick={handleCalculateRoutes}
                disabled={isPlanning}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 py-3 text-xs font-bold text-white shadow-xl shadow-cyan-500/20 hover:from-blue-500 hover:to-cyan-400 transition disabled:opacity-50"
              >
                <span>⚡</span>
                <span>{isPlanning ? "Calculating Road Routes..." : "Calculate Road-Based Routes"}</span>
              </button>
            </div>

            {planError && (
              <div className="mt-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2 text-[11px] text-rose-300">
                ❌ {planError}
              </div>
            )}
          </div>

          {/* Card C: Simulation Controls Deck */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                3. Simulation Controls
              </span>
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                  simState === "running"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : simState === "paused"
                    ? "bg-purple-500/20 text-purple-300"
                    : "bg-white/5 text-gray-400"
                }`}
              >
                State: {simState}
              </span>
            </div>

            {/* Action Buttons Grid */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleStartSimulation}
                disabled={simState === "running" || !plannedJourney}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 transition disabled:opacity-40"
              >
                <span>▶</span>
                <span>Start Simulation</span>
              </button>

              {simState === "running" ? (
                <button
                  type="button"
                  onClick={handlePauseSimulation}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-amber-600/20 hover:bg-amber-500 transition"
                >
                  <span>⏸</span>
                  <span>Pause</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleResumeSimulation}
                  disabled={simState !== "paused"}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-purple-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-600/20 hover:bg-purple-500 transition disabled:opacity-40"
                >
                  <span>⏯</span>
                  <span>Resume</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleStopSimulation}
                disabled={simState === "idle"}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 py-2.5 text-xs font-bold text-rose-300 hover:bg-rose-500/20 transition disabled:opacity-40"
              >
                <span>⏹</span>
                <span>Stop</span>
              </button>

              <button
                type="button"
                onClick={handleResetSimulation}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-bold text-gray-300 hover:bg-white/10 transition"
              >
                <span>↺</span>
                <span>Reset to Start</span>
              </button>
            </div>

            {/* Simulation Speed Multiplier */}
            <div className="mt-3.5 border-t border-white/5 pt-3">
              <label className="text-[11px] font-semibold text-gray-400">Simulation Speed Multiplier:</label>
              <div className="mt-1.5 flex gap-1.5">
                {[0.5, 1, 2, 5, 10].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleSetGlobalSpeed(m)}
                    className={`flex-1 rounded-xl py-1 text-xs font-bold transition ${
                      speedMultiplier === m
                        ? "bg-cyan-500 text-white shadow"
                        : "border border-white/10 bg-white/5 text-gray-400 hover:text-white"
                    }`}
                  >
                    {m}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================
            MAIN AREA: INTERACTIVE LEAFLET MAP & FLEET TELEMETRY
        ========================================================= */}
        <div className="space-y-5 lg:col-span-8">
          {/* Main Leaflet Map Container */}
          <div className="rounded-3xl border border-white/10 bg-slate-950 p-3 shadow-2xl overflow-hidden relative">
            <div className="h-[520px] w-full rounded-2xl overflow-hidden relative">
              <MapContainer
                center={NAGPUR_CENTER}
                zoom={13}
                style={{ height: "100%", width: "100%" }}
                className="z-0"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <MapRecenter center={[startLocation.latitude, startLocation.longitude]} zoom={13} />
                <MapClickHandler selectionMode={selectionMode} onSelectLocation={handleSelectLocation} />

                {/* Start Location Pin */}
                {startLocation && isValidCoordinate(startLocation.latitude, startLocation.longitude, false) && (
                  <Marker
                    position={[startLocation.latitude, startLocation.longitude]}
                    icon={createPinIcon("start")}
                  >
                    <Popup>
                      <div className="p-1 text-xs">
                        <b className="text-emerald-600 text-sm">🟢 START LOCATION</b>
                        <br />
                        <b>{startLocation.name}</b>
                        <br />
                        <span className="font-mono text-gray-500">
                          [{startLocation.latitude}, {startLocation.longitude}]
                        </span>
                      </div>
                    </Popup>
                  </Marker>
                )}

                {/* Destination Location Pin */}
                {destLocation && isValidCoordinate(destLocation.latitude, destLocation.longitude, false) && (
                  <Marker
                    position={[destLocation.latitude, destLocation.longitude]}
                    icon={createPinIcon("destination")}
                  >
                    <Popup>
                      <div className="p-1 text-xs">
                        <b className="text-rose-600 text-sm">🎯 DESTINATION</b>
                        <br />
                        <b>{destLocation.name}</b>
                        <br />
                        <span className="font-mono text-gray-500">
                          [{destLocation.latitude}, {destLocation.longitude}]
                        </span>
                      </div>
                    </Popup>
                  </Marker>
                )}

                {/* Planned Road Polylines (Dashed lines following real roads) */}
                {plannedJourney?.vehicles?.map((veh, i) => {
                  if (!veh.road_geometry || veh.road_geometry.length < 2) return null;
                  return (
                    <Polyline
                      key={`planned-${veh.vehicle_id}`}
                      positions={veh.road_geometry}
                      pathOptions={{
                        color: veh.color || VEHICLE_PALETTE[i % VEHICLE_PALETTE.length].color,
                        weight: 4,
                        dashArray: "6, 6",
                        opacity: 0.85,
                      }}
                    >
                      <Popup>
                        <div className="text-xs">
                          <b style={{ color: veh.color }}>{veh.vehicle_id} Planned Road Corridor</b>
                          <br />
                          {veh.assigned_route_type}
                          <br />
                          Distance: {veh.distance_km} km · ETA: {veh.travel_time_min} min
                        </div>
                      </Popup>
                    </Polyline>
                  );
                })}

                {/* Alternative Detour Polyline (if available) */}
                {plannedJourney?.journey?.alternative_road_geometry?.length >= 2 && (
                  <Polyline
                    positions={plannedJourney.journey.alternative_road_geometry}
                    pathOptions={{
                      color: "#f59e0b",
                      weight: 3,
                      dashArray: "4, 4",
                      opacity: 0.65,
                    }}
                  >
                    <Popup>
                      <div className="text-xs">
                        <b className="text-amber-500">Alternative Detour Corridor</b>
                        <br />
                        Congestion-bypassing secondary route
                      </div>
                    </Popup>
                  </Polyline>
                )}

                {/* Actual Traveled Route Polylines (Solid line behind each vehicle) */}
                {Object.entries(traveledTrails).map(([vId, trail]) => {
                  if (!trail || trail.length < 2) return null;
                  const vObj = vehicles.find((v) => v.vehicle_id === vId);
                  const color = vObj?.color || "#10b981";

                  return (
                    <Polyline
                      key={`trail-${vId}`}
                      positions={trail}
                      pathOptions={{
                        color: color,
                        weight: 5,
                        opacity: 0.95,
                      }}
                    >
                      <Popup>
                        <div className="text-xs">
                          <b style={{ color }}>{vId} Actual Traveled Path</b>
                          <br />
                          {trail.length} GPS pings on road
                        </div>
                      </Popup>
                    </Polyline>
                  );
                })}

                {/* Moving Vehicle Markers */}
                {vehicles.map((v) => {
                  const livePos = liveVehiclePositions[v.vehicle_id];
                  const lat = Number(livePos?.latitude ?? startLocation.latitude);
                  const lon = Number(livePos?.longitude ?? startLocation.longitude);

                  if (!isValidCoordinate(lat, lon, false)) return null;

                  return (
                    <Marker
                      key={`marker-${v.vehicle_id}`}
                      position={[lat, lon]}
                      icon={createSimVehicleIcon({
                        ...v,
                        ...livePos,
                        heading: livePos?.heading || 0,
                      })}
                    >
                      <Popup>
                        <div className="p-1 text-xs">
                          <b className="text-sm font-bold" style={{ color: v.color }}>
                            {v.vehicle_id}
                          </b>
                          <span className="ml-2 text-gray-400">({v.model})</span>
                          <div className="mt-1 space-y-0.5 border-t border-gray-200 pt-1">
                            <div>Speed: <b>{Math.round(livePos?.speed || v.speed_kmh)} km/h</b></div>
                            <div>Travelled: <b>{v.distance_travelled_km || 0} km</b></div>
                            <div>Remaining: <b>{v.remaining_distance_km || v.distance_km || 0} km</b></div>
                            <div>Progress: <b>{v.progress_percent || 0}%</b></div>
                            <div>Status: <b className="uppercase">{v.status}</b></div>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>

              {/* Map floating legend */}
              <div className="absolute bottom-3 right-3 z-[1000] rounded-xl border border-white/10 bg-slate-950/85 p-2.5 backdrop-blur-md text-[10px] space-y-1">
                <div className="font-bold text-gray-300">Map Elements:</div>
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <span>🟢</span>
                  <span>Start Location</span>
                </div>
                <div className="flex items-center gap-1.5 text-rose-400">
                  <span>🎯</span>
                  <span>Destination</span>
                </div>
                <div className="flex items-center gap-1.5 text-cyan-400">
                  <span className="w-3 border-t-2 border-dashed border-cyan-400"></span>
                  <span>Planned Road Path</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-3 border-t-2 border-emerald-400"></span>
                  <span>Actual Traveled Trail</span>
                </div>
              </div>
            </div>
          </div>

          {/* =========================================================
              CARD D: MULTI-FACTOR ROUTE INFORMATION & FACTOR DECK
          ========================================================= */}
          {plannedJourney?.journey && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold uppercase tracking-wider text-cyan-300">
                    Multi-Factor Route Evaluation Deck
                  </span>
                  <span className="rounded-md bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                    AHP Score: {plannedJourney.journey.multi_factor_score}
                  </span>
                </div>
                <span className="text-xs text-gray-400">Physical OSRM Street Geometry</span>
              </div>

              {/* Multi-Factor Metrics Grid */}
              <div className="mt-3 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
                <div className="rounded-2xl border border-white/5 bg-slate-950/70 p-3 text-center">
                  <span className="text-[10px] uppercase tracking-wider text-gray-400">Road Distance</span>
                  <div className="mt-1 text-base font-bold text-white font-mono">
                    {plannedJourney.journey.total_distance_km} <span className="text-xs font-normal text-gray-400">km</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/5 bg-slate-950/70 p-3 text-center">
                  <span className="text-[10px] uppercase tracking-wider text-gray-400">Travel Time</span>
                  <div className="mt-1 text-base font-bold text-cyan-300 font-mono">
                    ~{plannedJourney.journey.estimated_time_min} <span className="text-xs font-normal text-gray-400">min</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/5 bg-slate-950/70 p-3 text-center">
                  <span className="text-[10px] uppercase tracking-wider text-gray-400">Est. Fuel Cost</span>
                  <div className="mt-1 text-base font-bold text-emerald-300 font-mono">
                    ₹{plannedJourney.journey.fuel_cost_inr}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/5 bg-slate-950/70 p-3 text-center">
                  <span className="text-[10px] uppercase tracking-wider text-gray-400">Traffic Index</span>
                  <div className="mt-1 text-base font-bold text-amber-300 font-mono">
                    {plannedJourney.journey.ahp_factors?.realtime_traffic}x
                  </div>
                </div>

                <div className="rounded-2xl border border-white/5 bg-slate-950/70 p-3 text-center">
                  <span className="text-[10px] uppercase tracking-wider text-gray-400">Weather Impact</span>
                  <div className="mt-1 text-base font-bold text-blue-300 font-mono">
                    {plannedJourney.journey.ahp_factors?.weather_impact}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/5 bg-slate-950/70 p-3 text-center">
                  <span className="text-[10px] uppercase tracking-wider text-gray-400">Road Quality</span>
                  <div className="mt-1 text-base font-bold text-purple-300 font-mono">
                    {plannedJourney.journey.ahp_factors?.road_condition}
                  </div>
                </div>
              </div>

              {/* Route Alternatives Comparison */}
              {plannedJourney.journey.route_alternatives?.length > 1 && (
                <div className="mt-4 border-t border-white/5 pt-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-300">
                    Route Alternatives Comparison:
                  </span>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    {plannedJourney.journey.route_alternatives.map((alt) => (
                      <div
                        key={alt.id}
                        className={`rounded-2xl border p-3 ${
                          alt.is_optimal
                            ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200"
                            : "border-white/10 bg-slate-950/60 text-gray-300"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <b className="font-bold">{alt.name}</b>
                          {alt.is_optimal && (
                            <span className="rounded bg-cyan-500/30 px-1.5 py-0.5 text-[9px] font-bold text-cyan-200">
                              RECOMMENDED
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
                          <span>Distance: <b className="text-white">{alt.distance_km} km</b></span>
                          <span>Time: <b className="text-white">~{alt.estimated_time_min} min</b></span>
                          <span>Score: <b className="text-emerald-300 font-mono">{alt.cost_score}</b></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========================================================
              CARD E: INDIVIDUAL VEHICLE PROGRESS CARDS (TELEMETRY)
          ========================================================= */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
              <span className="text-sm font-bold uppercase tracking-wider text-cyan-300">
                Individual Vehicle Live Telemetry & Progress
              </span>
              <span className="text-xs text-gray-400">{vehicles.length} Concurrent Simulations</span>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {vehicles.map((v) => {
                const livePos = liveVehiclePositions[v.vehicle_id];
                const pct = v.progress_percent || 0;
                const speed = Math.round(livePos?.speed || (v.status === "running" ? v.speed_kmh : 0));
                const remaining = v.remaining_distance_km || v.distance_km || 0;
                const travelled = v.distance_travelled_km || 0;
                const etaMin = v.eta_seconds ? Math.round(v.eta_seconds / 60) : Math.round((remaining / 40) * 60);

                return (
                  <div
                    key={v.vehicle_id}
                    className="rounded-2xl border border-white/5 bg-slate-950/70 p-4 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: v.color }}></span>
                        <b className="font-mono text-base text-white">{v.vehicle_id}</b>
                        <span className="text-xs text-gray-400 truncate max-w-[130px]">{v.model}</span>
                      </div>
                      <span
                        className={`rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase ${
                          v.status === "running"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : v.status === "completed"
                            ? "bg-cyan-500/20 text-cyan-300"
                            : v.status === "paused"
                            ? "bg-purple-500/20 text-purple-300"
                            : "bg-white/10 text-gray-400"
                        }`}
                      >
                        {v.status}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-gray-400">
                        <span>Route Progress</span>
                        <span className="font-bold text-white">{pct}%</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: v.color }}
                        ></div>
                      </div>
                    </div>

                    {/* Telemetry Metrics Row */}
                    <div className="grid grid-cols-4 gap-2 text-center text-xs border-t border-white/5 pt-2 font-mono">
                      <div>
                        <span className="text-[9px] uppercase text-gray-500 block">Speed</span>
                        <span className="font-bold text-white">{speed} km/h</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase text-gray-500 block">Travelled</span>
                        <span className="font-bold text-emerald-300">{travelled} km</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase text-gray-500 block">Remaining</span>
                        <span className="font-bold text-cyan-300">{remaining} km</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase text-gray-500 block">ETA</span>
                        <span className="font-bold text-amber-300">~{etaMin} min</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiVehiclePlanner;

