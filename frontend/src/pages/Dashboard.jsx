import React from "react";

const Dashboard = () => {
  return (
    <div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Route Optimization Dashboard
        </h1>

        <p className="mt-2 text-gray-600">
          Generate efficient delivery routes using A* and
          calculate optimization factor weights using AHP.
        </p>
      </div>


      {/* Project Progress */}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">

            <h2 className="text-lg font-semibold text-gray-800">
              A* Route Generation
            </h2>

            <span className="px-3 py-1 text-sm rounded-full bg-green-100 text-green-700">
              Completed
            </span>

          </div>

          <p className="mt-3 text-gray-600">
            Generate the shortest route between locations
            using the A* pathfinding algorithm.
          </p>

        </div>


        <div className="bg-white rounded-xl border border-gray-200 p-6">

          <div className="flex items-center justify-between">

            <h2 className="text-lg font-semibold text-gray-800">
              AHP Weight Calculation
            </h2>

            <span className="px-3 py-1 text-sm rounded-full bg-green-100 text-green-700">
              Completed
            </span>

          </div>

          <p className="mt-3 text-gray-600">
            Calculate the relative importance of different
            route optimization factors using AHP.
          </p>

        </div>

      </div>


      {/* Future Modules */}

      <div className="mt-8">

        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Upcoming Modules
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-6">

            <h3 className="font-semibold text-gray-700">
              Multi-Factor Cost Function
            </h3>

            <p className="text-sm text-gray-500 mt-2">
              Combine multiple route factors into a unified
              optimization cost.
            </p>

            <span className="inline-block mt-4 text-sm text-gray-500">
              Coming Soon
            </span>

          </div>


          <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-6">

            <h3 className="font-semibold text-gray-700">
              Genetic Algorithm
            </h3>

            <p className="text-sm text-gray-500 mt-2">
              Further optimize delivery routes using
              evolutionary optimization.
            </p>

            <span className="inline-block mt-4 text-sm text-gray-500">
              Coming Soon
            </span>

          </div>

        </div>

      </div>

    </div>
  );
};

export default Dashboard;