import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Ride, RideStatus } from '../types';
import { haversineDistance } from '../lib/geo';
import { calculateFare } from '../lib/fare';
import { useDriverLocation } from './useDriverLocation';
import { useRideSubscription } from './useRideSubscription';

// [INTENT] Supabase select strings — primary includes profile joins for UI display
// [EDGE-CASE] FK join names may not match if migrations differ — fallback strips joins
const RIDE_SELECT = '*, rider:profiles!rides_rider_id_fkey(*), driver:profiles!rides_driver_id_fkey(*)';
const RIDE_SELECT_FALLBACK = '*';

// [INTENT] Try profile-joined query first, fall back to plain select on FK mismatch
// [EDGE-CASE] Fallback query may also fail — caller must handle null/empty results
async function queryRideWithFallback(
  query: () => PromiseLike<{ data: any; error: any }>,
  fallbackQuery: () => PromiseLike<{ data: any; error: any }>,
) {
  const { data, error } = await query();
  if (error) {
    console.warn('[TapRide] Primary ride query failed, trying fallback:', error.message);
    const { data: fb, error: fbErr } = await fallbackQuery();
    if (fbErr) console.warn('[TapRide] Fallback query also failed:', fbErr.message);
    return fb;
  }
  return data;
}

// [INTENT] Core ride lifecycle hook — CRUD operations + realtime sync for the active ride
// [CONSTRAINT] Only one ride can be active per user at a time (enforced by status filter)
// [CONSTRAINT] All state mutations check mountedRef to prevent setState-after-unmount
export function useRide() {
  const { user, profile } = useAuth();
  const [currentRide, setCurrentRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const mountedRef = useRef(true);

  // [INTENT] Ref mirrors currentRide state to avoid stale closures in async callbacks
  // [EDGE-CASE] completeRide reads fare_estimate — without ref it captures stale value from render
  const currentRideRef = useRef<Ride | null>(null);
  useEffect(() => { currentRideRef.current = currentRide; }, [currentRide]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const { driverLocation, updateDriverLocation, subscribeToDriverLocation } =
    useDriverLocation(user?.id);

  // [INTENT] Re-fetch a ride with full profile joins when realtime payload lacks FK data
  // [CONSTRAINT] Only called after realtime updates that may have changed driver/rider assignment
  // [EDGE-CASE] Query may fail if ride was just deleted — silently ignored
  const refetchRideWithProfiles = useCallback(async (rideId: string) => {
    try {
      const data = await queryRideWithFallback(
        () => supabase.from('rides').select(RIDE_SELECT).eq('id', rideId).single(),
        () => supabase.from('rides').select(RIDE_SELECT_FALLBACK).eq('id', rideId).single(),
      );
      if (data && mountedRef.current) {
        setCurrentRide(data as Ride);
      }
    } catch (err) {
      console.warn('[TapRide] refetchRideWithProfiles error:', err);
    }
  }, []);

  // [INTENT] Handle realtime ride updates — merge into state, preserving joined profile data
  // [EDGE-CASE] Completed/cancelled rides still update state so the UI can show final status before clearing
  // [EDGE-CASE] Supabase realtime payloads do NOT include FK joins — when status changes to
  //   'accepted' or 'in_progress', we must refetch to get rider/driver profile data
  const handleRideUpdate = useCallback((updated: Ride) => {
    if (!mountedRef.current) return;
    if (updated.status === 'cancelled' || updated.status === 'completed') {
      setCurrentRide(updated);
    } else {
      setCurrentRide((prev) =>
        prev ? { ...prev, ...updated, rider: prev.rider, driver: prev.driver } : updated,
      );
    }
    // [INTENT] Refetch with joins when profiles may be missing or newly assigned
    if (updated.status === 'accepted' || updated.status === 'in_progress') {
      refetchRideWithProfiles(updated.id);
    }
  }, [refetchRideWithProfiles]);

  const { subscribeToRide } = useRideSubscription(handleRideUpdate);

  // [INTENT] Find the user's active ride on mount or after auth changes
  // [CONSTRAINT] Checks driver_id or rider_id based on user_type to support dual-role accounts
  const fetchActiveRide = useCallback(async () => {
    if (!user) {
      if (mountedRef.current) { setCurrentRide(null); setInitializing(false); }
      return;
    }
    try {
      const activeStatuses: RideStatus[] = ['requested', 'accepted', 'in_progress'];
      const column = profile?.user_type === 'driver' ? 'driver_id' : 'rider_id';

      const data = await queryRideWithFallback(
        () => supabase.from('rides').select(RIDE_SELECT)
          .eq(column, user.id).in('status', activeStatuses)
          .order('created_at', { ascending: false }).limit(1).maybeSingle(),
        () => supabase.from('rides').select(RIDE_SELECT_FALLBACK)
          .eq(column, user.id).in('status', activeStatuses)
          .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      );

      if (mountedRef.current) setCurrentRide(data as Ride | null);
    } catch (err) {
      console.warn('[TapRide] fetchActiveRide error:', err);
    } finally {
      if (mountedRef.current) setInitializing(false);
    }
  }, [user, profile?.user_type]);

  // [INTENT] Create a new ride request with fare estimate
  // [CONSTRAINT] Uses OSRM route distance when available, haversine as fallback
  // [EDGE-CASE] Profile join on re-fetch may fail — falls back to plain inserted row
  const requestRide = useCallback(async (
    pickupLat: number, pickupLng: number, pickupAddress: string,
    destLat: number, destLng: number, destAddress: string,
    routeDistanceKm?: number,
  ) => {
    if (!user) throw new Error('Not authenticated');
    if (mountedRef.current) setLoading(true);

    const distanceKm = routeDistanceKm ?? haversineDistance(pickupLat, pickupLng, destLat, destLng);
    const fareEstimate = calculateFare(distanceKm);

    try {
      const { data: inserted, error: insertErr } = await supabase
        .from('rides')
        .insert({
          rider_id: user.id,
          pickup_lat: pickupLat, pickup_lng: pickupLng, pickup_address: pickupAddress,
          destination_lat: destLat, destination_lng: destLng, destination_address: destAddress,
          status: 'requested' as RideStatus,
          fare_estimate: fareEstimate,
          distance_km: Math.round(distanceKm * 10) / 10,
        })
        .select('*')
        .single();

      if (insertErr) throw new Error(insertErr.message);
      if (!inserted) throw new Error('Failed to create ride');

      // [INTENT] Re-fetch with joins for richer UI data (rider/driver profiles)
      const { data: withProfiles } = await supabase
        .from('rides').select(RIDE_SELECT).eq('id', inserted.id).single();

      const ride = (withProfiles || inserted) as Ride;
      if (mountedRef.current) setCurrentRide(ride);
      return ride;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [user]);

  // [INTENT] Driver claims a ride — optimistic lock via status='requested' guard
  // [EDGE-CASE] Two drivers tap accept simultaneously — PGRST116 (no rows returned) means another driver won
  const acceptRide = useCallback(async (rideId: string) => {
    if (!user) throw new Error('Not authenticated');
    if (mountedRef.current) setLoading(true);

    try {
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

      const { data: withProfiles } = await supabase
        .from('rides').select(RIDE_SELECT).eq('id', rideId).single();

      const ride = (withProfiles || updated) as Ride;
      if (mountedRef.current) setCurrentRide(ride);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [user]);

  // [INTENT] Transition ride to in_progress when driver confirms pickup
  const startRide = useCallback(async (rideId: string) => {
    if (mountedRef.current) setLoading(true);
    try {
      const { error } = await supabase
        .from('rides')
        .update({ status: 'in_progress' as RideStatus, started_at: new Date().toISOString() })
        .eq('id', rideId);
      if (error) throw new Error(error.message);
      await fetchActiveRide();
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [fetchActiveRide]);

  // [INTENT] Mark ride as completed and return the ride data for the rating screen
  // [CONSTRAINT] Uses currentRideRef (not state) to avoid stale closure capturing old fare_estimate
  // [EDGE-CASE] currentRideRef.current may be null if ride was cancelled via realtime before driver tapped complete
  const completeRide = useCallback(async (rideId: string): Promise<Ride | null> => {
    if (mountedRef.current) setLoading(true);
    try {
      const ride = currentRideRef.current;
      const { error } = await supabase
        .from('rides')
        .update({
          status: 'completed' as RideStatus,
          completed_at: new Date().toISOString(),
          fare_final: Number(ride?.fare_estimate) || 0,
        })
        .eq('id', rideId);
      if (error) throw new Error(error.message);

      const completedRide = ride ? { ...ride, status: 'completed' as RideStatus } : null;
      if (mountedRef.current) setCurrentRide(null);
      return completedRide;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  // [INTENT] Cancel a ride from either side (rider or driver)
  // [EDGE-CASE] Ride may already be cancelled by the other party — update still succeeds (idempotent)
  const cancelRide = useCallback(async (rideId: string) => {
    if (mountedRef.current) setLoading(true);
    try {
      const { error } = await supabase
        .from('rides')
        .update({ status: 'cancelled' as RideStatus })
        .eq('id', rideId);
      if (error) throw new Error(error.message);
      if (mountedRef.current) setCurrentRide(null);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const clearCurrentRide = useCallback(() => { setCurrentRide(null); }, []);

  // [INTENT] Load available ride requests for driver dashboard
  // [CONSTRAINT] Only shows rides with no driver assigned and status=requested
  const fetchNearbyRequests = useCallback(async (): Promise<Ride[]> => {
    try {
      const data = await queryRideWithFallback(
        () => supabase.from('rides').select(RIDE_SELECT)
          .eq('status', 'requested').is('driver_id', null)
          .order('created_at', { ascending: false }).limit(20),
        () => supabase.from('rides').select('*')
          .eq('status', 'requested').is('driver_id', null)
          .order('created_at', { ascending: false }).limit(20),
      );
      return (data as Ride[]) || [];
    } catch (err) {
      console.warn('[TapRide] fetchNearbyRequests error:', err);
      return [];
    }
  }, []);

  // [INTENT] Auto-subscribe to realtime updates for the active ride
  // [CONSTRAINT] Effect cleanup removes channel — prevents stale subscriptions after ride changes
  useEffect(() => {
    if (!currentRide?.id) return;
    return subscribeToRide(currentRide.id);
  }, [currentRide?.id, subscribeToRide]);

  // [INTENT] Rider auto-subscribes to driver location when a driver is assigned
  // [EDGE-CASE] User logs out mid-ride — profile becomes null, subscription must not fire
  useEffect(() => {
    if (!currentRide?.driver_id || profile?.user_type !== 'rider') return;
    return subscribeToDriverLocation(currentRide.driver_id);
  }, [currentRide?.driver_id, profile?.user_type, subscribeToDriverLocation]);

  // [INTENT] Restore active ride state on mount (page refresh, app reopen)
  useEffect(() => { fetchActiveRide(); }, [fetchActiveRide]);

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
