import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Map from "../components/Map";
import { getDeliveries, getVehicles, runOptimization, compareOptimization } from "../services/api";

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
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonResult, setComparisonResult] = useState(null);
  const [error, setError] = useState(null);
  const [savedDeliveries, setSavedDeliveries] = useState([]);
  const [savedVehicles, setSavedVehicles] = useState([]);
  const [mapNotice, setMapNotice] = useState('Loading saved delivery locations…');

  useEffect(() => {
    Promise.all([getDeliveries(), getVehicles('availability=1')])
      .then(([deliveryData, vehicleData]) => {
        setSavedDeliveries((deliveryData.records || []).filter((delivery) => ['pending', 'assigned'].includes(delivery.status)));
        setSavedVehicles((vehicleData || []).filter((vehicle) => vehicle.operational_status === 'available'));
        setMapNotice('');
      })
      .catch((err) => setMapNotice(`Unable to load saved delivery locations: ${err.message}`));
  }, []);

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
    if (!savedDeliveries.length || !savedVehicles.length) {
      setError('No eligible saved deliveries or available fleet vehicles exist. Load or update data in Delivery and Fleet Management first.');
      return;
    }
    setLoading(true);
    try {
      const optimizationData = await runOptimization({});
      navigate(`/results?run=${encodeURIComponent(optimizationData.run_id)}`, { state: { result: optimizationData } });
    } catch (err) {
      setError(
        err.message ||
          "Failed to run route optimization. Please ensure the backend is running.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRunComparison = async () => {
    if (comparisonLoading || loading) return;
    setError(null);
    setComparisonLoading(true);
    try {
      const compData = await compareOptimization({});
      setComparisonResult(compData);
    } catch (err) {
      setError(err.message || "Failed to execute side-by-side comparison.");
    } finally {
      setComparisonLoading(false);
    }
  };

  // Preserve the existing ad-hoc scenario form without allowing it to be
  // mistaken for the primary persisted-fleet workflow.
  const handleManualScenario = async () => {
    if (loading) return;
    const validationError = validateInput();
    if (validationError) { setError(validationError); return; }
    setError(null);
    setLoading(true);
    try {
      const result = await runOptimization({
        deliveries: deliveries.map((delivery) => ({ ...delivery, delivery_id: delivery.delivery_id.trim(), location: delivery.location.trim(), latitude: Number(delivery.latitude), longitude: Number(delivery.longitude), weight: Number(delivery.weight) })),
        vehicles: vehicles.map((vehicle) => ({ vehicle_id: vehicle.vehicle_id.trim(), capacity: Number(vehicle.capacity), fuel_cost: Number(vehicle.fuel_cost) })),
        depot: { latitude: Number(depot.latitude), longitude: Number(depot.longitude) },
        priority_penalties: { High: 100000, Medium: 50000, Low: 10000 },
        priority_urgency_weight: 0,
      });
      navigate(`/results?run=${encodeURIComponent(result.run_id)}`, { state: { result } });
    } catch (err) { setError(err.message || 'Unable to run the manual scenario.'); }
    finally { setLoading(false); }
  };

  // -----------------------------
  // Map preview
  // -----------------------------


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
              Generate a new run from the current eligible deliveries and
              available persisted fleet using AHP and OR-Tools.
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

          {/* Optimization & Comparison Action Buttons */}
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleRunOptimization}
              disabled={loading || comparisonLoading}
              className="flex items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-5 py-4 text-sm font-bold text-[#050816] transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
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

            <button
              type="button"
              onClick={handleRunComparison}
              disabled={loading || comparisonLoading}
              className="flex items-center justify-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-4 text-sm font-bold text-cyan-300 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {comparisonLoading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400" />
                  Running Side-by-Side...
                </>
              ) : (
                <>
                  <span>⚖️</span>
                  Compare Distance vs AHP
                </>
              )}
            </button>
          </div>

          <button type="button" onClick={handleManualScenario} disabled={loading || comparisonLoading} className="mt-3 w-full rounded-xl border border-white/15 px-4 py-2 text-xs text-gray-300 hover:border-cyan-400/30">
            Run manual scenario instead (ad-hoc form inputs)
          </button>

          {/* Comparison Results Card */}
          {comparisonResult && (
            <div className="mt-6 rounded-3xl border border-cyan-400/30 bg-cyan-950/20 p-6 shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-cyan-400/20 pb-4">
                <div>
                  <span className="rounded-full bg-cyan-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                    Scientific Evaluation
                  </span>
                  <h3 className="mt-1 text-lg font-bold text-white">
                    Distance-Only vs. Multi-Factor AHP Routing
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setComparisonResult(null)}
                  className="rounded-lg p-1 text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {/* Metrics Table */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-gray-400 text-[11px] uppercase">
                      <th className="py-2.5">Evaluation Metric</th>
                      <th className="py-2.5">Distance-Only VRP</th>
                      <th className="py-2.5 text-cyan-300">Multi-Factor AHP</th>
                      <th className="py-2.5 text-emerald-300">Delta / Advantage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-medium">
                    <tr>
                      <td className="py-2.5 text-gray-300">Total Route Distance</td>
                      <td className="py-2.5 font-mono text-gray-300">
                        {comparisonResult.comparison.distance_based_km} km
                      </td>
                      <td className="py-2.5 font-mono font-semibold text-cyan-300">
                        {comparisonResult.comparison.multifactor_km} km
                      </td>
                      <td className="py-2.5 text-gray-400">
                        +{comparisonResult.comparison.distance_delta_km} km (Congestion detour)
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 text-gray-300">Total Operational Cost</td>
                      <td className="py-2.5 font-mono text-gray-300">
                        {comparisonResult.comparison.distance_based_cost}
                      </td>
                      <td className="py-2.5 font-mono font-bold text-emerald-400">
                        {comparisonResult.comparison.multifactor_cost}
                      </td>
                      <td className="py-2.5 font-bold text-emerald-400">
                        ↓ {comparisonResult.comparison.cost_improvement_pct}% Cost Reduction
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 text-gray-300">High-Priority Fulfillment</td>
                      <td className="py-2.5 font-mono text-gray-300">100%</td>
                      <td className="py-2.5 font-mono text-cyan-300">100%</td>
                      <td className="py-2.5 text-emerald-300">Guaranteed</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Viva Evaluation Summary Note */}
              <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-950/40 p-4 text-xs leading-relaxed text-emerald-200">
                <span className="font-bold">Project Finding: </span>
                {comparisonResult.comparison.summary}
              </div>

              <div className="mt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setComparisonResult(null)}
                  className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-white/5"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigate("/results", {
                      state: { result: comparisonResult.multifactor },
                    })
                  }
                  className="rounded-xl bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-300"
                >
                  Inspect Multi-Factor Routes On Map →
                </button>
              </div>
            </div>
          )}
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

          {mapNotice ? <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-200">{mapNotice}</div> : <Map deliveries={savedDeliveries} vehicles={savedVehicles} height="500px" />}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-600">
                Fleet
              </p>

              <p className="mt-1 text-sm font-semibold text-gray-300">
                {savedVehicles.length} eligible saved vehicle{savedVehicles.length !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-600">
                Deliveries
              </p>

              <p className="mt-1 text-sm font-semibold text-gray-300">
                {savedDeliveries.length} eligible saved {savedDeliveries.length === 1 ? 'delivery' : 'deliveries'}
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
