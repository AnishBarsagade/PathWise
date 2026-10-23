import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { getRiderAssignments, updateDeliveryStatus, loginUser } from "../services/api";

const RiderDashboard = () => {
  const { user, token, login, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(null);
  const [successToast, setSuccessToast] = useState(null);

  const loadAssignments = async () => {
    try {
      setLoading(true);
      setError(null);
      const activeToken = token || (typeof localStorage !== "undefined" ? localStorage.getItem("pathwise_token") : null);
      if (!activeToken) {
        setError("Invalid or expired authentication token. Please sign in as a rider.");
        setLoading(false);
        return;
      }
      const res = await getRiderAssignments(null, activeToken);
      setData(res);
    } catch (err) {
      setError(err.message || "Failed to load rider assignments.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickRiderLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      const authData = await loginUser("rider@pathwise.com", "PathWise@123");
      login(authData.token, authData.user);
      const res = await getRiderAssignments(null, authData.token);
      setData(res);
    } catch (err) {
      setError(err.message || "Failed to authenticate rider.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssignments();
  }, [token]);

  const handleStatusChange = async (deliveryId, newStatus) => {
    try {
      setStatusUpdating(deliveryId);
      await updateDeliveryStatus(deliveryId, newStatus, token);
      setSuccessToast(`Delivery ${deliveryId} status updated to '${newStatus}'.`);
      setTimeout(() => setSuccessToast(null), 4000);
      await loadAssignments();
    } catch (err) {
      alert(`Could not update status: ${err.message}`);
    } finally {
      setStatusUpdating(null);
    }
  };

  const deliveries = data?.deliveries || [];
  const vehicle = data?.vehicle;
  const route = data?.route;

  const completedCount = deliveries.filter((d) => d.status === "completed").length;
  const totalCount = deliveries.length;
  const completionPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Toast Alert */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-950/90 px-5 py-4 text-emerald-200 shadow-2xl backdrop-blur-md">
          <span className="text-xl">✓</span>
          <p className="text-sm font-medium">{successToast}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white lg:text-3xl">
              Rider Operations
            </h1>
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-0.5 text-xs font-semibold text-cyan-300">
              Live Deliveries
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-400">
            Welcome back, <span className="font-medium text-gray-200">{user?.name || user?.email}</span>. Manage assigned route stops and report live status.
          </p>
        </div>

        <button
          onClick={loadAssignments}
          disabled={loading}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-gray-300 transition hover:bg-white/10 hover:text-white"
        >
          <span className={loading ? "animate-spin" : ""}>↻</span> Refresh Tasks
        </button>
      </div>

      {loading && !data ? (
        <div className="flex h-64 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.02]">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
            <p className="text-xs text-gray-400">Fetching assigned vehicle and deliveries...</p>
          </div>
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-6 text-red-200">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div className="flex-1">
              <h3 className="font-semibold text-base text-red-100">Unable to load assignments</h3>
              <p className="mt-1 text-sm opacity-90">{error}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleQuickRiderLogin}
                  className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg hover:from-cyan-400 hover:to-blue-500 transition"
                >
                  ⚡ Sign In as Demo Rider
                </button>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    window.location.href = "/login";
                  }}
                  className="rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-xs font-semibold text-gray-300 hover:bg-white/10"
                >
                  Go to Login Page
                </button>
                <button
                  type="button"
                  onClick={loadAssignments}
                  className="rounded-xl bg-red-500/20 px-4 py-2.5 text-xs font-medium text-red-200 hover:bg-red-500/30"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Vehicle & Shift Summary Cards */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Vehicle Card */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 shadow-xl">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Assigned Vehicle
              </span>
              {vehicle ? (
                <div className="mt-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white">
                      {vehicle.manufacturer} {vehicle.model}
                    </h3>
                    <span className="rounded-lg bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold text-cyan-300">
                      {vehicle.vehicle_id}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400 capitalize">
                    {vehicle.vehicle_class} · {vehicle.capacity} kg Capacity
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span className="text-xs text-emerald-300 capitalize">{vehicle.operational_status}</span>
                  </div>
                </div>
              ) : (
                <div className="mt-3">
                  <p className="text-sm font-semibold text-amber-300">Unassigned</p>
                  <p className="mt-1 text-xs text-gray-500">Contact admin to assign a delivery vehicle.</p>
                </div>
              )}
            </div>

            {/* Total Deliveries */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 shadow-xl">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Total Orders
              </span>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-white">{totalCount}</span>
                <span className="text-xs text-gray-400">parcels</span>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {deliveries.filter((d) => d.priority === "High").length} high-priority
              </p>
            </div>

            {/* Completed Deliveries */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 shadow-xl">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Delivered
              </span>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-emerald-400">{completedCount}</span>
                <span className="text-xs text-gray-400">/ {totalCount} completed</span>
              </div>
              {/* Progress bar */}
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-500"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
            </div>

            {/* Shift Route Cost / Load */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 shadow-xl">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Route Metrics
              </span>
              {route ? (
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Total Route Load:</span>
                    <span className="font-bold text-white">{route.load} kg</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Est. Composite Cost:</span>
                    <span className="font-bold text-cyan-300">{route.cost}</span>
                  </div>
                  {route.distance_km && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Distance:</span>
                      <span className="font-bold text-gray-200">{route.distance_km} km</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-3">
                  <p className="text-sm text-gray-400">No active optimized route</p>
                </div>
              )}
            </div>
          </div>

          {/* Sequence Waypoints (Breadcrumbs) */}
          {route && route.route && route.route.length > 0 && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 shadow-xl">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
                Turn-by-Turn Waypoint Sequence
              </h3>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {route.route.map((stop, i) => {
                  const isDepot = stop === "DEPOT";
                  const matchingDeliv = deliveries.find((d) => d.delivery_id === stop);
                  const isDone = matchingDeliv?.status === "completed";
                  const isCurrent = matchingDeliv?.status === "in_progress";

                  return (
                    <React.Fragment key={i}>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold ${
                          isDepot
                            ? "border-white/20 bg-white/10 text-white"
                            : isDone
                            ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                            : isCurrent
                            ? "border-cyan-400/50 bg-cyan-400/20 text-cyan-200 ring-2 ring-cyan-400/30"
                            : "border-white/10 bg-white/5 text-gray-300"
                        }`}
                      >
                        {isDepot ? "🏢 DEPOT" : isDone ? `✓ ${stop}` : isCurrent ? `⚡ ${stop}` : stop}
                        {!isDepot && matchingDeliv && (
                          <span className="text-[10px] opacity-75 font-normal">
                            ({matchingDeliv.location})
                          </span>
                        )}
                      </span>
                      {i < route.route.length - 1 && (
                        <span className="text-xs text-gray-600 font-bold">→</span>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}

          {/* Assigned Deliveries List */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Assigned Delivery Orders</h3>
                <p className="mt-1 text-xs text-gray-400">
                  Update package status as you arrive at drop locations.
                </p>
              </div>
              <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-300">
                {totalCount} Packages
              </span>
            </div>

            {deliveries.length === 0 ? (
              <div className="my-8 text-center text-sm text-gray-500">
                No deliveries currently assigned to this vehicle.
              </div>
            ) : (
              <div className="mt-6 divide-y divide-white/5">
                {deliveries.map((deliv, index) => {
                  const isPending = deliv.status === "pending" || deliv.status === "assigned";
                  const isInProgress = deliv.status === "in_progress";
                  const isCompleted = deliv.status === "completed";
                  const isCancelled = deliv.status === "cancelled";
                  const isBusy = statusUpdating === deliv.delivery_id;

                  return (
                    <div
                      key={deliv.delivery_id}
                      className="flex flex-col gap-4 py-5 transition sm:flex-row sm:items-center sm:justify-between"
                    >
                      {/* Left: Info */}
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-xs font-bold text-gray-300">
                          #{index + 1}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-base font-semibold text-white">
                              {deliv.recipient_name}
                            </h4>
                            <span className="text-xs text-gray-500 font-mono">
                              ({deliv.delivery_id})
                            </span>
                            {/* Priority tag */}
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                deliv.priority === "High"
                                  ? "bg-red-500/20 text-red-300 border border-red-500/30"
                                  : deliv.priority === "Medium"
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                  : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                              }`}
                            >
                              {deliv.priority} Priority
                            </span>
                            {/* Status tag */}
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-semibold capitalize ${
                                isCompleted
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                  : isInProgress
                                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                                  : isCancelled
                                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                  : "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                              }`}
                            >
                              {deliv.status.replace("_", " ")}
                            </span>
                          </div>

                          <p className="mt-1 text-xs text-gray-400">
                            📍 {deliv.location} <span className="text-gray-600">({deliv.zone} Zone)</span> · 📦 {deliv.parcel_category} · ⚖️ {deliv.weight} kg
                          </p>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        {isPending && (
                          <button
                            onClick={() => handleStatusChange(deliv.delivery_id, "in_progress")}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-500/20 px-3.5 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/30 border border-cyan-500/30 disabled:opacity-50"
                          >
                            {isBusy ? "Updating..." : "⚡ Start Delivery"}
                          </button>
                        )}

                        {isInProgress && (
                          <>
                            <button
                              onClick={() => handleStatusChange(deliv.delivery_id, "completed")}
                              disabled={isBusy}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/20 px-3.5 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/30 border border-emerald-500/30 disabled:opacity-50"
                            >
                              {isBusy ? "Updating..." : "✓ Mark Delivered"}
                            </button>
                            <button
                              onClick={() => handleStatusChange(deliv.delivery_id, "cancelled")}
                              disabled={isBusy}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500/20 px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/30 border border-rose-500/30 disabled:opacity-50"
                            >
                              Issue / Cancel
                            </button>
                          </>
                        )}

                        {isCompleted && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                            <span>✓</span> Completed
                          </span>
                        )}

                        {isCancelled && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-400">
                            <span>⚠</span> Delivery Cancelled
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default RiderDashboard;
