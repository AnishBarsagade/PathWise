import React, { useEffect, useState } from "react";
import {
  getVehicles,
  saveVehicle,
  removeVehicle,
  getRiders,
  assignRiderToVehicle,
  unassignRiderFromVehicle,
} from "../services/api";
import { useAuth } from "../context/AuthContext";

const BLANK_VEHICLE = {
  vehicle_id: "",
  manufacturer: "Tata Motors",
  model: "Ace EV",
  variant: "Electric Cargo",
  vehicle_class: "mini-truck",
  fuel_type: "Electric",
  registration_identifier: "MH31-PW-1001",
  configured_capacity_kg: 600,
  manufacturer_rated_payload_kg: 600,
  availability: 1,
  operational_status: "available",
};

const VEHICLE_CLASSES = [
  "motorcycle",
  "scooter",
  "electric two-wheeler",
  "cargo three-wheeler",
  "mini-truck",
  "pickup",
  "light commercial vehicle",
];

export default function Fleet() {
  const { token, user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [vehicles, setVehicles] = useState([]);
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(BLANK_VEHICLE);
  const [submitting, setSubmitting] = useState(false);

  // Rider assignment selected per vehicle
  const [selectedRider, setSelectedRider] = useState({});

  const loadData = async () => {
    try {
      setLoading(true);
      const [vehList, riderList] = await Promise.all([
        getVehicles(),
        getRiders(token).catch(() => []),
      ]);
      setVehicles(vehList || []);
      setRiders(riderList || []);
    } catch (err) {
      setMessage(err.message || "Failed to load fleet data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const handleOpenCreate = () => {
    const nextNum = String(vehicles.length + 1).padStart(3, "0");
    setFormData({
      ...BLANK_VEHICLE,
      vehicle_id: `V${nextNum}`,
      registration_identifier: `MH31-PW-${1000 + vehicles.length + 1}`,
    });
    setIsEditing(false);
    setModalOpen(true);
  };

  const handleOpenEdit = (v) => {
    setFormData({
      ...v,
      configured_capacity_kg: Number(v.configured_capacity_kg),
      manufacturer_rated_payload_kg: v.manufacturer_rated_payload_kg ? Number(v.manufacturer_rated_payload_kg) : "",
    });
    setIsEditing(true);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await saveVehicle(formData, token);
      setModalOpen(false);
      setToast(`Vehicle ${formData.vehicle_id} saved successfully.`);
      setTimeout(() => setToast(null), 4000);
      loadData();
    } catch (err) {
      alert(`Save error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (vehicleId) => {
    if (!window.confirm(`Delete vehicle ${vehicleId}?`)) return;
    try {
      await removeVehicle(vehicleId, token);
      setToast(`Vehicle ${vehicleId} removed.`);
      setTimeout(() => setToast(null), 4000);
      loadData();
    } catch (err) {
      alert(err.message || "Failed to delete vehicle.");
    }
  };

  const handleToggleAvailability = async (vehicle) => {
    const newStatus = vehicle.availability ? 0 : 1;
    const newOp = newStatus === 1 ? "available" : "maintenance";
    try {
      await saveVehicle(
        { ...vehicle, availability: newStatus, operational_status: newOp },
        token
      );
      setToast(`Vehicle ${vehicle.vehicle_id} availability updated.`);
      setTimeout(() => setToast(null), 3000);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAssignRider = async (vehicleId) => {
    const riderId = selectedRider[vehicleId];
    if (!riderId) {
      alert("Please select a rider from the dropdown.");
      return;
    }
    try {
      await assignRiderToVehicle(Number(riderId), vehicleId, token);
      setToast(`Rider assigned to ${vehicleId}.`);
      setTimeout(() => setToast(null), 4000);
      loadData();
    } catch (err) {
      alert(err.message || "Assignment failed.");
    }
  };

  const handleUnassignRider = async (vehicleId) => {
    try {
      // Find rider assigned to this vehicle
      const riderForVehicle = riders.find((r) => r.assigned_vehicle_id === vehicleId);
      if (riderForVehicle) {
        await unassignRiderFromVehicle(riderForVehicle.id, vehicleId, token);
      } else {
        await unassignRiderFromVehicle(0, vehicleId, token);
      }
      setToast(`Assignment cleared for ${vehicleId}.`);
      setTimeout(() => setToast(null), 3000);
      loadData();
    } catch (err) {
      alert(err.message || "Unassignment failed.");
    }
  };

  return (
    <div className="space-y-8">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-950/90 px-5 py-4 text-emerald-200 shadow-2xl backdrop-blur-md">
          <span>✓</span>
          <p className="text-sm font-medium">{toast}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white lg:text-3xl">
              Mixed Commercial Fleet
            </h1>
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-0.5 text-xs font-semibold text-cyan-300">
              {vehicles.length} Units
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-400">
            Configure vehicle payload limits, availability status, and assign active delivery riders.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 self-start rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-lg shadow-cyan-950/50 transition hover:opacity-90"
          >
            + Add Vehicle
          </button>
        )}
      </div>

      {/* Vehicle Grid */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {loading && vehicles.length === 0 ? (
          <div className="col-span-full py-16 text-center text-sm text-gray-500">
            Loading fleet records...
          </div>
        ) : vehicles.length === 0 ? (
          <div className="col-span-full rounded-3xl border border-white/10 bg-white/[0.02] p-12 text-center text-gray-400">
            No fleet vehicles found. Click "+ Add Vehicle" to register one.
          </div>
        ) : (
          vehicles.map((v) => {
            const isAvail = Boolean(v.availability);
            return (
              <div
                key={v.vehicle_id}
                className="flex flex-col justify-between rounded-3xl border border-white/10 bg-white/[0.02] p-6 shadow-xl transition hover:border-white/20"
              >
                <div>
                  {/* Top: Class & Status */}
                  <div className="flex items-center justify-between">
                    <span className="rounded-md border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                      {v.vehicle_class}
                    </span>
                    <button
                      onClick={() => handleToggleAvailability(v)}
                      title="Click to toggle availability"
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition ${
                        isAvail
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${isAvail ? "bg-emerald-400" : "bg-amber-400"}`} />
                      {isAvail ? "Available" : "Maintenance"}
                    </button>
                  </div>

                  {/* Title & Registration */}
                  <div className="mt-4">
                    <div className="flex items-baseline justify-between">
                      <h3 className="text-lg font-bold text-white">
                        {v.manufacturer} {v.model}
                      </h3>
                      <span className="font-mono text-xs font-semibold text-gray-400">
                        {v.vehicle_id}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {v.variant || "Standard Cargo"} · {v.fuel_type || "Electric"}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-gray-500">
                      Reg: {v.registration_identifier || "SYN-MH31-PW-000"}
                    </p>
                  </div>

                  {/* Capacity Bar */}
                  <div className="mt-5 rounded-2xl border border-white/5 bg-white/[0.02] p-3.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400 font-medium">Configured Payload</span>
                      <span className="font-bold text-cyan-300">{v.configured_capacity_kg} kg</span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full bg-cyan-400"
                        style={{ width: `${Math.min(100, (v.configured_capacity_kg / 1000) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Rider Assignment Section */}
                  {isAdmin && (
                    <div className="mt-5 border-t border-white/5 pt-4">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                        Assigned Delivery Rider
                      </label>
                      <div className="mt-2 flex items-center gap-2">
                        <select
                          value={selectedRider[v.vehicle_id] || ""}
                          onChange={(e) =>
                            setSelectedRider({ ...selectedRider, [v.vehicle_id]: e.target.value })
                          }
                          className="flex-1 rounded-xl border border-white/10 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                        >
                          <option value="">Select Rider...</option>
                          {riders.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name || r.email}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleAssignRider(v.vehicle_id)}
                          className="rounded-xl bg-cyan-400/20 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-400/30 border border-cyan-400/30"
                        >
                          Assign
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                {isAdmin && (
                  <div className="mt-6 flex items-center justify-end gap-2 border-t border-white/5 pt-4 text-xs">
                    <button
                      onClick={() => handleOpenEdit(v)}
                      className="rounded-lg bg-white/5 px-3 py-1.5 font-semibold text-gray-300 hover:bg-white/10"
                    >
                      Edit Vehicle
                    </button>
                    <button
                      onClick={() => handleDelete(v.vehicle_id)}
                      className="rounded-lg bg-red-400/10 px-3 py-1.5 font-semibold text-red-300 hover:bg-red-400/20"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal for Create/Edit Vehicle */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/20 bg-[#090e24] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-lg font-bold text-white">
                {isEditing ? `Edit Vehicle ${formData.vehicle_id}` : "Register New Fleet Vehicle"}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-gray-300">Vehicle ID *</label>
                  <input
                    type="text"
                    required
                    disabled={isEditing}
                    value={formData.vehicle_id}
                    onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300">Manufacturer *</label>
                  <input
                    type="text"
                    required
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300">Model *</label>
                  <input
                    type="text"
                    required
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300">Variant</label>
                  <input
                    type="text"
                    value={formData.variant || ""}
                    onChange={(e) => setFormData({ ...formData, variant: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300">Vehicle Class *</label>
                  <select
                    value={formData.vehicle_class}
                    onChange={(e) => setFormData({ ...formData, vehicle_class: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white capitalize focus:border-cyan-400 focus:outline-none"
                  >
                    {VEHICLE_CLASSES.map((vc) => (
                      <option key={vc} value={vc}>{vc}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300">Fuel / Powertrain</label>
                  <input
                    type="text"
                    value={formData.fuel_type || "Electric"}
                    onChange={(e) => setFormData({ ...formData, fuel_type: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300">Registration ID</label>
                  <input
                    type="text"
                    value={formData.registration_identifier || ""}
                    onChange={(e) => setFormData({ ...formData, registration_identifier: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300">Configured Payload Capacity (kg) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.configured_capacity_kg}
                    onChange={(e) => setFormData({ ...formData, configured_capacity_kg: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-cyan-400 px-5 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : isEditing ? "Update Vehicle" : "Register Vehicle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
