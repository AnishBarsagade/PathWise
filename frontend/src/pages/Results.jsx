import React from "react";

const Results = () => {
  const factorContribution = [
    ["Travel Time", 30],
    ["Traffic", 25],
    ["Distance", 20],
    ["Road Condition", 12],
    ["Fuel Cost", 8],
    ["Weather", 5],
  ];

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
                Optimization Output
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
                Optimization Results
              </h1>

              <span className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Completed
              </span>
            </div>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400 md:text-base">
              Optimized delivery route based on multiple routing factors.
            </p>
          </div>

          {/* Status */}
          <div className="flex w-fit items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-2">
            <span className="h-2 w-2 rounded-full bg-cyan-300" />

            <span className="text-xs font-medium text-cyan-300">
              Route Optimized
            </span>
          </div>
        </div>
      </div>

      {/* =====================================================
          OPTIMIZED ROUTE
      ===================================================== */}

      <div className="mb-6 rounded-3xl border border-white/10 bg-white/[0.025] p-6 shadow-2xl shadow-black/20">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-600">
            Generated Path
          </p>

          <h2 className="mt-2 text-xl font-semibold text-white">
            Optimized Route
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Warehouse */}
          <div className="flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] px-4 py-3">
            <span className="h-2 w-2 rounded-full bg-cyan-300" />

            <span className="text-sm font-semibold text-cyan-300">
              Warehouse
            </span>
          </div>

          <span className="text-gray-600">→</span>

          {/* Point A */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <span className="text-sm font-medium text-gray-300">Point A</span>
          </div>

          <span className="text-gray-600">→</span>

          {/* Point C */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <span className="text-sm font-medium text-gray-300">Point C</span>
          </div>

          <span className="text-gray-600">→</span>

          {/* Point B */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <span className="text-sm font-medium text-gray-300">Point B</span>
          </div>

          <span className="text-gray-600">→</span>

          {/* Point D */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <span className="text-sm font-medium text-gray-300">Point D</span>
          </div>

          <span className="text-gray-600">→</span>

          {/* Destination */}
          <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.05] px-4 py-3">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />

            <span className="text-sm font-semibold text-emerald-300">
              Destination
            </span>
          </div>
        </div>
      </div>

      {/* =====================================================
          STATISTICS
      ===================================================== */}

      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Distance */}
        <div className="group rounded-2xl border border-white/10 bg-white/[0.025] p-5 transition duration-200 hover:border-cyan-400/20 hover:bg-cyan-400/[0.02]">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-gray-600">
              Total Distance
            </p>

            <span className="text-cyan-300">↗</span>
          </div>

          <p className="mt-3 text-2xl font-bold text-white">18.4 km</p>

          <p className="mt-1 text-xs text-gray-600">Optimized route distance</p>
        </div>

        {/* Time */}
        <div className="group rounded-2xl border border-white/10 bg-white/[0.025] p-5 transition duration-200 hover:border-cyan-400/20 hover:bg-cyan-400/[0.02]">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-gray-600">
              Estimated Time
            </p>

            <span className="text-cyan-300">◷</span>
          </div>

          <p className="mt-3 text-2xl font-bold text-white">42 min</p>

          <p className="mt-1 text-xs text-gray-600">
            Estimated travel duration
          </p>
        </div>

        {/* Fuel */}
        <div className="group rounded-2xl border border-white/10 bg-white/[0.025] p-5 transition duration-200 hover:border-cyan-400/20 hover:bg-cyan-400/[0.02]">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-gray-600">
              Estimated Fuel Cost
            </p>

            <span className="text-cyan-300">₹</span>
          </div>

          <p className="mt-3 text-2xl font-bold text-white">₹96</p>

          <p className="mt-1 text-xs text-gray-600">
            Estimated route fuel cost
          </p>
        </div>

        {/* Score */}
        <div className="group rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.04] p-5 transition duration-200 hover:bg-cyan-400/[0.06]">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-gray-500">
              Route Score
            </p>

            <span className="text-cyan-300">✦</span>
          </div>

          <p className="mt-3 text-2xl font-bold text-cyan-300">87.4</p>

          <p className="mt-1 text-xs text-gray-600">
            Multi-factor optimization score
          </p>
        </div>
      </div>

      {/* =====================================================
          BEFORE VS AFTER
      ===================================================== */}

      <div className="mb-6 rounded-3xl border border-white/10 bg-white/[0.025] p-6 shadow-2xl shadow-black/20">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-600">
            Performance Comparison
          </p>

          <h2 className="mt-2 text-xl font-semibold text-white">
            Before vs After Optimization
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Comparison of route metrics before and after optimization.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[650px] border-collapse">
            <thead>
              <tr className="bg-white/[0.04]">
                <th className="border-b border-white/10 px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Metric
                </th>

                <th className="border-b border-white/10 px-5 py-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Before
                </th>

                <th className="border-b border-white/10 px-5 py-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-400">
                  After
                </th>

                <th className="border-b border-white/10 px-5 py-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Improvement
                </th>
              </tr>
            </thead>

            <tbody>
              <tr className="transition hover:bg-white/[0.02]">
                <td className="border-b border-white/5 px-5 py-4 text-sm font-semibold text-gray-300">
                  Distance
                </td>

                <td className="border-b border-white/5 px-5 py-4 text-center text-sm text-gray-500">
                  22.1 km
                </td>

                <td className="border-b border-white/5 px-5 py-4 text-center text-sm text-white">
                  18.4 km
                </td>

                <td className="border-b border-white/5 px-5 py-4 text-center text-sm font-semibold text-emerald-300">
                  16.7%
                </td>
              </tr>

              <tr className="transition hover:bg-white/[0.02]">
                <td className="border-b border-white/5 px-5 py-4 text-sm font-semibold text-gray-300">
                  Travel Time
                </td>

                <td className="border-b border-white/5 px-5 py-4 text-center text-sm text-gray-500">
                  51 min
                </td>

                <td className="border-b border-white/5 px-5 py-4 text-center text-sm text-white">
                  42 min
                </td>

                <td className="border-b border-white/5 px-5 py-4 text-center text-sm font-semibold text-emerald-300">
                  17.6%
                </td>
              </tr>

              <tr className="transition hover:bg-white/[0.02]">
                <td className="px-5 py-4 text-sm font-semibold text-gray-300">
                  Fuel Cost
                </td>

                <td className="px-5 py-4 text-center text-sm text-gray-500">
                  ₹118
                </td>

                <td className="px-5 py-4 text-center text-sm text-white">
                  ₹96
                </td>

                <td className="px-5 py-4 text-center text-sm font-semibold text-emerald-300">
                  18.6%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* =====================================================
          FACTOR BREAKDOWN
      ===================================================== */}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Factor Contribution */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 shadow-2xl shadow-black/20">
          <div className="mb-7">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-600">
              Multi-Factor Cost
            </p>

            <h2 className="mt-2 text-xl font-semibold text-white">
              Factor Contribution
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Relative contribution of each routing factor.
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
                    {value}%
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
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
        <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 shadow-2xl shadow-black/20">
          <div className="mb-7">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-600">
              Route Configuration
            </p>

            <h2 className="mt-2 text-xl font-semibold text-white">
              Route Details
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Current route optimization parameters.
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between border-b border-white/5 py-4">
              <span className="text-sm text-gray-500">Vehicle</span>

              <span className="text-sm font-semibold text-white">
                Vehicle 01
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-white/5 py-4">
              <span className="text-sm text-gray-500">Algorithm</span>

              <span className="text-sm font-semibold text-white">
                A* + AHP + VRP
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-white/5 py-4">
              <span className="text-sm text-gray-500">Traffic</span>

              <span className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Low
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-white/5 py-4">
              <span className="text-sm text-gray-500">Weather</span>

              <span className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Favorable
              </span>
            </div>

            <div className="flex items-center justify-between py-4">
              <span className="text-sm text-gray-500">Road Condition</span>

              <span className="text-sm font-semibold text-white">Good</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Results;
