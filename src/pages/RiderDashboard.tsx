import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRide } from '../hooks/useRide';
import { useLocation as useGeoLocation } from '../hooks/useLocation';
import { reverseGeocode, getRoute, type RouteResult } from '../lib/geo';
import { haversineDistance } from '../lib/geo';
import MapView from '../components/Map/MapView';
import AddressSearch from '../components/Map/AddressSearch';
import RideRequestForm from '../components/Ride/RideRequestForm';
import type { LocationCoords } from '../types';

const MIN_RIDE_DISTANCE_KM = 0.1; // 100 meters minimum

export default function RiderDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { currentRide, initializing, requestRide, cancelRide } = useRide();
  const { position, error: locationError } = useGeoLocation();
  const [pickup, setPickup] = useState<LocationCoords | null>(null);
  const [destination, setDestination] = useState<LocationCoords | null>(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [destAddress, setDestAddress] = useState('');
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [selectingFor, setSelectingFor] = useState<'pickup' | 'destination' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Set pickup to current location
  useEffect(() => {
    if (position && !pickup) {
      setPickup({ lat: position.lat, lng: position.lng });
      reverseGeocode(position.lat, position.lng).then(setPickupAddress);
    }
  }, [position, pickup]);

  // Fetch route when both pickup and destination are set
  useEffect(() => {
    if (!pickup || !destination) {
      setRoute(null);
      return;
    }
    let cancelled = false;
    getRoute(pickup.lat, pickup.lng, destination.lat, destination.lng).then((r) => {
      if (!cancelled) setRoute(r);
    });
    return () => { cancelled = true; };
  }, [pickup, destination]);

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    if (selectingFor === 'pickup') {
      setPickup({ lat, lng });
      setSelectingFor(null);
      const addr = await reverseGeocode(lat, lng);
      setPickupAddress(addr);
    } else if (selectingFor === 'destination') {
      setDestination({ lat, lng });
      setSelectingFor(null);
      const addr = await reverseGeocode(lat, lng);
      setDestAddress(addr);
    }
  }, [selectingFor]);

  const handlePickupSearch = useCallback((lat: number, lng: number, name: string) => {
    setPickup({ lat, lng });
    setPickupAddress(name);
  }, []);

  const handleDestSearch = useCallback((lat: number, lng: number, name: string) => {
    setDestination({ lat, lng });
    setDestAddress(name);
  }, []);

  const handleRequestRide = async () => {
    if (!pickup || !destination) {
      setError('Please set both pickup and destination');
      return;
    }

    // Validate minimum distance
    const dist = route?.distanceKm ?? haversineDistance(pickup.lat, pickup.lng, destination.lat, destination.lng);
    if (dist < MIN_RIDE_DISTANCE_KM) {
      setError('Pickup and destination are too close. Please choose locations at least 100m apart.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await requestRide(
        pickup.lat, pickup.lng, pickupAddress || 'Pickup location',
        destination.lat, destination.lng, destAddress || 'Destination',
        route?.distanceKm
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to request ride';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRide = async () => {
    if (!currentRide) return;
    try {
      await cancelRide(currentRide.id);
      setPickup(null);
      setDestination(null);
      setPickupAddress('');
      setDestAddress('');
      setRoute(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to cancel ride';
      setError(message);
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
          className="w-full px-4 py-3 bg-primary-600 text-white text-sm font-semibold flex items-center justify-between z-10"
        >
          <span>You have an active ride - tap to view</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}

      {/* Greeting */}
      <div className="px-4 pt-4 pb-2 bg-white dark:bg-gray-900 z-10">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          Hi, {profile?.full_name?.split(' ')[0] || 'Rider'}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Where are you going today?
        </p>
      </div>

      {/* Address search inputs */}
      {!currentRide && (
        <div className="px-4 py-2 bg-white dark:bg-gray-900 space-y-2 z-10">
          <AddressSearch
            placeholder="Pickup location"
            icon="pickup"
            value={pickupAddress}
            onSelect={handlePickupSearch}
          />
          <AddressSearch
            placeholder="Where are you going?"
            icon="destination"
            value={destAddress}
            onSelect={handleDestSearch}
          />
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative">
        <MapView
          center={position ? [position.lat, position.lng] : undefined}
          userPosition={position ? { lat: position.lat, lng: position.lng } : undefined}
          pickupPosition={pickup || undefined}
          destinationPosition={destination || undefined}
          routeCoords={route?.coordinates}
          onMapClick={selectingFor ? handleMapClick : undefined}
          className="h-full w-full"
        />

        {/* Selecting indicator */}
        {selectingFor && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium z-[1000]">
            <span>Tap map to set {selectingFor}</span>
            <button
              onClick={() => setSelectingFor(null)}
              className="ml-1 w-5 h-5 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {locationError && (
          <div className="absolute top-4 left-4 right-4 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-4 py-2 rounded-xl text-sm z-[1000]">
            {locationError}
          </div>
        )}
      </div>

      {/* Bottom Panel */}
      <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-4 py-4 space-y-3">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-2">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {currentRide && currentRide.status === 'requested' ? (
          /* Waiting for driver */
          <div className="space-y-3">
            <div className="flex items-center gap-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl p-4">
              <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  Looking for a driver...
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Estimated fare: ${Number(currentRide.fare_estimate || 0).toFixed(2)}
                </p>
              </div>
            </div>
            <button
              onClick={handleCancelRide}
              className="w-full py-3 rounded-xl border-2 border-red-500 text-red-500 font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              Cancel Request
            </button>
          </div>
        ) : !hasActiveRide ? (
          /* Ride request form */
          <>
            <RideRequestForm
              pickup={pickup}
              destination={destination}
              pickupAddress={pickupAddress}
              destAddress={destAddress}
              distanceKm={route?.distanceKm}
              durationMin={route?.durationMin}
              onSelectPickup={() => setSelectingFor('pickup')}
              onSelectDestination={() => setSelectingFor('destination')}
              onRequestRide={handleRequestRide}
              loading={loading}
            />
            <p className="text-center text-xs text-gray-400 dark:text-gray-600">
              Or tap the map to set locations
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
