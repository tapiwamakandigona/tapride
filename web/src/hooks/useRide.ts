/**
 * Ride state machine hook — handles creating, accepting,
 * cancelling and completing rides via Appwrite Databases.
 */
import { useState, useCallback } from 'react';
import { ID, Query, AppwriteException } from 'appwrite';
import { databases, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite';
import { useRideStore } from '@/store/rideStore';
import { useAuthStore } from '@/store/authStore';
import type { Ride, RideStatus } from '@/types';
import { logger } from '@/lib/logger';

export function useRide() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { activeRide, setActiveRide } = useRideStore();
  const { user } = useAuthStore();

  /** Create a new ride request */
  const requestRide = useCallback(async (params: {
    pickupLat: number;
    pickupLng: number;
    pickupAddress: string;
    dropoffLat: number;
    dropoffLng: number;
    dropoffAddress: string;
    fare: number;
    distanceKm: number;
  }): Promise<Ride | null> => {
    if (!user) return null;
    setError(null);
    setLoading(true);
    try {
      const doc = await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.RIDES,
        ID.unique(),
        {
          riderId: user.$id,
          status: 'pending' as RideStatus,
          
          
          ...params,
        },
      );
      const ride = doc as unknown as Ride;
      setActiveRide(ride);
      return ride;
    } catch (e) {
      const msg = e instanceof AppwriteException ? e.message : 'Failed to request ride';
      setError(msg);
      logger.error('requestRide', e);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, setActiveRide]);

  /** Driver accepts a ride */
  const acceptRide = useCallback(async (rideId: string): Promise<boolean> => {
    if (!user) return false;
    setError(null);
    setLoading(true);
    try {
      const doc = await databases.updateDocument(
        DATABASE_ID,
        COLLECTIONS.RIDES,
        rideId,
        { status: 'accepted', driverId: user.$id },
      );
      setActiveRide(doc as unknown as Ride);
      return true;
    } catch (e) {
      const msg = e instanceof AppwriteException ? e.message : 'Failed to accept ride';
      setError(msg);
      logger.error('acceptRide', e);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, setActiveRide]);

  /** Driver starts the ride (in_progress) */
  const startRide = useCallback(async (rideId: string): Promise<boolean> => {
    setError(null);
    setLoading(true);
    try {
      const doc = await databases.updateDocument(
        DATABASE_ID,
        COLLECTIONS.RIDES,
        rideId,
        { status: 'inprogress' },
      );
      setActiveRide(doc as unknown as Ride);
      return true;
    } catch (e) {
      const msg = e instanceof AppwriteException ? e.message : 'Failed to start ride';
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, [setActiveRide]);

  /** Driver completes the ride */
  const completeRide = useCallback(async (rideId: string): Promise<boolean> => {
    setError(null);
    setLoading(true);
    try {
      const doc = await databases.updateDocument(
        DATABASE_ID,
        COLLECTIONS.RIDES,
        rideId,
        { status: 'completed' },
      );
      setActiveRide(doc as unknown as Ride);
      return true;
    } catch (e) {
      const msg = e instanceof AppwriteException ? e.message : 'Failed to complete ride';
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, [setActiveRide]);

  /** Cancel a ride (rider or driver) */
  const cancelRide = useCallback(async (rideId: string, reason?: string): Promise<boolean> => {
    setError(null);
    setLoading(true);
    try {
      const doc = await databases.updateDocument(
        DATABASE_ID,
        COLLECTIONS.RIDES,
        rideId,
        {
          status: 'cancelled',
        },
      );
      setActiveRide(doc as unknown as Ride);
      return true;
    } catch (e) {
      const msg = e instanceof AppwriteException ? e.message : 'Failed to cancel ride';
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, [setActiveRide]);

  /** Fetch ride history for the current user (rider or driver) */
  const fetchHistory = useCallback(async (): Promise<Ride[]> => {
    if (!user) return [];
    setLoading(true);
    try {
      const [riderRes, driverRes] = await Promise.all([
        databases.listDocuments(DATABASE_ID, COLLECTIONS.RIDES, [
          Query.equal('riderId', user.$id),
          Query.orderDesc('$createdAt'),
          Query.limit(50),
        ]),
        databases.listDocuments(DATABASE_ID, COLLECTIONS.RIDES, [
          Query.equal('driverId', user.$id),
          Query.orderDesc('$createdAt'),
          Query.limit(50),
        ]),
      ]);
      const all = [...riderRes.documents, ...driverRes.documents] as unknown as Ride[];
      // Deduplicate and sort
      const map = new Map(all.map((r) => [r.$id, r]));
      return Array.from(map.values()).sort(
        (a, b) => new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime(),
      );
    } catch (e) {
      logger.error('fetchHistory', e);
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  return {
    activeRide,
    loading,
    error,
    requestRide,
    acceptRide,
    startRide,
    completeRide,
    cancelRide,
    fetchHistory,
  };
}
