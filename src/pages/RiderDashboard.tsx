import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRide } from '../hooks/useRide';
import { useLocation as useGeoLocation } from '../hooks/useLocation';
import { reverseGeocode } from '../lib/geo';
import { haversineDistance } from '../lib/geo';
import MapView from '../components/Map/MapView';
import RideRequestForm from '../components/Ride/RideRequestForm';
import type { LocationCoords } from '../types';

const MIN_RIDE_DISTANCE_KM = 0.1; // 100 meters minimum

export default function RiderDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { currentRide, initializing, requestRide, cancelRide } = useRide();
  const { position, error: locationError, getCurrentLocation } = useGeoLocation();
  const [pickup, setPickup] = useState<LocationCoords | null>(null);
  const [destination, setDestination] = useState<LocationCoords | null>(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [destAddress, setDestAddress] = useState('');
  const [selectingFor, setSelectingFor] = useState<'pickup' | 'destination' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Get current location on mount
  useEffect(() => {
    getCurrentLocation();
  }, [getCurrentLocation]);

  // Set pickup to current location
  useEffect(() => {
    if (position && !pickup) {
      setPickup({ lat: position.lat, lng: position.lng });
      reverseGeocode(position.lat, position.lng).then(setPickupAddress);
    }
  }, [position, pickup]);

  // Navigate to active ride screen when ride is accepted
  useEffect(() => {
    if (currentRide && (currentRide.status === 'accepted' || currentRide.status === 'in_progress')) {
      navigate('/ride/active', { replace: true });
    }
  }, [currentRide, navigate]);

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

  const handleRequestRide = async () => {
    if (!pickup || !destination) {
      setError('Please set both pickup and destination');
      return;
    }

    // Validate minimum distance
    const dist = haversineDistance(pickup.lat, pickup.lng, destination.lat, destination.lng);
    if (dist < MIN_RIDE_DISTANCE_KM) {
      setError('Pickup and destination are too close. Please choose locations at least 100m apart.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await requestRide(
        pickup.lat, pickup.lng, pickupAddress || 'Pickup location',
        destination.lat, destination.lng, destAddress || 'Destination'
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

  return (
    <div className="flex flex-col h-full">
      {/* Greeting */}
      <div className="px-4 pt-4 pb-2 bg-white dark:bg-gray-900 z-10">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          Hi, {profile?.full_name?.split(' ')[0] || 'Rider'}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Where are you going today?
        </p>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <MapView
          center={position ? [position.lat, position.lng] : undefined}
          userPosition={position ? { lat: position.lat, lng: position.lng } : undefined}
          pickupPosition={pickup || undefined}
          destinationPosition={destination || undefined}
          onMapClick={selectingFor ? handleMapClick : undefined}
          className="h-full w-full"
        />

        {/* Selecting indicator */}
        {selectingFor && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-primary-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium z-[1000]">
            Tap map to set {selectingFor}
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
                  Estimated fare: ${currentRide.fare_estimate?.toFixed(2)}
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
        ) : (
          /* Ride request form */
          <RideRequestForm
            pickup={pickup}
            destination={destination}
            onSelectPickup={() => setSelectingFor('pickup')}
            onSelectDestination={() => setSelectingFor('destination')}
            onRequestRide={handleRequestRide}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
}
