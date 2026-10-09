const { fetchRoadGeometry, validateCoordinates } = require('../src/services/routeGeometryService');
const request = require('supertest');
const app = require('../src/app');

describe('Road geometry visualisation service', () => {
  const points = [[21.145, 79.088], [21.15, 79.09]];

  it('converts OSRM GeoJSON longitude-latitude coordinates for Leaflet', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ routes: [{ geometry: { coordinates: [[79.088, 21.145], [79.09, 21.15]] } }] }) });
    await expect(fetchRoadGeometry(points, fetchMock)).resolves.toEqual({ source: 'osrm', coordinates: points });
    expect(fetchMock.mock.calls[0][0]).toContain('79.088,21.145;79.09,21.15');
  });

  it('returns an explicit straight-line fallback when road geometry is unavailable', async () => {
    const fallback = await fetchRoadGeometry(points, jest.fn().mockRejectedValue(new Error('service unavailable')));
    expect(fallback.source).toBe('straight_line');
    expect(fallback.coordinates).toEqual(points);
    expect(fallback.reason).toContain('service unavailable');
  });

  it('validates route-geometry request shape', async () => {
    expect(validateCoordinates([[91, 79], [21, 79]])).toBe(false);
    expect(validateCoordinates([null, [21, 79]])).toBe(false);
    const response = await request(app).post('/api/route-geometry').send({ routes: [] });
    expect(response.status).toBe(400);
  });
});
