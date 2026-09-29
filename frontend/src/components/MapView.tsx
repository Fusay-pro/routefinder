import { useEffect } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { LatLng, ParkingLotSummary } from '../api/types';

// Thammasat Rangsit, matching CAMPUS_BOUNDS in the backend's services/campus.ts.
export const CAMPUS_CENTER: LatLng = { lat: 14.0727593, lng: 100.6051706 };

const pinIcon = (color: string) =>
  L.divIcon({
    className: '',
    html: `<span style="display:block;width:20px;height:20px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 2px 6px rgba(19,27,46,.4)"></span>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

const parkingIcon = (lot: ParkingLotSummary) => {
  // A lot nobody is reporting on must not look like a lot that is simply full.
  const known = lot.freeSpots + lot.occupiedSpots;
  const border = known === 0 ? '#98a5a0' : lot.freeSpots > 0 ? '#10b981' : '#ba1a1a';
  const dash = known === 0 ? 'border-style:dashed;' : '';
  return L.divIcon({
    className: '',
    html: `<span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;background:#fff;border:2px solid ${border};${dash}font:700 13px Inter,sans-serif;color:${border}">P</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
};

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length < 2) return;
    map.fitBounds(
      points.map((p) => [p.lat, p.lng] as [number, number]),
      { padding: [60, 60], maxZoom: 17 }
    );
  }, [map, points]);
  return null;
}

interface MapViewProps {
  route?: LatLng[];
  travelled?: LatLng[];
  origin?: LatLng | null;
  destination?: LatLng | null;
  current?: LatLng | null;
  lots?: ParkingLotSummary[];
  className?: string;
}

export function MapView({
  route = [],
  travelled = [],
  origin,
  destination,
  current,
  lots = [],
  className = '',
}: MapViewProps) {
  const toTuple = (p: LatLng) => [p.lat, p.lng] as [number, number];

  return (
    <MapContainer
      center={toTuple(origin ?? CAMPUS_CENTER)}
      zoom={16}
      zoomControl={false}
      attributionControl={false}
      className={className}
    >
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />

      {route.length > 1 && (
        <Polyline positions={route.map(toTuple)} pathOptions={{ color: '#ffffff', weight: 11 }} />
      )}
      {route.length > 1 && (
        <Polyline
          positions={route.map(toTuple)}
          pathOptions={{ color: travelled.length > 1 ? '#c3ccd4' : '#10b981', weight: 6, dashArray: travelled.length > 1 ? '9 7' : undefined }}
        />
      )}
      {travelled.length > 1 && (
        <Polyline positions={travelled.map(toTuple)} pathOptions={{ color: '#10b981', weight: 7 }} />
      )}

      {lots.map((lot) => (
        <Marker key={lot.id} position={[lot.lat, lot.lng]} icon={parkingIcon(lot)} />
      ))}

      {origin && <Marker position={toTuple(origin)} icon={pinIcon('#4b41e1')} />}
      {destination && <Marker position={toTuple(destination)} icon={pinIcon('#006c49')} />}
      {current && <Marker position={toTuple(current)} icon={pinIcon('#10b981')} />}

      <FitBounds points={route.length > 1 ? route : lots.map((l) => ({ lat: l.lat, lng: l.lng }))} />
    </MapContainer>
  );
}
