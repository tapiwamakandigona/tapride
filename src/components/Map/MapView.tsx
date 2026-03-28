import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { LocationCoords } from '../../types';

// Fix default marker icons
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
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

L.Marker.prototype.options.icon = defaultIcon;

interface MapViewProps {
  center?: [number, number];
  userPosition?: LocationCoords;
  pickupPosition?: LocationCoords;
  destinationPosition?: LocationCoords;
  driverPosition?: LocationCoords;
  onMapClick?: (lat: number, lng: number) => void;
  className?: string;
}

function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();
  const hasCentered = useRef(false);
  useEffect(() => {
    if (!hasCentered.current) {
      map.setView(center, 14);
      hasCentered.current = true;
    }
  }, [center, map]);
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

export default function MapView({
  center,
  userPosition,
  pickupPosition,
  destinationPosition,
  driverPosition,
  onMapClick,
  className = '',
}: MapViewProps) {
  const defaultCenter: [number, number] = center
    || (userPosition ? [userPosition.lat, userPosition.lng] : [-20.1325, 28.6265]); // Bulawayo default

  return (
    <div className={`relative ${className}`} style={{ height: '100%', minHeight: '300px' }}>
      <MapContainer
        center={defaultCenter}
        zoom={14}
        className="h-full w-full rounded-lg"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {center && <RecenterMap center={center} />}

        {onMapClick && <MapClickHandler onClick={onMapClick} />}

        {userPosition && (
          <Marker position={[userPosition.lat, userPosition.lng]} icon={defaultIcon}>
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
