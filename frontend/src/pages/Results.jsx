import React, { useEffect, useState } from "react";
import { useLocation, Link, useSearchParams } from "react-router-dom";
import Map from '../components/Map';
import { getOptimizationById } from '../services/api';

const Results = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [result, setResult] = useState(location.state?.result || null);
  const [loadError, setLoadError] = useState('');
  const requestedRunId = searchParams.get('run');
  const awaitingRequestedRun = Boolean(requestedRunId && result?.run_id !== requestedRunId && !loadError);

  useEffect(() => {
    if (!requestedRunId || result?.run_id === requestedRunId) return;
    getOptimizationById(requestedRunId)
      .then((run) => setResult({ ...run.result, run_id: run.run_id, created_at: run.created_at, realtime: run.realtime_data, ahp_weights: run.result?.ahp_weights || run.ahp_weights }))
      .catch((error) => setLoadError(error.message || 'Unable to load the saved optimization run.'));
  }, [requestedRunId, result?.run_id]);

  const labels = { distance: 'Distance', travel_time: 'Travel Time', traffic: 'Traffic', fuel_cost: 'Fuel Cost', weather: 'Weather', road_condition: 'Road Condition' };
  const factorContribution = Object.entries(result?.ahp_weights || {}).map(([key, value]) => [labels[key] || key, Number(value) * 100]);

  // =====================================================
  // NO RESULT FALLBACK
  // =====================================================
  if (!result || awaitingRequestedRun || !Array.isArray(result.routes) || result.routes.length === 0) {
    return (
      <div className="min-h-screen bg-[#050816] text-white">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-400">
              Optimization Output
            </span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
            Optimization Results
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400 md:text-base">
            Optimized delivery routes based on multi-factor cost and vehicle
            constraints.
          </p>
        </div>

        {/* Empty state card */}
        <div className="rounded-3xl border border-white/10 bg-white/2.5 p-10 text-center shadow-2xl shadow-black/20">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-2xl text-cyan-300">
            🗺️
          </div>

          <h2 className="text-xl font-semibold text-white">
            No optimization result available
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm text-gray-400">{loadError || (requestedRunId ? 'Loading saved optimization run…' : 'Please run an optimization from the Route Optimizer page first to view vehicle assignments, stop sequences, and multi-factor costs.')}</p>

          <div className="mt-6">
            <Link
              to="/route-optimizer"
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-6 py-3 text-sm font-semibold text-[#041016] transition duration-200 hover:-translate-y-0.5 hover:bg-cyan-300 hover:shadow-lg hover:shadow-cyan-500/20"
            >
              <span>Go to Route Optimizer</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Calculate total delivery stops served (excluding DEPOT markers)
  const servedIds = new Set(result.routes.flatMap((route) => (route.route || []).filter((stop) => stop !== 'DEPOT')));
  const totalDeliveriesServed = result.priority_summary?.total_served ?? servedIds.size;
  const deliveriesConsidered = result.deliveries_considered ?? result.delivery_records?.length ?? totalDeliveriesServed;
  const deliveriesUnserved = result.deliveries_unserved ?? Math.max(0, deliveriesConsidered - totalDeliveriesServed);
  const eligibleVehicleCount = result.eligible_vehicle_count ?? result.vehicle_records?.length ?? 0;

  return (
    <div className="min-h-screen bg-[#050816] text-white">
      {/* =====================================================
          HEADER
      ===================================================== */}
      <div className="mb-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-cyan-300" />
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
                Optimization Output
              </span>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
                Optimization Results
              </h1>

              <span className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Completed
              </span>
            </div>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400 md:text-base">
              Multi-factor delivery routes generated by Google OR-Tools and AHP
              cost calculation.
            </p>
            {result.run_id && <p className="mt-2 text-xs text-gray-500">Run {result.run_id} · {result.created_at ? new Date(result.created_at).toLocaleString() : 'timestamp unavailable'} · source: {result.input_source || 'saved response'}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/route-optimizer"
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/4 px-4 py-2 text-xs font-medium text-gray-300 transition hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-300"
            >
              <span>← New Run</span>
            </Link>

            <div className="flex w-fit items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-2">
              <span className="h-2 w-2 rounded-full bg-cyan-300" />
              <span className="text-xs font-medium text-cyan-300">
                {result.routes.length} Active{" "}
                {result.routes.length === 1 ? "Route" : "Routes"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================
          OPTIMIZED ROUTES (DYNAMIC PER VEHICLE)
      ===================================================== */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[['Deliveries considered', deliveriesConsidered], ['Served / unserved', `${totalDeliveriesServed} / ${deliveriesUnserved}`], ['Eligible / used vehicles', `${eligibleVehicleCount} / ${result.routes.length}`], ['Run status', 'Persisted']].map(([label, value]) => <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-4"><p className="text-xs text-gray-400">{label}</p><p className="mt-1 font-semibold text-cyan-200">{value}</p></div>)}
      </div>
      <section className="mb-6 rounded-3xl border border-white/10 bg-white/2.5 p-6">
        <h2 className="text-xl font-semibold">Route visualization</h2>
        <p className="mt-1 mb-4 text-sm text-gray-400">Saved coordinates and optimized stop order. Lines are straight-line visual sequences, not verified road paths.</p>
        <Map deliveries={result.delivery_records || []} routes={result.routes} vehicles={result.vehicle_records || []} height="480px" />
      </section>
      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-600">
              Generated Paths
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              Optimized Vehicle Routes
            </h2>
          </div>

          <span className="text-xs text-gray-400">
            {totalDeliveriesServed} delivery stops assigned
          </span>
        </div>

        {result.routes.map((routeItem, idx) => {
          const stopsCount = Array.isArray(routeItem.route)
            ? routeItem.route.filter((s) => s !== "DEPOT").length
            : 0;
          const utilizationPct =
            routeItem.capacity > 0
              ? Math.round((routeItem.load / routeItem.capacity) * 100)
              : 0;

          return (
            <div
              key={routeItem.vehicle_id || idx}
              className="rounded-3xl border border-white/10 bg-white/2.5 p-6 shadow-2xl shadow-black/20"
            >
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-xs font-bold text-cyan-300">
                    {routeItem.vehicle_id}
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-white">
                      Vehicle {routeItem.vehicle_id}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {stopsCount} {stopsCount === 1 ? "stop" : "stops"}{" "}
                      assigned
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="rounded-xl border border-white/10 bg-white/3 px-3.5 py-1.5">
                    <span className="text-gray-500">Load: </span>
                    <span className="font-semibold text-white">
                      {routeItem.load}
                    </span>
                    <span className="text-gray-500">
                      {" "}
                      / {routeItem.capacity} kg
                    </span>
                    <span className="ml-1.5 font-medium text-emerald-300">
                      ({utilizationPct}%)
                    </span>
                  </div>

                  <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/6 px-3.5 py-1.5">
                    <span className="text-gray-400">Route Cost: </span>
                    <span className="font-semibold text-cyan-300">
                      {routeItem.cost}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stop Sequence */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {Array.isArray(routeItem.route) &&
                  routeItem.route.map((stop, sIdx) => {
                    const isDepot = stop === "DEPOT";
                    const isLast = sIdx === routeItem.route.length - 1;

                    return (
                      <React.Fragment
                        key={`${routeItem.vehicle_id}-${stop}-${sIdx}`}
                      >
                        <div
                          className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition ${
                            isDepot
                              ? "border border-cyan-400/20 bg-cyan-400/8 font-semibold text-cyan-300"
                              : "border border-white/10 bg-white/3 text-gray-300 hover:border-white/20"
                          }`}
                        >
                          {isDepot && (
                            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
                          )}
                          <span>{stop}</span>
                        </div>

                        {!isLast && (
                          <span className="text-xs text-gray-600">→</span>
                        )}
                      </React.Fragment>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>

      {/* =====================================================
          STATISTICS (DYNAMIC TOTALS)
      ===================================================== */}
      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Cost */}
        <div className="group rounded-2xl border border-cyan-400/20 bg-cyan-400/4 p-5 transition duration-200 hover:bg-cyan-400/6">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-gray-400">
              Total Cost
            </p>
            <span className="text-cyan-300">✦</span>
          </div>

          <p className="mt-3 text-2xl font-bold text-cyan-300">
            {result.total_cost}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            Multi-factor composite score
          </p>
        </div>

        {/* Total Load */}
        <div className="group rounded-2xl border border-white/10 bg-white/2.5 p-5 transition duration-200 hover:border-cyan-400/20 hover:bg-cyan-400/2">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-gray-600">
              Total Load
            </p>
            <span className="text-cyan-300">⚖</span>
          </div>

          <p className="mt-3 text-2xl font-bold text-white">
            {typeof result.total_load === "number"
              ? result.total_load.toLocaleString()
              : result.total_load}{" "}
            kg
          </p>

          <p className="mt-1 text-xs text-gray-600">
            Total delivery weight dispatched
          </p>
        </div>

        {/* Active Vehicles */}
        <div className="group rounded-2xl border border-white/10 bg-white/2.5 p-5 transition duration-200 hover:border-cyan-400/20 hover:bg-cyan-400/2">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-gray-600">
              Active Vehicles
            </p>
            <span className="text-cyan-300">🚚</span>
          </div>

          <p className="mt-3 text-2xl font-bold text-white">
            {result.routes.length}
          </p>

          <p className="mt-1 text-xs text-gray-600">
            Vehicles assigned to routes
          </p>
        </div>

        {/* Deliveries Served */}
        <div className="group rounded-2xl border border-white/10 bg-white/2.5 p-5 transition duration-200 hover:border-cyan-400/20 hover:bg-cyan-400/2">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-gray-600">
              Deliveries Served
            </p>
            <span className="text-cyan-300">📦</span>
          </div>

          <p className="mt-3 text-2xl font-bold text-white">
            {totalDeliveriesServed}
          </p>

          <p className="mt-1 text-xs text-gray-600">
            Total stops across all vehicles
          </p>
        </div>
      </div>

      {/* =====================================================
          VEHICLE FLEET ALLOCATION TABLE
      ===================================================== */}
      <div className="mb-6 rounded-3xl border border-white/10 bg-white/2.5 p-6 shadow-2xl shadow-black/20">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-600">
            Fleet Breakdown
          </p>

          <h2 className="mt-2 text-xl font-semibold text-white">
            Vehicle Route Allocation
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Capacity utilization and multi-factor cost allocation across the
            active fleet.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-162.5 border-collapse">
            <thead>
              <tr className="bg-white/4">
                <th className="border-b border-white/10 px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Vehicle ID
                </th>

                <th className="border-b border-white/10 px-5 py-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Stops
                </th>

                <th className="border-b border-white/10 px-5 py-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Assigned Load
                </th>

                <th className="border-b border-white/10 px-5 py-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Capacity
                </th>

                <th className="border-b border-white/10 px-5 py-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Utilization
                </th>

                <th className="border-b border-white/10 px-5 py-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Route Cost
                </th>
              </tr>
            </thead>

            <tbody>
              {result.routes.map((r, i) => {
                const stops = Array.isArray(r.route)
                  ? r.route.filter((s) => s !== "DEPOT").length
                  : 0;
                const util =
                  r.capacity > 0 ? Math.round((r.load / r.capacity) * 100) : 0;

                return (
                  <tr
                    key={r.vehicle_id || i}
                    className="transition hover:bg-white/2"
                  >
                    <td className="border-b border-white/5 px-5 py-4 text-sm font-semibold text-cyan-300">
                      Vehicle {r.vehicle_id}
                    </td>

                    <td className="border-b border-white/5 px-5 py-4 text-center text-sm text-white">
                      {stops} {stops === 1 ? "stop" : "stops"}
                    </td>

                    <td className="border-b border-white/5 px-5 py-4 text-center text-sm text-gray-300">
                      {r.load} kg
                    </td>

                    <td className="border-b border-white/5 px-5 py-4 text-center text-sm text-gray-400">
                      {r.capacity} kg
                    </td>

                    <td className="border-b border-white/5 px-5 py-4 text-center text-sm font-semibold text-emerald-300">
                      {util}%
                    </td>

                    <td className="border-b border-white/5 px-5 py-4 text-center text-sm font-semibold text-cyan-300">
                      {r.cost}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* =====================================================
          FACTOR BREAKDOWN & CONFIGURATION
      ===================================================== */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Factor Contribution */}
        <div className="rounded-3xl border border-white/10 bg-white/2.5 p-6 shadow-2xl shadow-black/20">
          <div className="mb-7">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-600">
              Multi-Factor Cost
            </p>

            <h2 className="mt-2 text-xl font-semibold text-white">
              Factor Contribution
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Relative contribution of each routing factor from AHP weights.
            </p>
          </div>

          <div className="space-y-6">
            {factorContribution.map(([name, value], index) => (
              <div key={name}>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-600">
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    <span className="text-sm font-medium text-gray-300">
                      {name}
                    </span>
                  </div>

                  <span className="text-sm font-semibold text-cyan-300">
                    {value.toFixed(2)}%
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-cyan-400 transition-all duration-700"
                    style={{ width: `${value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Route Details */}
        <div className="rounded-3xl border border-white/10 bg-white/2.5 p-6 shadow-2xl shadow-black/20">
          <div className="mb-7">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-600">
              Optimization Summary
            </p>

            <h2 className="mt-2 text-xl font-semibold text-white">
              Execution Details
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Solver parameters and convergence metrics.
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between border-b border-white/5 py-4">
              <span className="text-sm text-gray-500">Optimization Engine</span>
              <span className="text-sm font-semibold text-white">
                Google OR-Tools CVRP
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-white/5 py-4">
              <span className="text-sm text-gray-500">Cost Evaluation</span>
              <span className="text-sm font-semibold text-white">
                AHP 6-Factor Weighted Matrix
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-white/5 py-4">
              <span className="text-sm text-gray-500">Fleet Dispatched</span>
              <span className="text-sm font-semibold text-cyan-300">
                {result.routes.length} Vehicles
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-white/5 py-4">
              <span className="text-sm text-gray-500">Total Load Served</span>
              <span className="text-sm font-semibold text-emerald-300">
                {result.total_load} kg
              </span>
            </div>

            <div className="flex items-center justify-between py-4">
              <span className="text-sm text-gray-500">
                Composite Route Cost
              </span>
              <span className="text-sm font-semibold text-cyan-300">
                {result.total_cost}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Results;
