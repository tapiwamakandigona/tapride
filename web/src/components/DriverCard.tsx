/**
 * DriverCard — shows a nearby driver's info with vehicle details.
 */
import React from 'react';
import type { DriverLocation, Profile } from '@/types';
import { haversineKm } from '@/lib/geo';

interface Props {
  driver: DriverLocation;
  profile?: Profile;
  userLat: number;
  userLng: number;
}

/** Renders a card showing a nearby driver's distance and vehicle info. */
export const DriverCard: React.FC<Props> = ({ driver, profile, userLat, userLng }) => {
  const dist = haversineKm(userLat, userLng, driver.lat, driver.lng);

  return (
    <div className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm border border-gray-100">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-xl">
        🚗
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-800 truncate">
          {profile?.name ?? 'Driver'}
        </p>
        {profile?.vehicleType && (
          <p className="text-xs text-gray-500">{profile.vehicleType} · {profile.licensePlate}</p>
        )}
        {profile && (
          <p className="text-xs text-yellow-600">⭐ {profile.rating.toFixed(1)}</p>
        )}
      </div>
      <span className="text-sm font-medium text-brand-600">{dist.toFixed(1)} km</span>
    </div>
  );
};
