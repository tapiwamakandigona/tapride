import type { Ride } from '../../types';
import { formatFare } from '../../lib/fare';
import { distanceToPickup } from '../../lib/matching';

interface RideRequestCardProps {
  ride: Ride;
  onAccept: () => void;
  loading: boolean;
  driverLat?: number;
  driverLng?: number;
}

export default function RideRequestCard({ ride, onAccept, loading, driverLat, driverLng }: RideRequestCardProps) {
  const riderName = ride.rider?.full_name || 'Rider';
  const riderRating = ride.rider?.rating;
  const ratingDisplay = riderRating != null && riderRating > 0
    ? `${Number(riderRating).toFixed(1)}/5`
    : 'No rating yet';
  const distanceDisplay = typeof ride.distance_km === 'number'
    ? Number(ride.distance_km).toFixed(1)
    : ride.distance_km;

  // Distance from driver to pickup
  const pickupDistance = (driverLat != null && driverLng != null)
    ? distanceToPickup(driverLat, driverLng, Number(ride.pickup_lat), Number(ride.pickup_lng))
    : null;

  const rideTypeLabel = ride.ride_type && ride.ride_type !== 'economy'
    ? ride.ride_type.charAt(0).toUpperCase() + ride.ride_type.slice(1)
    : null;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md p-4 mb-3 border border-gray-100 dark:border-gray-800 animate-fade-in">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-green-500 shrink-0" />
            <p className="text-sm font-medium truncate">{ride.pickup_address || 'Pickup'}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
            <p className="text-sm font-medium truncate">{ride.destination_address || 'Destination'}</p>
          </div>
        </div>
        <div className="text-right ml-3">
          <p className="text-lg font-bold text-primary-600 dark:text-primary-400">
            {formatFare(Number(ride.fare_estimate) || 0)}
          </p>
          <p className="text-xs text-gray-500">{distanceDisplay} km</p>
          {rideTypeLabel && (
            <span className="inline-block mt-0.5 px-1.5 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-xs font-medium rounded">
              {rideTypeLabel}
            </span>
          )}
        </div>
      </div>

      {/* Rider info + distance to pickup */}
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-100 dark:border-gray-800">
        <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-sm font-bold text-primary-600">
          {riderName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">{riderName}</p>
          <p className="text-xs text-gray-500">{ratingDisplay}</p>
        </div>
        {pickupDistance !== null && (
          <div className="text-right">
            <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
              {pickupDistance < 1 ? `${Math.round(pickupDistance * 1000)}m` : `${pickupDistance.toFixed(1)}km`}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">to pickup</p>
          </div>
        )}
      </div>

      <button
        onClick={() => onAccept()}
        disabled={loading}
        className="w-full py-2.5 rounded-lg bg-green-500 hover:bg-green-600 text-white font-semibold text-sm disabled:opacity-50 transition-colors"
      >
        {loading ? 'Accepting...' : 'Accept Ride'}
      </button>
    </div>
  );
}
