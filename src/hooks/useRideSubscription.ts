import { useCallback, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Ride } from '../types';

// [INTENT] Isolated realtime subscription for ride row updates
// [CONSTRAINT] onUpdate callback must be stable (useCallback) to avoid subscription churn
// [EDGE-CASE] Supabase channel may receive updates after component unmounts — mountedRef guards setState

export function useRideSubscription(onUpdate: (ride: Ride) => void) {
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // [INTENT] Subscribe to postgres_changes for a specific ride row
  // [CONSTRAINT] Returns cleanup function that removes the channel — must be called on effect teardown
  const subscribeToRide = useCallback((rideId: string) => {
    const channel = supabase
      .channel(`ride-${rideId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rides',
        filter: `id=eq.${rideId}`,
      }, (payload) => {
        if (mountedRef.current) {
          onUpdate(payload.new as Ride);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [onUpdate]);

  return { subscribeToRide };
}
