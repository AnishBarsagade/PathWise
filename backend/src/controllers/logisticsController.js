const db = require('../services/dbService');
const { demoVehicles, demoDeliveries } = require('../data/demoData');
const priorities = new Set(['High', 'Medium', 'Low']);
const statuses = new Set(['pending', 'assigned', 'in_progress', 'completed', 'cancelled']);
const classes = new Set(['motorcycle', 'scooter', 'electric two-wheeler', 'cargo three-wheeler', 'mini-truck', 'pickup', 'light commercial vehicle']);

function deliveryPayload(body, id) {
  const d = { ...body, delivery_id: id || body.delivery_id, weight: Number(body.weight), latitude: Number(body.latitude), longitude: Number(body.longitude), assigned_vehicle_id: body.assigned_vehicle_id || null, status: body.status || 'pending' };
  if (!d.delivery_id || !d.recipient_name || !d.parcel_category || !d.location || !d.zone || !priorities.has(d.priority) || !statuses.has(d.status) || !(d.weight > 0) || d.latitude < -90 || d.latitude > 90 || d.longitude < -180 || d.longitude > 180) throw new Error('Invalid delivery: provide ID, recipient, category, positive weight, priority, synthetic location/zone, valid coordinates, and status.');
  return d;
}
function vehiclePayload(body, id) {
  const v = { ...body, vehicle_id: id || body.vehicle_id, configured_capacity_kg: Number(body.configured_capacity_kg), manufacturer_rated_payload_kg: body.manufacturer_rated_payload_kg === '' || body.manufacturer_rated_payload_kg == null ? null : Number(body.manufacturer_rated_payload_kg), availability: body.availability ? 1 : 0, operational_status: body.operational_status || 'available' };
  if (!v.vehicle_id || !v.manufacturer || !v.model || !classes.has(v.vehicle_class) || !(v.configured_capacity_kg > 0) || !['available','maintenance','inactive'].includes(v.operational_status)) throw new Error('Invalid vehicle: provide ID, manufacturer, model, supported class, positive configured capacity, and operational status.');
  return v;
}
function wrap(fn) { return (req, res, next) => { try { fn(req, res); } catch (e) { if (e.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || e.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'Conflict', message: 'A record with this identifier already exists.' }); return res.status(400).json({ error: 'Validation Error', message: e.message }); } }; }

exports.listDeliveries = wrap((req, res) => res.json(db.listDeliveries(req.query)));
exports.getDelivery = wrap((req, res) => { const item = db.getDelivery(req.params.id); if (!item) return res.status(404).json({ error: 'Not Found', message: 'Delivery not found.' }); res.json(item); });
function validatedDelivery(body, id) { const delivery = deliveryPayload(body, id); if (delivery.assigned_vehicle_id && !db.getVehicle(delivery.assigned_vehicle_id)) throw new Error('Assigned vehicle does not exist. Choose Unassigned or a saved fleet vehicle.'); return delivery; }
exports.createDelivery = wrap((req, res) => res.status(201).json(db.saveDelivery(validatedDelivery(req.body))));
exports.updateDelivery = wrap((req, res) => { if (!db.getDelivery(req.params.id)) return res.status(404).json({ error: 'Not Found', message: 'Delivery not found.' }); res.json(db.saveDelivery(validatedDelivery(req.body, req.params.id), true)); });
exports.deleteDelivery = wrap((req, res) => res.status(db.deleteDelivery(req.params.id) ? 204 : 404).end());
exports.listVehicles = wrap((req, res) => res.json(db.listVehicles(req.query)));
exports.getVehicle = wrap((req, res) => { const item = db.getVehicle(req.params.id); if (!item) return res.status(404).json({ error: 'Not Found', message: 'Vehicle not found.' }); res.json(item); });
exports.createVehicle = wrap((req, res) => res.status(201).json(db.saveVehicle(vehiclePayload(req.body))));
exports.updateVehicle = wrap((req, res) => { if (!db.getVehicle(req.params.id)) return res.status(404).json({ error: 'Not Found', message: 'Vehicle not found.' }); res.json(db.saveVehicle(vehiclePayload(req.body, req.params.id), true)); });
exports.deleteVehicle = wrap((req, res) => { const result = db.deleteVehicle(req.params.id); if (result.reason) return res.status(409).json({ error: 'Conflict', message: result.reason }); res.status(result.deleted ? 204 : 404).end(); });
exports.seedDemo = wrap((req, res) => res.status(200).json({ ...db.seedDemoData({ deliveries: demoDeliveries(), vehicles: demoVehicles() }), message: 'Synthetic Nagpur demonstration records loaded without overwriting existing data.' }));
exports.dashboardStats = wrap((req, res) => res.json(db.getDashboardStats()));
