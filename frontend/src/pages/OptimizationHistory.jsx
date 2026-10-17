import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getOptimizationHistory } from "../services/api";

function safeParseJson(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (_) {
      return fallback;
    }
  }
  return fallback;
}

export default function OptimizationHistory() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getOptimizationHistory();
      const list = Array.isArray(data) ? data : (data?.runs || []);
      setRuns(list);
    } catch (e) {
      setError(e.message || "Failed to load optimization history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const filteredRuns = runs.filter((r) =>
    r?.run_id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white lg:text-3xl">
              Optimization History
            </h1>
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-0.5 text-xs font-semibold text-cyan-300">
              {runs.length} Saved Runs
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-400">
            Historical audit log of solved VRP routes, multi-factor cost scores, and capacity loads.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadHistory}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-gray-300 transition hover:bg-white/10 hover:text-white"
          >
            <span className={loading ? "animate-spin" : ""}>↻</span> Refresh
          </button>
          <Link
            to="/route-optimizer"
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-cyan-300 shadow-lg shadow-cyan-500/20"
          >
            <span>⚡</span> New Optimization
          </Link>
        </div>
      </div>

      {/* Search Filter */}
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <span className="text-gray-400 text-sm">🔍</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter runs by run identifier (e.g. run_...)..."
          className="w-full bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="text-xs text-gray-500 hover:text-white"
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-xs text-red-200 flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button
            onClick={loadHistory}
            className="underline hover:text-white ml-4 font-semibold"
          >
            Try Again
          </button>
        </div>
      )}

      {/* History List */}
      <div className="space-y-4">
        {loading && runs.length === 0 ? (
          <div className="flex h-64 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.02]">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
              <p className="text-xs text-gray-400">Loading historical optimization runs...</p>
            </div>
          </div>
        ) : filteredRuns.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-12 text-center text-gray-400">
            <span className="text-3xl block mb-2">📋</span>
            <p className="font-semibold text-white">No saved optimization runs found</p>
            <p className="text-xs text-gray-500 mt-1">Run a vehicle route optimization to record runs in history.</p>
            <Link
              to="/route-optimizer"
              className="mt-5 inline-block rounded-xl bg-cyan-400/10 px-5 py-2.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-400/20 border border-cyan-400/30 transition"
            >
              Run an Optimization Now →
            </Link>
          </div>
        ) : (
          filteredRuns.map((r) => {
            const prioritySummary = safeParseJson(r.priority_summary, {});
            const routes = safeParseJson(r.routes, []);
            const routeCount = Array.isArray(routes) ? routes.length : 0;
            const servedCount = prioritySummary?.total_served ?? prioritySummary?.served ?? "—";
            const totalLoad = r.total_load !== undefined && r.total_load !== null ? r.total_load : 0;
            const compositeCost = Number(r.total_cost || 0).toFixed(3);
            const dateLabel = r.created_at ? new Date(r.created_at).toLocaleString() : "Recent Run";

            return (
              <div
                key={r.run_id}
                className="flex flex-col justify-between gap-5 rounded-3xl border border-white/10 bg-white/[0.02] p-6 shadow-xl transition hover:border-cyan-400/30 hover:bg-white/[0.03] lg:flex-row lg:items-center"
              >
                {/* Left: ID & Info */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-base font-bold text-cyan-300">
                      {r.run_id}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-semibold text-gray-400">
                      {dateLabel}
                    </span>
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                      Multi-Factor AHP
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
                    <span>
                      Total Load: <b className="text-white">{totalLoad} kg</b>
                    </span>
                    <span>•</span>
                    <span>
                      Composite Cost: <b className="text-cyan-300">{compositeCost}</b>
                    </span>
                    <span>•</span>
                    <span>
                      Vehicles Deployed: <b className="text-white">{routeCount}</b>
                    </span>
                    <span>•</span>
                    <span>
                      Stops Served: <b className="text-emerald-400">{servedCount}</b>
                    </span>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-3 self-start lg:self-auto">
                  <button
                    onClick={() => navigate(`/results?run=${encodeURIComponent(r.run_id)}`)}
                    className="rounded-xl bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-400/20 border border-cyan-400/20"
                  >
                    View Map & Details →
                  </button>
                  <button
                    onClick={() => navigate("/dynamic-rerouting", { state: { selectedRunId: r.run_id } })}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-gray-300 transition hover:bg-white/10 hover:text-white"
                  >
                    Simulate Incident
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
