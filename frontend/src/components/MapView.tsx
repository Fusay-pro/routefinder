import { useEffect } from 'react';
import { Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import type { LatLng } from '../api/types';

// Thammasat Rangsit, matching CAMPUS_BOUNDS in the backend's services/campus.ts.
export const CAMPUS_CENTER: LatLng = { lat: 14.0727593, lng: 100.6051706 };

// Advanced markers need a map id. Google publishes DEMO_MAP_ID for development;
// set a real one once the map has styling worth keeping.
const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ?? 'DEMO_MAP_ID';

function Pin({ color }: { color: string }) {
  return (
    <span
      className="block h-5 w-5 rounded-full border-[3px] border-white"
      style={{ background: color, boxShadow: '0 2px 6px rgba(19,27,46,.4)' }}
    />
  );
}

interface LineProps {
  path: LatLng[];
  color: string;
  weight: number;
  dashed?: boolean;
  zIndex: number;
}

// google.maps.Polyline is imperative, so it's wrapped rather than rendered.
// Re-created whenever the path changes, which is fine at route length.
function Line({ path, color, weight, dashed, zIndex }: LineProps) {
  const map = useMap();

  useEffect(() => {
    if (!map || path.length < 2) return;

    const line = new google.maps.Polyline({
      path,
      zIndex,
      strokeColor: color,
      strokeWeight: dashed ? 0 : weight,
      // A dashed line in Maps is a repeated symbol along an invisible stroke.
      strokeOpacity: dashed ? 0 : 1,
      icons: dashed
        ? [
            {
              icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeWeight: weight, scale: 1 },
              offset: '0',
              repeat: '14px',
            },
          ]
        : undefined,
    });
    line.setMap(map);
    return () => line.setMap(null);
  }, [map, path, color, weight, dashed, zIndex]);

  return null;
}

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || points.length < 2) return;
    const bounds = new google.maps.LatLngBounds();
    points.forEach((point) => bounds.extend(point));
    map.fitBounds(bounds, 60);
  }, [map, points]);

  return null;
}

interface MapViewProps {
  route?: LatLng[];
  travelled?: LatLng[];
  origin?: LatLng | null;
  destination?: LatLng | null;
  current?: LatLng | null;
  className?: string;
}

export function MapView({
  route = [],
  travelled = [],
  origin,
  destination,
  current,
  className = '',
}: MapViewProps) {
  const inProgress = travelled.length > 1;

  return (
    <Map
      className={className}
      mapId={MAP_ID}
      defaultCenter={origin ?? CAMPUS_CENTER}
      defaultZoom={16}
      disableDefaultUI
      gestureHandling="greedy"
      clickableIcons={false}
    >
      {/* White casing under the route, so it reads against any basemap. */}
      <Line path={route} color="#ffffff" weight={11} zIndex={1} />
      {/* Once a trip is under way the planned route greys out behind the track. */}
      <Line
        path={route}
        color={inProgress ? '#c3ccd4' : '#10b981'}
        weight={6}
        dashed={inProgress}
        zIndex={2}
      />
      <Line path={travelled} color="#10b981" weight={7} zIndex={3} />

      {origin && (
        <AdvancedMarker position={origin}>
          <Pin color="#4b41e1" />
        </AdvancedMarker>
      )}
      {destination && (
        <AdvancedMarker position={destination}>
          <Pin color="#006c49" />
        </AdvancedMarker>
      )}
      {current && (
        <AdvancedMarker position={current}>
          <Pin color="#10b981" />
        </AdvancedMarker>
      )}

      <FitBounds points={route} />
    </Map>
  );
}
