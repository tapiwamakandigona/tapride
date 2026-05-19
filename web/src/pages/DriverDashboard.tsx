/**
 * DriverDashboard — main screen for drivers.
 * Toggle online/offline, see incoming ride requests in real-time,
 * and accept rides.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapView } from '@/components/MapView';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { StatusBadge } from '@/components/StatusBadge';
import { useDriverLocation } from '@/hooks/useDriverLocation';
import { useRide } from '@/hooks/useRide';
import { useRealtime } from '@/hooks/useRealtime';
import { useAuthStore } from '@/store/authStore';
import { databases, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite';
import { formatFare } from '@/lib/fare';
import { rideRequestAlert } from '@/lib/notifications';
import type { Ride } from '@/types';
import { Query } from 'appwrite';
import { logger } from '@/lib/logger';

/** Driver's home screen: online toggle and incoming ride requests. */
const DriverDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const { startPublishing, stopPublishing, publishing } = useDriverLocation();
  const { acceptRide, loading } = useRide();

  const [isOnline, setIsOnline] = useState(profile?.isOnline ?? false);
  const [requestedRides, setRequestedRides] = useState<Ride[]>([]);
  const [userLat, setUserLat] = useState<number | undefined>();
  const [userLng, setUserLng] = useState<number | undefined>();
  const [togglingOnline, setTogglingOnline] = useState(false);

  // Get driver location
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
      },
      () => logger.warn('Geolocation denied'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  // Load existing requested rides on mount
  useEffect(() => {
    if (!isOnline) return;
    const load = async () => {
      try {
        const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.RIDES, [
          Query.equal('status', 'pending'),
          Query.orderDesc('requestedAt'),
          Query.limit(10),
        ]);
        setRequestedRides(res.documents as unknown as Ride[]);
      } catch (e) {
        logger.error('load rides', e);
      }
    };
    load();
  }, [isOnline]);

  // Subscribe to new ride requests via Realtime when online
  useRealtime<Ride>(
    isOnline
      ? `databases.${DATABASE_ID}.collections.${COLLECTIONS.RIDES}.documents`
      : '',
    (event) => {
      const ride = event.payload;
      if (event.events.some((e) => e.includes('.create')) && ride.status === 'pending') {
        setRequestedRides((prev) => {
          if (prev.find((r) => r.$id === ride.$id)) return prev;
          rideRequestAlert();
          return [ride, ...prev];
        });
      }
      if (event.events.some((e) => e.includes('.update'))) {
        if (ride.status !== 'pending') {
          setRequestedRides((prev) => prev.filter((r) => r.$id !== ride.$id));
        }
      }
    },
  );

  const handleToggleOnline = async () => {
    setTogglingOnline(true);
    const newState = !isOnline;
    setIsOnline(newState);
    if (newState) {
      startPublishing();
    } else {
      await stopPublishing();
      setRequestedRides([]);
    }

    // Update profile in DB
    if (profile) {
      try {
        await databases.updateDocument(DATABASE_ID, COLLECTIONS.PROFILES, profile.$id, {
          isOnline: newState,
        });
      } catch (e) {
        logger.error('toggle online', e);
      }
    }
    setTogglingOnline(false);
  };

  const handleAccept = async (ride: Ride) => {
    const ok = await acceptRide(ride.$id);
    if (ok) {
      navigate(`/ride/${ride.$id}`);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <MapView
        userLat={userLat}
        userLng={userLng}
        className="h-48 flex-shrink-0"
      />

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 space-y-4">
        {/* Header & online toggle */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Driver Dashboard</h2>
            <p className="text-sm text-gray-500">
              {isOnline ? '🟢 You are online' : '🔴 You are offline'}
            </p>
          </div>
          <button
            onClick={handleToggleOnline}
            disabled={togglingOnline || publishing}
            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none disabled:opacity-60 ${
              isOnline ? 'bg-brand-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                isOnline ? 'translate-x-8' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {!isOnline && (
          <div className="rounded-xl bg-gray-100 p-4 text-center text-sm text-gray-500">
            Go online to see ride requests
          </div>
        )}

        {isOnline && requestedRides.length === 0 && (
          <div className="rounded-xl bg-white border border-gray-100 p-6 text-center">
            <div className="text-4xl mb-2">⏳</div>
            <p className="text-sm text-gray-500">Waiting for ride requests…</p>
          </div>
        )}

        {isOnline && requestedRides.map((ride) => (
          <div
            key={ride.$id}
            className="rounded-xl bg-white p-4 shadow-sm border border-gray-100 space-y-3"
          >
            <div className="flex items-center justify-between">
              <StatusBadge status={ride.status} />
              <span className="text-lg font-bold text-brand-600">{formatFare(ride.fare)}</span>
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 h-2 w-2 rounded-full bg-green-500 flex-shrink-0" />
                <span className="text-gray-700 line-clamp-2">{ride.pickupAddress}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 h-2 w-2 rounded-full bg-red-500 flex-shrink-0" />
                <span className="text-gray-700 line-clamp-2">{ride.dropAddress}</span>
              </div>
            </div>

            <p className="text-xs text-gray-500">{ride.distanceKm.toFixed(1)} km</p>

            <button
              onClick={() => handleAccept(ride)}
              disabled={loading}
              className="w-full rounded-lg bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60 transition-colors"
            >
              {loading ? <LoadingSpinner size="sm" /> : 'Accept Ride'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DriverDashboard;
