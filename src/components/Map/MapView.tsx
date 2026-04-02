import { useState, useCallback, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { LocationCoords } from '../../types';

// Default center: Bulawayo, Zimbabwe
const DEFAULT_CENTER: [number, number] = [-20.1325, 28.6265];

// All markers use DivIcon — no CDN dependency
const userIcon = L.divIcon({
  html: '<div style="background:#6366f1;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  className: '',
});

const pickupIcon = L.divIcon({
  html: '<div style="background:#22c55e;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  className: '',
});

const destinationIcon = L.divIcon({
  html: '<div style="background:#ef4444;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  className: '',
});

const driverIcon = L.divIcon({
  html: '<div style="background:#3b82f6;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  className: '',
});

// Set default icon to avoid broken image
L.Marker.prototype.options.icon = userIcon;

interface MapViewProps {
  center?: [number, number];
  userPosition?: LocationCoords;
  pickupPosition?: LocationCoords;
  destinationPosition?: LocationCoords;
  driverPosition?: LocationCoords;
  routeCoords?: [number, number][];
  onMapClick?: (lat: number, lng: number) => void;
  className?: string;
}

function RecenterMap({ center, auto }: { center: [number, number]; auto?: boolean }) {
  const map = useMap();
  const hasCentered = useRef(false);
  useEffect(() => {
    if (auto || !hasCentered.current) {
      map.setView(center, map.getZoom() || 14, { animate: true });
      hasCentered.current = true;
    }
  }, [center, map, auto]);
  return null;
}

function FitBounds({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  const lastCoordsKey = useRef('');
  useEffect(() => {
    if (coords.length < 2) return;
    // Create a key from first and last coords to detect route changes
    const key = `${coords[0][0]},${coords[0][1]}-${coords[coords.length - 1][0]},${coords[coords.length - 1][1]}`;
    if (key === lastCoordsKey.current) return;
    lastCoordsKey.current = key;
    const bounds = L.latLngBounds(coords.map(c => L.latLng(c[0], c[1])));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  }, [coords, map]);
  return null;
}

function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function RecenterButton() {
  const map = useMap();
  const handleRecenter = useCallback(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.setView([pos.coords.latitude, pos.coords.longitude], 15, { animate: true });
      },
      () => {
        // Ignore errors silently
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }, [map]);

  return (
    <div className="leaflet-bottom leaflet-right" style={{ marginBottom: '10px', marginRight: '10px' }}>
      <div className="leaflet-control">
        <button
          type="button"
          onClick={handleRecenter}
          title="Re-center to my location"
          style={{
            width: '36px',
            height: '36px',
            backgroundColor: 'white',
            border: '2px solid rgba(0,0,0,0.2)',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 1px 5px rgba(0,0,0,0.15)',
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function MapView({
  center,
  userPosition,
  pickupPosition,
  destinationPosition,
  driverPosition,
  routeCoords,
  onMapClick,
  className = '',
}: MapViewProps) {
  const defaultCenter: [number, number] = center
    || (userPosition ? [userPosition.lat, userPosition.lng] : DEFAULT_CENTER);

  const [recenterTrigger] = useState(false);

  // Auto-fit bounds when route is provided
  const shouldFitRoute = routeCoords && routeCoords.length >= 2;

  return (
    <div className={`relative ${className}`} style={{ height: '100%', minHeight: '300px' }}>
      <MapContainer
        center={defaultCenter}
        zoom={14}
        className="h-full w-full rounded-lg"
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Recenter logic */}
        {center && <RecenterMap center={center} auto={recenterTrigger} />}

        {/* Fit route bounds */}
        {shouldFitRoute && <FitBounds coords={routeCoords!} />}

        {onMapClick && <MapClickHandler onClick={onMapClick} />}

        {/* Re-center button */}
        <RecenterButton />

        {/* Route polyline */}
        {routeCoords && routeCoords.length >= 2 && (
          <Polyline
            positions={routeCoords}
            pathOptions={{ color: '#6366f1', weight: 4, opacity: 0.8 }}
          />
        )}

        {userPosition && (
          <Marker position={[userPosition.lat, userPosition.lng]} icon={userIcon}>
            <Popup>You are here</Popup>
          </Marker>
        )}

        {pickupPosition && (
          <Marker position={[pickupPosition.lat, pickupPosition.lng]} icon={pickupIcon}>
            <Popup>Pickup location</Popup>
          </Marker>
        )}

        {destinationPosition && (
          <Marker position={[destinationPosition.lat, destinationPosition.lng]} icon={destinationIcon}>
            <Popup>Destination</Popup>
          </Marker>
        )}

        {driverPosition && (
          <Marker position={[driverPosition.lat, driverPosition.lng]} icon={driverIcon}>
            <Popup>Driver</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
