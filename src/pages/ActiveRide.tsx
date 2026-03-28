import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRide } from '../hooks/useRide';
import { useLocation as useGeoLocation } from '../hooks/useLocation';
import MapView from '../components/Map/MapView';
import { formatFare } from '../lib/fare';
import type { Ride } from '../types';

export default function ActiveRide() {
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const { profile } = useAuth();
  const {
    currentRide,
    driverLocation,
    initializing,
    startRide,
    completeRide,
    cancelRide,
    updateDriverLocation,
  } = useRide();
  const { position, startWatching } = useGeoLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isDriver = profile?.user_type === 'driver';

  // If no active ride (after initializing completes), redirect back
  useEffect(() => {
    if (initializing) return;
    if (!currentRide || currentRide.status === 'completed' || currentRide.status === 'cancelled') {
      if (currentRide?.status === 'completed') {
        navigate('/ride/rate', { replace: true, state: { ride: currentRide } });
      } else {
        const path = isDriver ? '/driver' : '/rider';
        navigate(path, { replace: true });
      }
    }
  }, [currentRide, initializing, isDriver, navigate]);

  // Driver: track own location
  useEffect(() => {
    if (isDriver) {
      const stop = startWatching();
      return () => { stop(); };
    }
  }, [isDriver, startWatching]);

  // Driver: update location in DB
  useEffect(() => {
    if (isDriver && position) {
      updateDriverLocation(position.lat, position.lng, position.heading, position.speed);
    }
  }, [isDriver, position, updateDriverLocation]);

  // Show loading while initializing
  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentRide) return null;

  const handleStartRide = async () => {
    setLoading(true);
    setError('');
    try {
      await startRide(currentRide.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start ride');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteRide = async () => {
    setLoading(true);
    setError('');
    try {
      const completedRide = await completeRide(currentRide.id);
      navigate('/ride/rate', { replace: true, state: { ride: completedRide } });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to complete ride');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    setLoading(true);
    setError('');
    try {
      await cancelRide(currentRide.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to cancel ride');
    } finally {
      setLoading(false);
    }
  };

  const statusLabel: Record<string, string> = {
    requested: 'Waiting for driver',
    accepted: isDriver ? 'Head to pickup' : 'Driver is on the way',
    in_progress: 'Ride in progress',
  };

  const statusColor: Record<string, string> = {
    requested: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    accepted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    in_progress: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  };

  const driverPos = isDriver
    ? position ? { lat: position.lat, lng: position.lng } : undefined
    : driverLocation ? { lat: driverLocation.lat, lng: driverLocation.lng } : undefined;

  return (
    <div className="flex flex-col h-full">
      {/* Status Bar */}
      <div className="px-4 pt-4 pb-2 bg-white dark:bg-gray-900 z-10">
        <div className="flex items-center justify-between">
          <div>
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusColor[currentRide.status] || ''}`}>
              {statusLabel[currentRide.status] || currentRide.status}
            </span>
          </div>
          <button
            onClick={() => navigate('/ride/chat')}
            className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-full text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Chat
          </button>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1">
        <MapView
          center={driverPos ? [driverPos.lat, driverPos.lng] : undefined}
          userPosition={!isDriver && position ? { lat: position.lat, lng: position.lng } : undefined}
          pickupPosition={{ lat: currentRide.pickup_lat, lng: currentRide.pickup_lng }}
          destinationPosition={{ lat: currentRide.destination_lat, lng: currentRide.destination_lng }}
          driverPosition={driverPos}
          className="h-full w-full"
        />
      </div>

      {/* Bottom Panel */}
      <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-4 py-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-2 mb-3">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Ride info */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2.5 h-2.5 bg-green-500 rounded-full" />
              <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                {currentRide.pickup_address || 'Pickup'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-red-500 rounded-full" />
              <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                {currentRide.destination_address || 'Destination'}
              </p>
            </div>
          </div>
          <div className="text-right ml-4">
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {formatFare(currentRide.fare_estimate || 0)}
            </p>
            {currentRide.distance_km > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {currentRide.distance_km.toFixed(1)} km
              </p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          {isDriver && currentRide.status === 'accepted' && (
            <button
              onClick={handleStartRide}
              disabled={loading}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? 'Starting...' : 'Start Ride'}
            </button>
          )}

          {isDriver && currentRide.status === 'in_progress' && (
            <button
              onClick={handleCompleteRide}
              disabled={loading}
              className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? 'Completing...' : 'Complete Ride'}
            </button>
          )}

          {currentRide.status !== 'in_progress' && (
            <button
              onClick={handleCancel}
              disabled={loading}
              className={`${isDriver ? 'px-4' : 'flex-1'} py-3 rounded-xl border-2 border-red-500 text-red-500 font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors`}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
