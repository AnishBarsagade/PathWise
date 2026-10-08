const request = require('supertest');
const app = require('../src/app');
const dbService = require('../src/services/dbService');

describe('Dynamic Rerouting API (POST /api/reroute)', () => {
  const sampleRunId = 'test_reroute_run_001';

  beforeEach(() => {
    dbService.clearHistory();

    // Seed a known optimization run
    dbService.saveOptimizationRun({
      run_id: sampleRunId,
      created_at: new Date().toISOString(),
      input_config: {
        deliveries: [
          { delivery_id: 'D001', latitude: 21.1458, longitude: 79.0882, weight: 120, priority: 'High' },
          { delivery_id: 'D003', latitude: 21.1610, longitude: 79.0885, weight: 150, priority: 'High' },
          { delivery_id: 'D007', latitude: 21.1120, longitude: 79.0850, weight: 130, priority: 'High' },
        ],
        vehicles: [
          { vehicle_id: 'V001', capacity: 500, fuel_cost: 8.5 },
        ],
      },
      ahp_weights: { distance: 0.3 },
      realtime_source: 'live',
      realtime_timestamp: new Date().toISOString(),
      realtime_data: {},
      routes: [
        {
          vehicle_id: 'V001',
          route: ['DEPOT', 'D001', 'D003', 'D007', 'DEPOT'],
          cost: 0.85,
          load: 400,
          capacity: 500,
        },
      ],
      total_cost: 0.85,
      total_load: 400,
      priority_summary: { High: { total: 3, served: 3 } },
      result_json: {},
    });
  });

  afterAll(() => {
    dbService.clearHistory();
  });

  it('should return 400 when run_id is missing', async () => {
    const res = await request(app).post('/api/reroute').send({
      vehicle_id: 'V001',
      incident_type: 'Traffic Congestion',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Missing run_id');
  });

  it('should return 400 when vehicle_id is missing', async () => {
    const res = await request(app).post('/api/reroute').send({
      run_id: sampleRunId,
      incident_type: 'Traffic Congestion',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Missing vehicle_id');
  });

  it('should return 400 when incident_type is missing or invalid', async () => {
    const res = await request(app).post('/api/reroute').send({
      run_id: sampleRunId,
      vehicle_id: 'V001',
      incident_type: 'Alien Invasion',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid incident_type');
  });

  it('should return 404 when optimization run does not exist', async () => {
    const res = await request(app).post('/api/reroute').send({
      run_id: 'non_existent_run_999',
      vehicle_id: 'V001',
      incident_type: 'Road Closure',
    });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not Found');
  });

  it('should return 400 when vehicle does not exist in the run', async () => {
    const res = await request(app).post('/api/reroute').send({
      run_id: sampleRunId,
      vehicle_id: 'V999',
      incident_type: 'Road Closure',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Vehicle Not Found');
  });

  it('should return 400 when incident location is not on the vehicle route', async () => {
    const res = await request(app).post('/api/reroute').send({
      run_id: sampleRunId,
      vehicle_id: 'V001',
      incident_type: 'Road Closure',
      incident_details: { location: 'D999' },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid Incident Location');
  });

  it('should successfully handle Road Closure scenario and bypass the blocked stop', async () => {
    const res = await request(app).post('/api/reroute').send({
      run_id: sampleRunId,
      vehicle_id: 'V001',
      incident_type: 'Road Closure',
      incident_details: { location: 'D003', severity: 'High' },
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('event_id');
    expect(res.body.run_id).toBe(sampleRunId);
    expect(res.body.vehicle_id).toBe('V001');
    expect(res.body.incident_type).toBe('Road Closure');
    expect(res.body.original_route).toEqual(['DEPOT', 'D001', 'D003', 'D007', 'DEPOT']);
    expect(res.body.rerouted_route).not.toContain('D003');
    expect(res.body.metrics.incident_location).toBe('D003');
    expect(res.body.metrics.original_stops_count).toBe(3);
    expect(res.body.metrics.rerouted_stops_count).toBe(2);
    expect(res.body.reason).toContain('Road Closure at D003');
  }, 15000);

  it('should successfully handle Traffic Congestion scenario and reschedule stop to the end', async () => {
    const res = await request(app).post('/api/reroute').send({
      run_id: sampleRunId,
      vehicle_id: 'V001',
      incident_type: 'Traffic Congestion',
      incident_details: { location: 'D001', severity: 'High' },
    });

    expect(res.status).toBe(200);
    expect(res.body.incident_type).toBe('Traffic Congestion');
    expect(res.body.rerouted_route[res.body.rerouted_route.length - 2]).toBe('D001');
    expect(res.body.metrics.delay_estimate_minutes).toBe(18);
    expect(res.body.reason).toContain('Traffic Congestion at D001');
  });

  it('should persist rerouting events in SQLite and retrieve them via GET /api/rerouting/history', async () => {
    await request(app).post('/api/reroute').send({
      run_id: sampleRunId,
      vehicle_id: 'V001',
      incident_type: 'Weather',
      incident_details: { location: 'D007', severity: 'Medium' },
    });

    const historyRes = await request(app).get('/api/rerouting/history');
    expect(historyRes.status).toBe(200);
    expect(Array.isArray(historyRes.body)).toBe(true);
    expect(historyRes.body.length).toBe(1);
    expect(historyRes.body[0].run_id).toBe(sampleRunId);
    expect(historyRes.body[0].vehicle_id).toBe('V001');
    expect(historyRes.body[0].incident_type).toBe('Weather');
  });
});
