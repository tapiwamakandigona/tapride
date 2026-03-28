import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRide } from '../hooks/useRide';
import { useLocation as useGeoLocation } from '../hooks/useLocation';
import MapView from '../components/Map/MapView';
import RideRequestCard from '../components/Ride/RideRequestCard';
import { supabase } from '../lib/supabase';
import type { Ride } from '../types';

export default function DriverDashboard() {
  const navigate = useNavigate();
  const { profile, updateProfile } = useAuth();
  const { currentRide, acceptRide, updateDriverLocation, fetchNearbyRequests } = useRide();
  const { position, getCurrentLocation, startWatching } = useGeoLocation();
  const [isOnline, setIsOnline] = useState(profile?.is_online ?? false);
  const [nearbyRequests, setNearbyRequests] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Get current location on mount
  useEffect(() => {
    getCurrentLocation();
  }, [getCurrentLocation]);

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
      return;
    }

    const loadRequests = async () => {
      try {
        const requests = await fetchNearbyRequests();
        setNearbyRequests(requests);
      } catch {
        // Silently fail, will retry
      }
    };

    loadRequests();
    const interval = setInterval(loadRequests, 10000); // Poll every 10s

    // Also subscribe to new ride requests in realtime
    const channel = supabase
      .channel('new-ride-requests')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'rides', filter: 'status=eq.requested' },
        () => { loadRequests(); }
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

  // Navigate to active ride when ride is accepted/in_progress
  useEffect(() => {
    if (currentRide && (currentRide.status === 'accepted' || currentRide.status === 'in_progress')) {
      navigate('/ride/active', { replace: true });
    }
  }, [currentRide, navigate]);

  const handleToggleOnline = useCallback(async () => {
    setLoading(true);
    try {
      const newStatus = !isOnline;
      await updateProfile({ is_online: newStatus });
      setIsOnline(newStatus);

      if (!newStatus) {
        // Going offline: remove from driver_locations
        await supabase
          .from('driver_locations')
          .delete()
          .eq('driver_id', profile?.id);
      }
    } catch {
      setError('Failed to update status');
    } finally {
      setLoading(false);
    }
  }, [isOnline, profile?.id, updateProfile]);

  const handleAcceptRide = async (rideId: string) => {
    setLoading(true);
    setError('');
    try {
      await acceptRide(rideId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to accept ride';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
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
          disabled={loading}
          className={`px-4 py-2 rounded-full font-semibold text-sm transition-all ${
            isOnline
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
          }`}
        >
          {isOnline ? 'Online' : 'Offline'}
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
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No ride requests nearby. Stay online and they'll appear here.
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {nearbyRequests.map((ride) => (
                <RideRequestCard
                  key={ride.id}
                  ride={ride}
                  onAccept={() => handleAcceptRide(ride.id)}
                  loading={loading}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
