import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  getOptimizationHistory,
  getOptimizationById,
  getReroutingHistory,
  rerouteRoute,
} from "../services/api";

const INCIDENT_TYPES = [
  {
    id: "Road Closure",
    label: "Road Closure",
    icon: "🚫",
    color: "from-rose-500/20 to-rose-600/10 border-rose-500/30 text-rose-300",
    desc: "Access corridor blocked. Stop is bypassed and deferred to secondary delivery.",
  },
  {
    id: "Traffic Congestion",
    label: "Traffic Congestion",
    icon: "🚦",
    color: "from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-300",
    desc: "Peak-hour corridor bottleneck. Stop rescheduled to end of delivery cycle.",
  },
  {
    id: "Accident",
    label: "Accident",
    icon: "⚠️",
    color: "from-orange-500/20 to-orange-600/10 border-orange-500/30 text-orange-300",
    desc: "Lane blockage from collision. Perimeter detour and sequence adjustment applied.",
  },
  {
    id: "Weather",
    label: "Weather",
    icon: "🌧️",
    color: "from-sky-500/20 to-sky-600/10 border-sky-500/30 text-sky-300",
    desc: "Severe localized storm/flooding. Sequence prioritizes accessible zones first.",
  },
];

const SEVERITIES = ["High", "Medium", "Low"];

