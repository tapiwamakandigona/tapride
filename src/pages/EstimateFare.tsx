import { useState } from 'react';
import { Link } from 'react-router-dom';
import AddressSearch from '../components/Map/AddressSearch';
import { getRoute, type RouteResult } from '../lib/geo';
import { calculateFare, formatFare, type RideType } from '../lib/fare';

const rideTypes: { type: RideType; label: string; desc: string; icon: string; seats: string }[] = [
  { type: 'economy', label: 'Economy', desc: 'Affordable everyday rides', icon: '🚗', seats: '1-4' },
  { type: 'comfort', label: 'Comfort', desc: 'More space, newer cars', icon: '🚙', seats: '1-4' },
  { type: 'xl', label: 'XL', desc: 'SUVs & larger vehicles', icon: '🚐', seats: '1-6' },
];

export default function EstimateFare() {
  const [pickup, setPickup] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [destination, setDestination] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleEstimate = async () => {
    if (!pickup || !destination) return;
    setLoading(true);
    setError('');
    try {
      const result = await getRoute(pickup.lat, pickup.lng, destination.lat, destination.lng);
      if (result) {
        setRoute(result);
      } else {
        setError('Could not calculate route. Try different locations.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 pt-8 pb-4 px-6">
        <Link to="/login" className="inline-flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 mb-4 hover:underline">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Estimate a Fare
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          See prices before you sign up — no account needed
        </p>
      </div>

      {/* Address inputs */}
      <div className="px-6 space-y-3">
        <AddressSearch
          placeholder="Pickup location"
          icon="pickup"
          value={pickup?.name ?? ''}
          onSelect={(lat, lng, name) => { setPickup({ lat, lng, name }); setRoute(null); }}
        />
        <AddressSearch
          placeholder="Where to?"
          icon="destination"
          value={destination?.name ?? ''}
          onSelect={(lat, lng, name) => { setDestination({ lat, lng, name }); setRoute(null); }}
        />

        <button
          onClick={handleEstimate}
          disabled={!pickup || !destination || loading}
          className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors shadow-lg shadow-primary-600/25"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Calculating...
            </span>
          ) : (
            'Get Estimate'
          )}
        </button>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-3">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}
      </div>

      {/* Results */}
      {route && (
        <div className="flex-1 px-6 mt-6 animate-fade-in">
          {/* Route info */}
          <div className="flex items-center gap-4 mb-4 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {route.distanceKm.toFixed(1)} km
            </span>
            <span className="flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ~{Math.round(route.durationMin)} min
            </span>
          </div>

          {/* Ride type cards */}
          <div className="space-y-3">
            {rideTypes.map(({ type, label, desc, icon, seats }) => {
              const fare = calculateFare(route.distanceKm, route.durationMin, type);
              return (
                <div
                  key={type}
                  className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{icon}</span>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{label}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{seats} passengers</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                        {formatFare(fare)}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">est.</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* CTA */}
          <Link
            to="/register"
            className="block w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-xl text-center mt-6 shadow-lg shadow-primary-600/25 transition-colors"
          >
            Sign Up to Book a Ride
          </Link>

          <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-3 mb-6">
            Prices are estimates and may vary based on demand
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="flex-shrink-0 py-4 text-center mt-auto">
        <p className="text-gray-400 dark:text-gray-600 text-xs">
          Made by Tapiwa Makandigona
        </p>
      </div>
    </div>
  );
}
