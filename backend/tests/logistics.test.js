const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const db = require('../src/services/dbService');
const config = require('../src/config/env');

describe('Persistent logistics data APIs', () => {
  const suffix = `${Date.now()}`;
  const vehicleId = `VT${suffix}`;
  const deliveryId = `DT${suffix}`;
  const token = jwt.sign({ id: 1, role: 'admin' }, config.JWT_SECRET, { expiresIn: '5m' });
  const auth = { Authorization: `Bearer ${token}` };

  afterAll(() => {
    db.deleteDelivery(deliveryId);
    db.deleteVehicle(vehicleId);
  });

  it('persists a delivery with optional and saved vehicle assignments', async () => {
    const vehicle = { vehicle_id: vehicleId, manufacturer: 'Test', model: 'Cargo', variant: 'Demo', vehicle_class: 'mini-truck', fuel_type: 'Diesel', registration_identifier: `SYN-TEST-${suffix}`, configured_capacity_kg: 100, availability: 1, operational_status: 'available' };
    expect((await request(app).post('/api/vehicles').set(auth).send(vehicle)).status).toBe(201);
    const delivery = { delivery_id: deliveryId, recipient_name: 'Synthetic Test Recipient', parcel_category: 'Documents and envelopes', weight: 2, priority: 'High', location: 'Synthetic test point, Nagpur', zone: 'Sitabuldi', latitude: 21.146, longitude: 79.088, status: 'pending', assigned_vehicle_id: '' };
    const created = await request(app).post('/api/deliveries').set(auth).send(delivery);
    expect(created.status).toBe(201);
    expect(created.body.assigned_vehicle_id).toBeNull();
    expect(created.body.latitude).toBeCloseTo(21.146);

    const updated = await request(app).put(`/api/deliveries/${deliveryId}`).set(auth).send({ ...delivery, weight: 3, assigned_vehicle_id: vehicleId });
    expect(updated.status).toBe(200);
    expect(updated.body.assigned_vehicle_id).toBe(vehicleId);
    expect(db.getDelivery(deliveryId).weight).toBe(3);

    const invalid = await request(app).put(`/api/deliveries/${deliveryId}`).set(auth).send({ ...delivery, assigned_vehicle_id: 'V_MISSING' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.message).toContain('Assigned vehicle does not exist');
  });
});
