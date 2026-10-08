const request = require('supertest');
const app = require('../src/app');
const realtimeService = require('../src/services/realtimeService');

describe('Real-Time Environmental Data API (GET /api/realtime-data)', () => {
  beforeEach(() => {
    realtimeService.clearCache();
  });

  afterAll(() => {
    realtimeService.clearCache();
  });

  it('should return 200 and formatted realtime payload with weather and traffic', async () => {
    const res = await request(app).get('/api/realtime-data');
    expect(res.status).toBe(200);

    const body = res.body;
    expect(body).toHaveProperty('status', 'success');
    expect(body).toHaveProperty('source');
    expect(['live', 'fallback']).toContain(body.source);
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('cached', false);

    // Weather checks
    expect(body).toHaveProperty('weather');
    expect(body.weather).toHaveProperty('score');
    expect(typeof body.weather.score).toBe('number');
    expect(body.weather.score).toBeGreaterThanOrEqual(1.0);
    expect(body.weather.score).toBeLessThanOrEqual(5.0);
    expect(body.weather).toHaveProperty('condition');
    expect(body.weather).toHaveProperty('temperature');

    // Traffic checks (explicitly labeled fallback/demo)
    expect(body).toHaveProperty('traffic');
    expect(body.traffic.source).toBe('fallback');
    expect(body.traffic).toHaveProperty('score', 3.0);
    expect(body.traffic).toHaveProperty('status');
  }, 15000);

  it('should return cached: true on consecutive requests within TTL', async () => {
    // First call sets cache
    const res1 = await request(app).get('/api/realtime-data');
    expect(res1.status).toBe(200);
    expect(res1.body.cached).toBe(false);

    // Second immediate call must hit in-memory cache
    const res2 = await request(app).get('/api/realtime-data');
    expect(res2.status).toBe(200);
    expect(res2.body.cached).toBe(true);
    expect(res2.body.timestamp).toBe(res1.body.timestamp);
  }, 10000);

  it('should gracefully return fallback weather without crashing if external API fails', async () => {
    // Force weather fetch error
    const spy = jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network offline or DNS failure'));

    realtimeService.clearCache();
    const res = await request(app).get('/api/realtime-data');
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('fallback');
    expect(res.body.weather.source).toBe('fallback');
    expect(res.body.weather.score).toBe(2.0);

    spy.mockRestore();
  });

  it('should correctly interpret various WMO weather codes to scores between 1.0 and 5.0', () => {
    const clear = realtimeService.interpretWeatherCode(0, 0, 10);
    expect(clear.score).toBe(1.0);
    expect(clear.condition).toBe('Clear sky');

    const rain = realtimeService.interpretWeatherCode(61, 2, 15);
    expect(rain.score).toBe(3.2);

    const storm = realtimeService.interpretWeatherCode(95, 10, 40);
    expect(storm.score).toBe(5.0);
  });
});
