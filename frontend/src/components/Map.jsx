/* Geometry status is asynchronous UI state managed by the request lifecycle. */
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { getRouteGeometries } from '../services/api';
import 'leaflet/dist/leaflet.css';

const colors = ['#22d3ee', '#f59e0b', '#a78bfa', '#34d399', '#fb7185', '#60a5fa'];
const depot = { delivery_id: 'DEPOT', latitude: 21.145, longitude: 79.088, location: 'PathWise synthetic Nagpur depot' };

export default function Map({ deliveries = [], routes = [], vehicles = [], height = '420px' }) {
  const validDeliveries = deliveries.filter((delivery) => Number.isFinite(Number(delivery.latitude)) && Number.isFinite(Number(delivery.longitude)));
  const invalidCount = deliveries.length - validDeliveries.length;
  const deliveryById = useMemo(() => new globalThis.Map(validDeliveries.map((delivery) => [String(delivery.delivery_id), delivery])), [validDeliveries]);
  const vehicleById = useMemo(() => new globalThis.Map(vehicles.map((vehicle) => [String(vehicle.vehicle_id), vehicle])), [vehicles]);
  const routeRequests = useMemo(() => routes.map((route) => ({
    vehicle_id: route.vehicle_id,
    coordinates: (route.route || []).map((stop) => stop === 'DEPOT' ? depot : deliveryById.get(String(stop))).filter(Boolean).map((point) => [Number(point.latitude), Number(point.longitude)]),
  })).filter((route) => route.coordinates.length >= 2), [routes, deliveryById]);
  const routeKey = JSON.stringify(routeRequests);
  const [geometry, setGeometry] = useState({});
  const [geometryStatus, setGeometryStatus] = useState('');

  useEffect(() => {
    if (!routeRequests.length) return undefined;
    let cancelled = false;
    setGeometryStatus('Loading road geometry…');
    getRouteGeometries(routeRequests).then(({ geometries }) => {
      if (cancelled) return;
      setGeometry(Object.fromEntries((geometries || []).map((item) => [item.vehicle_id, item])));
      setGeometryStatus((geometries || []).some((item) => item.source === 'straight_line') ? 'Road geometry unavailable for one or more routes; straight-line fallback shown.' : 'Road-following visual geometry from OSRM.');
    }).catch(() => {
      if (!cancelled) { setGeometry({}); setGeometryStatus('Road geometry unavailable; straight-line route sequence shown.'); }
    });
    return () => { cancelled = true; };
  // routeKey deliberately represents the serialised coordinate request.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  const stopDetails = new globalThis.Map();
  routes.forEach((route, routeIndex) => (route.route || []).filter((stop) => stop !== 'DEPOT').forEach((stop, stopIndex) => stopDetails.set(String(stop), { vehicleId: route.vehicle_id, stopNumber: stopIndex + 1, color: colors[routeIndex % colors.length] })));
  if (!validDeliveries.length) return <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm text-gray-400">No valid coordinates were persisted for this view. An older run cannot be mapped without its saved delivery coordinates.</div>;

  return <div className="relative overflow-hidden rounded-2xl border border-white/10" style={{ height }}>
    <MapContainer center={[depot.latitude, depot.longitude]} zoom={11} className="h-full w-full">
      <TileLayer attribution="© OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker position={[depot.latitude, depot.longitude]}><Popup><b>Depot</b><br />{depot.location}</Popup></Marker>
      {validDeliveries.map((delivery) => { const sequence = stopDetails.get(String(delivery.delivery_id)); return <Marker key={delivery.delivery_id} position={[Number(delivery.latitude), Number(delivery.longitude)]}><Popup><b>{delivery.delivery_id}</b>{sequence && <><br />Route {sequence.vehicleId}, stop {sequence.stopNumber}</>}<br />{delivery.zone || delivery.location}<br />{delivery.weight} kg · {delivery.priority || 'Unspecified'} priority</Popup></Marker>; })}
      {routes.map((route, routeIndex) => {
        const fallback = routeRequests.find((item) => item.vehicle_id === route.vehicle_id)?.coordinates || [];
        const routeGeometry = geometry[route.vehicle_id];
        const points = routeGeometry?.coordinates || fallback;
        const vehicle = vehicleById.get(String(route.vehicle_id));
        return points.length >= 2 ? <Polyline key={route.vehicle_id || routeIndex} positions={points} pathOptions={{ color: colors[routeIndex % colors.length], weight: 4 }}><Popup><b>{route.vehicle_id}</b><br />{vehicle ? `${vehicle.manufacturer || ''} ${vehicle.model || ''} ${vehicle.variant || ''} · ${vehicle.vehicle_class || ''}` : 'Vehicle metadata unavailable'}<br />{(route.route || []).filter((stop) => stop !== 'DEPOT').length} ordered stops; {routeGeometry?.source === 'osrm' ? 'road-following visual geometry only.' : 'straight-line links, not road paths.'}</Popup></Polyline> : null;
      })}
    </MapContainer>
    <div className="absolute z-[1000] m-2 max-w-xs rounded bg-slate-950/85 px-3 py-2 text-xs text-white"><div>● Depot · {geometryStatus || 'Visualized stop sequence'}</div>{routes.map((route, index) => <div key={route.vehicle_id} style={{ color: colors[index % colors.length] }}>━ {route.vehicle_id}</div>)}{invalidCount > 0 && <div className="mt-1 text-amber-200">{invalidCount} record(s) excluded: invalid coordinates.</div>}</div>
  </div>;
}
