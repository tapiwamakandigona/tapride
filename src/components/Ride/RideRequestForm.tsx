import type { LocationCoords } from '../../types';
import { calculateFare, formatFare } from '../../lib/fare';

interface RideRequestFormProps {
  pickup: LocationCoords | null;
  destination: LocationCoords | null;
  pickupAddress?: string;
  destAddress?: string;
  distanceKm?: number;
  durationMin?: number;
  onSelectPickup: () => void;
  onSelectDestination: () => void;
  onRequestRide: () => void;
  loading: boolean;
}

export default function RideRequestForm({
  pickup,
  destination,
  pickupAddress,
  destAddress,
  distanceKm,
  durationMin,
  onSelectPickup,
  onSelectDestination,
  onRequestRide,
  loading,
}: RideRequestFormProps) {
  const distance = distanceKm ?? 0;
  const fare = distance > 0 ? calculateFare(distance) : 0;
  const eta = durationMin ? Math.ceil(durationMin) : null;

  return (
    <div className="space-y-3">
      {/* Pickup */}
      <button
        type="button"
        onClick={onSelectPickup}
        className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0">
          <div className="w-3 h-3 bg-green-500 rounded-full" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">PICKUP</p>
          <p className="text-sm text-gray-900 dark:text-white truncate">
            {pickup
              ? (pickupAddress || `${pickup.lat.toFixed(4)}, ${pickup.lng.toFixed(4)}`)
              : 'Set pickup location'}
          </p>
        </div>
        {pickup && (
          <span className="text-xs text-green-600 dark:text-green-400 font-medium flex-shrink-0">Set</span>
        )}
      </button>

      {/* Destination */}
      <button
        type="button"
        onClick={onSelectDestination}
        className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0">
          <div className="w-3 h-3 bg-red-500 rounded-full" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">DESTINATION</p>
          <p className="text-sm text-gray-900 dark:text-white truncate">
            {destination
              ? (destAddress || `${destination.lat.toFixed(4)}, ${destination.lng.toFixed(4)}`)
              : 'Where are you going?'}
          </p>
        </div>
        {destination && (
          <span className="text-xs text-red-600 dark:text-red-400 font-medium flex-shrink-0">Set</span>
        )}
      </button>

      {/* Fare estimate */}
      {distance > 0 && (
        <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Distance</span>
            <span className="font-medium text-gray-900 dark:text-white">{distance.toFixed(1)} km</span>
          </div>
          {eta && (
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-600 dark:text-gray-400">ETA</span>
              <span className="font-medium text-gray-900 dark:text-white">{eta} min</span>
            </div>
          )}
          <div className="flex justify-between text-sm mt-1">
            <span className="text-gray-600 dark:text-gray-400">Estimated fare</span>
            <span className="font-bold text-primary-600 dark:text-primary-400 text-lg">
              {formatFare(fare)}
            </span>
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={onRequestRide}
        disabled={!pickup || !destination || loading}
        className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold transition-colors shadow-lg shadow-primary-600/25"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Requesting...
          </span>
        ) : (
          'Request Ride'
        )}
      </button>
    </div>
  );
}
