import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { DriverLocation } from '../types';

// [INTENT] Isolated driver location state — subscribe to realtime updates + push location to server
// [CONSTRAINT] Extracted from useRide to keep ride CRUD separate from location tracking
// [EDGE-CASE] userId may be undefined if user logs out — all operations must guard against it

export function useDriverLocation(userId: string | undefined) {
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // [INTENT] Push current driver GPS to server for rider-side tracking
  // [EDGE-CASE] Upsert may fail if driver_locations table has RLS restrictions — log but don't throw
  const updateDriverLocation = useCallback(async (
    lat: number, lng: number, heading?: number | null, speed?: number | null,
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

  // [INTENT] Subscribe to realtime location changes for a specific driver
  // [CONSTRAINT] Returns cleanup function — caller (useEffect) must invoke on teardown
  // [EDGE-CASE] Initial fetch may return null if driver hasn't shared location yet
  const subscribeToDriverLocation = useCallback((driverId: string) => {
    // [INTENT] Seed state with current location before subscription delivers first event
    // [CONSTRAINT] Supabase query returns PromiseLike (not full Promise), so .catch() is unavailable.
    //   Wrap in async IIFE with try/catch to handle both query errors and thrown exceptions.
    (async () => {
      try {
        const { data, error } = await supabase
          .from('driver_locations')
          .select('*')
          .eq('driver_id', driverId)
          .single();
        if (error) {
          console.warn('[TapRide] Initial driver location fetch failed:', error.message);
        }
        if (data && mountedRef.current) setDriverLocation(data);
      } catch (err) {
        // [EDGE-CASE] Unhandled promise rejection if supabase client throws
        console.warn('[TapRide] Driver location fetch exception:', err);
      }
    })();

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
