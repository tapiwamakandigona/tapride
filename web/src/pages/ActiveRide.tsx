/**
 * ActiveRide page — live ride tracking for both rider and driver.
 * Subscribes to the ride document via Realtime for status updates.
 */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapView } from '@/components/MapView';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useRide } from '@/hooks/useRide';
import { useRealtime } from '@/hooks/useRealtime';
import { useAuthStore } from '@/store/authStore';
import { useRideStore } from '@/store/rideStore';
import { databases, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite';
import { formatFare } from '@/lib/fare';
import type { Ride } from '@/types';
import { logger } from '@/lib/logger';

/** Status messages shown in the banner for each ride state. */
const STATUS_MESSAGES: Record<string, string> = {
  pending: '🔍 Looking for a driver…',
  accepted: '🚗 Driver is on the way',
  in_progress: '🛣️ Ride in progress',
  completed: '✅ Ride completed!',
  cancelled: '❌ Ride cancelled',
};

/** Active ride screen with map, status banner and driver/rider controls. */
const ActiveRide: React.FC = () => {
  const { rideId } = useParams<{ rideId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const { activeRide, setActiveRide } = useRideStore();
  const { startRide, completeRide, cancelRide, loading } = useRide();
  const [localRide, setLocalRide] = useState<Ride | null>(activeRide);
  const [error, setError] = useState<string | null>(null);

  const isDriver = profile?.role === 'driver';

  // Load ride from DB if not in store
  useEffect(() => {
    if (!rideId) return;
    if (activeRide?.$id === rideId) {
      setLocalRide(activeRide);
      return;
    }
    const load = async () => {
      try {
        const doc = await databases.getDocument(DATABASE_ID, COLLECTIONS.RIDES, rideId);
        const ride = doc as unknown as Ride;
        setLocalRide(ride);
        setActiveRide(ride);
      } catch (e) {
        logger.error('load ride', e);
        setError('Failed to load ride');
      }
    };
    load();
  }, [rideId, activeRide, setActiveRide]);

  // Sync activeRide from store to local
  useEffect(() => {
    if (activeRide && activeRide.$id === rideId) {
      setLocalRide(activeRide);
    }
  }, [activeRide, rideId]);

  // Realtime subscription for live status updates
  useRealtime<Ride>(
    rideId
      ? `databases.${DATABASE_ID}.collections.${COLLECTIONS.RIDES}.documents.${rideId}`
      : '',
    (event) => {
      if (event.events.some((e) => e.includes('.update') || e.includes('.create'))) {
        const updated = event.payload;
        setLocalRide(updated);
        setActiveRide(updated);
      }
    },
  );

  const handleStart = async () => {
    if (!rideId) return;
    const ok = await startRide(rideId);
    if (!ok) setError('Failed to start ride');
  };

  const handleComplete = async () => {
    if (!rideId) return;
    const ok = await completeRide(rideId);
    if (ok) navigate('/driver');
  };

  const handleCancel = async () => {
    if (!rideId) return;
    const ok = await cancelRide(rideId, 'User cancelled');
    if (ok) navigate(isDriver ? '/driver' : '/rider');
  };

  if (!localRide) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size="lg" label="Loading ride…" />
      </div>
    );
  }

  const canCancel = localRide.status === 'pending' || localRide.status === 'accepted';
  const showComplete = localRide.status === 'completed';

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Map */}
      <MapView
        pickupLat={localRide.pickupLat}
        pickupLng={localRide.pickupLng}
        dropLat={localRide.dropLat}
        dropLng={localRide.dropLng}
        showRoute
        className="h-56 flex-shrink-0"
      />

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 space-y-4">
        {/* Status banner */}
        <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-1">
            <StatusBadge status={localRide.status} />
            <span className="font-bold text-brand-600">{formatFare(localRide.fare)}</span>
          </div>
          <p className="text-sm text-gray-600">{STATUS_MESSAGES[localRide.status]}</p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Route info */}
        <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100 space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 h-2 w-2 rounded-full bg-green-500 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-400">Pickup</p>
              <p className="text-gray-700">{localRide.pickupAddress}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 h-2 w-2 rounded-full bg-red-500 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-400">Drop-off</p>
              <p className="text-gray-700">{localRide.dropAddress}</p>
            </div>
          </div>
          <p className="text-xs text-gray-400">{localRide.distanceKm.toFixed(1)} km</p>
        </div>

        {/* Driver controls */}
        {isDriver && localRide.status === 'accepted' && (
          <button
            onClick={handleStart}
            disabled={loading}
            className="w-full rounded-xl bg-brand-500 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {loading ? <LoadingSpinner size="sm" /> : '▶ Start Ride'}
          </button>
        )}

        {isDriver && localRide.status === 'inprogress' && (
          <button
            onClick={handleComplete}
            disabled={loading}
            className="w-full rounded-xl bg-green-500 py-3 text-sm font-bold text-white hover:bg-green-600 disabled:opacity-60"
          >
            {loading ? <LoadingSpinner size="sm" /> : '✅ End Ride'}
          </button>
        )}

        {/* Completed - prompt rider to rate */}
        {showComplete && !isDriver && (
          <button
            onClick={() => navigate(`/rate/${rideId}`)}
            className="w-full rounded-xl bg-yellow-400 py-3 text-sm font-bold text-gray-900 hover:bg-yellow-500"
          >
            ⭐ Rate Your Driver
          </button>
        )}

        {/* Chat button */}
        {(localRide.status === 'accepted' || localRide.status === 'inprogress') && (
          <button
            onClick={() => navigate(`/chat/${rideId}`)}
            className="w-full rounded-xl bg-white border border-gray-200 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            💬 Chat
          </button>
        )}

        {/* Cancel button */}
        {canCancel && (
          <button
            onClick={handleCancel}
            disabled={loading}
            className="w-full rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-60"
          >
            Cancel Ride
          </button>
        )}
      </div>
    </div>
  );
};

export default ActiveRide;
