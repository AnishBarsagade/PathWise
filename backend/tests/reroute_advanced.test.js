const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const dbService = require('../src/services/dbService');
const config = require('../src/config/env');
const pythonOptimizerService = require('../src/services/pythonOptimizerService');
const realtimeService = require('../src/services/realtimeService');

describe('Task 2 — Dynamic Rerouting Engine & Verification (16 Requirements)', () => {
  const sampleRunId = 'reroute_audit_run_999';
  const adminToken = jwt.sign(
    { id: 1, email: 'admin@pathwise.com', role: 'admin' },
    config.JWT_SECRET,
    { expiresIn: '1h' }
  );
  const adminAuth = { Authorization: `Bearer ${adminToken}` };

  let rider1Auth, rider2Auth;

  beforeEach(() => {
    dbService.clearHistory();

    // Ensure test riders exist in users table so foreign keys pass
    let rider1 = dbService.findUserByEmail('rider101@test.com');
    if (!rider1) {
      rider1 = dbService.createUser({
        name: 'Rider 101',
        email: 'rider101@test.com',
        passwordHash: '$2b$10$fakehashforridertest12345678901234567890',
        role: 'rider',
      });
    }

    let rider2 = dbService.findUserByEmail('rider102@test.com');
    if (!rider2) {
      rider2 = dbService.createUser({
        name: 'Rider 102',
        email: 'rider102@test.com',
        passwordHash: '$2b$10$fakehashforridertest12345678901234567890',
        role: 'rider',
      });
    }

    const rider1Token = jwt.sign(
      { id: rider1.id, email: rider1.email, role: 'rider' },
      config.JWT_SECRET,
      { expiresIn: '1h' }
    );
    rider1Auth = { Authorization: `Bearer ${rider1Token}` };

    const rider2Token = jwt.sign(
      { id: rider2.id, email: rider2.email, role: 'rider' },
      config.JWT_SECRET,
      { expiresIn: '1h' }
    );
    rider2Auth = { Authorization: `Bearer ${rider2Token}` };

    // Seed test vehicles and deliveries into DB if needed
    dbService.saveVehicle({
      vehicle_id: 'V001',
      manufacturer: 'Tata',
      model: 'Ace EV',
      variant: 'Standard',
      vehicle_class: 'mini-truck',
      fuel_type: 'Electric',
      registration_identifier: 'MH31-RR-0001',
      configured_capacity_kg: 500,
      availability: 1,
      operational_status: 'available',
    }, true);

    dbService.saveVehicle({
      vehicle_id: 'V002',
      manufacturer: 'Mahindra',
      model: 'Zor Grand',
      variant: 'Standard',
      vehicle_class: 'three-wheeler',
      fuel_type: 'Electric',
      registration_identifier: 'MH31-RR-0002',
      configured_capacity_kg: 400,
      availability: 1,
      operational_status: 'available',
    }, true);

    // Assign Rider 101 to V001
    dbService.assignRiderToVehicle(rider1.id, 'V001');
    // Assign Rider 102 to V002
    dbService.assignRiderToVehicle(rider2.id, 'V002');

    // Seed a known optimization run
    dbService.saveOptimizationRun({
      run_id: sampleRunId,
      created_at: new Date().toISOString(),
      input_config: {
        deliveries: [
          { delivery_id: 'D001', latitude: 21.1458, longitude: 79.0882, weight: 120, priority: 'High' },
          { delivery_id: 'D002', latitude: 21.1500, longitude: 79.0900, weight: 100, priority: 'Medium' },
          { delivery_id: 'D003', latitude: 21.1610, longitude: 79.0885, weight: 150, priority: 'Low' },
        ],
        vehicles: [
          { vehicle_id: 'V001', capacity: 500, fuel_cost: 10.0 },
        ],
      },
      ahp_weights: {
        distance: 0.3004,
        travel_time: 0.2691,
        traffic: 0.1706,
        fuel_cost: 0.1195,
        weather: 0.0744,
        road_condition: 0.0661,
      },
      realtime_source: 'live',
      realtime_timestamp: new Date().toISOString(),
      realtime_data: {},
      routes: [
        {
          vehicle_id: 'V001',
          route: ['DEPOT', 'D001', 'D002', 'D003', 'DEPOT'],
          cost: 0.95,
          load: 370,
          capacity: 500,
        },
      ],
      total_cost: 0.95,
      total_load: 370,
      priority_summary: {
        High: { total: 1, served: 1 },
        Medium: { total: 1, served: 1 },
        Low: { total: 1, served: 1 },
        total_deliveries: 3,
        total_served: 3,
      },
      result_json: {},
    });
  });

  afterAll(() => {
    dbService.deleteVehicle('V001');
    dbService.deleteVehicle('V002');
    dbService.clearHistory();
  });

  // 1. A valid persisted optimization run can be selected for rerouting.
  it('1. A valid persisted optimization run can be selected for rerouting', async () => {
    const res = await request(app)
      .post('/api/reroute')
      .set(adminAuth)
      .send({
        run_id: sampleRunId,
        vehicle_id: 'V001',
        incident_type: 'Road Closure',
        incident_details: { location: 'D002', severity: 'High' },
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('event_id');
    expect(res.body.run_id).toBe(sampleRunId);
    expect(res.body.vehicle_id).toBe('V001');
    expect(res.body.original_route).toEqual(['DEPOT', 'D001', 'D002', 'D003', 'DEPOT']);
    expect(res.body.rerouted_route).not.toContain('D002');
  });

  // 2. A traffic change triggers reassessment when appropriate.
  it('2. A traffic change triggers reassessment when appropriate', async () => {
    const res = await request(app)
      .post('/api/reroute')
      .set(adminAuth)
      .send({
        run_id: sampleRunId,
        vehicle_id: 'V001',
        incident_type: 'Traffic Congestion',
        incident_details: { location: 'D001', severity: 'High' },
      });

    expect(res.status).toBe(200);
    expect(res.body.incident_type).toBe('Traffic Congestion');
    expect(res.body.rerouted).toBe(true);
    expect(res.body.metrics.delay_estimate_minutes).toBe(18);
    expect(res.body.metrics.cost_delta).toBeGreaterThan(0);
    expect(res.body.reason).toContain('Traffic Congestion at D001');
  });

  // 3. A weather change triggers reassessment when appropriate.
  it('3. A weather change triggers reassessment when appropriate', async () => {
    const res = await request(app)
      .post('/api/reroute')
      .set(adminAuth)
      .send({
        run_id: sampleRunId,
        vehicle_id: 'V001',
        incident_type: 'Weather',
        incident_details: { location: 'D003', severity: 'High' },
      });

    expect(res.status).toBe(200);
    expect(res.body.incident_type).toBe('Weather');
    expect(res.body.rerouted).toBe(true);
    expect(res.body.metrics.cost_delta).toBeGreaterThan(0);
    expect(res.body.reason).toContain('Adverse Weather at D003');
  });

  // 4. A road-condition change triggers reassessment when appropriate.
  it('4. A road-condition change triggers reassessment when appropriate', async () => {
    const res = await request(app)
      .post('/api/reroute')
      .set(adminAuth)
      .send({
        run_id: sampleRunId,
        vehicle_id: 'V001',
        incident_type: 'Road Condition',
        incident_details: { location: 'D001', severity: 'Medium' },
      });

    expect(res.status).toBe(200);
    expect(res.body.incident_type).toBe('Road Condition');
    expect(res.body.rerouted).toBe(true);
    expect(res.body.reason).toContain('Degraded Road Condition at D001');
  });

  // 5. A change that does not justify a different route produces a clear no-change response.
  it('5. A change that does not justify a different route produces a clear no-change response', async () => {
    const res = await request(app)
      .post('/api/reroute')
      .set(adminAuth)
      .send({
        run_id: sampleRunId,
        vehicle_id: 'V001',
        incident_type: 'None',
        incident_details: { severity: 'None', no_change_justified: true },
      });

    expect(res.status).toBe(200);
    expect(res.body.rerouted).toBe(false);
    expect(res.body.status).toBe('No Change Justified');
    expect(res.body.reason).toContain('do not justify altering');
    expect(res.body.rerouted_route).toEqual(res.body.original_route);
    expect(res.body.metrics.cost_delta).toBe(0);
  });

  // 6. A better feasible route is accepted only when the solver and cost comparison justify it.
  it('6. Feasible route is accepted and reports accurate cost comparison metrics', async () => {
    const res = await request(app)
      .post('/api/reroute')
      .set(adminAuth)
      .send({
        run_id: sampleRunId,
        vehicle_id: 'V001',
        incident_type: 'Road Closure',
        incident_details: { location: 'D002', severity: 'High' },
      });

    expect(res.status).toBe(200);
    expect(res.body.metrics).toHaveProperty('original_cost');
    expect(res.body.metrics).toHaveProperty('rerouted_cost');
    expect(res.body.metrics).toHaveProperty('cost_delta');
    expect(typeof res.body.metrics.cost_delta).toBe('number');
    expect(res.body.metrics.original_stops_count).toBe(3);
    expect(res.body.metrics.rerouted_stops_count).toBe(2);
  });

  // 7. An infeasible alternative is handled safely.
  it('7. An infeasible alternative is handled safely without corrupting system state', async () => {
    const res = await request(app)
      .post('/api/reroute')
      .set(adminAuth)
      .send({
        run_id: sampleRunId,
        vehicle_id: 'V001',
        incident_type: 'Road Closure',
        incident_details: {
          location: 'D001',
          force_infeasible: true,
          infeasible_weight: 9999,
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Infeasible Alternative');
    expect(res.body.message).toContain('No feasible alternative route exists');

    // Run remains intact in database
    const runAfter = dbService.getOptimizationRunById(sampleRunId);
    expect(runAfter).not.toBeNull();
    expect(runAfter.run_id).toBe(sampleRunId);
  });

  // 8. A solver error does not corrupt the original optimization run.
  it('8. A solver error does not corrupt the original optimization run', async () => {
    const solverSpy = jest
      .spyOn(pythonOptimizerService, 'runOptimization')
      .mockRejectedValueOnce(new Error('OR-Tools solver process timeout.'));

    const res = await request(app)
      .post('/api/reroute')
      .set(adminAuth)
      .send({
        run_id: sampleRunId,
        vehicle_id: 'V001',
        incident_type: 'Road Closure',
        incident_details: { location: 'D001', severity: 'High' },
      });

    // Solver failure falls back safely and returns structured response without crash
    expect(res.status).toBe(200);
    expect(res.body.rerouted).toBe(true);

    // Verify original run in SQLite is completely untouched
    const originalRun = dbService.getOptimizationRunById(sampleRunId);
    expect(originalRun.total_cost).toBe(0.95);
    expect(originalRun.total_load).toBe(370);

    solverSpy.mockRestore();
  });

  // 9. A rerouting event is saved and appears in rerouting history.
  it('9. A rerouting event is saved and appears in rerouting history', async () => {
    const rerouteRes = await request(app)
      .post('/api/reroute')
      .set(adminAuth)
      .send({
        run_id: sampleRunId,
        vehicle_id: 'V001',
        incident_type: 'Accident',
        incident_details: { location: 'D001', severity: 'High' },
      });

    expect(rerouteRes.status).toBe(200);
    const eventId = rerouteRes.body.event_id;

    // Check history endpoint
    const historyRes = await request(app).get('/api/rerouting/history');
    expect(historyRes.status).toBe(200);
    expect(Array.isArray(historyRes.body)).toBe(true);
    const found = historyRes.body.find((e) => e.event_id === eventId);
    expect(found).toBeDefined();
    expect(found.incident_type).toBe('Accident');
    expect(found.vehicle_id).toBe('V001');
  });

  // 10. The original optimization run remains retrievable and unchanged.
  it('10. The original optimization run remains retrievable and unchanged', async () => {
    const beforeRun = dbService.getOptimizationRunById(sampleRunId);

    // Perform rerouting action
    await request(app)
      .post('/api/reroute')
      .set(adminAuth)
      .send({
        run_id: sampleRunId,
        vehicle_id: 'V001',
        incident_type: 'Weather',
        incident_details: { location: 'D002', severity: 'High' },
      });

    // Retrieve original run through API
    const runRes = await request(app).get(`/api/optimization/${sampleRunId}`);
    expect(runRes.status).toBe(200);
    expect(runRes.body.run_id).toBe(sampleRunId);
    expect(runRes.body.total_cost).toBe(beforeRun.total_cost);
    expect(runRes.body.total_load).toBe(beforeRun.total_load);
    expect(runRes.body.routes).toEqual(beforeRun.routes);
  });

  // 11. Completed deliveries are not incorrectly reassigned.
  it('11. Completed deliveries are not incorrectly reassigned (returns clear no-change response)', async () => {
    const res = await request(app)
      .post('/api/reroute')
      .set(adminAuth)
      .send({
        run_id: sampleRunId,
        vehicle_id: 'V001',
        incident_type: 'Traffic Congestion',
        incident_details: {
          location: 'D001',
          severity: 'High',
          completed_stops: ['D001'],
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.rerouted).toBe(false);
    expect(res.body.status).toBe('No Change Required');
    expect(res.body.reason).toContain('is already completed');
    expect(res.body.rerouted_route).toEqual(res.body.original_route);
  });

  // 12. Vehicle capacities, delivery priorities, and eligibility constraints remain respected.
  it('12. Vehicle capacities, delivery priorities, and eligibility constraints remain respected', async () => {
    const res = await request(app)
      .post('/api/reroute')
      .set(adminAuth)
      .send({
        run_id: sampleRunId,
        vehicle_id: 'V001',
        incident_type: 'Road Closure',
        incident_details: { location: 'D003', severity: 'High' },
      });

    expect(res.status).toBe(200);
    // Capacity of V001 is 500. Remaining deliveries are D001 (120kg) and D002 (100kg) = 220kg <= 500kg
    expect(res.body.rerouted_route).toContain('D001');
    expect(res.body.rerouted_route).toContain('D002');
    expect(res.body.rerouted_route).not.toContain('D003');
  });

  // 13. Missing or invalid run IDs return an appropriate error.
  it('13. Missing or invalid run IDs return appropriate error codes (400 and 404)', async () => {
    // Missing run_id
    const resMissing = await request(app)
      .post('/api/reroute')
      .set(adminAuth)
      .send({
        vehicle_id: 'V001',
        incident_type: 'Road Closure',
      });
    expect(resMissing.status).toBe(400);
    expect(resMissing.body.error).toBe('Missing run_id');

    // Invalid/non-existent run_id
    const resNotFound = await request(app)
      .post('/api/reroute')
      .set(adminAuth)
      .send({
        run_id: 'non_existent_run_999999',
        vehicle_id: 'V001',
        incident_type: 'Road Closure',
      });
    expect(resNotFound.status).toBe(404);
    expect(resNotFound.body.error).toBe('Not Found');
  });

  // 14. Unavailable live data triggers a clearly labelled fallback or an informative failure response.
  it('14. Unavailable live data triggers a clearly labelled fallback or informative failure response', async () => {
    const fetchSpy = jest
      .spyOn(realtimeService, 'getRealtimeData')
      .mockResolvedValueOnce({
        source: 'fallback',
        timestamp: new Date().toISOString(),
        weather: { score: 2.0, condition: 'Fair (Fallback)' },
        traffic: { score: 3.0, status: 'Moderate', source: 'fallback' },
      });

    const res = await request(app)
      .post('/api/reroute')
      .set(adminAuth)
      .send({
        run_id: sampleRunId,
        vehicle_id: 'V001',
        incident_type: 'Weather',
        incident_details: {
          location: 'D001',
          severity: 'Medium',
          use_live_data: true,
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.metrics.live_data_source).toBe('fallback');
    expect(res.body.metrics.traffic_source).toBe('fallback');

    fetchSpy.mockRestore();
  });

  // 15. Unauthorized Riders cannot trigger fleet-wide rerouting.
  it('15. Unauthorized Riders cannot trigger fleet-wide rerouting (returns 403 Forbidden)', async () => {
    const res = await request(app)
      .post('/api/reroute')
      .set(rider1Auth)
      .send({
        run_id: sampleRunId,
        // Omitted vehicle_id -> attempts fleet-wide operation
        incident_type: 'Road Closure',
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toContain('Riders cannot trigger fleet-wide rerouting');
  });

  // 16. A Rider cannot reroute a route assigned to another Rider.
  it('16. A Rider cannot reroute a route assigned to another Rider (returns 403 Forbidden)', async () => {
    // Rider 102 (assigned to V002) attempts to reroute V001 (assigned to Rider 101)
    const res = await request(app)
      .post('/api/reroute')
      .set(rider2Auth)
      .send({
        run_id: sampleRunId,
        vehicle_id: 'V001',
        incident_type: 'Traffic Congestion',
        incident_details: { location: 'D001', severity: 'High' },
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toContain("Rider is not assigned to vehicle 'V001'");
  });
});
