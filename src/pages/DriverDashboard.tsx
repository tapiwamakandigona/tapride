import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRide } from '../hooks/useRide';
import { useLocation as useGeoLocation } from '../hooks/useLocation';
import MapView from '../components/Map/MapView';
import RideRequestCard from '../components/Ride/RideRequestCard';
import { supabase } from '../lib/supabase';
import { playNewRequestSound, vibrateDevice } from '../lib/notifications';
import AlertError from '../components/ui/AlertError';
import Spinner from '../components/ui/Spinner';
import type { Ride } from '../types';

export default function DriverDashboard() {
  const navigate = useNavigate();
  const { profile, updateProfile } = useAuth();
  const { currentRide, initializing, acceptRide, updateDriverLocation, fetchNearbyRequests } = useRide();
  const { position, startWatching } = useGeoLocation(false); // Don't auto-start GPS; start when online
  const [isOnline, setIsOnline] = useState(profile?.is_online ?? false);
  const [nearbyRequests, setNearbyRequests] = useState<Ride[]>([]);
  const [acceptingRideId, setAcceptingRideId] = useState<string | null>(null);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [error, setError] = useState('');
  const prevRequestCount = useRef(0);
  const loadingRequestsRef = useRef(false);

  // [INTENT] Only consume battery for GPS when driver is actively accepting rides
  useEffect(() => {
    if (isOnline) {
      const stopWatching = startWatching();
      return () => { stopWatching(); };
    }
  }, [isOnline, startWatching]);

  // [INTENT] Push driver coordinates to Supabase for rider-side tracking
  // [CONSTRAINT] Only while online — offline drivers shouldn't appear on rider maps
  useEffect(() => {
    if (isOnline && position) {
      updateDriverLocation(position.lat, position.lng, position.heading, position.speed);
    }
  }, [isOnline, position, updateDriverLocation]);

  // [INTENT] Poll + realtime subscribe for ride requests within range
  // [CONSTRAINT] 8s polling as safety net; realtime channel handles instant updates
  // [EDGE-CASE] Multiple rapid fetches can fire — loadingRequestsRef debounces
  useEffect(() => {
    if (!isOnline) {
      setNearbyRequests([]);
      prevRequestCount.current = 0;
      return;
    }

    const loadRequests = async () => {
      // [INTENT] Prevent concurrent fetches from stacking (realtime + interval can overlap)
      if (loadingRequestsRef.current) return;
      loadingRequestsRef.current = true;
      try {
        const requests = await fetchNearbyRequests();
        const prevCount = prevRequestCount.current;

        // [INTENT] Alert driver to new requests via audio/haptic — critical for engagement
        // [CONSTRAINT] Only play on transition from 0→N or N→N+1, not on every poll
        if (requests.length > 0 && prevCount === 0) {
          playNewRequestSound();
          vibrateDevice();
        } else if (requests.length > prevCount && prevCount > 0) {
          playNewRequestSound();
          vibrateDevice();
        }

        prevRequestCount.current = requests.length;
        setNearbyRequests(requests);
      } catch {
        // [EDGE-CASE] Network flake during poll — silently retry on next interval
      } finally {
        loadingRequestsRef.current = false;
      }
    };

    loadRequests();
    const interval = setInterval(loadRequests, 8000);

    // [INTENT] Realtime channel catches new rides faster than polling
    // [CONSTRAINT] Both INSERT and UPDATE filters needed — ride may be re-requested after cancellation
    const channel = supabase
      .channel('new-ride-requests')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'rides', filter: 'status=eq.requested' },
        () => {
          loadRequests();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rides', filter: 'status=eq.requested' },
        () => { loadRequests(); }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [isOnline, fetchNearbyRequests]);

  const handleToggleOnline = useCallback(async () => {
    if (!profile?.id) return;
    setToggleLoading(true);
    try {
      const newStatus = !isOnline;
      await updateProfile({ is_online: newStatus });
      setIsOnline(newStatus);

      if (!newStatus) {
        // [INTENT] Going offline: clean up driver_locations so riders don't see stale pins
        await supabase
          .from('driver_locations')
          .delete()
          .eq('driver_id', profile.id);
      }
    } catch {
      setError('Failed to update status');
    } finally {
      setToggleLoading(false);
    }
  }, [isOnline, profile?.id, updateProfile]);

  const handleAcceptRide = async (rideId: string) => {
    setAcceptingRideId(rideId);
    setError('');
    try {
      await acceptRide(rideId);
      // [INTENT] Navigate to active ride view after successful accept
      navigate('/ride/active');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to accept ride';
      setError(message);
      // [EDGE-CASE] Accept failed (another driver got it) — refresh list to remove stale card
      const requests = await fetchNearbyRequests();
      setNearbyRequests(requests);
    } finally {
      setAcceptingRideId(null);
    }
  };

  // [INTENT] Block render until useRide resolves — prevents flash of empty dashboard
  if (initializing) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Spinner />
      </div>
    );
  }

  // [INTENT] Non-blocking banner for rides in progress — driver can still see new requests
  // [CONSTRAINT] Deliberately not auto-redirecting to avoid breaking the request list flow
  const hasActiveRide = currentRide && (currentRide.status === 'accepted' || currentRide.status === 'in_progress');

  return (
    <div className="flex flex-col h-full">
      {/* Active ride banner */}
      {hasActiveRide && (
        <button
          onClick={() => navigate('/ride/active')}
          className="w-full px-4 py-3 bg-green-600 text-white text-sm font-semibold flex items-center justify-between z-10"
        >
          <span>
            {currentRide.status === 'accepted' ? 'Head to pickup - tap to view' : 'Ride in progress - tap to view'}
          </span>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}

      {/* Header */}
      {/* [INTENT] Header with driver name + online/offline toggle */}
      {/* [Z-INDEX] relative z-20 — must sit above map (Leaflet's internal z-indexes reach 400+) */}
      <div className="relative px-4 pt-4 pb-2 bg-white dark:bg-gray-900 z-20 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Hi, {profile?.full_name?.split(' ')[0] || 'Driver'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isOnline ? `${nearbyRequests.length} ride request${nearbyRequests.length !== 1 ? 's' : ''} nearby` : 'You are offline'}
          </p>
        </div>
        <button
          onClick={handleToggleOnline}
          disabled={toggleLoading}
          className={`px-4 py-2 rounded-full font-semibold text-sm transition-all ${
            isOnline
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
          }`}
        >
          {toggleLoading ? '...' : isOnline ? 'Online' : 'Offline'}
        </button>
      </div>

      {/* Map */}
      {/* [Z-INDEX] isolate creates stacking context — contains Leaflet's z-indexes within the map div */}
      <div className="flex-1 relative isolate">
        <MapView
          center={position ? [position.lat, position.lng] : undefined}
          userPosition={position ? { lat: position.lat, lng: position.lng } : undefined}
          className="h-full w-full"
        />

        {!isOnline && (
          /* [Z-INDEX] z-10 within isolated map container — covers map but not sibling panels */
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-10">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 text-center shadow-xl mx-4">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                You're Offline
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Go online to start receiving ride requests
              </p>
              <button
                onClick={handleToggleOnline}
                className="bg-primary-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-primary-700 transition-colors"
              >
                Go Online
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Ride Requests */}
      {isOnline && (
        /* [Z-INDEX] relative z-20 — ride request cards must be clickable above map */
      <div className="relative bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 max-h-[40vh] overflow-y-auto z-20">
          {error && <AlertError message={error} className="mx-4 mt-3" />}

          {nearbyRequests.length === 0 ? (
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                No ride requests nearby
              </p>
              <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                Stay online - new requests will appear here automatically
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                New Ride Requests
              </p>
              {nearbyRequests.map((ride) => (
                <RideRequestCard
                  key={ride.id}
                  ride={ride}
                  onAccept={() => handleAcceptRide(ride.id)}
                  loading={acceptingRideId === ride.id}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
