import type { Ride } from '../../types';
import { formatFare } from '../../lib/fare';

interface ReceiptCardProps {
  ride: Ride;
  onViewReceipt: () => void;
}

export default function ReceiptCard({ ride, onViewReceipt }: ReceiptCardProps) {
  const fare = Number(ride.fare_final || ride.fare_estimate || 0);
  const distance = Number(ride.distance_km || 0);
  const rideType = ride.ride_type || 'economy';
  const rideDate = new Date(ride.created_at);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            Completed
          </span>
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary-100 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400 capitalize">
            {rideType}
          </span>
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {rideDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      </div>

      <div className="space-y-1 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
          <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{ride.pickup_address || 'Pickup'}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" />
          <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{ride.destination_address || 'Destination'}</p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          {distance > 0 && <span>{distance.toFixed(1)} km</span>}
          {ride.promo_code && (
            <span className="text-green-600 dark:text-green-400">🏷 Promo applied</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <p className="font-bold text-gray-900 dark:text-white">{formatFare(fare)}</p>
          <button
            onClick={onViewReceipt}
            className="text-xs text-primary-600 dark:text-primary-400 font-semibold hover:underline"
          >
            Receipt →
          </button>
        </div>
      </div>
    </div>
  );
}
