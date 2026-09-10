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
    <div className="min-h-screen bg-gray-100">

      {/* Main Content */}
      <main className="p-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900">
            AHP Analysis
          </h1>

          <p className="mt-2 text-lg text-slate-600">
            Determine the importance of each factor using the Analytic
            Hierarchy Process.
          </p>
        </div>

        {/* Criteria */}
        <div className="mb-8 rounded-xl bg-white p-6 shadow-sm border border-gray-200">
          <h2 className="mb-5 text-2xl font-bold text-slate-800">
            Optimization Criteria
          </h2>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {criteria.map((criterion, index) => (
              <div
                key={criterion}
                className="rounded-lg border border-gray-200 bg-gray-50 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-600">
                    {index + 1}
                  </div>

                  <span className="font-semibold text-slate-700">
                    {criterion}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pairwise Comparison */}
        <div className="mb-8 rounded-xl bg-white p-6 shadow-sm border border-gray-200">

          <div className="mb-5">
            <h2 className="text-2xl font-bold text-slate-800">
              Pairwise Comparison Matrix
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Comparison of criteria used to calculate their relative
              importance.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-center">

              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="border border-slate-700 px-4 py-3">
                    Criteria
                  </th>

                  {criteria.map((criterion) => (
                    <th
                      key={criterion}
                      className="border border-slate-700 px-4 py-3 text-sm"
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
                    className="hover:bg-gray-50"
                  >
                    <td className="border border-gray-200 bg-gray-50 px-4 py-3 text-left font-semibold text-slate-700">
                      {criteria[rowIndex]}
                    </td>

                    {row.map((value, columnIndex) => (
                      <td
                        key={columnIndex}
                        className={`border border-gray-200 px-4 py-3 text-slate-600 ${
                          rowIndex === columnIndex
                            ? "bg-blue-50 font-bold text-blue-600"
                            : ""
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
        </div>

        {/* Weights + Consistency */}
        <div className="grid gap-8 lg:grid-cols-2">

          {/* Weights */}
          <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">

            <h2 className="mb-6 text-2xl font-bold text-slate-800">
              Calculated Weights
            </h2>

            <div className="space-y-5">

              {weights.map((item) => (
                <div key={item.name}>

                  <div className="mb-2 flex justify-between">
                    <span className="font-medium text-slate-700">
                      {item.name}
                    </span>

                    <span className="font-bold text-blue-600">
                      {item.value}%
                    </span>
                  </div>

                  <div className="h-3 w-full rounded-full bg-gray-200">
                    <div
                      className="h-3 rounded-full bg-blue-600"
                      style={{ width: `${item.value}%` }}
                    ></div>
                  </div>

                </div>
              ))}

            </div>
          </div>

          {/* Consistency */}
          <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">

            <h2 className="mb-6 text-2xl font-bold text-slate-800">
              Consistency Analysis
            </h2>

            <div className="rounded-lg border border-green-200 bg-green-50 p-5">

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-xl text-green-600">
                  ✓
                </div>

                <div>
                  <p className="font-bold text-green-700">
                    Consistent
                  </p>

                  <p className="text-sm text-green-600">
                    Pairwise comparisons are within acceptable limits.
                  </p>
                </div>
              </div>

            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">

              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-slate-500">
                  Consistency Index
                </p>

                <p className="mt-1 text-2xl font-bold text-slate-800">
                  0.08
                </p>
              </div>

              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-slate-500">
                  Consistency Ratio
                </p>

                <p className="mt-1 text-2xl font-bold text-green-600">
                  0.06
                </p>
              </div>

            </div>

            <div className="mt-5 rounded-lg bg-blue-50 p-4 text-sm text-blue-700">
              CR &lt; 0.10 indicates that the comparison matrix is
              sufficiently consistent.
            </div>

          </div>

        </div>

        {/* Continue Button */}
        <div className="mt-8 flex justify-end">

          <button
            className="rounded-lg bg-blue-600 px-8 py-3 font-semibold
                       text-white transition hover:bg-blue-700"
          >
            Continue to Optimization Results →
          </button>

        </div>

      </main>
    </div>
  );
};

export default AHP;