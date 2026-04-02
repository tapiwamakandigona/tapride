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
  const { currentRide, driverLocation, initializing, requestRide, cancelRide, loading: rideLoading } = useRide();
  const { position, error: locationError } = useGeoLocation();
  const [pickup, setPickup] = useState<LocationCoords | null>(null);
  const [destination, setDestination] = useState<LocationCoords | null>(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [destAddress, setDestAddress] = useState('');
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [selectingFor, setSelectingFor] = useState<'pickup' | 'destination' | null>(null);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
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
    setCancelling(true);
    setError('');
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
    } finally {
      setCancelling(false);
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

  // Ride states
  const isRequested = currentRide?.status === 'requested';
  const isAccepted = currentRide?.status === 'accepted';
  const isInProgress = currentRide?.status === 'in_progress';
  const hasActiveRide = isAccepted || isInProgress;

  // Driver info when ride is accepted
  const driverName = currentRide?.driver?.full_name;
  const driverRating = currentRide?.driver?.rating;
  const vehicleInfo = currentRide?.driver
    ? [currentRide.driver.vehicle_color, currentRide.driver.vehicle_make, currentRide.driver.vehicle_model].filter(Boolean).join(' ')
    : null;
  const licensePlate = currentRide?.driver?.license_plate;

  // Driver position for map
  const driverPos = driverLocation ? { lat: driverLocation.lat, lng: driverLocation.lng } : undefined;

  return (
    <div className="flex flex-col h-full">
      {/* Active ride banner — only for accepted/in_progress */}
      {hasActiveRide && (
        <button
          onClick={() => navigate('/ride/active')}
          className="w-full px-4 py-3 bg-primary-600 text-white text-sm font-semibold flex items-center justify-between z-10"
        >
          <span>
            {isAccepted ? 'Driver is on the way - tap to view' : 'Ride in progress - tap to view'}
          </span>
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
          {isRequested ? 'Finding you a driver...' : hasActiveRide ? 'You have an active ride' : 'Where are you going today?'}
        </p>
      </div>

      {/* Address search inputs — only when no ride */}
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
          pickupPosition={pickup || (currentRide ? { lat: Number(currentRide.pickup_lat), lng: Number(currentRide.pickup_lng) } : undefined)}
          destinationPosition={destination || (currentRide ? { lat: Number(currentRide.destination_lat), lng: Number(currentRide.destination_lng) } : undefined)}
          driverPosition={driverPos}
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

        {isRequested ? (
          /* Waiting for driver */
          <div className="space-y-3">
            <div className="flex items-center gap-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl p-4">
              <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
              </div>
              <div className="flex-1">
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
              disabled={cancelling}
              className="w-full py-3 rounded-xl border-2 border-red-500 text-red-500 font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
            >
              {cancelling ? 'Cancelling...' : 'Cancel Request'}
            </button>
          </div>
        ) : hasActiveRide ? (
          /* Active ride info */
          <div className="space-y-3">
            {/* Driver info card */}
            {(driverName || vehicleInfo) && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
                    {driverName ? driverName.charAt(0).toUpperCase() : 'D'}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {driverName || 'Your Driver'}
                    </p>
                    {vehicleInfo && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {vehicleInfo}{licensePlate ? ` (${licensePlate})` : ''}
                      </p>
                    )}
                    {driverRating != null && Number(driverRating) > 0 && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        Rating: {Number(driverRating).toFixed(1)}/5
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => navigate('/ride/active')}
                className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                View Ride
              </button>
              <button
                onClick={() => navigate('/ride/chat')}
                className="px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Chat
              </button>
            </div>
          </div>
        ) : (
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
              loading={loading || rideLoading}
            />
            <p className="text-center text-xs text-gray-400 dark:text-gray-600">
              Or tap the map to set locations
            </p>
          </>
        )}
      </div>
    </div>
  );
}
