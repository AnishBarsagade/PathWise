const { fetchRoadGeometry, validateCoordinates } = require('../services/routeGeometryService');

async function getRouteGeometries(req, res, next) {
  try {
    const routes = Array.isArray(req.body?.routes) ? req.body.routes : [];
    if (!routes.length || routes.length > 20) return res.status(400).json({ error: 'Validation Error', message: 'Provide between 1 and 20 route coordinate sequences.' });
    const geometries = await Promise.all(routes.map(async (route) => ({
      vehicle_id: String(route.vehicle_id || ''),
      ...(await fetchRoadGeometry(route.coordinates)),
    })));
    res.status(200).json({ geometries });
  } catch (error) { next(error); }
}

module.exports = { getRouteGeometries };
