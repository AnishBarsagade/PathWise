import React, { useState } from "react";
import Map from "../components/Map";

const RouteOptimizer = () => {
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [waypoints, setWaypoints] = useState([""]);
  const [sourceCoordinates, setSourceCoordinates] = useState(null);
  const [destinationCoordinates, setDestinationCoordinates] = useState(null);

  const addWaypoint = () => {
    setWaypoints([...waypoints, ""]);
  };

  const updateWaypoint = (index, value) => {
    const updatedWaypoints = [...waypoints];
    updatedWaypoints[index] = value;
    setWaypoints(updatedWaypoints);
  };

  const removeWaypoint = (index) => {
    const updatedWaypoints = waypoints.filter((_, i) => i !== index);
    setWaypoints(updatedWaypoints);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Temporary coordinates
    const sourceCoords = [21.1458, 79.0882];
    const destinationCoords = [18.5204, 73.8567];

    setSourceCoordinates(sourceCoords);
    setDestinationCoordinates(destinationCoords);

    console.log({
      source,
      destination,
      waypoints,
      sourceCoords,
      destinationCoords,
    });
  };

  return (
    <div className="min-h-screen bg-[#050816] text-white">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-cyan-300" />

              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
                Route Planning
              </span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
              Route Optimizer
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-400 md:text-base">
              Generate an efficient route using the A* pathfinding algorithm.
            </p>
          </div>

          <div className="flex w-fit items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-2">
            <span className="h-2 w-2 rounded-full bg-cyan-300" />

            <span className="text-xs font-medium text-cyan-300">
              A* Engine Ready
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        {/* =====================================================
            ROUTE INFORMATION
        ===================================================== */}
        <div className="rounded-3xl border border-white/10 bg-white/2.5 p-6 shadow-2xl shadow-black/20">
          <div className="mb-7 flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-gray-600">
                Input Configuration
              </p>

              <h2 className="mt-2 text-xl font-semibold text-white">
                Route Information
              </h2>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
              ↗
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Source */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Starting Location
              </label>

              <input
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Enter starting location"
                className="w-full rounded-xl border border-white/10 bg-white/3 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-cyan-400/40 focus:bg-cyan-400/3 focus:ring-2 focus:ring-cyan-400/10"
                required
              />
            </div>

            {/* Destination */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Destination
              </label>

              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Enter destination"
                className="w-full rounded-xl border border-white/10 bg-white/3 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-cyan-400/40 focusfocus:bg-cyan-400/3s:ring-2 focus:ring-cyan-400/10"
                required
              />
            </div>

            {/* Waypoints */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <label className="text-sm font-medium text-gray-300">
                  Delivery Points
                </label>

                <button
                  type="button"
                  onClick={addWaypoint}
                  className="text-sm font-medium text-cyan-300 transition hover:text-cyan-200"
                >
                  + Add Point
                </button>
              </div>

              <div className="space-y-3">
                {waypoints.map((waypoint, index) => (
                  <div key={index} className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-gray-600">
                        {String(index + 1).padStart(2, "0")}
                      </span>

                      <input
                        type="text"
                        value={waypoint}
                        onChange={(e) => updateWaypoint(index, e.target.value)}
                        placeholder={`Delivery point ${index + 1}`}
                        className="w-full rounded-xl border border-white/10 bg-white/3 py-3.5 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-cyan-400/40 focus:bg-cyan-400/3 focus:ring-2 focus:ring-cyan-400/10"
                      />
                    </div>

                    {waypoints.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeWaypoint(index)}
                        className="rounded-xl border border-red-400/10 bg-red-400/5 px-4 text-sm text-red-400 transition hover:border-red-400/30 hover:bg-red-400/10"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-white/5" />

            {/* Submit */}
            <button
              type="submit"
              className="group flex w-full items-center justify-center gap-3 rounded-xl bg-cyan-400 px-5 py-3.5 font-semibold text-[#041016] transition duration-200 hover:-translate-y-0.5 hover:bg-cyan-300 hover:shadow-lg hover:shadow-cyan-500/20"
            >
              <span>Generate A* Route</span>

              <span className="transition-transform duration-200 group-hover:translate-x-1">
                →
              </span>
            </button>

            <p className="text-center text-xs text-gray-600">
              A* will calculate an efficient path between the selected
              locations.
            </p>
          </form>
        </div>

        {/* =====================================================
            MAP
        ===================================================== */}
        <div className="rounded-3xl border border-white/10 bg-white/2.5 shadow-2xl shadow-black/20">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-gray-600">
                Live Visualization
              </p>

              <h2 className="mt-2 text-xl font-semibold text-white">
                Route Visualization
              </h2>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

              <span className="text-xs text-emerald-300">Map Ready</span>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#080d20]">
            <div className="h-130">
              <Map
                source={sourceCoordinates}
                destination={destinationCoordinates}
              />
            </div>
          </div>

          {/* Map information */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/2 p-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-600">
                Starting Point
              </p>

              <p className="mt-1 truncate text-xs text-gray-400">
                {source || "Not selected"}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/2 p-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-600">
                Destination
              </p>

              <p className="mt-1 truncate text-xs text-gray-400">
                {destination || "Not selected"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouteOptimizer;
