import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Ride, RideStatus, DriverLocation } from '../types';
import { haversineDistance } from '../lib/geo';
import { calculateFare } from '../lib/fare';

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
      const activeStatuses: RideStatus[] = ['requested', 'accepted', 'in_progress'];

      // For drivers, check driver_id. For riders, check rider_id.
      const column = profile?.user_type === 'driver' ? 'driver_id' : 'rider_id';

      // Try with profile join first
      let data: Ride | null = null;
      const { data: joined, error: joinErr } = await supabase
        .from('rides')
        .select(RIDE_SELECT)
        .eq(column, user.id)
        .in('status', activeStatuses)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (joinErr) {
        // Fallback without join
        const { data: fallback } = await supabase
          .from('rides')
          .select(RIDE_SELECT_FALLBACK)
          .eq(column, user.id)
          .in('status', activeStatuses)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        data = fallback as Ride | null;
      } else {
        data = joined as Ride | null;
      }

      if (mountedRef.current) setCurrentRide(data);
    } catch (err) {
      console.warn('[TapRide] fetchActiveRide error:', err);
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
    routeDistanceKm?: number
  ) => {
    if (!user) throw new Error('Not authenticated');
    setLoading(true);

    const distanceKm = routeDistanceKm ?? haversineDistance(pickupLat, pickupLng, destLat, destLng);
    const fareEstimate = calculateFare(distanceKm);

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

  // Cancel ride
  const cancelRide = async (rideId: string) => {
    const { error } = await supabase
      .from('rides')
      .update({ status: 'cancelled' as RideStatus })
      .eq('id', rideId);
    if (error) throw new Error(error.message);
    if (mountedRef.current) setCurrentRide(null);
  };

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

  // Fetch nearby ride requests (driver) — joins rider profile
  const fetchNearbyRequests = useCallback(async (): Promise<Ride[]> => {
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
  };
}
