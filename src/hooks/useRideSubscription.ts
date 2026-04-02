import { useCallback, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Ride } from '../types';

/**
 * Hook for realtime ride subscription.
 * Extracted from useRide for separation of concerns.
 */
export function useRideSubscription(
  onUpdate: (ride: Ride) => void,
) {
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

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
