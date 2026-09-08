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
    <div>
      {/* Header */}

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Route Optimizer</h1>

        <p className="mt-2 text-gray-600">
          Generate an efficient route using the A* pathfinding algorithm.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Route Input */}

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">
            Route Information
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Source */}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Starting Location
              </label>

              <input
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Enter starting location"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Destination */}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Destination
              </label>

              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Enter destination"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Waypoints */}

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  Delivery Points
                </label>

                <button
                  type="button"
                  onClick={addWaypoint}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  + Add Point
                </button>
              </div>

              <div className="space-y-3">
                {waypoints.map((waypoint, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={waypoint}
                      onChange={(e) => updateWaypoint(index, e.target.value)}
                      placeholder={`Delivery point ${index + 1}`}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    {waypoints.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeWaypoint(index)}
                        className="px-3 text-red-500 hover:text-red-700"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Submit */}

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition"
            >
              Generate A* Route
            </button>
          </form>
        </div>

        {/* Map Placeholder */}

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">
            Route Visualization
          </h2>

          <div className="h-125 rounded-lg overflow-hidden">
            <Map
              source={sourceCoordinates}
              destination={destinationCoordinates}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouteOptimizer;
