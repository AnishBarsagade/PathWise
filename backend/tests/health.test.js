const request = require('supertest');
const app = require('../src/app');

describe('Health Check API', () => {
  it('GET /api/health should return 200 and health status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'ok',
      service: 'PathWise backend',
    });
  });
});
