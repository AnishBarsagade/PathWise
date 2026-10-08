const request = require('supertest');
const app = require('../src/app');
const dbService = require('../src/services/dbService');

describe('Data Persistence & Optimization History API', () => {
  beforeEach(() => {
    dbService.clearHistory();
  });

  afterAll(() => {
    dbService.clearHistory();
  });

  it('GET /api/optimization/history should return empty array when no runs exist', async () => {
    const res = await request(app).get('/api/optimization/history');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  it('GET /api/rerouting/history should return empty array initially', async () => {
    const res = await request(app).get('/api/rerouting/history');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  it('should persist a run in SQLite and retrieve it via history and ID endpoints', async () => {
    const sampleRun = {
      run_id: 'test_run_123',
      created_at: new Date().toISOString(),
      input_config: { test: true },
      ahp_weights: { distance: 0.3004 },
      realtime_source: 'live',
      realtime_timestamp: new Date().toISOString(),
      realtime_data: { weather: { score: 1.2 } },
      routes: [
        { vehicle_id: 'V001', route: ['DEPOT', 'D001', 'DEPOT'], cost: 0.5, load: 100 }
      ],
      total_cost: 0.5,
      total_load: 100,
      priority_summary: { High: { total: 1, served: 1 } },
      result_json: { sample: 'result' },
    };

    dbService.saveOptimizationRun(sampleRun);

    // Verify history endpoint
    const historyRes = await request(app).get('/api/optimization/history');
    expect(historyRes.status).toBe(200);
    expect(historyRes.body.length).toBe(1);
    expect(historyRes.body[0].run_id).toBe('test_run_123');
    expect(historyRes.body[0].total_cost).toBe(0.5);
    expect(historyRes.body[0].total_load).toBe(100);

    // Verify ID endpoint
    const idRes = await request(app).get('/api/optimization/test_run_123');
    expect(idRes.status).toBe(200);
    expect(idRes.body.run_id).toBe('test_run_123');
    expect(idRes.body.realtime_source).toBe('live');
    expect(idRes.body.routes.length).toBe(1);
    expect(idRes.body.input_config).toEqual({ test: true });
  });

  it('GET /api/optimization/:id should return 404 for non-existent run ID', async () => {
    const res = await request(app).get('/api/optimization/non_existent_id');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not Found');
  });

  it('POST /api/optimize should save the run in SQLite and attach run_id and realtime to response', async () => {
    const res = await request(app).post('/api/optimize').send({});
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('run_id');
    expect(typeof res.body.run_id).toBe('string');
    expect(res.body.run_id).toMatch(/^run_/);
    expect(res.body).toHaveProperty('realtime');
    expect(res.body.realtime).toHaveProperty('weather');

    // Confirm it was persisted in SQLite
    const savedRun = dbService.getOptimizationRunById(res.body.run_id);
    expect(savedRun).not.toBeNull();
    expect(savedRun.run_id).toBe(res.body.run_id);
    expect(savedRun.total_cost).toBeCloseTo(1.798, 2);
    expect(savedRun.total_load).toBe(1220);
  }, 15000);
});
