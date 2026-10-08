import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Map from "../components/Map";
import { runOptimization } from "../services/api";

const RouteOptimizer = () => {
  const navigate = useNavigate();

  const [vehicles, setVehicles] = useState([
    {
      vehicle_id: "V001",
      capacity: "500",
      fuel_cost: "8.5",
    },
  ]);

  const [deliveries, setDeliveries] = useState([
    {
      delivery_id: "D001",
      location: "Nagpur Central",
      latitude: "21.1458",
      longitude: "79.0882",
      weight: "120",
      priority: "High",
    },
  ]);

  const [depot, setDepot] = useState({
    latitude: "21.1450",
    longitude: "79.0880",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // -----------------------------
  // Vehicle handlers
  // -----------------------------

  const addVehicle = () => {
    const nextNumber = vehicles.length + 1;

    setVehicles([
      ...vehicles,
      {
        vehicle_id: `V${String(nextNumber).padStart(3, "0")}`,
        capacity: "",
        fuel_cost: "",
      },
    ]);
  };

  const updateVehicle = (index, field, value) => {
    const updated = [...vehicles];
    updated[index][field] = value;
    setVehicles(updated);
  };

  const removeVehicle = (index) => {
    if (vehicles.length === 1) return;

    setVehicles(vehicles.filter((_, i) => i !== index));
  };

  // -----------------------------
  // Delivery handlers
  // -----------------------------

  const addDelivery = () => {
    const nextNumber = deliveries.length + 1;

    setDeliveries([
      ...deliveries,
      {
        delivery_id: `D${String(nextNumber).padStart(3, "0")}`,
        location: "",
        latitude: "",
        longitude: "",
        weight: "",
        priority: "Medium",
      },
    ]);
  };

  const updateDelivery = (index, field, value) => {
    const updated = [...deliveries];
    updated[index][field] = value;
    setDeliveries(updated);
  };

  const removeDelivery = (index) => {
    if (deliveries.length === 1) return;

    setDeliveries(deliveries.filter((_, i) => i !== index));
  };

  // -----------------------------
  // Validation
  // -----------------------------

  const validateInput = () => {
    if (vehicles.length === 0) {
      return "Please add at least one vehicle.";
    }

    if (deliveries.length === 0) {
      return "Please add at least one delivery.";
    }

    for (const vehicle of vehicles) {
      if (!vehicle.vehicle_id.trim()) {
        return "Every vehicle must have a Vehicle ID.";
      }

      if (!vehicle.capacity || Number(vehicle.capacity) <= 0) {
        return `Invalid capacity for vehicle ${vehicle.vehicle_id}.`;
      }

      if (!vehicle.fuel_cost || Number(vehicle.fuel_cost) <= 0) {
        return `Invalid fuel cost for vehicle ${vehicle.vehicle_id}.`;
      }
    }

    for (const delivery of deliveries) {
      if (!delivery.delivery_id.trim()) {
        return "Every delivery must have a Delivery ID.";
      }

      if (
        !delivery.latitude ||
        Number(delivery.latitude) < -90 ||
        Number(delivery.latitude) > 90
      ) {
        return `Invalid latitude for ${delivery.delivery_id}.`;
      }

      if (
        !delivery.longitude ||
        Number(delivery.longitude) < -180 ||
        Number(delivery.longitude) > 180
      ) {
        return `Invalid longitude for ${delivery.delivery_id}.`;
      }

      if (!delivery.weight || Number(delivery.weight) <= 0) {
        return `Invalid weight for ${delivery.delivery_id}.`;
      }

      if (!delivery.location.trim()) {
        return `Please enter a location for ${delivery.delivery_id}.`;
      }
    }

    const maxCapacity = Math.max(
      ...vehicles.map((vehicle) => Number(vehicle.capacity)),
    );

    const overweightDelivery = deliveries.find(
      (delivery) => Number(delivery.weight) > maxCapacity,
    );

    if (overweightDelivery) {
      return `${overweightDelivery.delivery_id} weighs more than the available vehicle capacity.`;
    }

    return null;
  };

  // -----------------------------
  // Optimization
  // -----------------------------

  const handleRunOptimization = async () => {
    if (loading) return;

    setError(null);

    const validationError = validateInput();

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const payload = {
        deliveries: deliveries.map((delivery) => ({
          delivery_id: delivery.delivery_id.trim(),
          location: delivery.location.trim(),
          latitude: Number(delivery.latitude),
          longitude: Number(delivery.longitude),
          weight: Number(delivery.weight),
          priority: delivery.priority,
        })),

        vehicles: vehicles.map((vehicle) => ({
          vehicle_id: vehicle.vehicle_id.trim(),
          capacity: Number(vehicle.capacity),
          fuel_cost: Number(vehicle.fuel_cost),
        })),

        depot: {
          latitude: Number(depot.latitude),
          longitude: Number(depot.longitude),
        },

        // Keep the existing PathWise priority configuration.
        priority_penalties: {
          High: 100000,
          Medium: 50000,
          Low: 10000,
        },

        priority_urgency_weight: 0,
      };

      const optimizationData = await runOptimization(payload);

      navigate("/results", {
        state: {
          result: optimizationData,
        },
      });
    } catch (err) {
      setError(
        err.message ||
          "Failed to run route optimization. Please ensure the backend is running.",
      );
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------
  // Map preview
  // -----------------------------

  const sourceCoordinates = [
    Number(depot.latitude) || 21.145,
    Number(depot.longitude) || 79.088,
  ];

  const firstDelivery = deliveries[0];

  const destinationCoordinates = firstDelivery
    ? [
        Number(firstDelivery.latitude) || 21.1458,
        Number(firstDelivery.longitude) || 79.0882,
      ]
    : sourceCoordinates;

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
              Configure your delivery fleet and delivery points, then generate
              optimized multi-factor routes using A*, AHP and Google OR-Tools.
            </p>
          </div>

          <div className="flex w-fit items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-2">
            <span
              className={`h-2 w-2 rounded-full ${
                loading ? "animate-pulse bg-amber-400" : "bg-cyan-300"
              }`}
            />

            <span className="text-xs font-medium text-cyan-300">
              {loading
                ? "Optimization In Progress..."
                : "OR-Tools Engine Ready"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        {/* LEFT SIDE */}
        <div className="space-y-6">
          {/* Error */}
          {error && (
            <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-300">
              <div className="font-semibold">Optimization Error</div>
              <div className="mt-1">{error}</div>
            </div>
          )}

          {/* Vehicles */}
          {/* Vehicles */}
          <div className="rounded-3xl border border-white/10 bg-white/2.5 p-6 shadow-2xl shadow-black/20">
            <div className="mb-6 flex flex-col gap-5">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-600">
                  Fleet Configuration
                </p>

                <h2 className="mt-2 text-xl font-semibold text-white">
                  Vehicles
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Add the vehicles available for delivery.
                </p>
              </div>

              <button
                type="button"
                onClick={addVehicle}
                className="w-full shrink-0 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-300 transition hover:bg-cyan-400/20"
              >
                + Add Vehicle
              </button>
            </div>

            <div className="space-y-4">
              {vehicles.map((vehicle, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-300">
                      Vehicle {index + 1}
                    </span>

                    {vehicles.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeVehicle(index)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                      <label className="mb-2 block text-xs text-gray-500">
                        Vehicle ID
                      </label>

                      <input
                        value={vehicle.vehicle_id}
                        onChange={(e) =>
                          updateVehicle(index, "vehicle_id", e.target.value)
                        }
                        placeholder="V001"
                        className="w-full rounded-xl border border-white/10 bg-[#080b18] px-3 py-3 text-sm text-white outline-none transition focus:border-cyan-400/50"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs text-gray-500">
                        Capacity
                      </label>

                      <input
                        type="number"
                        min="1"
                        value={vehicle.capacity}
                        onChange={(e) =>
                          updateVehicle(index, "capacity", e.target.value)
                        }
                        placeholder="500"
                        className="w-full rounded-xl border border-white/10 bg-[#080b18] px-3 py-3 text-sm text-white outline-none transition focus:border-cyan-400/50"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs text-gray-500">
                        Fuel Cost
                      </label>

                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={vehicle.fuel_cost}
                        onChange={(e) =>
                          updateVehicle(index, "fuel_cost", e.target.value)
                        }
                        placeholder="8.5"
                        className="w-full rounded-xl border border-white/10 bg-[#080b18] px-3 py-3 text-sm text-white outline-none transition focus:border-cyan-400/50"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Deliveries */}
          <div className="rounded-3xl border border-white/10 bg-white/2.5 p-6 shadow-2xl shadow-black/20">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-600">
                  Delivery Configuration
                </p>

                <h2 className="mt-2 text-xl font-semibold text-white">
                  Delivery Points
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Enter the locations and priority of each delivery.
                </p>
              </div>

              <button
                type="button"
                onClick={addDelivery}
                className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-300 transition hover:bg-cyan-400/20"
              >
                + Add Delivery
              </button>
            </div>

            <div className="space-y-4">
              {deliveries.map((delivery, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-300">
                      Delivery {index + 1}
                    </span>

                    {deliveries.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDelivery(index)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs text-gray-500">
                        Delivery ID
                      </label>

                      <input
                        value={delivery.delivery_id}
                        onChange={(e) =>
                          updateDelivery(index, "delivery_id", e.target.value)
                        }
                        placeholder="D001"
                        className="w-full rounded-xl border border-white/10 bg-[#080b18] px-3 py-3 text-sm text-white outline-none focus:border-cyan-400/50"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs text-gray-500">
                        Location
                      </label>

                      <input
                        value={delivery.location}
                        onChange={(e) =>
                          updateDelivery(index, "location", e.target.value)
                        }
                        placeholder="Nagpur Central"
                        className="w-full rounded-xl border border-white/10 bg-[#080b18] px-3 py-3 text-sm text-white outline-none focus:border-cyan-400/50"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs text-gray-500">
                        Latitude
                      </label>

                      <input
                        type="number"
                        step="any"
                        value={delivery.latitude}
                        onChange={(e) =>
                          updateDelivery(index, "latitude", e.target.value)
                        }
                        placeholder="21.1458"
                        className="w-full rounded-xl border border-white/10 bg-[#080b18] px-3 py-3 text-sm text-white outline-none focus:border-cyan-400/50"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs text-gray-500">
                        Longitude
                      </label>

                      <input
                        type="number"
                        step="any"
                        value={delivery.longitude}
                        onChange={(e) =>
                          updateDelivery(index, "longitude", e.target.value)
                        }
                        placeholder="79.0882"
                        className="w-full rounded-xl border border-white/10 bg-[#080b18] px-3 py-3 text-sm text-white outline-none focus:border-cyan-400/50"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs text-gray-500">
                        Weight
                      </label>

                      <input
                        type="number"
                        min="1"
                        value={delivery.weight}
                        onChange={(e) =>
                          updateDelivery(index, "weight", e.target.value)
                        }
                        placeholder="120"
                        className="w-full rounded-xl border border-white/10 bg-[#080b18] px-3 py-3 text-sm text-white outline-none focus:border-cyan-400/50"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs text-gray-500">
                        Priority
                      </label>

                      <select
                        value={delivery.priority}
                        onChange={(e) =>
                          updateDelivery(index, "priority", e.target.value)
                        }
                        className="w-full rounded-xl border border-white/10 bg-[#080b18] px-3 py-3 text-sm text-white outline-none focus:border-cyan-400/50"
                      >
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Depot */}
          <div className="rounded-3xl border border-white/10 bg-white/2.5 p-6">
            <div className="mb-5">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-600">
                Depot
              </p>

              <h2 className="mt-2 text-xl font-semibold text-white">
                Starting Depot
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs text-gray-500">
                  Depot Latitude
                </label>

                <input
                  type="number"
                  step="any"
                  value={depot.latitude}
                  onChange={(e) =>
                    setDepot({
                      ...depot,
                      latitude: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#080b18] px-3 py-3 text-sm text-white outline-none focus:border-cyan-400/50"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs text-gray-500">
                  Depot Longitude
                </label>

                <input
                  type="number"
                  step="any"
                  value={depot.longitude}
                  onChange={(e) =>
                    setDepot({
                      ...depot,
                      longitude: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#080b18] px-3 py-3 text-sm text-white outline-none focus:border-cyan-400/50"
                />
              </div>
            </div>
          </div>

          {/* Optimize button */}
          <button
            type="button"
            onClick={handleRunOptimization}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-cyan-400 px-6 py-4 text-sm font-bold text-[#050816] transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#050816]/30 border-t-[#050816]" />
                Optimizing Routes...
              </>
            ) : (
              <>
                <span>⚡</span>
                Run Multi-Factor Optimization
              </>
            )}
          </button>
        </div>

        {/* RIGHT SIDE */}
        <div className="h-fit rounded-3xl border border-white/10 bg-white/2.5 p-6 shadow-2xl shadow-black/20 xl:sticky xl:top-24">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-gray-600">
                Live Visualization
              </p>

              <h2 className="mt-2 text-xl font-semibold text-white">
                Route Preview
              </h2>
            </div>

            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1 text-xs text-cyan-300">
              Map Ready
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10">
            <div className="h-125">
              <Map
                source={sourceCoordinates}
                destination={destinationCoordinates}
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-600">
                Fleet
              </p>

              <p className="mt-1 text-sm font-semibold text-gray-300">
                {vehicles.length} Vehicle
                {vehicles.length !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-600">
                Deliveries
              </p>

              <p className="mt-1 text-sm font-semibold text-gray-300">
                {deliveries.length} Point
                {deliveries.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-cyan-400/10 bg-cyan-400/5 p-3">
            <p className="text-xs leading-5 text-gray-400">
              Routes are calculated using the existing PathWise AHP-weighted
              multi-factor cost function and OR-Tools capacitated vehicle
              routing engine.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouteOptimizer;
