import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRide } from '../hooks/useRide';
import { useLocation as useGeoLocation } from '../hooks/useLocation';
import MapView from '../components/Map/MapView';
import RideRequestCard from '../components/Ride/RideRequestCard';
import BidResponseCard from '../components/Ride/BidResponseCard';
import { supabase } from '../lib/supabase';
import type { Ride, VerificationStatus } from '../types';
import VerificationBadge from '../components/Driver/VerificationBadge';

// Play a beep sound using Web Audio API (no external files needed)
function playNewRequestSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
    // Play a second beep
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.value = 1100;
    osc2.type = 'sine';
    gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.3);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
    osc2.start(ctx.currentTime + 0.3);
    osc2.stop(ctx.currentTime + 0.8);
  } catch {
    // Silently fail — not all browsers support AudioContext
  }
}

function vibrateDevice() {
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
  } catch {
    // Silently fail
  }
}

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
  const [showVerificationPrompt, setShowVerificationPrompt] = useState(false);
  const prevRequestCount = useRef(0);
  const loadingRequestsRef = useRef(false);

  // Start watching location when online
  useEffect(() => {
    if (isOnline) {
      const stopWatching = startWatching();
      return () => { stopWatching(); };
    }
  }, [isOnline, startWatching]);

  // Update driver location in DB when position changes (while online)
  useEffect(() => {
    if (isOnline && position) {
      updateDriverLocation(position.lat, position.lng, position.heading, position.speed);
    }
  }, [isOnline, position, updateDriverLocation]);

  // Fetch nearby ride requests when online
  useEffect(() => {
    if (!isOnline) {
      setNearbyRequests([]);
      prevRequestCount.current = 0;
      return;
    }

    const loadRequests = async () => {
      // Debounce guard — skip if already loading
      if (loadingRequestsRef.current) return;
      loadingRequestsRef.current = true;
      try {
        const requests = await fetchNearbyRequests();
        const prevCount = prevRequestCount.current;

        // Play sound/vibrate OUTSIDE setState
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
        // Silently fail, will retry
      } finally {
        loadingRequestsRef.current = false;
      }
    };

    loadRequests();
    const interval = setInterval(loadRequests, 8000);

    // Subscribe to new ride requests in realtime
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
    // Check verification before going online
    const verificationStatus = (profile as unknown as Record<string, unknown>).verification_status as string;
    if (!isOnline && verificationStatus !== 'verified') {
      setShowVerificationPrompt(true);
      return;
    }
    setToggleLoading(true);
    try {
      const newStatus = !isOnline;
      await updateProfile({ is_online: newStatus });
      setIsOnline(newStatus);

      if (!newStatus) {
        // Going offline: remove from driver_locations
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
      // After accepting, navigate to active ride
      navigate('/ride/active');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to accept ride';
      setError(message);
      // Refresh the list since the ride may have been taken
      const requests = await fetchNearbyRequests();
      setNearbyRequests(requests);
    } finally {
      setAcceptingRideId(null);
    }
  };

  // Show loading spinner while useRide initializes
  if (initializing) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Active ride banner (instead of auto-redirect)
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
      <div className="px-4 pt-4 pb-2 bg-white dark:bg-gray-900 z-10 flex items-center justify-between">
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
      <div className="flex-1 relative">
        <MapView
          center={position ? [position.lat, position.lng] : undefined}
          userPosition={position ? { lat: position.lat, lng: position.lng } : undefined}
          className="h-full w-full"
        />

        {!isOnline && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-[1000]">
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
        <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 max-h-[40vh] overflow-y-auto">
          {error && (
            <div className="mx-4 mt-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-2">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

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
                Stay online — new requests will appear here automatically
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                New Ride Requests
              </p>
              {nearbyRequests.map((ride) => (
                <div key={ride.id} className="space-y-2">
                  <RideRequestCard
                    ride={ride}
                    onAccept={() => handleAcceptRide(ride.id)}
                    loading={acceptingRideId === ride.id}
                    driverLat={position?.lat}
                    driverLng={position?.lng}
                  />
                  <BidResponseCard
                    rideId={ride.id}
                    fareEstimate={Number(ride.fare_estimate) || 0}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Verification prompt modal */}
      {showVerificationPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-yellow-600 dark:text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white text-center mb-2">
              Verification Required
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-4">
              You need to complete driver verification before going online.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => { setShowVerificationPrompt(false); navigate('/driver/verify'); }}
                className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold transition-colors"
              >
                Start Verification
              </button>
              <button
                onClick={() => setShowVerificationPrompt(false)}
                className="w-full py-3 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
