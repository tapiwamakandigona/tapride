/**
 * ActiveRide page — live ride tracking for both rider and driver.
 * Subscribes to the ride document via Realtime for status updates.
 *
 * UX improvements:
 *  - Cancel confirmation dialog (fix 6)
 *  - "No drivers available" timeout after 60 s (fix 5)
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
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

/** How long (ms) to wait in pending before showing "no drivers" warning */
const DRIVER_TIMEOUT_MS = 60_000;

/** Status messages shown in the banner for each ride state. */
const STATUS_MESSAGES: Record<string, string> = {
  pending: '🔍 Looking for a driver…',
  accepted: '🚗 Driver is on the way',
  inprogress: '🛣️ Ride in progress',
  completed: '✅ Ride completed!',
  cancelled: '❌ Ride cancelled',
};

// ─── Cancel confirmation dialog ───────────────────────────────────────────────

interface CancelDialogProps {
  loading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const CancelDialog: React.FC<CancelDialogProps> = ({ loading, onConfirm, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
    <div
      className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl space-y-4"
      onClick={(e) => e.stopPropagation()}
    >
      <h3 className="text-lg font-bold text-gray-900 text-center">Cancel this ride?</h3>
      <p className="text-sm text-gray-500 text-center">
        Your ride request will be cancelled. You can always book a new one.
      </p>
      <button
        onClick={onConfirm}
        disabled={loading}
        className="w-full rounded-xl bg-red-500 py-3 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? <LoadingSpinner size="sm" /> : 'Yes, Cancel Ride'}
      </button>
      <button
        onClick={onClose}
        disabled={loading}
        className="w-full rounded-xl border border-gray-200 py-2 text-sm text-gray-600 hover:bg-gray-50"
      >
        Keep Waiting
      </button>
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

const ActiveRide: React.FC = () => {
  const { rideId } = useParams<{ rideId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const { activeRide, setActiveRide } = useRideStore();
  const { startRide, completeRide, cancelRide, loading } = useRide();
  const [localRide, setLocalRide] = useState<Ride | null>(activeRide);
  const [error, setError] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [noDriversWarning, setNoDriversWarning] = useState(false);

  const isDriver = profile?.role === 'driver';
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load ride from DB if not in store ───────────────────────────────────
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

  // ── Sync activeRide from store to local ──────────────────────────────────
  useEffect(() => {
    if (activeRide && activeRide.$id === rideId) {
      setLocalRide(activeRide);
    }
  }, [activeRide, rideId]);

  // ── 60 s "no drivers" warning when still pending ─────────────────────────
  useEffect(() => {
    if (localRide?.status === 'pending') {
      setNoDriversWarning(false);
      timeoutRef.current = setTimeout(() => setNoDriversWarning(true), DRIVER_TIMEOUT_MS);
    } else {
      setNoDriversWarning(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [localRide?.status]);

  // ── Polling fallback (every 5 s while ride is active) ────────────────────
  useEffect(() => {
    if (!rideId) return;
    if (localRide?.status === 'completed' || localRide?.status === 'cancelled') return;
    const interval = setInterval(async () => {
      try {
        const doc = await databases.getDocument(DATABASE_ID, COLLECTIONS.RIDES, rideId);
        const ride = doc as unknown as Ride;
        setLocalRide(ride);
        setActiveRide(ride);
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [rideId, localRide?.status, setActiveRide]);

  // ── Realtime subscription ─────────────────────────────────────────────────
  useRealtime<Ride>(
    rideId
      ? `databases.${DATABASE_ID}.collections.${COLLECTIONS.RIDES}.documents.${rideId}`
      : '',
    useCallback((event) => {
      if (event.events.some((e) => e.includes('.update') || e.includes('.create'))) {
        const updated = event.payload;
        setLocalRide(updated);
        setActiveRide(updated);
      }
    }, [setActiveRide]),
  );

  // ── Handlers ──────────────────────────────────────────────────────────────
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

  const handleCancelConfirmed = async () => {
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
  const showCompleteBtn = localRide.status === 'completed';

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Map */}
      <MapView
        pickupLat={localRide.pickupLat}
        pickupLng={localRide.pickupLng}
        dropoffLat={localRide.dropoffLat}
        dropoffLng={localRide.dropoffLng}
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

        {/* No drivers warning (after 60 s) */}
        {noDriversWarning && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 flex items-start gap-2">
            <span className="text-lg leading-none">⏱</span>
            <div>
              <p className="font-semibold">No drivers available yet</p>
              <p className="text-xs mt-0.5">It's taking longer than usual. You can keep waiting or cancel and try again.</p>
            </div>
          </div>
        )}

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
              <p className="text-gray-700">{localRide.dropoffAddress}</p>
            </div>
          </div>
          <p className="text-xs text-gray-400">{localRide.distanceKm.toFixed(1)} km</p>
        </div>

        {/* Driver controls */}
        {isDriver && localRide.status === 'accepted' && (
          <button
            onClick={handleStart}
            disabled={loading}
            className="w-full rounded-xl bg-brand-500 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? <LoadingSpinner size="sm" /> : '▶ Start Ride'}
          </button>
        )}

        {isDriver && localRide.status === 'inprogress' && (
          <button
            onClick={handleComplete}
            disabled={loading}
            className="w-full rounded-xl bg-green-500 py-3 text-sm font-bold text-white hover:bg-green-600 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? <LoadingSpinner size="sm" /> : '✅ End Ride'}
          </button>
        )}

        {/* Completed — prompt rider to rate */}
        {showCompleteBtn && !isDriver && (
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

        {/* Cancel button → opens dialog */}
        {canCancel && (
          <button
            onClick={() => setShowCancelDialog(true)}
            disabled={loading}
            className="w-full rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-60"
          >
            Cancel Ride
          </button>
        )}
      </div>

      {/* Cancel confirmation dialog */}
      {showCancelDialog && (
        <CancelDialog
          loading={loading}
          onConfirm={handleCancelConfirmed}
          onClose={() => setShowCancelDialog(false)}
        />
      )}
    </div>
  );
};

export default ActiveRide;
