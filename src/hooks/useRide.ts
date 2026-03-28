import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Ride, RideStatus, DriverLocation } from '../types';
import { haversineDistance } from '../lib/geo';
import { calculateFare } from '../lib/fare';

export function useRide() {
  const { user, profile } = useAuth();
  const [currentRide, setCurrentRide] = useState<Ride | null>(null);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch active ride for current user
  const fetchActiveRide = useCallback(async () => {
    if (!user) return;
    const activeStatuses: RideStatus[] = ['requested', 'accepted', 'in_progress'];
    const column = profile?.user_type === 'driver' ? 'driver_id' : 'rider_id';

    const { data } = await supabase
      .from('rides')
      .select('*')
      .eq(column, user.id)
      .in('status', activeStatuses)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    setCurrentRide(data);
  }, [user, profile]);

  // Request a ride (rider)
  const requestRide = async (
    pickupLat: number,
    pickupLng: number,
    pickupAddress: string,
    destLat: number,
    destLng: number,
    destAddress: string
  ) => {
    if (!user) throw new Error('Not authenticated');
    setLoading(true);

    const distanceKm = haversineDistance(pickupLat, pickupLng, destLat, destLng);
    const fareEstimate = calculateFare(distanceKm);

    const { data, error } = await supabase
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

    setLoading(false);
    if (error) throw new Error(error.message);
    if (data) setCurrentRide(data);
    return data;
  };

  // Accept a ride (driver)
  const acceptRide = async (rideId: string) => {
    if (!user) throw new Error('Not authenticated');
    setLoading(true);

    const { data, error } = await supabase
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

    setLoading(false);
    if (error) throw new Error(error.message);
    if (data) setCurrentRide(data);
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

  // Complete ride
  const completeRide = async (rideId: string) => {
    const { error } = await supabase
      .from('rides')
      .update({
        status: 'completed' as RideStatus,
        completed_at: new Date().toISOString(),
        fare_final: currentRide?.fare_estimate ?? 0,
      })
      .eq('id', rideId);
    if (error) throw new Error(error.message);
    // Keep the ride in state briefly for the rating page
    setCurrentRide((prev) => prev ? { ...prev, status: 'completed' } : null);
  };

  // Cancel ride
  const cancelRide = async (rideId: string) => {
    const { error } = await supabase
      .from('rides')
      .update({ status: 'cancelled' as RideStatus })
      .eq('id', rideId);
    if (error) throw new Error(error.message);
    setCurrentRide(null);
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
        setCurrentRide((prev) => prev ? { ...prev, ...payload.new } : null);
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
      .then(({ data }) => { if (data) setDriverLocation(data); });

    const channel = supabase
      .channel(`driver-loc-${driverId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'driver_locations',
        filter: `driver_id=eq.${driverId}`,
      }, (payload) => {
        setDriverLocation(payload.new as DriverLocation);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Fetch nearby ride requests (driver) — no params, uses all requested rides
  const fetchNearbyRequests = useCallback(async (): Promise<Ride[]> => {
    const { data } = await supabase
      .from('rides')
      .select('*')
      .eq('status', 'requested')
      .is('driver_id', null)
      .order('created_at', { ascending: false })
      .limit(20);

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
