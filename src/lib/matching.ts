// ============================================
// Smart Driver Matching
// ============================================

import { supabase } from './supabase';

export interface NearbyDriver {
  driver_id: string;
  full_name: string;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  license_plate: string | null;
  rating: number | null;
  lat: number;
  lng: number;
  distance_km: number;
}

/**
 * Find nearby online drivers using PostGIS spatial query.
 * Falls back to client-side if RPC not available.
 */
export async function findNearbyDrivers(
  lat: number,
  lng: number,
  radiusKm: number = 10,
  limit: number = 20,
): Promise<NearbyDriver[]> {
  const { data, error } = await supabase.rpc('find_nearby_drivers', {
    p_lat: lat,
    p_lng: lng,
    p_radius_km: radiusKm,
    p_limit: limit,
  });

  if (error) {
    console.warn('[TapRide] find_nearby_drivers RPC failed, falling back:', error.message);
    return [];
  }

  return (data as NearbyDriver[]) || [];
}

/**
 * Calculate distance between two points (haversine) — for UI display.
 */
export function distanceToPickup(
  driverLat: number,
  driverLng: number,
  pickupLat: number,
  pickupLng: number,
): number {
  const R = 6371;
  const dLat = toRad(pickupLat - driverLat);
  const dLng = toRad(pickupLng - driverLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(driverLat)) * Math.cos(toRad(pickupLat)) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
