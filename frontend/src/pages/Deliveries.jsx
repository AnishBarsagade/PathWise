import React, { useEffect, useState } from "react";
import { getDeliveries, getVehicles, removeDelivery, saveDelivery, loadDemoDataset } from "../services/api";
import { useAuth } from "../context/AuthContext";

const BLANK_DELIVERY = {
  delivery_id: "",
  recipient_name: "",
  parcel_category: "Standard Courier",
  weight: 2.5,
  priority: "Medium",
  location: "Dharampeth, Nagpur",
  zone: "West Zone",
  latitude: 21.1458,
  longitude: 79.0882,
  status: "pending",
  assigned_vehicle_id: "",
};

const ZONES = ["All Zones", "North Zone", "South Zone", "East Zone", "West Zone", "Central Zone", "Sitabuldi", "Dharampeth", "Sadar"];
const PRIORITIES = ["All Priorities", "High", "Medium", "Low"];
const STATUSES = ["All Statuses", "pending", "assigned", "in_progress", "completed", "cancelled"];

export default function Deliveries() {
  const { token, user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [deliveries, setDeliveries] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [priorityFilter, setPriorityFilter] = useState("All Priorities");
  const [zoneFilter, setZoneFilter] = useState("All Zones");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(BLANK_DELIVERY);
  const [submitting, setSubmitting] = useState(false);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter !== "All Statuses") params.append("status", statusFilter);
      if (priorityFilter !== "All Priorities") params.append("priority", priorityFilter);
      if (zoneFilter !== "All Zones") params.append("zone", zoneFilter);

      const [delivRes, vehRes] = await Promise.all([
        getDeliveries(params.toString()),
        getVehicles(),
      ]);

      setDeliveries(delivRes.records || []);
      setTotalCount(delivRes.total || 0);
      setVehicles(vehRes || []);
    } catch (err) {
      setMessage(err.message || "Failed to load deliveries.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [search, statusFilter, priorityFilter, zoneFilter]);

  const handleOpenCreate = () => {
    const nextId = `D${String(totalCount + 1).padStart(3, "0")}`;
    setFormData({ ...BLANK_DELIVERY, delivery_id: nextId });
    setIsEditing(false);
    setModalOpen(true);
  };

  const handleOpenEdit = (delivery) => {
    setFormData({
      ...delivery,
      assigned_vehicle_id: delivery.assigned_vehicle_id || "",
    });
    setIsEditing(true);
    setModalOpen(true);
  };

  const handleFormChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await saveDelivery(formData, token, isEditing);
      setModalOpen(false);
      setToast(`Delivery ${formData.delivery_id} successfully saved.`);
      setTimeout(() => setToast(null), 4000);
      fetchAllData();
    } catch (err) {
      alert(`Save error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (deliveryId) => {
    if (!window.confirm(`Are you sure you want to delete delivery order ${deliveryId}?`)) {
      return;
    }
    try {
      await removeDelivery(deliveryId, token);
      setToast(`Delivery ${deliveryId} deleted.`);
      setTimeout(() => setToast(null), 4000);
      fetchAllData();
    } catch (err) {
      alert(`Delete error: ${err.message}`);
    }
  };

  const handleSeed = async () => {
    try {
      setLoading(true);
      const res = await loadDemoDataset(token);
      setToast(`Seeded ${res.created} synthetic Nagpur delivery records.`);
      setTimeout(() => setToast(null), 4000);
      fetchAllData();
    } catch (err) {
      alert(`Seed error: ${err.message}`);
    } finally {
      setLoading(false);
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
              Delivery Orders
            </h1>
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-0.5 text-xs font-semibold text-cyan-300">
              {totalCount} Total
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-400">
            Nagpur operational delivery stops, customer destinations, and vehicle assignments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isAdmin && (
            <>
              <button
                onClick={handleSeed}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-gray-300 transition hover:bg-white/10 hover:text-white"
              >
                🌱 Seed Demo Orders
              </button>
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-lg shadow-cyan-950/50 transition hover:opacity-90"
              >
                + New Delivery
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.02] p-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Search Input */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Search</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID, recipient, or street..."
            className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-cyan-400 focus:outline-none"
          />
        </div>

        {/* Priority Filter */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Priority</label>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white capitalize focus:border-cyan-400 focus:outline-none"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace("_", " ")}</option>
            ))}
          </select>
        </div>

        {/* Zone Filter */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Zone</label>
          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
          >
            {ZONES.map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Deliveries Table */}
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-gray-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="px-5 py-4">ID</th>
                <th className="px-5 py-4">Recipient & Location</th>
                <th className="px-5 py-4">Zone</th>
                <th className="px-5 py-4">Weight</th>
                <th className="px-5 py-4">Priority</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Assigned Vehicle</th>
                {isAdmin && <th className="px-5 py-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && deliveries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500">
                    Loading delivery records...
                  </td>
                </tr>
              ) : deliveries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500">
                    No matching deliveries found. Try adjusting your filters or seed demo records.
                  </td>
                </tr>
              ) : (
                deliveries.map((deliv) => {
                  return (
                    <tr key={deliv.delivery_id} className="transition hover:bg-white/[0.02]">
                      <td className="px-5 py-3.5 font-mono font-bold text-cyan-300">
                        {deliv.delivery_id}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-white">{deliv.recipient_name}</p>
                        <p className="text-[11px] text-gray-400">{deliv.location}</p>
                      </td>
                      <td className="px-5 py-3.5 text-gray-300 font-medium">{deliv.zone}</td>
                      <td className="px-5 py-3.5 font-bold text-gray-200">{deliv.weight} kg</td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            deliv.priority === "High"
                              ? "bg-red-500/20 text-red-300 border border-red-500/30"
                              : deliv.priority === "Medium"
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                          }`}
                        >
                          {deliv.priority}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-semibold capitalize ${
                            deliv.status === "completed"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : deliv.status === "in_progress"
                              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                              : deliv.status === "cancelled"
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                              : "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                          }`}
                        >
                          {deliv.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {deliv.assigned_vehicle_id ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-300">
                            🚛 {deliv.assigned_vehicle_id}
                          </span>
                        ) : (
                          <span className="text-[11px] text-gray-500 italic">Unassigned</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-5 py-3.5 text-right space-x-2">
                          <button
                            onClick={() => handleOpenEdit(deliv)}
                            className="rounded-lg bg-cyan-400/10 px-2.5 py-1 font-semibold text-cyan-300 hover:bg-cyan-400/20"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(deliv.delivery_id)}
                            className="rounded-lg bg-red-400/10 px-2.5 py-1 font-semibold text-red-300 hover:bg-red-400/20"
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for Create/Edit */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/20 bg-[#090e24] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-lg font-bold text-white">
                {isEditing ? `Edit Delivery ${formData.delivery_id}` : "Create New Delivery Order"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-gray-300">Delivery ID *</label>
                  <input
                    type="text"
                    required
                    disabled={isEditing}
                    value={formData.delivery_id}
                    onChange={(e) => handleFormChange("delivery_id", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300">Recipient Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.recipient_name}
                    onChange={(e) => handleFormChange("recipient_name", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300">Parcel Category</label>
                  <input
                    type="text"
                    required
                    value={formData.parcel_category}
                    onChange={(e) => handleFormChange("parcel_category", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300">Weight (kg) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={formData.weight}
                    onChange={(e) => handleFormChange("weight", Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300">Priority *</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => handleFormChange("priority", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300">Status *</label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleFormChange("status", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  >
                    <option value="pending">pending</option>
                    <option value="assigned">assigned</option>
                    <option value="in_progress">in_progress</option>
                    <option value="completed">completed</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-gray-300">Street Location & Landmark *</label>
                  <input
                    type="text"
                    required
                    value={formData.location}
                    onChange={(e) => handleFormChange("location", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300">Delivery Zone *</label>
                  <input
                    type="text"
                    required
                    value={formData.zone}
                    onChange={(e) => handleFormChange("zone", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300">Assigned Fleet Vehicle</label>
                  <select
                    value={formData.assigned_vehicle_id || ""}
                    onChange={(e) => handleFormChange("assigned_vehicle_id", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    {vehicles.map((v) => (
                      <option key={v.vehicle_id} value={v.vehicle_id}>
                        {v.vehicle_id} - {v.manufacturer} {v.model} ({v.configured_capacity_kg} kg)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300">Latitude (-90 to 90) *</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formData.latitude}
                    onChange={(e) => handleFormChange("latitude", Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300">Longitude (-180 to 180) *</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formData.longitude}
                    onChange={(e) => handleFormChange("longitude", Number(e.target.value))}
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
                  {submitting ? "Saving..." : isEditing ? "Update Delivery" : "Create Delivery"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
