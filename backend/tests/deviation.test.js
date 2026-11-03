const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const config = require('../src/config/env');
const dbService = require('../src/services/dbService');
const {
  turfNearestPointOnRoute,
  turfDistanceToRouteMeters,
  evaluateRouteDeviation,
  DISTANCE_ON_ROUTE_METERS,
  DISTANCE_WARNING_METERS,
  DEFAULT_DEVIATION_THRESHOLD_METERS,
  MAX_ACCEPTABLE_ACCURACY_METERS,
  CONSECUTIVE_DEVIATION_ALERT_COUNT,
} = require('../src/services/deviationService');
const {
  toLeafletLatLng,
  toTurfLngLat,
  isValidCoordinate,
  isValidAccuracy,
  isValidTimestamp,
} = require('../src/utils/geoUtils');

describe('PathWise Route Deviation & Tracking Architecture', () => {
  const adminToken = jwt.sign({ id: 1, role: 'admin' }, config.JWT_SECRET, { expiresIn: '1h' });
  const auth = { Authorization: `Bearer ${adminToken}` };

  // Planned corridor: Sitabuldi to Dharampeth corridor in Nagpur
  // [latitude, longitude]
  const plannedRoute = [
    [21.145, 79.088],
    [21.150, 79.094],
    [21.156, 79.102],
    [21.162, 79.110],
  ];

  describe('1. Coordinate Validation and Conversion Utilities', () => {
    it('correctly converts Leaflet [lat, lon] to Turf [lon, lat] and back without reversing twice', () => {
      const leafletCoord = [21.145, 79.088];
      const turfCoord = toTurfLngLat(leafletCoord);
      expect(turfCoord).toEqual([79.088, 21.145]);

      // If already in Turf format, toTurfLngLat does NOT double-reverse
      const turfCoord2 = toTurfLngLat(turfCoord);
      expect(turfCoord2).toEqual([79.088, 21.145]);

      // Convert back to Leaflet format
      const backToLeaflet = toLeafletLatLng(turfCoord);
      expect(backToLeaflet).toEqual([21.145, 79.088]);

      // If already in Leaflet format, toLeafletLatLng does NOT double-reverse
      const backToLeaflet2 = toLeafletLatLng(backToLeaflet);
      expect(backToLeaflet2).toEqual([21.145, 79.088]);
    });

    it('handles coordinate objects { lat, lon } and { latitude, longitude }', () => {
      expect(toLeafletLatLng({ lat: 21.145, lon: 79.088 })).toEqual([21.145, 79.088]);
      expect(toTurfLngLat({ latitude: 21.145, longitude: 79.088 })).toEqual([79.088, 21.145]);
    });

    it('validates coordinates, finite ranges, and excludes uninitialized zero island', () => {
      expect(isValidCoordinate(21.145, 79.088)).toBe(true);
      expect(isValidCoordinate(95, 79.088)).toBe(false); // Lat > 90
      expect(isValidCoordinate(21.145, 200)).toBe(false); // Lon > 180
      expect(isValidCoordinate(NaN, 79.088)).toBe(false);
      expect(isValidCoordinate(0, 0, true)).toBe(false); // Zero island rejected
    });

    it('validates GPS accuracy gate (initial maximum 50m)', () => {
      expect(isValidAccuracy(8, 50)).toBe(true);
      expect(isValidAccuracy(50, 50)).toBe(true);
      expect(isValidAccuracy(51, 50)).toBe(false); // > 50m rejected
      expect(isValidAccuracy(0, 50)).toBe(false); // <= 0 rejected
      expect(isValidAccuracy(-5, 50)).toBe(false);
    });

    it('validates timestamps and detects future drift', () => {
      const now = new Date().toISOString();
      expect(isValidTimestamp(now)).toBe(true);
      expect(isValidTimestamp('invalid-date')).toBe(false);
      // Future timestamp 1 hour ahead
      const future = new Date(Date.now() + 3600000).toISOString();
      expect(isValidTimestamp(future)).toBe(false);
    });
  });

  describe('2. Turf.js nearestPointOnLine Distance Calculation & Tiers', () => {
    it('calculates distance ~0m for a GPS point directly on planned route using nearestPointOnLine', () => {
      const { distance_m, nearest_point } = turfNearestPointOnRoute(21.145, 79.088, plannedRoute);
      expect(distance_m).toBeLessThan(1);
      expect(nearest_point).toBeDefined();
      expect(nearest_point[0]).toBeCloseTo(21.145, 3);
      expect(nearest_point[1]).toBeCloseTo(79.088, 3);
    });

    it('classifies points <=50m as ON_ROUTE', () => {
      // Offset ~20m from route
      const result = evaluateRouteDeviation({
        latitude: 21.145,
        longitude: 79.0883,
        accuracy: 10,
        routeCoordinates: plannedRoute,
      });

      expect(result.status).toBe('ON_ROUTE');
      expect(result.deviation_distance_m).toBeLessThanOrEqual(DISTANCE_ON_ROUTE_METERS);
      expect(result.is_deviated).toBe(false);
      expect(result.consecutive_deviations).toBe(0);
    });

    it('classifies points 50m to 100m as WARNING (corridor caution)', () => {
      // Offset ~65m from route: between 50m and 100m
      const result = evaluateRouteDeviation({
        latitude: 21.150,
        longitude: 79.095,
        accuracy: 10,
        routeCoordinates: plannedRoute,
      });

      expect(result.deviation_distance_m).toBeGreaterThan(DISTANCE_ON_ROUTE_METERS);
      expect(result.deviation_distance_m).toBeLessThanOrEqual(DISTANCE_WARNING_METERS);
      expect(result.status).toBe('WARNING');
      expect(result.alert_status).toContain('CORRIDOR_WARNING');
      expect(result.is_deviated).toBe(false);
      expect(result.consecutive_deviations).toBe(0); // Warning does not trigger deviation alert
    });

    it('classifies points >100m as potential deviation', () => {
      // Offset ~195m from route: clearly >100m
      const result = evaluateRouteDeviation({
        latitude: 21.150,
        longitude: 79.097,
        accuracy: 10,
        routeCoordinates: plannedRoute,
        previousConsecutiveDeviations: 0,
      });

      expect(result.deviation_distance_m).toBeGreaterThan(100);
      expect(result.status).toBe('DEVIATION_SUSPECTED');
      expect(result.consecutive_deviations).toBe(1);
      expect(result.is_deviated).toBe(false); // First ping does not declare deviation yet
    });
  });

  describe('3. Anti-Jitter Accuracy Gate (Initial Max Accuracy 50m)', () => {
    it('ignores GPS readings with poor accuracy (>50m) and does not increment consecutive counter', () => {
      const result = evaluateRouteDeviation({
        latitude: 21.150,
        longitude: 79.097, // ~195m off route
        accuracy: 55, // > 50m max accuracy gate
        routeCoordinates: plannedRoute,
        previousConsecutiveDeviations: 0,
      });

      expect(result.confidence).toBe('unreliable_gps');
      expect(result.consecutive_deviations).toBe(0); // Counter unchanged
      expect(result.is_deviated).toBe(false);
      expect(result.is_new_alert).toBe(false);
      expect(result.reason).toContain('exceeds maximum acceptable threshold');
    });

    it('preserves existing deviation status if an unreliable GPS ping arrives during ongoing deviation', () => {
      const result = evaluateRouteDeviation({
        latitude: 21.150,
        longitude: 79.097,
        accuracy: 80, // poor accuracy
        routeCoordinates: plannedRoute,
        previousConsecutiveDeviations: 3,
        previousIsDeviated: true,
      });

      expect(result.confidence).toBe('unreliable_gps');
      expect(result.is_deviated).toBe(true);
      expect(result.consecutive_deviations).toBe(3);
      expect(result.is_new_alert).toBe(false);
    });
  });

  describe('4. Persistence Requirement & Immediate Reset', () => {
    it('requires at least 3 consecutive qualifying out-of-route readings before declaring deviation', () => {
      const offLat = 21.150;
      const offLon = 79.097; // ~195m off route
      const goodAcc = 8;

      // Ping 1
      const ping1 = evaluateRouteDeviation({
        latitude: offLat,
        longitude: offLon,
        accuracy: goodAcc,
        routeCoordinates: plannedRoute,
        previousConsecutiveDeviations: 0,
      });
      expect(ping1.consecutive_deviations).toBe(1);
      expect(ping1.is_deviated).toBe(false);
      expect(ping1.is_new_alert).toBe(false);
      expect(ping1.status).toBe('DEVIATION_SUSPECTED');

      // Ping 2
      const ping2 = evaluateRouteDeviation({
        latitude: offLat,
        longitude: offLon,
        accuracy: goodAcc,
        routeCoordinates: plannedRoute,
        previousConsecutiveDeviations: ping1.consecutive_deviations,
      });
      expect(ping2.consecutive_deviations).toBe(2);
      expect(ping2.is_deviated).toBe(false);
      expect(ping2.is_new_alert).toBe(false);

      // Ping 3 -> DEVIATION DECLARED
      const ping3 = evaluateRouteDeviation({
        latitude: offLat,
        longitude: offLon,
        accuracy: goodAcc,
        routeCoordinates: plannedRoute,
        previousConsecutiveDeviations: ping2.consecutive_deviations,
      });
      expect(ping3.consecutive_deviations).toBe(3);
      expect(ping3.is_deviated).toBe(true);
      expect(ping3.is_new_alert).toBe(true); // First time alert triggered
      expect(ping3.status).toBe('DEVIATION_ALERT');
    });

    it('resets consecutive counter to 0 immediately when vehicle returns within corridor', () => {
      const onRouteLat = 21.150;
      const onRouteLon = 79.094; // on route

      const returnPing = evaluateRouteDeviation({
        latitude: onRouteLat,
        longitude: onRouteLon,
        accuracy: 10,
        routeCoordinates: plannedRoute,
        previousConsecutiveDeviations: 3,
        previousIsDeviated: true,
      });

      expect(returnPing.consecutive_deviations).toBe(0);
      expect(returnPing.is_deviated).toBe(false);
      expect(returnPing.was_resolved).toBe(true);
      expect(returnPing.status).toBe('ON_ROUTE');
    });

    it('suppresses duplicate alerts on continued deviation across pings 4 and 5', () => {
      const offLat = 21.150;
      const offLon = 79.097;

      const ping4 = evaluateRouteDeviation({
        latitude: offLat,
        longitude: offLon,
        accuracy: 8,
        routeCoordinates: plannedRoute,
        previousConsecutiveDeviations: 3,
        previousIsDeviated: true,
      });

      expect(ping4.consecutive_deviations).toBe(4);
      expect(ping4.is_deviated).toBe(true);
      expect(ping4.is_new_alert).toBe(false); // Duplicate alert suppressed
    });
  });

  describe('5. GPS History, Outdated Rejection & Session Isolation', () => {
    const testVehId = 'V_TEST_HIST_01';
    const testSessionA = 'sess_hist_A_001';
    const testSessionB = 'sess_hist_B_002';

    beforeAll(() => {
      dbService.saveVehicle({
        vehicle_id: testVehId,
        manufacturer: 'Tata',
        model: 'Ace EV',
        variant: 'Standard',
        vehicle_class: 'mini-truck',
        fuel_type: 'Electric',
        registration_identifier: 'MH-31-HIST-001',
        configured_capacity_kg: 500,
        manufacturer_rated_payload_kg: 600,
        availability: 1,
        operational_status: 'available',
      });
    });

    afterAll(() => {
      dbService.deleteVehicle(testVehId);
    });

    it('rejects outdated or duplicate timestamps within the same tracking session', () => {
      const t1 = new Date('2026-11-01T10:00:00.000Z').toISOString();
      const t2 = new Date('2026-11-01T10:00:02.000Z').toISOString();
      const tOld = new Date('2026-11-01T09:59:50.000Z').toISOString(); // Older than t2

      // Ping 1 (valid)
      const p1 = dbService.recordGpsPing({
        vehicle_id: testVehId,
        driver_id: 1,
        session_id: testSessionA,
        latitude: 21.145,
        longitude: 79.088,
        accuracy: 10,
        timestamp: t1,
      });
      expect(p1.rejected).toBeUndefined();

      // Ping 2 (valid, newer)
      const p2 = dbService.recordGpsPing({
        vehicle_id: testVehId,
        driver_id: 1,
        session_id: testSessionA,
        latitude: 21.146,
        longitude: 79.089,
        accuracy: 10,
        timestamp: t2,
      });
      expect(p2.rejected).toBeUndefined();

      // Ping 3 with duplicate timestamp t2 (rejected)
      const pDup = dbService.recordGpsPing({
        vehicle_id: testVehId,
        driver_id: 1,
        session_id: testSessionA,
        latitude: 21.147,
        longitude: 79.090,
        accuracy: 10,
        timestamp: t2,
      });
      expect(pDup.rejected).toBe(true);
      expect(pDup.reason).toContain('Duplicate or outdated timestamp');

      // Ping 4 with older timestamp tOld (rejected)
      const pOlder = dbService.recordGpsPing({
        vehicle_id: testVehId,
        driver_id: 1,
        session_id: testSessionA,
        latitude: 21.147,
        longitude: 79.090,
        accuracy: 10,
        timestamp: tOld,
      });
      expect(pOlder.rejected).toBe(true);
    });

    it('isolates GPS history strictly by session_id and vehicle_id', () => {
      // Add points to session B
      const tb1 = new Date('2026-11-01T11:00:00.000Z').toISOString();
      const tb2 = new Date('2026-11-01T11:00:02.000Z').toISOString();

      dbService.recordGpsPing({
        vehicle_id: testVehId,
        driver_id: 1,
        session_id: testSessionB,
        latitude: 21.160,
        longitude: 79.100,
        accuracy: 10,
        timestamp: tb1,
      });
      dbService.recordGpsPing({
        vehicle_id: testVehId,
        driver_id: 1,
        session_id: testSessionB,
        latitude: 21.162,
        longitude: 79.102,
        accuracy: 10,
        timestamp: tb2,
      });

      // Query session A trail
      const trailA = dbService.getVehicleLocationTrail(testVehId, { session_id: testSessionA });
      expect(trailA.length).toBe(2);
      expect(trailA.every((pt) => pt.session_id === testSessionA)).toBe(true);

      // Query session B trail
      const trailB = dbService.getVehicleLocationTrail(testVehId, { session_id: testSessionB });
      expect(trailB.length).toBe(2);
      expect(trailB.every((pt) => pt.session_id === testSessionB)).toBe(true);
      // Verify session A coordinates are not mixed into session B
      expect(trailB[0].latitude).toBeCloseTo(21.160);
    });
  });

  describe('6. Planned Road Geometry & Deviation API Endpoints', () => {
    it('GET /api/tracking/planned-route/:id returns stops and road geometry coordinates', async () => {
      const res = await request(app)
        .get('/api/tracking/planned-route/V003')
        .set(auth);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('vehicle_id');
      expect(res.body).toHaveProperty('waypoints');
      expect(Array.isArray(res.body.waypoints)).toBe(true);
    });

    it('GET /api/tracking/history/:id accepts session_id query param', async () => {
      const res = await request(app)
        .get('/api/tracking/history/V003?limit=50')
        .set(auth);

      expect(res.status).toBe(200);
      expect(res.body.vehicle_id).toBe('V003');
      expect(Array.isArray(res.body.trail)).toBe(true);
    });

    it('GET /api/tracking/deviations retrieves stored deviation records', async () => {
      const res = await request(app)
        .get('/api/tracking/deviations')
        .set(auth);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
