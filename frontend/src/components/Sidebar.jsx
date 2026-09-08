import React from "react";
import { Link } from "react-router-dom";

const Sidebar = () => {
  return (
    <aside className="w-64 min-h-[calc(100vh-4rem)] bg-gray-900 text-white p-5">
      <div className="mb-8">
        <h2 className="text-lg font-semibold">Navigation</h2>
      </div>

      <div className="space-y-2">
        <Link
          to="/"
          className="block w-full px-4 py-3 rounded-lg hover:bg-gray-800"
        >
          Dashboard
        </Link>

        <Link
          to="/route-optimizer"
          className="block w-full px-4 py-3 rounded-lg hover:bg-gray-800"
        >
          Route Optimizer
        </Link>

        <Link
          to="/ahp"
          className="block w-full px-4 py-3 rounded-lg hover:bg-gray-800"
        >
          AHP Analysis
        </Link>

        <Link
          to="/results"
          className="block w-full px-4 py-3 rounded-lg hover:bg-gray-800"
        >
          Results
        </Link>
      </div>
    </aside>
  );
};

export default Sidebar;
