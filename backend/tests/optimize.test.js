const request = require('supertest');
const app = require('../src/app');
const pythonOptimizerService = require('../src/services/pythonOptimizerService');

describe('Optimization API (POST /api/optimize)', () => {
  // 1. Valid optimization with demo data
  it('should return 200 and optimize default demo dataset when payload is empty', async () => {
    const res = await request(app).post('/api/optimize').send({});
    expect(res.status).toBe(200);

    const body = res.body;
    expect(body).toHaveProperty('routes');
    expect(body).toHaveProperty('total_cost');
    expect(body).toHaveProperty('total_load');

    expect(Array.isArray(body.routes)).toBe(true);
    expect(body.routes.length).toBeGreaterThan(0);
    expect(body.total_load).toBe(1220);
    expect(body.total_cost).toBeCloseTo(1.798, 2);

    // Verify properties required by specifications:
    // - all deliveries assigned
    // - vehicle capacities respected
    // - returned vehicle IDs correct
    // - DEPOT at beginning/end
    const assignedDeliveries = [];
    body.routes.forEach((r) => {
      expect(r).toHaveProperty('vehicle_id');
      expect(r).toHaveProperty('route');
      expect(r).toHaveProperty('load');
      expect(r).toHaveProperty('capacity');
      expect(r).toHaveProperty('distance');
      expect(r).toHaveProperty('cost');

      expect(typeof r.vehicle_id).toBe('string');
      expect(r.vehicle_id).toMatch(/^V\d+/);
      expect(r.capacity).toBeGreaterThanOrEqual(r.load);
      expect(r.distance).toBeGreaterThan(0);

      expect(r.route[0]).toBe('DEPOT');
      expect(r.route[r.route.length - 1]).toBe('DEPOT');

      const stops = r.route.filter((s) => s !== 'DEPOT');
      assignedDeliveries.push(...stops);
    });

    expect(assignedDeliveries.length).toBe(12);
    const uniqueDeliveries = new Set(assignedDeliveries);
    expect(uniqueDeliveries.size).toBe(12);
  }, 15000);

  // 1b. Support POST /api/optimize-route endpoint
  it('should return 200 on POST /api/optimize-route', async () => {
    const res = await request(app).post('/api/optimize-route').send({});
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('routes');
    expect(res.body).toHaveProperty('total_cost');
    expect(res.body).toHaveProperty('total_distance');
    expect(res.body).toHaveProperty('total_load');
    expect(res.body.routes.length).toBeGreaterThan(0);
  }, 15000);

  // 2. Valid optimization with custom payload
  it('should return 200 and optimize custom deliveries and vehicles', async () => {
    const customPayload = {
      deliveries: [
        {
          delivery_id: 'D001',
          latitude: 21.1458,
          longitude: 79.0882,
          weight: 100,
          priority: 'High',
        },
        {
          delivery_id: 'D002',
          latitude: 21.1500,
          longitude: 79.0900,
          weight: 150,
          priority: 'Medium',
        },
      ],
      vehicles: [
        {
          vehicle_id: 'V001',
          capacity: 500,
          fuel_cost: 8.5,
        },
      ],
    };

    const res = await request(app).post('/api/optimize').send(customPayload);
    expect(res.status).toBe(200);
    expect(res.body.total_load).toBe(250);
    expect(res.body.routes.length).toBe(1);
    expect(res.body.routes[0].vehicle_id).toBe('V001');
    expect(res.body.routes[0].route[0]).toBe('DEPOT');
    expect(res.body.routes[0].route[res.body.routes[0].route.length - 1]).toBe('DEPOT');
    expect(res.body.routes[0].route).toContain('D001');
    expect(res.body.routes[0].route).toContain('D002');
  }, 15000);

  // 3. Validation error: Missing vehicles when deliveries provided
  it('should return 400 when vehicles are missing in custom payload', async () => {
    const res = await request(app).post('/api/optimize').send({
      deliveries: [{ delivery_id: 'D1', latitude: 21.1, longitude: 79.1, weight: 10 }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Missing vehicles');
  });

  // 4. Validation error: Missing deliveries when vehicles provided
  it('should return 400 when deliveries are missing in custom payload', async () => {
    const res = await request(app).post('/api/optimize').send({
      vehicles: [{ vehicle_id: 'V1', capacity: 100, fuel_cost: 5 }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Missing deliveries');
  });

  // 5. Validation error: Empty arrays
  it('should return 400 when deliveries array is empty', async () => {
    const res = await request(app).post('/api/optimize').send({
      deliveries: [],
      vehicles: [{ vehicle_id: 'V1', capacity: 100, fuel_cost: 5 }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Missing deliveries');
  });

  // 6. Validation error: Invalid coordinates
  it('should return 400 when delivery latitude is invalid', async () => {
    const res = await request(app).post('/api/optimize').send({
      deliveries: [{ delivery_id: 'D1', latitude: 120.5, longitude: 79.1, weight: 10 }],
      vehicles: [{ vehicle_id: 'V1', capacity: 100, fuel_cost: 5 }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid coordinates');
  });

  // 7. Validation error: Non-positive delivery weight
  it('should return 400 when delivery weight is non-positive', async () => {
    const res = await request(app).post('/api/optimize').send({
      deliveries: [{ delivery_id: 'D1', latitude: 21.1, longitude: 79.1, weight: -5 }],
      vehicles: [{ vehicle_id: 'V1', capacity: 100, fuel_cost: 5 }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid delivery data');
    expect(res.body.message).toContain('greater than 0');
  });

  // 8. Validation error: Non-positive vehicle capacity
  it('should return 400 when vehicle capacity is non-positive', async () => {
    const res = await request(app).post('/api/optimize').send({
      deliveries: [{ delivery_id: 'D1', latitude: 21.1, longitude: 79.1, weight: 10 }],
      vehicles: [{ vehicle_id: 'V1', capacity: 0, fuel_cost: 5 }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid vehicle capacity');
    expect(res.body.message).toContain('greater than 0');
  });

  // 9. Validation error: Delivery weight exceeds max vehicle capacity
  it('should return 400 when delivery weight exceeds max vehicle capacity', async () => {
    const res = await request(app).post('/api/optimize').send({
      deliveries: [{ delivery_id: 'D1', latitude: 21.1, longitude: 79.1, weight: 500 }],
      vehicles: [{ vehicle_id: 'V1', capacity: 200, fuel_cost: 5 }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid delivery data');
    expect(res.body.message).toContain('exceeds the maximum vehicle capacity');
  });

  // 10. Server error: Optimization failure (500)
  it('should return 500 when python optimization fails unexpectedly', async () => {
    const spy = jest
      .spyOn(pythonOptimizerService, 'runOptimization')
      .mockRejectedValueOnce(new Error('OR-Tools solver process crashed.'));

    const res = await request(app).post('/api/optimize').send({});
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal Server Error');
    expect(res.body.message).toContain('OR-Tools solver process crashed.');

    spy.mockRestore();
  });
});
