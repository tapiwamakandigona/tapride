import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { withTimeout } from '../lib/resilience';
import type { Ride, RideStatus, DriverLocation } from '../types';
import { haversineDistance } from '../lib/geo';
import { calculateFare } from '../lib/fare';
import type { RideType } from '../lib/fare';
import { distanceToPickup } from '../lib/matching';

// Select with joined rider/driver profiles
const RIDE_SELECT = '*, rider:profiles!rides_rider_id_fkey(*), driver:profiles!rides_driver_id_fkey(*)';
// Fallback without FK join (in case FK names differ)
const RIDE_SELECT_FALLBACK = '*';

export function useRide() {
  const { user, profile } = useAuth();
  const [currentRide, setCurrentRide] = useState<Ride | null>(null);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [initError, setInitError] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Fetch active ride for current user — with profile join
  const fetchActiveRide = useCallback(async () => {
    if (!user) {
      setInitializing(false);
      return;
    }
    try {
      setInitError(false);
      const activeStatuses: RideStatus[] = ['requested', 'accepted', 'in_progress'];
      const column = profile?.user_type === 'driver' ? 'driver_id' : 'rider_id';

      let data: Ride | null = null;
      const { data: joined, error: joinErr } = await withTimeout(
        supabase
          .from('rides')
          .select(RIDE_SELECT)
          .eq(column, user.id)
          .in('status', activeStatuses)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        5000,
      );

      if (joinErr) {
        const { data: fallback } = await withTimeout(
          supabase
            .from('rides')
            .select(RIDE_SELECT_FALLBACK)
            .eq(column, user.id)
            .in('status', activeStatuses)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          5000,
        );
        data = fallback as Ride | null;
      } else {
        data = joined as Ride | null;
      }

      if (mountedRef.current) setCurrentRide(data);
    } catch (err) {
      console.warn('[TapRide] fetchActiveRide error:', err);
      if (mountedRef.current) setInitError(true);
    } finally {
      if (mountedRef.current) setInitializing(false);
    }
  }, [user, profile?.user_type]);

  // Request a ride (rider)
  const requestRide = async (
    pickupLat: number,
    pickupLng: number,
    pickupAddress: string,
    destLat: number,
    destLng: number,
    destAddress: string,
    routeDistanceKm?: number,
    routeDurationMin?: number,
    rideType: RideType = 'economy',
  ) => {
    if (!user) throw new Error('Not authenticated');
    setLoading(true);

    const distanceKm = routeDistanceKm ?? haversineDistance(pickupLat, pickupLng, destLat, destLng);
    const durationMin = routeDurationMin ?? distanceKm * 2; // rough estimate if no OSRM
    const fareEstimate = calculateFare(distanceKm, durationMin, rideType);

    try {
      // Insert ONCE, then try to select with profile join
      const { data: inserted, error: insertErr } = await supabase
        .from('rides')
        .insert({
          rider_id: user.id,
          pickup_lat: pickupLat,
          pickup_lng: pickupLng,
          pickup_address: pickupAddress,
          destination_lat: destLat,
          destination_lng: destLng,
          destination_address: destAddress,
          status: 'requested' as RideStatus,
          fare_estimate: fareEstimate,
          distance_km: Math.round(distanceKm * 10) / 10,
          ride_type: rideType,
        })
        .select('*')
        .single();

      if (insertErr) throw new Error(insertErr.message);
      if (!inserted) throw new Error('Failed to create ride');

      // Now try to re-fetch with profile join for richer data
      const { data: withProfiles } = await supabase
        .from('rides')
        .select(RIDE_SELECT)
        .eq('id', inserted.id)
        .single();

      const ride = (withProfiles || inserted) as Ride;
      if (mountedRef.current) setCurrentRide(ride);
      return ride;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  // Accept a ride (driver)
  const acceptRide = async (rideId: string) => {
    if (!user) throw new Error('Not authenticated');
    setLoading(true);

    try {
      // Update ONCE with the status guard, plain select
      const { data: updated, error: updateErr } = await supabase
        .from('rides')
        .update({
          driver_id: user.id,
          status: 'accepted' as RideStatus,
          accepted_at: new Date().toISOString(),
        })
        .eq('id', rideId)
        .eq('status', 'requested')
        .select('*')
        .single();

      if (updateErr) {
        if (updateErr.code === 'PGRST116') {
          throw new Error('This ride was already accepted by another driver');
        }
        throw new Error(updateErr.message);
      }
      if (!updated) throw new Error('This ride was already accepted by another driver');

      // Re-fetch with profile join for richer data
      const { data: withProfiles } = await supabase
        .from('rides')
        .select(RIDE_SELECT)
        .eq('id', rideId)
        .single();

      const ride = (withProfiles || updated) as Ride;
      if (mountedRef.current) setCurrentRide(ride);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  // Start ride (driver picked up rider)
  const startRide = async (rideId: string) => {
    const { error } = await supabase
      .from('rides')
      .update({ status: 'in_progress' as RideStatus, started_at: new Date().toISOString() })
      .eq('id', rideId);
    if (error) throw new Error(error.message);
    await fetchActiveRide();
  };

  // Complete ride — returns the completed ride data for the rating page
  const completeRide = async (rideId: string): Promise<Ride | null> => {
    const { error } = await supabase
      .from('rides')
      .update({
        status: 'completed' as RideStatus,
        completed_at: new Date().toISOString(),
        fare_final: Number(currentRide?.fare_estimate) || 0,
      })
      .eq('id', rideId);
    if (error) throw new Error(error.message);

    const completedRide = currentRide ? { ...currentRide, status: 'completed' as RideStatus } : null;
    if (mountedRef.current) setCurrentRide(null);
    return completedRide;
  };

  // Cancel ride — with fee logic
  const cancelRide = async (rideId: string) => {
    if (!user) throw new Error('Not authenticated');

    // Check if cancellation fee applies
    let fee = 0;
    if (currentRide) {
      const createdAt = new Date(currentRide.created_at).getTime();
      const now = Date.now();
      const twoMinMs = 2 * 60 * 1000;
      const isAccepted = currentRide.status === 'accepted' || currentRide.status === 'in_progress';

      if (now - createdAt > twoMinMs || isAccepted) {
        fee = 1.0; // $1 cancellation fee
      }
    }

    const { error } = await supabase
      .from('rides')
      .update({ status: 'cancelled' as RideStatus })
      .eq('id', rideId);
    if (error) throw new Error(error.message);

    // Apply fee and increment cancellation count
    if (fee > 0 && profile) {
      await supabase
        .from('profiles')
        .update({
          cancellation_count: (profile.cancellation_count ?? 0) + 1,
          cancellation_fee_balance: (profile.cancellation_fee_balance ?? 0) + fee,
        })
        .eq('id', user.id);
    }

    if (mountedRef.current) setCurrentRide(null);
    return { fee };
  };

  // Check if user has excessive cancellations in last 24h
  const checkCancellationWarning = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    const { data } = await supabase
      .from('profiles')
      .select('cancellation_count')
      .eq('id', user.id)
      .single();
    return (data?.cancellation_count ?? 0) >= 5;
  }, [user]);

  // Clear current ride from state
  const clearCurrentRide = () => {
    setCurrentRide(null);
  };

  // Update driver location
  const updateDriverLocation = useCallback(async (lat: number, lng: number, heading?: number | null, speed?: number | null) => {
    if (!user) return;
    await supabase.from('driver_locations').upsert({
      driver_id: user.id,
      lat,
      lng,
      heading: heading ?? 0,
      speed: speed ?? 0,
      updated_at: new Date().toISOString(),
    });
  }, [user]);

  // Subscribe to ride updates (returns unsubscribe function)
  const subscribeToRide = useCallback((rideId: string) => {
    const channel = supabase
      .channel(`ride-${rideId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rides',
        filter: `id=eq.${rideId}`,
      }, (payload) => {
        const updated = payload.new as Ride;
        if (updated.status === 'cancelled' || updated.status === 'completed') {
          // Ride ended — clear state (the useEffect in ActiveRide handles navigation)
          if (mountedRef.current) setCurrentRide(updated);
        } else {
          // Merge the update into current ride, preserving joined profile data
          if (mountedRef.current) {
            setCurrentRide((prev) => prev ? { ...prev, ...updated, rider: prev.rider, driver: prev.driver } : updated);
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Subscribe to driver location (returns unsubscribe function)
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

  // Fetch nearby ride requests (driver) — joins rider profile, adds distance
  const fetchNearbyRequests = useCallback(async (driverLat?: number, driverLng?: number): Promise<Ride[]> => {
    const { data, error } = await supabase
      .from('rides')
      .select(RIDE_SELECT)
      .eq('status', 'requested')
      .is('driver_id', null)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      // Fallback without join if FK reference doesn't work
      const { data: fallbackData } = await supabase
        .from('rides')
        .select('*')
        .eq('status', 'requested')
        .is('driver_id', null)
        .order('created_at', { ascending: false })
        .limit(20);
      return (fallbackData as Ride[]) || [];
    }

    return (data as Ride[]) || [];
  }, []);

  // No changes needed below — distance is computed in RideRequestCard via props

  // Auto-subscribe to ride updates when there's an active ride
  useEffect(() => {
    if (!currentRide?.id) return;
    const unsub = subscribeToRide(currentRide.id);
    return () => { unsub(); };
  }, [currentRide?.id, subscribeToRide]);

  // Auto-subscribe to driver location when rider has active ride
  useEffect(() => {
    if (!currentRide?.driver_id || profile?.user_type !== 'rider') return;
    const unsub = subscribeToDriverLocation(currentRide.driver_id);
    return () => { unsub(); };
  }, [currentRide?.driver_id, profile?.user_type, subscribeToDriverLocation]);

  // Fetch active ride on mount
  useEffect(() => {
    fetchActiveRide();
  }, [fetchActiveRide]);

  return {
    currentRide,
    driverLocation,
    loading,
    initializing,
    initError,
    requestRide,
    acceptRide,
    startRide,
    completeRide,
    cancelRide,
    clearCurrentRide,
    updateDriverLocation,
    fetchNearbyRequests,
    fetchActiveRide,
    subscribeToRide,
    subscribeToDriverLocation,
    checkCancellationWarning,
  };
}
