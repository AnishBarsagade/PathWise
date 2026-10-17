import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDashboardStats, loadDemoDataset } from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { token, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refreshStats = async () => {
    try {
      setLoading(true);
      const data = await getDashboardStats();
      setStats(data);
    } catch (e) {
      setMessage(e.message || "Failed to load dashboard metrics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshStats();
  }, []);

  const handleSeed = async () => {
    setBusy(true);
    try {
      const res = await loadDemoDataset(token);
      setMessage(`Demo data loaded: ${res.created} new records added, ${res.skipped} already existed.`);
      setTimeout(() => setMessage(""), 5000);
      await refreshStats();
    } catch (e) {
      setMessage(`Seeding failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const totalDeliveries = stats?.total_deliveries || 0;
  const completedDeliveries = stats?.completed_deliveries || 0;
  const pendingDeliveries = stats?.pending_deliveries || 0;
  const highPriority = stats?.high_priority_deliveries || 0;
  const totalVehicles = stats?.total_vehicles || 0;
  const availableVehicles = stats?.available_vehicles || 0;
  const completionRate = totalDeliveries > 0 ? Math.round((completedDeliveries / totalDeliveries) * 100) : 0;

  const zones = stats?.deliveries_by_zone || [];
  const maxZoneCount = Math.max(...zones.map((z) => z.count), 1);

  const vehicleClasses = stats?.vehicles_by_class || [];
  const classColors = [
    "from-cyan-400 to-blue-500",
    "from-emerald-400 to-teal-500",
    "from-purple-400 to-indigo-500",
    "from-amber-400 to-orange-500",
    "from-rose-400 to-pink-500",
  ];

  return (
    <div className="space-y-8">
      {/* Top Banner / Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white lg:text-3xl">
              Operations & Analytics
            </h1>
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-300">
              Live Feed
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-400">
            Real-time delivery status, multi-factor fleet metrics, and Nagpur logistics network overview.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {user?.role === "admin" && (
            <button
              onClick={handleSeed}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2.5 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-400/20 disabled:opacity-50"
            >
              <span>{busy ? "⏳" : "🌱"}</span>
              {busy ? "Seeding Data..." : "Load Demo Records"}
            </button>
          )}

          <button
            onClick={refreshStats}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-gray-300 transition hover:bg-white/10 hover:text-white"
          >
            <span className={loading ? "animate-spin" : ""}>↻</span> Refresh
          </button>
        </div>
      </div>

      {/* Alert banner */}
      {message && (
        <div className="rounded-2xl border border-cyan-400/30 bg-cyan-950/60 p-4 text-xs font-medium text-cyan-200 backdrop-blur-md">
          {message}
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {/* Total Deliveries */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] p-5 shadow-xl transition hover:border-white/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Total Orders</span>
            <span className="rounded-lg bg-blue-500/10 p-1.5 text-sm text-blue-400">📦</span>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-white">{totalDeliveries}</p>
          <p className="mt-1 text-[11px] text-gray-500">Registered packages</p>
        </div>

        {/* Completed */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] p-5 shadow-xl transition hover:border-white/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Delivered</span>
            <span className="rounded-lg bg-emerald-500/10 p-1.5 text-sm text-emerald-400">✓</span>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-emerald-300">{completedDeliveries}</p>
          <p className="mt-1 text-[11px] text-emerald-400/80">{completionRate}% fulfillment rate</p>
        </div>

        {/* Pending */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] p-5 shadow-xl transition hover:border-white/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Pending</span>
            <span className="rounded-lg bg-amber-500/10 p-1.5 text-sm text-amber-400">⏳</span>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-amber-300">{pendingDeliveries}</p>
          <p className="mt-1 text-[11px] text-gray-500">Awaiting transit</p>
        </div>

        {/* High Priority */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] p-5 shadow-xl transition hover:border-white/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">High Priority</span>
            <span className="rounded-lg bg-rose-500/10 p-1.5 text-sm text-rose-400">🔥</span>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-rose-400">{highPriority}</p>
          <p className="mt-1 text-[11px] text-rose-300/80">Penalty-weighted</p>
        </div>

        {/* Fleet Count */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] p-5 shadow-xl transition hover:border-white/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Total Fleet</span>
            <span className="rounded-lg bg-purple-500/10 p-1.5 text-sm text-purple-400">🚛</span>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-purple-300">{totalVehicles}</p>
          <p className="mt-1 text-[11px] text-gray-500">Multi-class vehicles</p>
        </div>

        {/* Available Vehicles */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] p-5 shadow-xl transition hover:border-white/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Ready Vehicles</span>
            <span className="rounded-lg bg-cyan-500/10 p-1.5 text-sm text-cyan-400">⚡</span>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-cyan-300">{availableVehicles}</p>
          <p className="mt-1 text-[11px] text-gray-500">Deployable now</p>
        </div>
      </div>

      {/* Analytics Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Deliveries by Zone (Horizontal Progress Distribution Chart) */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Deliveries by Geographical Zone</h3>
              <p className="text-xs text-gray-400">Parcel concentration across Nagpur delivery clusters</p>
            </div>
            <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-gray-400">
              {zones.length} Zones
            </span>
          </div>

          <div className="mt-6 space-y-3.5">
            {zones.length === 0 ? (
              <p className="text-xs text-gray-500">No zone data available. Load demo records to populate.</p>
            ) : (
              zones.map((zone, i) => {
                const pct = Math.round((zone.count / maxZoneCount) * 100);
                return (
                  <div key={zone.zone || i} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-gray-200">{zone.zone}</span>
                      <span className="text-gray-400 font-mono">
                        {zone.count} orders ({Math.round((zone.count / totalDeliveries) * 100)}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Fleet Composition by Vehicle Class */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Fleet Composition by Class</h3>
              <p className="text-xs text-gray-400">Distribution of commercial and EV delivery units</p>
            </div>
            <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-gray-400">
              {vehicleClasses.length} Classes
            </span>
          </div>

          <div className="mt-6 space-y-3.5">
            {vehicleClasses.length === 0 ? (
              <p className="text-xs text-gray-500">No vehicle data available.</p>
            ) : (
              vehicleClasses.map((vc, i) => {
                const pct = totalVehicles > 0 ? Math.round((vc.count / totalVehicles) * 100) : 0;
                const gradient = classColors[i % classColors.length];
                return (
                  <div key={vc.vehicle_class || i} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-gray-200 capitalize">{vc.vehicle_class}</span>
                      <span className="text-gray-400 font-mono">
                        {vc.count} units ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Latest Optimization Run & Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Latest Run Snapshot */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 shadow-xl lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Latest Route Optimization Run</h3>
              <p className="text-xs text-gray-400">Summary of the most recent multi-factor solver output</p>
            </div>
            {stats?.latest_run && (
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                Active
              </span>
            )}
          </div>

          {stats?.latest_run ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                <span className="text-[11px] text-gray-500 uppercase">Run Identifier</span>
                <p className="mt-1 font-mono text-xs font-semibold text-cyan-300 truncate">
                  {stats.latest_run.run_id}
                </p>
                <p className="mt-1 text-[10px] text-gray-500">
                  {new Date(stats.latest_run.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                <span className="text-[11px] text-gray-500 uppercase">Stop Fulfillment</span>
                <p className="mt-1 text-lg font-bold text-white">
                  {stats.latest_run.served} <span className="text-xs text-emerald-400">served</span>
                </p>
                <p className="mt-1 text-[10px] text-gray-400">
                  {stats.latest_run.unserved} unserved
                </p>
              </div>

              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                <span className="text-[11px] text-gray-500 uppercase">Fleet Deployment</span>
                <p className="mt-1 text-lg font-bold text-white">
                  {stats.latest_run.routes} <span className="text-xs text-cyan-300">routes</span>
                </p>
                <Link
                  to="/results"
                  className="mt-1 inline-block text-xs font-medium text-cyan-400 hover:text-cyan-300"
                >
                  View Map & Schedules →
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-white/5 bg-white/[0.01] p-6 text-center">
              <p className="text-xs text-gray-400">No optimization run recorded yet.</p>
              <Link
                to="/route-optimizer"
                className="mt-3 inline-block rounded-xl bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-400/20"
              >
                Launch Route Optimizer →
              </Link>
            </div>
          )}
        </div>

        {/* Quick Launchpad */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 shadow-xl">
          <h3 className="text-base font-bold text-white">System Actions</h3>
          <p className="text-xs text-gray-400">Quick shortcuts to key modules</p>

          <div className="mt-5 space-y-2.5">
            <Link
              to="/route-optimizer"
              className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-3 text-xs font-medium text-gray-200 transition hover:border-cyan-400/30 hover:bg-cyan-400/5 hover:text-cyan-300"
            >
              <span className="flex items-center gap-2">
                <span>↗</span> Route Optimizer (OR-Tools)
              </span>
              <span>→</span>
            </Link>

            <Link
              to="/rider"
              className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-3 text-xs font-medium text-gray-200 transition hover:border-emerald-400/30 hover:bg-emerald-400/5 hover:text-emerald-300"
            >
              <span className="flex items-center gap-2">
                <span>⚡</span> Rider Deliveries & Status
              </span>
              <span>→</span>
            </Link>

            <Link
              to="/deliveries"
              className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-3 text-xs font-medium text-gray-200 transition hover:border-white/20 hover:bg-white/5"
            >
              <span className="flex items-center gap-2">
                <span>□</span> Delivery Management
              </span>
              <span>→</span>
            </Link>

            <Link
              to="/fleet"
              className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-3 text-xs font-medium text-gray-200 transition hover:border-white/20 hover:bg-white/5"
            >
              <span className="flex items-center gap-2">
                <span>▣</span> Mixed Fleet & Assignments
              </span>
              <span>→</span>
            </Link>

            <Link
              to="/dynamic-rerouting"
              className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-3 text-xs font-medium text-gray-200 transition hover:border-white/20 hover:bg-white/5"
            >
              <span className="flex items-center gap-2">
                <span>↻</span> Dynamic Incident Rerouting
              </span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
