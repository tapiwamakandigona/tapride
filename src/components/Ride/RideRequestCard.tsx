import type { Ride } from '../../types';
import { formatFare } from '../../lib/fare';

interface RideRequestCardProps {
  ride: Ride;
  onAccept: () => void;
  loading: boolean;
}

export default function RideRequestCard({ ride, onAccept, loading }: RideRequestCardProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md p-4 mb-3 border border-gray-100 dark:border-gray-800 animate-fade-in">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-green-500 shrink-0" />
            <p className="text-sm font-medium truncate">{ride.pickup_address}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
            <p className="text-sm font-medium truncate">{ride.destination_address}</p>
          </div>
        </div>
        <div className="text-right ml-3">
          <p className="text-lg font-bold text-primary-600 dark:text-primary-400">
            {formatFare(ride.fare_estimate)}
          </p>
          <p className="text-xs text-gray-500">{ride.distance_km} km</p>
        </div>
      </div>

      {ride.rider && (
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-sm font-bold text-primary-600">
            {ride.rider.full_name?.charAt(0) || 'R'}
          </div>
          <div>
            <p className="text-sm font-medium">{ride.rider.full_name || 'Rider'}</p>
            <p className="text-xs text-gray-500">
              Rating: {(ride.rider.rating ?? 0).toFixed(1)} / 5
            </p>
          </div>
        </div>
      )}

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
