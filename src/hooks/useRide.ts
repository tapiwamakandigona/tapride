import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { withTimeout } from '../lib/resilience';
import type { Ride, RideStatus, DriverLocation, Profile } from '../types';
import { haversineDistance } from '../lib/geo';
import { calculateFare } from '../lib/fare';
import type { RideType } from '../lib/fare';

// Select with joined rider/driver profiles
const RIDE_SELECT = '*, rider:profiles!rides_rider_id_fkey(*), driver:profiles!rides_driver_id_fkey(*)';
// Fallback without FK join (in case FK names differ)
const RIDE_SELECT_FALLBACK = '*';

/** Fetch a single profile by ID, returns null on failure */
async function fetchProfileById(userId: string): Promise<Profile | null> {
  try {
    const { data, error } = await withTimeout(
      supabase.from('profiles').select('*').eq('id', userId).single(),
      3000,
    );
    if (error) {
      console.warn('[TapRide] fetchProfileById failed:', userId, error.message);
      return null;
    }
    return data as Profile;
  } catch (err) {
    console.warn('[TapRide] fetchProfileById exception:', userId, err);
    return null;
  }
}

export function useRide() {
  const { user, profile } = useAuth();
  const [currentRide, setCurrentRide] = useState<Ride | null>(null);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [initError, setInitError] = useState(false);
  const mountedRef = useRef(true);
  const subscriptionRef = useRef<string | null>(null); // track subscribed ride ID
  const profileCacheRef = useRef<Map<string, Profile>>(new Map()); // cache rider/driver profiles

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  /** Get or fetch a profile, using cache */
  const getCachedProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const cached = profileCacheRef.current.get(userId);
    if (cached) return cached;
    const fetched = await fetchProfileById(userId);
    if (fetched) profileCacheRef.current.set(userId, fetched);
    return fetched;
  }, []);

  /** Enrich a raw ride row with cached/fetched profiles */
  const enrichRideWithProfiles = useCallback(async (ride: Ride): Promise<Ride> => {
    const enriched = { ...ride };
    if (ride.rider_id && !ride.rider) {
      enriched.rider = await getCachedProfile(ride.rider_id) ?? undefined;
    }
    if (ride.driver_id && !ride.driver) {
      enriched.driver = await getCachedProfile(ride.driver_id) ?? undefined;
    }
    return enriched;
  }, [getCachedProfile]);

  // Fetch active ride for current user — with profile join
  const fetchActiveRide = useCallback(async (retryCount = 0) => {
    if (!user) {
      if (mountedRef.current) setInitializing(false);
      return;
    }
    try {
      if (mountedRef.current) setInitError(false);
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
        console.warn('[TapRide] fetchActiveRide join failed, using fallback:', joinErr.message);
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

      // Retry once after a short delay if no ride found (write propagation delay)
      if (!data && retryCount < 1) {
        console.warn('[TapRide] fetchActiveRide: not found, retrying in 1s...');
        await new Promise((r) => setTimeout(r, 1000));
        if (mountedRef.current) return fetchActiveRide(retryCount + 1);
        return;
      }

      if (data) {
        // Enrich with profiles if missing
        data = await enrichRideWithProfiles(data);
        // Cache profiles from joined data
        if (data.rider) profileCacheRef.current.set(data.rider_id, data.rider);
        if (data.driver_id && data.driver) profileCacheRef.current.set(data.driver_id, data.driver);
        console.warn('[TapRide] fetchActiveRide: found ride', data.id, 'status:', data.status);
      } else {
        console.warn('[TapRide] fetchActiveRide: no active ride found');
      }

      if (mountedRef.current) setCurrentRide(data);
    } catch (err) {
      console.warn('[TapRide] fetchActiveRide error:', err);
      if (mountedRef.current) setInitError(true);
    } finally {
      if (mountedRef.current) setInitializing(false);
    }
  }, [user, profile?.user_type, enrichRideWithProfiles]);

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
    const durationMin = routeDurationMin ?? distanceKm * 2;
    const fareEstimate = calculateFare(distanceKm, durationMin, rideType);

    try {
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

      console.warn('[TapRide] Ride requested:', inserted.id);

      // Try to re-fetch with profile join for richer data
      const { data: withProfiles } = await supabase
        .from('rides')
        .select(RIDE_SELECT)
        .eq('id', inserted.id)
        .single();

      const ride = (withProfiles || inserted) as Ride;
      // Attach current user as rider profile if missing
      if (!ride.rider && profile) {
        ride.rider = profile as Profile;
        profileCacheRef.current.set(user.id, profile as Profile);
      }
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

      console.warn('[TapRide] Ride accepted:', rideId, 'by driver:', user.id);

      // DON'T re-fetch with join — it races with the realtime subscription.
      // Instead, build the ride object manually with the current user as driver.
      const ride = updated as Ride;
      // Attach current user as driver profile
      if (profile) {
        ride.driver = profile as Profile;
        profileCacheRef.current.set(user.id, profile as Profile);
      }
      // Try to get rider profile from cache or fetch it
      if (ride.rider_id && !ride.rider) {
        const riderProfile = await getCachedProfile(ride.rider_id);
        if (riderProfile) ride.rider = riderProfile;
      }

      if (mountedRef.current) setCurrentRide(ride);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  // Start ride (driver picked up rider)
  const startRide = async (rideId: string) => {
    const { data, error } = await supabase
      .from('rides')
      .update({ status: 'in_progress' as RideStatus, started_at: new Date().toISOString() })
      .eq('id', rideId)
      .select('*')
      .single();
    if (error) throw new Error(error.message);

    console.warn('[TapRide] Ride started:', rideId);

    // Update local state directly instead of re-fetching
    if (mountedRef.current && data) {
      setCurrentRide((prev) => prev ? {
        ...prev,
        ...data,
        rider: prev.rider,
        driver: prev.driver,
      } : data as Ride);
    }
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

    console.warn('[TapRide] Ride completed:', rideId);

    const completedRide = currentRide ? { ...currentRide, status: 'completed' as RideStatus } : null;
    if (mountedRef.current) setCurrentRide(null);
    return completedRide;
  };

  // Cancel ride — with fee logic
  const cancelRide = async (rideId: string) => {
    if (!user) throw new Error('Not authenticated');

    let fee = 0;
    if (currentRide) {
      const createdAt = new Date(currentRide.created_at).getTime();
      const now = Date.now();
      const twoMinMs = 2 * 60 * 1000;
      const isAccepted = currentRide.status === 'accepted' || currentRide.status === 'in_progress';
      if (now - createdAt > twoMinMs || isAccepted) {
        fee = 1.0;
      }
    }

    const { error } = await supabase
      .from('rides')
      .update({ status: 'cancelled' as RideStatus })
      .eq('id', rideId);
    if (error) throw new Error(error.message);

    console.warn('[TapRide] Ride cancelled:', rideId, 'fee:', fee);

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

  const checkCancellationWarning = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    const { data } = await supabase
      .from('profiles')
      .select('cancellation_count')
      .eq('id', user.id)
      .single();
    return (data?.cancellation_count ?? 0) >= 5;
  }, [user]);

  const clearCurrentRide = () => {
    setCurrentRide(null);
  };

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
  // Handles raw DB rows by merging with cached profiles
  const subscribeToRide = useCallback((rideId: string) => {
    // Prevent duplicate subscriptions
    if (subscriptionRef.current === rideId) {
      console.warn('[TapRide] Already subscribed to ride:', rideId);
      return () => {};
    }
    subscriptionRef.current = rideId;
    console.warn('[TapRide] Subscribing to ride updates:', rideId);

    const channel = supabase
      .channel(`ride-${rideId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rides',
        filter: `id=eq.${rideId}`,
      }, async (payload) => {
        if (!mountedRef.current) return;

        const rawUpdate = payload.new as Record<string, unknown>;
        const newStatus = rawUpdate.status as RideStatus;
        console.warn('[TapRide] Realtime: ride status changed to', newStatus, 'for ride', rideId);

        if (newStatus === 'completed' || newStatus === 'cancelled') {
          // Ride ended — clear state cleanly
          console.warn('[TapRide] Realtime: ride ended with status', newStatus);
          if (mountedRef.current) {
            setCurrentRide((prev) => prev ? { ...prev, status: newStatus } : null);
          }
          return;
        }

        // For other updates, merge with existing state and cached profiles
        if (mountedRef.current) {
          setCurrentRide((prev) => {
            if (!prev) return null;

            // Start with previous state (has profile joins)
            const merged: Ride = { ...prev };

            // Copy all scalar fields from the raw update
            for (const [key, value] of Object.entries(rawUpdate)) {
              if (key !== 'rider' && key !== 'driver') {
                (merged as unknown as Record<string, unknown>)[key] = value;
              }
            }

            // Preserve existing profile data
            merged.rider = prev.rider;
            merged.driver = prev.driver;

            return merged;
          });

          // If status changed to 'accepted' and we're the rider, fetch driver profile
          if (newStatus === 'accepted' && rawUpdate.driver_id && profile?.user_type === 'rider') {
            console.warn('[TapRide] Realtime: ride accepted, fetching driver profile:', rawUpdate.driver_id);
            const driverProfile = await getCachedProfile(rawUpdate.driver_id as string);
            if (driverProfile && mountedRef.current) {
              setCurrentRide((prev) => prev ? { ...prev, driver: driverProfile } : null);
            }
          }
        }
      })
      .subscribe();

    return () => {
      console.warn('[TapRide] Unsubscribing from ride:', rideId);
      subscriptionRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [profile?.user_type, getCachedProfile]);

  // Subscribe to driver location (returns unsubscribe function)
  const subscribeToDriverLocation = useCallback((driverId: string) => {
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

  // Fetch nearby ride requests (driver)
  const fetchNearbyRequests = useCallback(async (driverLat?: number, driverLng?: number): Promise<Ride[]> => {
    const { data, error } = await supabase
      .from('rides')
      .select(RIDE_SELECT)
      .eq('status', 'requested')
      .is('driver_id', null)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
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
    if (!currentRide?.id) {
      // Clear subscription ref when no ride
      subscriptionRef.current = null;
      return;
    }
    // Only subscribe if not already subscribed to this ride
    if (subscriptionRef.current === currentRide.id) return;
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
