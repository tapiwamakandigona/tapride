import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { DriverLocation } from '../types';

/**
 * Hook for subscribing to and updating driver location.
 * Extracted from useRide for separation of concerns.
 */
export function useDriverLocation(userId: string | undefined) {
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const updateDriverLocation = useCallback(async (
    lat: number, lng: number, heading?: number | null, speed?: number | null
  ) => {
    if (!userId) return;
    const { error } = await supabase.from('driver_locations').upsert({
      driver_id: userId,
      lat,
      lng,
      heading: heading ?? 0,
      speed: speed ?? 0,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.warn('[TapRide] updateDriverLocation error:', error.message);
    }
  }, [userId]);

  const subscribeToDriverLocation = useCallback((driverId: string) => {
    // Fetch initial location
    supabase
      .from('driver_locations')
      .select('*')
      .eq('driver_id', driverId)
      .single()
      .then(({ data }) => { if (data && mountedRef.current) setDriverLocation(data); });

    const channel = supabase
      .channel(`driver-loc-${driverId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'driver_locations',
        filter: `driver_id=eq.${driverId}`,
      }, (payload) => {
        if (mountedRef.current) setDriverLocation(payload.new as DriverLocation);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return { driverLocation, updateDriverLocation, subscribeToDriverLocation };
}
