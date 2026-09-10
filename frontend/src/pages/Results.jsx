import React from "react";

const Results = () => {
  return (
    <div className="min-h-screen bg-gray-100">

      <main className="p-8">

        {/* Header */}
        <div className="mb-8">

          <div className="flex items-center gap-3">

            <h1 className="text-4xl font-bold text-slate-900">
              Optimization Results
            </h1>

            <span className="rounded-full bg-green-100 px-4 py-1 text-sm font-semibold text-green-700">
              Completed
            </span>

          </div>

          <p className="mt-2 text-lg text-slate-600">
            Optimized delivery route based on multiple factors.
          </p>

        </div>

        {/* Route Summary */}
        <div className="mb-8 rounded-xl bg-white p-6 shadow-sm border border-gray-200">

          <h2 className="mb-6 text-2xl font-bold text-slate-800">
            Optimized Route
          </h2>

          <div className="flex flex-wrap items-center gap-3">

            <div className="rounded-lg bg-blue-50 px-5 py-3 font-semibold text-blue-700">
              Warehouse
            </div>

            <span className="text-xl text-slate-400">→</span>

            <div className="rounded-lg bg-gray-100 px-5 py-3 font-semibold text-slate-700">
              Point A
            </div>

            <span className="text-xl text-slate-400">→</span>

            <div className="rounded-lg bg-gray-100 px-5 py-3 font-semibold text-slate-700">
              Point C
            </div>

            <span className="text-xl text-slate-400">→</span>

            <div className="rounded-lg bg-gray-100 px-5 py-3 font-semibold text-slate-700">
              Point B
            </div>

            <span className="text-xl text-slate-400">→</span>

            <div className="rounded-lg bg-gray-100 px-5 py-3 font-semibold text-slate-700">
              Point D
            </div>

            <span className="text-xl text-slate-400">→</span>

            <div className="rounded-lg bg-green-50 px-5 py-3 font-semibold text-green-700">
              Destination
            </div>

          </div>

        </div>

        {/* Statistics */}
        <div className="mb-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">

          <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
            <p className="text-sm text-slate-500">
              Total Distance
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              18.4 km
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
            <p className="text-sm text-slate-500">
              Estimated Time
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              42 min
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
            <p className="text-sm text-slate-500">
              Estimated Fuel Cost
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              ₹96
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
            <p className="text-sm text-slate-500">
              Route Score
            </p>

            <p className="mt-2 text-3xl font-bold text-blue-600">
              87.4
            </p>
          </div>

        </div>

        {/* Before vs After */}
        <div className="mb-8 rounded-xl bg-white p-6 shadow-sm border border-gray-200">

          <h2 className="mb-6 text-2xl font-bold text-slate-800">
            Before vs After Optimization
          </h2>

          <div className="overflow-x-auto">

            <table className="w-full border-collapse">

              <thead>
                <tr className="bg-slate-900 text-white">

                  <th className="border border-slate-700 px-5 py-3 text-left">
                    Metric
                  </th>

                  <th className="border border-slate-700 px-5 py-3">
                    Before
                  </th>

                  <th className="border border-slate-700 px-5 py-3">
                    After
                  </th>

                  <th className="border border-slate-700 px-5 py-3">
                    Improvement
                  </th>

                </tr>
              </thead>

              <tbody>

                <tr>
                  <td className="border border-gray-200 px-5 py-4 font-semibold">
                    Distance
                  </td>

                  <td className="border border-gray-200 px-5 py-4 text-center">
                    22.1 km
                  </td>

                  <td className="border border-gray-200 px-5 py-4 text-center">
                    18.4 km
                  </td>

                  <td className="border border-gray-200 px-5 py-4 text-center font-semibold text-green-600">
                    16.7%
                  </td>
                </tr>

                <tr className="bg-gray-50">
                  <td className="border border-gray-200 px-5 py-4 font-semibold">
                    Travel Time
                  </td>

                  <td className="border border-gray-200 px-5 py-4 text-center">
                    51 min
                  </td>

                  <td className="border border-gray-200 px-5 py-4 text-center">
                    42 min
                  </td>

                  <td className="border border-gray-200 px-5 py-4 text-center font-semibold text-green-600">
                    17.6%
                  </td>
                </tr>

                <tr>
                  <td className="border border-gray-200 px-5 py-4 font-semibold">
                    Fuel Cost
                  </td>

                  <td className="border border-gray-200 px-5 py-4 text-center">
                    ₹118
                  </td>

                  <td className="border border-gray-200 px-5 py-4 text-center">
                    ₹96
                  </td>

                  <td className="border border-gray-200 px-5 py-4 text-center font-semibold text-green-600">
                    18.6%
                  </td>
                </tr>

              </tbody>

            </table>

          </div>

        </div>

        {/* Factor Breakdown */}
        <div className="grid gap-8 lg:grid-cols-2">

          {/* Factor Contribution */}
          <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">

            <h2 className="mb-6 text-2xl font-bold text-slate-800">
              Factor Contribution
            </h2>

            <div className="space-y-5">

              {[
                ["Travel Time", 30],
                ["Traffic", 25],
                ["Distance", 20],
                ["Road Condition", 12],
                ["Fuel Cost", 8],
                ["Weather", 5],
              ].map(([name, value]) => (

                <div key={name}>

                  <div className="mb-2 flex justify-between">

                    <span className="font-medium text-slate-700">
                      {name}
                    </span>

                    <span className="font-bold text-blue-600">
                      {value}%
                    </span>

                  </div>

                  <div className="h-3 rounded-full bg-gray-200">

                    <div
                      className="h-3 rounded-full bg-blue-600"
                      style={{ width: `${value}%` }}
                    ></div>

                  </div>

                </div>

              ))}

            </div>

          </div>

          {/* Route Details */}
          <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">

            <h2 className="mb-6 text-2xl font-bold text-slate-800">
              Route Details
            </h2>

            <div className="space-y-4">

              <div className="flex justify-between border-b pb-3">
                <span className="text-slate-500">
                  Vehicle
                </span>

                <span className="font-semibold text-slate-800">
                  Vehicle 01
                </span>
              </div>

              <div className="flex justify-between border-b pb-3">
                <span className="text-slate-500">
                  Algorithm
                </span>

                <span className="font-semibold text-slate-800">
                  A* + AHP + VRP
                </span>
              </div>

              <div className="flex justify-between border-b pb-3">
                <span className="text-slate-500">
                  Traffic
                </span>

                <span className="font-semibold text-green-600">
                  Low
                </span>
              </div>

              <div className="flex justify-between border-b pb-3">
                <span className="text-slate-500">
                  Weather
                </span>

                <span className="font-semibold text-green-600">
                  Favorable
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500">
                  Road Condition
                </span>

                <span className="font-semibold text-slate-800">
                  Good
                </span>
              </div>

            </div>

          </div>

        </div>

      </main>
    </div>
  );
};

export default Results;