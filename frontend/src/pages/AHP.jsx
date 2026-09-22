import React from "react";

const criteria = [
  "Distance",
  "Travel Time",
  "Traffic",
  "Fuel Cost",
  "Weather",
  "Road Condition",
];

const weights = [
  { name: "Travel Time", value: 30 },
  { name: "Traffic", value: 25 },
  { name: "Distance", value: 20 },
  { name: "Road Condition", value: 12 },
  { name: "Fuel Cost", value: 8 },
  { name: "Weather", value: 5 },
];

const matrix = [
  [1, 0.33, 2, 3, 4, 3],
  [3, 1, 3, 4, 5, 4],
  [0.5, 0.33, 1, 2, 3, 2],
  [0.33, 0.25, 0.5, 1, 2, 2],
  [0.25, 0.2, 0.33, 0.5, 1, 0.5],
  [0.33, 0.25, 0.5, 0.5, 2, 1],
];

const AHP = () => {
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
                Decision Model
              </span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
              AHP Analysis
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400 md:text-base">
              Determine the relative importance of each routing factor using the
              Analytic Hierarchy Process.
            </p>
          </div>

          {/* Status */}
          <div className="flex w-fit items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-2">
            <span className="h-2 w-2 rounded-full bg-cyan-300" />

            <span className="text-xs font-medium text-cyan-300">
              AHP Model Active
            </span>
          </div>
        </div>
      </div>

      {/* =====================================================
          CRITERIA
      ===================================================== */}

      <div className="mb-6 rounded-3xl border border-white/10 bg-white/[0.025] p-6 shadow-2xl shadow-black/20">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-600">
              Optimization Factors
            </p>

            <h2 className="mt-2 text-xl font-semibold text-white">
              Optimization Criteria
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Factors considered when calculating the multi-factor route cost.
            </p>
          </div>

          <div className="hidden h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300 sm:flex">
            ◈
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {criteria.map((criterion, index) => (
            <div
              key={criterion}
              className="group rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition duration-200 hover:border-cyan-400/20 hover:bg-cyan-400/[0.03]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-400/10 bg-cyan-400/5 text-sm font-semibold text-cyan-300">
                  {String(index + 1).padStart(2, "0")}
                </div>

                <span className="text-sm font-medium text-gray-300 transition group-hover:text-white">
                  {criterion}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* =====================================================
          PAIRWISE MATRIX
      ===================================================== */}

      <div className="mb-6 rounded-3xl border border-white/10 bg-white/[0.025] p-6 shadow-2xl shadow-black/20">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-600">
            AHP Calculation
          </p>

          <h2 className="mt-2 text-xl font-semibold text-white">
            Pairwise Comparison Matrix
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Comparison of criteria used to determine their relative importance.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[850px] border-collapse text-center">
            <thead>
              <tr className="bg-white/[0.04]">
                <th className="border-b border-white/10 px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Criteria
                </th>

                {criteria.map((criterion) => (
                  <th
                    key={criterion}
                    className="border-b border-white/10 px-4 py-4 text-xs font-medium text-gray-400"
                  >
                    {criterion}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {matrix.map((row, rowIndex) => (
                <tr
                  key={criteria[rowIndex]}
                  className="transition hover:bg-white/[0.025]"
                >
                  <td className="border-b border-white/5 bg-white/[0.02] px-4 py-4 text-left text-sm font-semibold text-gray-300">
                    {criteria[rowIndex]}
                  </td>

                  {row.map((value, columnIndex) => (
                    <td
                      key={columnIndex}
                      className={`border-b border-white/5 px-4 py-4 text-sm ${
                        rowIndex === columnIndex
                          ? "bg-cyan-400/[0.06] font-bold text-cyan-300"
                          : "text-gray-500"
                      }`}
                    >
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-gray-600">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
          <span>Diagonal values represent self-comparison.</span>
        </div>
      </div>

      {/* =====================================================
          WEIGHTS + CONSISTENCY
      ===================================================== */}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ================= WEIGHTS ================= */}

        <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 shadow-2xl shadow-black/20">
          <div className="mb-7">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-600">
              Priority Distribution
            </p>

            <h2 className="mt-2 text-xl font-semibold text-white">
              Calculated Weights
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Relative importance assigned to each optimization factor.
            </p>
          </div>

          <div className="space-y-6">
            {weights.map((item, index) => (
              <div key={item.name}>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-600">
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    <span className="text-sm font-medium text-gray-300">
                      {item.name}
                    </span>
                  </div>

                  <span className="text-sm font-semibold text-cyan-300">
                    {item.value}%
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
                  <div
                    className="h-full rounded-full bg-cyan-400 transition-all duration-700"
                    style={{
                      width: `${item.value}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="mt-7 flex items-center justify-between border-t border-white/10 pt-5">
            <span className="text-sm text-gray-500">Total Weight</span>

            <span className="text-sm font-semibold text-white">
              {weights.reduce((sum, item) => sum + item.value, 0)}%
            </span>
          </div>
        </div>

        {/* ================= CONSISTENCY ================= */}

        <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 shadow-2xl shadow-black/20">
          <div className="mb-7">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-600">
              Validation
            </p>

            <h2 className="mt-2 text-xl font-semibold text-white">
              Consistency Analysis
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Validation of the pairwise comparison matrix.
            </p>
          </div>

          {/* Consistent status */}
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-lg text-emerald-300">
                ✓
              </div>

              <div>
                <p className="font-semibold text-emerald-300">Consistent</p>

                <p className="mt-1 text-xs text-gray-500">
                  Pairwise comparisons are within acceptable limits.
                </p>
              </div>
            </div>
          </div>

          {/* Metrics */}
          <div className="mt-5 grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <p className="text-xs uppercase tracking-wider text-gray-600">
                Consistency Index
              </p>

              <p className="mt-2 text-2xl font-bold text-white">0.08</p>
            </div>

            <div className="rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.03] p-5">
              <p className="text-xs uppercase tracking-wider text-gray-600">
                Consistency Ratio
              </p>

              <p className="mt-2 text-2xl font-bold text-emerald-300">0.06</p>
            </div>
          </div>

          {/* Explanation */}
          <div className="mt-5 rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.03] p-4">
            <div className="flex gap-3">
              <span className="mt-0.5 text-cyan-300">ℹ</span>

              <p className="text-xs leading-5 text-gray-500">
                A consistency ratio below 0.10 indicates that the comparison
                matrix is sufficiently consistent for the AHP calculation.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================
          CONTINUE
      ===================================================== */}

      <div className="mt-6 flex justify-end">
        <button className="group flex items-center gap-3 rounded-xl bg-cyan-400 px-6 py-3.5 text-sm font-semibold text-[#041016] transition duration-200 hover:-translate-y-0.5 hover:bg-cyan-300 hover:shadow-lg hover:shadow-cyan-500/20">
          <span>Continue to Optimization Results</span>

          <span className="transition-transform duration-200 group-hover:translate-x-1">
            →
          </span>
        </button>
      </div>
    </div>
  );
};

export default AHP;
