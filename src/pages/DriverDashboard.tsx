import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRide } from '../hooks/useRide';
import { useLocation as useGeoLocation } from '../hooks/useLocation';
import MapView from '../components/Map/MapView';
import RideRequestCard from '../components/Ride/RideRequestCard';
import { supabase } from '../lib/supabase';
import type { Ride } from '../types';

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
  const prevRequestCount = useRef(0);

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
      try {
        const requests = await fetchNearbyRequests();
        setNearbyRequests((prev) => {
          // Notify if there are new requests
          if (requests.length > prev.length && prev.length > 0) {
            playNewRequestSound();
            vibrateDevice();
          } else if (requests.length > 0 && prevRequestCount.current === 0) {
            // First load with requests
            playNewRequestSound();
            vibrateDevice();
          }
          prevRequestCount.current = requests.length;
          return requests;
        });
      } catch {
        // Silently fail, will retry
      }
    };

    loadRequests();
    const interval = setInterval(loadRequests, 8000); // Poll every 8s (slightly faster)

    // Also subscribe to new ride requests in realtime
    const channel = supabase
      .channel('new-ride-requests')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'rides', filter: 'status=eq.requested' },
        () => {
          // New ride inserted — play sound and reload
          playNewRequestSound();
          vibrateDevice();
          loadRequests();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rides' },
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