const DynamicRerouting = () => {
  // State for history & runs
  const [runs, setRuns] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [selectedRunDetails, setSelectedRunDetails] = useState(null);
  const [loadingRuns, setLoadingRuns] = useState(true);

  // State for rerouting configuration
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [incidentType, setIncidentType] = useState("Traffic Congestion");
  const [affectedLocation, setAffectedLocation] = useState("");
  const [severity, setSeverity] = useState("High");
  const [incidentNotes, setIncidentNotes] = useState("");

  // State for execution & result
  const [submitting, setSubmitting] = useState(false);
  const [latestResult, setLatestResult] = useState(null);
  const [reroutingHistory, setReroutingHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // 1. Fetch past optimization runs on mount
  useEffect(() => {
    fetchRuns();
    fetchHistory();
  }, []);

  const fetchRuns = async () => {
    setLoadingRuns(true);
    try {
      const data = await getOptimizationHistory(20);
      setRuns(data || []);
      if (data && data.length > 0) {
        // Select the most recent run by default
        const initialRun = data[0];
        setSelectedRunId(initialRun.run_id);
        loadRunDetails(initialRun.run_id);
      }
    } catch (err) {
      setError(err.message || "Failed to load previous optimization runs.");
    } finally {
      setLoadingRuns(false);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await getReroutingHistory(20);
      setReroutingHistory(data || []);
    } catch (err) {
      console.error("Failed to load rerouting history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Load detailed configuration for selected run
  const loadRunDetails = async (runId) => {
    try {
      const details = await getOptimizationById(runId);
      setSelectedRunDetails(details);

      // Auto-select first active vehicle if available
      const activeRoutes = details?.routes || [];
      if (activeRoutes.length > 0) {
        const firstVehicle = activeRoutes[0].vehicle_id;
        setSelectedVehicleId(firstVehicle);

        // Auto-select first delivery stop
        const stops = (activeRoutes[0].route || []).filter(
          (s) => s !== "DEPOT"
        );
        if (stops.length > 0) {
          setAffectedLocation(stops[0]);
        } else {
          setAffectedLocation("");
        }
      } else {
        setSelectedVehicleId("");
        setAffectedLocation("");
      }
    } catch (err) {
      setError(`Failed to fetch details for run ${runId}: ${err.message}`);
    }
  };

  const handleRunChange = (e) => {
    const newRunId = e.target.value;
    setSelectedRunId(newRunId);
    setLatestResult(null);
    setError(null);
    if (newRunId) {
      loadRunDetails(newRunId);
    } else {
      setSelectedRunDetails(null);
      setSelectedVehicleId("");
      setAffectedLocation("");
    }
  };

  const handleVehicleChange = (newVehicleId) => {
    setSelectedVehicleId(newVehicleId);
    const vehicleRoute = (selectedRunDetails?.routes || []).find(
      (r) => r.vehicle_id === newVehicleId
    );
    const stops = (vehicleRoute?.route || []).filter((s) => s !== "DEPOT");
    if (stops.length > 0) {
      setAffectedLocation(stops[0]);
    } else {
      setAffectedLocation("");
    }
  };

  // Active vehicle's route object
  const activeVehicleRoute = (selectedRunDetails?.routes || []).find(
    (r) => r.vehicle_id === selectedVehicleId
  );
  const activeStops = (activeVehicleRoute?.route || []).filter(
    (s) => s !== "DEPOT"
  );

  // Submit reroute request
  const handleReroute = async (e) => {
    e.preventDefault();
    if (!selectedRunId || !selectedVehicleId || submitting) return;

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    const payload = {
      run_id: selectedRunId,
      vehicle_id: selectedVehicleId,
      incident_type: incidentType,
      incident_details: {
        location: affectedLocation,
        severity: severity,
        notes: incidentNotes,
      },
    };

    try {
      const response = await rerouteRoute(payload);
      setLatestResult(response);
      setSuccessMessage(
        `Vehicle ${selectedVehicleId} successfully rerouted for ${incidentType} at ${affectedLocation}.`
      );
      fetchHistory(); // Refresh history table
    } catch (err) {
      setError(err.message || "Rerouting calculation failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050816] text-white">
      {/* =====================================================
          HEADER
      ===================================================== */}
      <div className="mb-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-cyan-300" />
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
                Real-Time Adaptation
              </span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
              Dynamic Rerouting
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400 md:text-base">
              Recalculate and adapt vehicle delivery routes when real-world incidents such as road closures, traffic congestion, adverse weather, or accidents disrupt dispatch operations.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-2 text-xs font-medium text-cyan-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
            <span>Scenario Solver Active</span>
          </div>
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="mb-6 rounded-2xl border border-red-400/30 bg-red-500/10 p-4">
          <div className="flex items-start gap-3">
            <span className="text-base text-red-400">⚠️</span>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-red-200">Error</h4>
              <p className="mt-1 text-xs leading-relaxed text-red-300/90">
                {error}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-xs text-red-400 transition hover:text-red-200"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="mb-6 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
          <div className="flex items-start gap-3">
            <span className="text-base text-emerald-400">✓</span>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-emerald-200">
                Rerouting Complete
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-emerald-300/90">
                {successMessage}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="text-xs text-emerald-400 transition hover:text-emerald-200"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* =====================================================
          MAIN CONFIGURATION & TRIGGER SECTION
      ===================================================== */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Left: Configuration Form */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 shadow-2xl shadow-black/20">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-gray-400">
                Incident Setup
              </p>
              <h2 className="mt-1 text-xl font-semibold text-white">
                Configure Rerouting Scenario
              </h2>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
              ↻
            </span>
          </div>

          {loadingRuns ? (
            <div className="flex items-center justify-center py-12 text-sm text-gray-400">
              <svg
                className="mr-3 h-5 w-5 animate-spin text-cyan-300"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Loading optimization runs...
            </div>
          ) : runs.length === 0 ? (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-6 text-center">
              <span className="text-2xl">⚠️</span>
              <h3 className="mt-2 text-sm font-semibold text-amber-200">
                No Optimization Runs Found
              </h3>
              <p className="mt-1 text-xs text-gray-400">
                Run an initial route optimization first to generate routes eligible for dynamic rerouting.
              </p>
              <Link
                to="/route-optimizer"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-xs font-semibold text-[#041016] transition hover:bg-cyan-300"
              >
                Go to Route Optimizer →
              </Link>
            </div>
          ) : (
            <form onSubmit={handleReroute} className="space-y-5">
              {/* Step 1: Select Optimization Run */}
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-gray-300">
                  1. Base Optimization Run
                </label>
                <select
                  value={selectedRunId}
                  onChange={handleRunChange}
                  disabled={submitting}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/10"
                >
                  {runs.map((r) => (
                    <option
                      key={r.run_id}
                      value={r.run_id}
                      className="bg-[#0b132b] text-white"
                    >
                      {r.run_id} — {new Date(r.created_at).toLocaleTimeString()}{" "}
                      ({r.routes ? r.routes.length : 0} vehicles, Cost:{" "}
                      {r.total_cost})
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 2: Select Vehicle */}
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-gray-300">
                  2. Select Affected Vehicle
                </label>
                {selectedRunDetails?.routes &&
                selectedRunDetails.routes.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {selectedRunDetails.routes.map((r) => {
                      const isSelected = r.vehicle_id === selectedVehicleId;
                      const stopsCount = (r.route || []).filter(
                        (s) => s !== "DEPOT"
                      ).length;
                      return (
                        <button
                          key={r.vehicle_id}
                          type="button"
                          onClick={() => handleVehicleChange(r.vehicle_id)}
                          className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                            isSelected
                              ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200 shadow-md shadow-cyan-950/30"
                              : "border-white/10 bg-white/[0.02] text-gray-400 hover:border-white/20 hover:text-white"
                          }`}
                        >
                          <div className="flex w-full items-center justify-between">
                            <span className="font-semibold text-white">
                              {r.vehicle_id}
                            </span>
                            {isSelected && (
                              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
                            )}
                          </div>
                          <span className="mt-1 text-[11px] text-gray-400">
                            {stopsCount} {stopsCount === 1 ? "stop" : "stops"} ·
                            Cost: {r.cost}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">
                    No active vehicles in this run.
                  </p>
                )}
              </div>

              {/* Step 3: Select Incident Type */}
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-gray-300">
                  3. Incident Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {INCIDENT_TYPES.map((type) => {
                    const isSelected = incidentType === type.id;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setIncidentType(type.id)}
                        className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition ${
                          isSelected
                            ? `bg-gradient-to-r ${type.color} ring-1 ring-white/20`
                            : "border-white/10 bg-white/[0.02] text-gray-400 hover:border-white/20 hover:text-gray-200"
                        }`}
                      >
                        <span className="text-base">{type.icon}</span>
                        <div className="flex-1 overflow-hidden">
                          <p className="truncate text-xs font-semibold">
                            {type.label}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 4: Affected Location & Severity */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-gray-300">
                    Affected Delivery Stop
                  </label>
                  {activeStops.length > 0 ? (
                    <select
                      value={affectedLocation}
                      onChange={(e) => setAffectedLocation(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/10"
                    >
                      {activeStops.map((stop) => (
                        <option
                          key={stop}
                          value={stop}
                          className="bg-[#0b132b] text-white"
                        >
                          Stop {stop}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={affectedLocation}
                      onChange={(e) => setAffectedLocation(e.target.value)}
                      placeholder="e.g. D003"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/10"
                    />
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-gray-300">
                    Incident Severity
                  </label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/10"
                  >
                    {SEVERITIES.map((s) => (
                      <option
                        key={s}
                        value={s}
                        className="bg-[#0b132b] text-white"
                      >
                        {s} Severity
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Step 5: Optional Notes */}
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-gray-300">
                  Incident Description / Notes (Optional)
                </label>
                <input
                  type="text"
                  value={incidentNotes}
                  onChange={(e) => setIncidentNotes(e.target.value)}
                  placeholder="e.g. Water main break near junction; lane blocked"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/10"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting || !selectedVehicleId}
                className="group flex w-full items-center justify-center gap-3 rounded-xl bg-cyan-400 px-5 py-3.5 font-semibold text-[#041016] transition duration-200 hover:-translate-y-0.5 hover:bg-cyan-300 hover:shadow-lg hover:shadow-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <svg
                      className="h-4 w-4 animate-spin text-[#041016]"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>Recalculating Alternate Route...</span>
                  </>
                ) : (
                  <>
                    <span>Recalculate & Adapt Route</span>
                    <span className="transition-transform duration-200 group-hover:translate-x-1">
                      →
                    </span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Right: Active Vehicle Route Overview */}
        <div className="flex flex-col justify-between rounded-3xl border border-white/10 bg-white/[0.025] p-6 shadow-2xl shadow-black/20">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-400">
                  Current Deployment
                </p>
                <h3 className="text-lg font-semibold text-white">
                  Vehicle {selectedVehicleId || "Unselected"}
                </h3>
              </div>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1 text-xs text-emerald-300">
                Dispatched
              </span>
            </div>

            {activeVehicleRoute ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <p className="text-xs text-gray-400">Original Sequence</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {activeVehicleRoute.route.map((stop, sIdx) => {
                      const isDepot = stop === "DEPOT";
                      const isAffected = stop === affectedLocation;
                      return (
                        <React.Fragment key={`${stop}-${sIdx}`}>
                          <span
                            className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                              isAffected
                                ? "border border-rose-500/40 bg-rose-500/20 text-rose-300"
                                : isDepot
                                ? "border border-cyan-400/20 bg-cyan-400/10 text-cyan-300"
                                : "border border-white/10 bg-white/[0.04] text-gray-300"
                            }`}
                          >
                            {stop}
                          </span>
                          {sIdx < activeVehicleRoute.route.length - 1 && (
                            <span className="text-xs text-gray-600">→</span>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
                    <p className="text-[10px] uppercase text-gray-500">Stops</p>
                    <p className="mt-1 text-lg font-bold text-white">
                      {activeStops.length}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
                    <p className="text-[10px] uppercase text-gray-500">Load</p>
                    <p className="mt-1 text-lg font-bold text-white">
                      {activeVehicleRoute.load} kg
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
                    <p className="text-[10px] uppercase text-gray-500">Cost</p>
                    <p className="mt-1 text-lg font-bold text-cyan-300">
                      {activeVehicleRoute.cost}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4 text-xs text-gray-300">
                  <p className="font-semibold text-cyan-200">
                    Scenario Description:
                  </p>
                  <p className="mt-1 text-gray-400">
                    {
                      INCIDENT_TYPES.find((t) => t.id === incidentType)?.desc
                    }
                  </p>
                </div>
              </div>
            ) : (
              <p className="py-8 text-center text-xs text-gray-500">
                Select an optimization run to view vehicle route.
              </p>
            )}
          </div>

          <div className="mt-6 border-t border-white/5 pt-4 text-xs text-gray-500">
            PathWise Dynamic Rerouting Engine · Multi-Factor CVRP
          </div>
        </div>
      </div>

      {/* =====================================================
          REROUTING RESULT SECTION
      ===================================================== */}
      {latestResult && (
        <div className="mb-10 rounded-3xl border border-emerald-400/20 bg-emerald-950/10 p-6 shadow-2xl backdrop-blur-sm">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                  Adaptive Rerouting Solved
                </span>
              </div>
              <h2 className="mt-1 text-2xl font-bold text-white">
                Vehicle {latestResult.vehicle_id} Alternate Plan
              </h2>
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1 text-xs text-gray-300">
              Event ID: {latestResult.event_id}
            </div>
          </div>

          {/* Comparison Cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Original Route */}
            <div className="rounded-2xl border border-white/10 bg-[#070c1e] p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider text-gray-400">
                  Original Route
                </p>
                <span className="text-xs font-semibold text-gray-400">
                  Cost: {latestResult.metrics?.original_cost}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {(latestResult.original_route || []).map((stop, i) => (
                  <React.Fragment key={`orig-${stop}-${i}`}>
                    <span
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                        stop === latestResult.incident_details?.location
                          ? "border border-rose-500/40 bg-rose-500/20 text-rose-300"
                          : stop === "DEPOT"
                          ? "border border-cyan-400/20 bg-cyan-400/10 text-cyan-300"
                          : "border border-white/10 bg-white/[0.04] text-gray-300"
                      }`}
                    >
                      {stop}
                    </span>
                    {i < latestResult.original_route.length - 1 && (
                      <span className="text-xs text-gray-600">→</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Rerouted Route */}
            <div className="rounded-2xl border border-cyan-400/30 bg-cyan-950/20 p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider text-cyan-300">
                  Rerouted Path
                </p>
                <span className="text-xs font-bold text-cyan-300">
                  Cost: {latestResult.metrics?.rerouted_cost}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {(latestResult.rerouted_route || []).map((stop, i) => (
                  <React.Fragment key={`reroute-${stop}-${i}`}>
                    <span
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                        stop === latestResult.incident_details?.location
                          ? "border border-amber-400/30 bg-amber-400/15 text-amber-300"
                          : stop === "DEPOT"
                          ? "border border-cyan-400/30 bg-cyan-400/20 text-cyan-200"
                          : "border border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                      }`}
                    >
                      {stop}
                    </span>
                    {i < latestResult.rerouted_route.length - 1 && (
                      <span className="text-xs text-cyan-500">→</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          {/* Metrics Tiles */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
              <p className="text-[10px] uppercase text-gray-500">Original Cost</p>
              <p className="mt-1 text-lg font-bold text-gray-300">
                {latestResult.metrics?.original_cost}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
              <p className="text-[10px] uppercase text-gray-500">Rerouted Cost</p>
              <p className="mt-1 text-lg font-bold text-cyan-300">
                {latestResult.metrics?.rerouted_cost}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
              <p className="text-[10px] uppercase text-gray-500">Cost Delta</p>
              <p
                className={`mt-1 text-lg font-bold ${
                  latestResult.metrics?.cost_delta < 0
                    ? "text-emerald-400"
                    : "text-amber-400"
                }`}
              >
                {latestResult.metrics?.cost_delta > 0 ? "+" : ""}
                {latestResult.metrics?.cost_delta}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
              <p className="text-[10px] uppercase text-gray-500">Stops Served</p>
              <p className="mt-1 text-lg font-bold text-white">
                {latestResult.metrics?.rerouted_stops_count} /{" "}
                {latestResult.metrics?.original_stops_count}
              </p>
            </div>
          </div>

          {/* Strategy & Reason */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <p className="text-xs font-semibold text-gray-300">
              Rerouting Strategy & Reason:
            </p>
            <p className="mt-1 text-xs leading-relaxed text-gray-400">
              {latestResult.reason}
            </p>
          </div>
        </div>
      )}

      {/* =====================================================
          REROUTING HISTORY LOG
      ===================================================== */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 shadow-2xl shadow-black/20">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-400">
              Audit Log
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              Dynamic Rerouting History
            </h2>
          </div>
          <span className="text-xs text-gray-400">
            {reroutingHistory.length} Recorded Events
          </span>
        </div>

        {loadingHistory ? (
          <p className="py-8 text-center text-sm text-gray-500">
            Loading rerouting history...
          </p>
        ) : reroutingHistory.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-8 text-center text-xs text-gray-500">
            No rerouting events recorded yet. When incidents are triggered above, the adaptation decisions will be logged here.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[700px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03]">
                  <th className="px-4 py-3 font-semibold text-gray-400">Time</th>
                  <th className="px-4 py-3 font-semibold text-gray-400">Vehicle</th>
                  <th className="px-4 py-3 font-semibold text-gray-400">Incident</th>
                  <th className="px-4 py-3 font-semibold text-gray-400">Original Route</th>
                  <th className="px-4 py-3 font-semibold text-gray-400">Rerouted Route</th>
                  <th className="px-4 py-3 font-semibold text-gray-400">Cost Impact</th>
                  <th className="px-4 py-3 font-semibold text-gray-400">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {reroutingHistory.map((item) => {
                  const originalCost = item.metrics?.original_cost;
                  const reroutedCost = item.metrics?.rerouted_cost;
                  const delta = item.metrics?.cost_delta;
                  return (
                    <tr
                      key={item.event_id}
                      className="transition hover:bg-white/[0.02]"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-gray-400">
                        {new Date(item.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 font-semibold text-cyan-300">
                        {item.vehicle_id}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-medium text-gray-200">
                          {item.incident_type}
                        </span>
                      </td>
                      <td className="max-w-[150px] truncate px-4 py-3 text-gray-400">
                        {(item.original_route || []).join(" → ")}
                      </td>
                      <td className="max-w-[150px] truncate px-4 py-3 font-medium text-emerald-300">
                        {(item.rerouted_route || []).join(" → ")}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {originalCost !== undefined && reroutedCost !== undefined ? (
                          <span>
                            {originalCost} → {reroutedCost}{" "}
                            <span
                              className={
                                delta < 0
                                  ? "text-emerald-400 font-semibold"
                                  : "text-amber-400 font-semibold"
                              }
                            >
                              ({delta > 0 ? "+" : ""}
                              {delta})
                            </span>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-gray-400" title={item.reason}>
                        {item.reason}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DynamicRerouting;
