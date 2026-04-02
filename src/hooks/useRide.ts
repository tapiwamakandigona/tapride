import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Ride, RideStatus } from '../types';
import { haversineDistance } from '../lib/geo';
import { calculateFare } from '../lib/fare';
import { useDriverLocation } from './useDriverLocation';
import { useRideSubscription } from './useRideSubscription';

// Select with joined rider/driver profiles
const RIDE_SELECT = '*, rider:profiles!rides_rider_id_fkey(*), driver:profiles!rides_driver_id_fkey(*)';
const RIDE_SELECT_FALLBACK = '*';

/** Try query with profile join, fallback to plain select if FK join fails */
async function queryRideWithFallback(
  query: () => PromiseLike<{ data: any; error: any }>,
  fallbackQuery: () => PromiseLike<{ data: any; error: any }>,
) {
  const { data, error } = await query();
  if (error) {
    console.warn('[TapRide] queryRideWithFallback: primary query failed, using fallback:', error.message);
    const { data: fb } = await fallbackQuery();
    return fb;
  }
  return data;
}

export function useRide() {
  const { user, profile } = useAuth();
  const [currentRide, setCurrentRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const mountedRef = useRef(true);
  // Ref to avoid stale closure in completeRide
  const currentRideRef = useRef<Ride | null>(null);

  useEffect(() => {
    currentRideRef.current = currentRide;
  }, [currentRide]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Driver location (extracted hook)
  const { driverLocation, updateDriverLocation, subscribeToDriverLocation } =
    useDriverLocation(user?.id);

  // Ride subscription handler
  const handleRideUpdate = useCallback((updated: Ride) => {
    if (updated.status === 'cancelled' || updated.status === 'completed') {
      if (mountedRef.current) setCurrentRide(updated);
    } else {
      if (mountedRef.current) {
        setCurrentRide((prev) =>
          prev ? { ...prev, ...updated, rider: prev.rider, driver: prev.driver } : updated
        );
      }
    }
  }, []);

  const { subscribeToRide } = useRideSubscription(handleRideUpdate);

  // Fetch active ride for current user
  const fetchActiveRide = useCallback(async () => {
    if (!user) {
      if (mountedRef.current) setInitializing(false);
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

  // Request a ride (rider)
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

      const { data: withProfiles } = await supabase
        .from('rides').select(RIDE_SELECT).eq('id', inserted.id).single();

      const ride = (withProfiles || inserted) as Ride;
      if (mountedRef.current) setCurrentRide(ride);
      return ride;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [user]);

  // Accept a ride (driver)
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

  // Start ride
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

  // Complete ride — uses ref to avoid stale closure
  const completeRide = useCallback(async (rideId: string): Promise<Ride | null> => {
    if (mountedRef.current) setLoading(true);
    try {
      const ride = currentRideRef.current;
      const { error } = await supabase
        .from('rides')
        .update({
          status: 'completed' as RideStatus,
          completed_at: new Date().toISOString(),
          // TODO: Calculate actual fare from real trip distance/duration instead of estimate
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

  // Cancel ride
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

  // Fetch nearby ride requests (driver)
  const fetchNearbyRequests = useCallback(async (): Promise<Ride[]> => {
    const data = await queryRideWithFallback(
      () => supabase.from('rides').select(RIDE_SELECT)
        .eq('status', 'requested').is('driver_id', null)
        .order('created_at', { ascending: false }).limit(20),
      () => supabase.from('rides').select('*')
        .eq('status', 'requested').is('driver_id', null)
        .order('created_at', { ascending: false }).limit(20),
    );
    return (data as Ride[]) || [];
  }, []);

  // Auto-subscribe to ride updates
  useEffect(() => {
    if (!currentRide?.id) return;
    return subscribeToRide(currentRide.id);
  }, [currentRide?.id, subscribeToRide]);

  // Auto-subscribe to driver location when rider has active ride
  useEffect(() => {
    if (!currentRide?.driver_id || profile?.user_type !== 'rider') return;
    return subscribeToDriverLocation(currentRide.driver_id);
  }, [currentRide?.driver_id, profile?.user_type, subscribeToDriverLocation]);

  // Fetch active ride on mount
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
