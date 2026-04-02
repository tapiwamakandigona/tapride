import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRide } from '../hooks/useRide';
import { useLocation as useGeoLocation } from '../hooks/useLocation';
import { getRoute, type RouteResult } from '../lib/geo';
import MapView from '../components/Map/MapView';
import { formatFare } from '../lib/fare';
import { PageSpinner } from '../components/ui/Spinner';
import AlertError from '../components/ui/AlertError';

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

  const isDriver = profile?.user_type === 'driver';

  // [INTENT] Redirect away from active ride screen when there's nothing to show
  // [EDGE-CASE] Completed rides redirect to rating; cancelled/missing rides go to dashboard
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

  // [INTENT] Fetch OSRM route for map polyline and ETA display
  // [CONSTRAINT] Only re-fetches when ride ID changes, not on every render
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
  }, [currentRide?.id]); // eslint-disable-line react-hooks/exhaustive-deps — intentionally depends only on ride ID

  // [INTENT] Start GPS watch when driver views active ride — needed for real-time location sharing
  // [CONSTRAINT] Must return cleanup function to stop watch on unmount or role change
  useEffect(() => {
    if (isDriver) {
      const stop = startWatching();
      return () => { stop(); };
    }
  }, [isDriver, startWatching]);

  // [INTENT] Push driver GPS to Supabase so rider can track in real-time
  // [CONSTRAINT] Fires on every position change — Supabase upsert handles dedup
  useEffect(() => {
    if (isDriver && position) {
      updateDriverLocation(position.lat, position.lng, position.heading, position.speed);
    }
  }, [isDriver, position, updateDriverLocation]);

  // [INTENT] Block render until useRide resolves active ride from DB — prevents flash of wrong state
  if (initializing) return <PageSpinner />;

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

  // [INTENT] Show the other side's profile (driver sees rider info, rider sees driver info)
  const otherParty = isDriver ? currentRide.rider : currentRide.driver;
  const otherName = otherParty?.full_name;
  const otherRating = otherParty?.rating;
  const vehicleInfo = !isDriver && currentRide.driver
    ? [currentRide.driver.vehicle_color, currentRide.driver.vehicle_make, currentRide.driver.vehicle_model].filter(Boolean).join(' ')
    : null;
  const licensePlate = !isDriver ? currentRide.driver?.license_plate : null;

  return (
    <div className="flex flex-col h-full">
      {/* [INTENT] Status bar with back button + ride status badge + chat shortcut */}
      {/* [Z-INDEX] z-20 relative — must sit above the map container (Leaflet uses z-index internally) */}
      <div className="relative px-4 pt-4 pb-2 bg-white dark:bg-gray-900 z-20">
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

      {/* [Z-INDEX] isolate creates a new stacking context — Leaflet's internal z-indexes (400+) won't bleed into sibling panels */}
      <div className="flex-1 isolate">
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

      {/* [Z-INDEX] relative z-20 — must stack above map to receive clicks on action buttons */}
      <div className="relative bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-4 py-4 z-20">
        {error && <AlertError message={error} className="mb-3" />}

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
