import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatFare } from '../lib/fare';
import type { Ride } from '../types';

export default function RideReceipt() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const isDriver = profile?.user_type === 'driver';

  // Read ride from router state
  const ride: Ride | null = (location.state as { ride?: Ride } | null)?.ride ?? null;

  if (!ride) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">No receipt data available.</p>
          <button
            onClick={() => navigate(isDriver ? '/driver' : '/rider', { replace: true })}
            className="bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-700 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const fare = Number(ride.fare_final || ride.fare_estimate || 0);
  const distance = Number(ride.distance_km || 0);
  const rideType = ride.ride_type || 'economy';
  const promoDiscount = Number((ride as unknown as Record<string, unknown>).promo_discount || 0);

  // Approximate breakdown
  const baseFare = 2.0;
  const distanceCharge = Math.round(0.5 * distance * 100) / 100;
  const durationMin = ride.started_at && ride.completed_at
    ? (new Date(ride.completed_at).getTime() - new Date(ride.started_at).getTime()) / 60000
    : distance * 2;
  const timeCharge = Math.round(0.15 * durationMin * 100) / 100;
  const subtotal = baseFare + distanceCharge + timeCharge;
  const multiplier = fare > 0 && subtotal > 0 ? Math.round((fare / subtotal) * 100) / 100 : 1;

  const rideDate = new Date(ride.created_at);
  const otherParty = isDriver ? ride.rider : ride.driver;

  const handleShare = async () => {
    const text = `TapRide Receipt\n${rideDate.toLocaleDateString()} ${rideDate.toLocaleTimeString()}\nFrom: ${ride.pickup_address}\nTo: ${ride.destination_address}\nDistance: ${distance.toFixed(1)} km\nTotal: ${formatFare(fare)}\n${promoDiscount > 0 ? `Promo discount: -${formatFare(promoDiscount)}\n` : ''}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'TapRide Receipt', text });
        return;
      } catch { /* fallback to clipboard */ }
    }
    await navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
        <button
          onClick={() => navigate(isDriver ? '/driver' : '/rider', { replace: true })}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-700 dark:text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Ride Receipt</h1>
      </div>

      <div className="flex-1 px-4 py-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm max-w-md mx-auto">
          {/* Logo / title */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-primary-600 dark:text-primary-400">TapRide</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {rideDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {rideDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          {/* Route */}
          <div className="space-y-2 mb-6">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-green-500 rounded-full flex-shrink-0" />
              <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{ride.pickup_address || 'Pickup'}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-red-500 rounded-full flex-shrink-0" />
              <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{ride.destination_address || 'Destination'}</p>
            </div>
          </div>

          {/* Static map placeholder */}
          <div className="bg-gray-100 dark:bg-gray-700 rounded-xl h-32 flex items-center justify-center mb-6">
            <p className="text-xs text-gray-400 dark:text-gray-500">Route map</p>
          </div>

          {/* Ride info */}
          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mb-6">
            <span className="px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 text-xs font-semibold capitalize">
              {rideType}
            </span>
            {distance > 0 && <span>{distance.toFixed(1)} km</span>}
            {durationMin > 0 && <span>{Math.ceil(durationMin)} min</span>}
          </div>

          {/* Fare breakdown */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Base fare</span>
              <span className="text-gray-900 dark:text-white">{formatFare(baseFare)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Distance ({distance.toFixed(1)} km)</span>
              <span className="text-gray-900 dark:text-white">{formatFare(distanceCharge)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Time ({Math.ceil(durationMin)} min)</span>
              <span className="text-gray-900 dark:text-white">{formatFare(timeCharge)}</span>
            </div>
            {multiplier > 1 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Multiplier (surge + type)</span>
                <span className="text-gray-900 dark:text-white">×{multiplier.toFixed(2)}</span>
              </div>
            )}
            {promoDiscount > 0 && (
              <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                <span>Promo discount</span>
                <span>-{formatFare(promoDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-gray-900 dark:text-white">Total</span>
              <span className="text-primary-600 dark:text-primary-400">{formatFare(fare)}</span>
            </div>
          </div>

          {/* Other party info */}
          {otherParty && (
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider font-semibold">
                {isDriver ? 'Rider' : 'Driver'}
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold">
                  {(otherParty.full_name || 'U')[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">{otherParty.full_name}</p>
                  {otherParty.rating != null && Number(otherParty.rating) > 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500">{Number(otherParty.rating).toFixed(1)}/5 ⭐</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom actions */}
      <div className="px-4 pb-6 space-y-3 max-w-md mx-auto w-full">
        <button
          onClick={handleShare}
          className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          Share Receipt
        </button>
        <button
          onClick={() => navigate(isDriver ? '/driver' : '/rider', { replace: true })}
          className="w-full py-3 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
