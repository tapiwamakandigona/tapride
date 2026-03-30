import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRide } from '../hooks/useRide';
import { useLocation as useGeoLocation } from '../hooks/useLocation';
import { getRoute, type RouteResult } from '../lib/geo';
import MapView from '../components/Map/MapView';
import SOSButton from '../components/Safety/SOSButton';
import { formatFare } from '../lib/fare';

export default function ActiveRide() {
  const navigate = useNavigate();
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
  const { position, startWatching } = useGeoLocation(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);

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

  // Fetch route for display
  useEffect(() => {
    if (!currentRide) return;
    let cancelled = false;
    getRoute(
      Number(currentRide.pickup_lat),
      Number(currentRide.pickup_lng),
      Number(currentRide.destination_lat),
      Number(currentRide.destination_lng)
    ).then((r) => {
      if (!cancelled) setRoute(r);
    });
    return () => { cancelled = true; };
  }, [currentRide?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ETA countdown timer
  useEffect(() => {
    if (currentRide?.status !== 'in_progress' || !route?.durationMin) {
      setEtaSeconds(null);
      return;
    }
    // Initialize ETA based on route duration
    setEtaSeconds(Math.ceil(route.durationMin * 60));
    const interval = setInterval(() => {
      setEtaSeconds((prev) => {
        if (prev === null || prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [currentRide?.status, route?.durationMin]);

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

  // Other party info
  const otherParty = isDriver ? currentRide.rider : currentRide.driver;
  const otherName = otherParty?.full_name;
  const otherRating = otherParty?.rating;
  const vehicleInfo = !isDriver && currentRide.driver
    ? [currentRide.driver.vehicle_color, currentRide.driver.vehicle_make, currentRide.driver.vehicle_model].filter(Boolean).join(' ')
    : null;
  const licensePlate = !isDriver ? currentRide.driver?.license_plate : null;

  return (
    <div className="flex flex-col h-full">
      {/* Status Bar */}
      <div className="px-4 pt-4 pb-2 bg-white dark:bg-gray-900 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(isDriver ? '/driver' : '/rider')}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Go back"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-700 dark:text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusColor[currentRide.status] || ''}`}>
              {statusLabel[currentRide.status] || currentRide.status}
            </span>
            {currentRide.status === 'in_progress' && etaSeconds !== null && etaSeconds > 0 && (
              <span className="ml-2 px-3 py-1 rounded-full text-xs font-bold bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
                Arriving in {Math.ceil(etaSeconds / 60)} min
              </span>
            )}
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
          pickupPosition={{ lat: Number(currentRide.pickup_lat), lng: Number(currentRide.pickup_lng) }}
          destinationPosition={{ lat: Number(currentRide.destination_lat), lng: Number(currentRide.destination_lng) }}
          driverPosition={driverPos}
          routeCoords={route?.coordinates}
          className="h-full w-full"
        />
      </div>

      {/* SOS Button */}
      <SOSButton ride={currentRide} />

      {/* Bottom Panel */}
      <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-4 py-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-2 mb-3">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Other party info */}
        {otherName && (
          <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-100 dark:border-gray-700">
            <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold">
              {otherName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900 dark:text-white text-sm">
                {otherName}
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                {otherRating != null && Number(otherRating) > 0 && (
                  <span>{Number(otherRating).toFixed(1)}/5</span>
                )}
                {vehicleInfo && <span>{vehicleInfo}</span>}
                {licensePlate && <span>({licensePlate})</span>}
              </div>
            </div>
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
              {formatFare(Number(currentRide.fare_estimate) || 0)}
            </p>
            {Number(currentRide.distance_km) > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {Number(currentRide.distance_km).toFixed(1)} km
                {route?.durationMin ? ` ~ ${Math.ceil(route.durationMin)} min` : ''}
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
              {loading ? 'Starting...' : 'Picked Up - Start Ride'}
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
              className={`${isDriver && currentRide.status === 'accepted' ? 'px-4' : 'flex-1'} py-3 rounded-xl border-2 border-red-500 text-red-500 font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50`}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
