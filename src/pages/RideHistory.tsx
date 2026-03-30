import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { formatFare } from '../lib/fare';
import type { Ride } from '../types';

export default function RideHistory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [scheduledRides, setScheduledRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchRides = async () => {
      setLoading(true);

      // Completed/cancelled rides
      const { data } = await supabase
        .from('rides')
        .select('*')
        .or(`rider_id.eq.${user.id},driver_id.eq.${user.id}`)
        .in('status', ['completed', 'cancelled'])
        .order('created_at', { ascending: false })
        .limit(50);

      setRides((data as Ride[]) || []);

      // Scheduled upcoming rides
      const { data: scheduled } = await supabase
        .from('rides')
        .select('*')
        .eq('rider_id', user.id)
        .not('scheduled_for', 'is', null)
        .eq('status', 'requested')
        .gte('scheduled_for', new Date().toISOString())
        .order('scheduled_for', { ascending: true })
        .limit(10);

      setScheduledRides((scheduled as Ride[]) || []);
      setLoading(false);
    };

    fetchRides();
  }, [user]);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'cancelled':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getRideTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      economy: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
      comfort: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
      xl: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    };
    return styles[type] || styles.economy;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatScheduledDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="min-h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 bg-white dark:bg-gray-900">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Ride History
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {rides.length} ride{rides.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Rides list */}
      <div className="px-4 pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Scheduled rides section */}
            {scheduledRides.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    📅 Scheduled Rides
                  </h2>
                  <button
                    onClick={() => navigate('/rides/scheduled')}
                    className="text-xs text-primary-600 dark:text-primary-400 font-semibold"
                  >
                    View All →
                  </button>
                </div>
                <div className="space-y-3">
                  {scheduledRides.slice(0, 3).map((ride) => (
                    <div key={ride.id} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                          📅 {ride.scheduled_for ? formatScheduledDate(ride.scheduled_for) : ''}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${getRideTypeBadge(ride.ride_type || 'economy')}`}>
                          {ride.ride_type || 'economy'}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
                          <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{ride.pickup_address || 'Pickup'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" />
                          <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{ride.destination_address || 'Destination'}</p>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white mt-2">
                        {formatFare(Number(ride.fare_estimate || 0))}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Past rides */}
            {rides.length === 0 ? (
              <div className="text-center py-12">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <h3 className="font-semibold text-gray-500 dark:text-gray-400 mb-1">
                  No rides yet
                </h3>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  Your completed rides will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {rides.map((ride) => (
                  <div
                    key={ride.id}
                    className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusStyle(ride.status)}`}>
                          {ride.status.charAt(0).toUpperCase() + ride.status.slice(1)}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${getRideTypeBadge(ride.ride_type || 'economy')}`}>
                          {ride.ride_type || 'economy'}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {formatDate(ride.created_at)}
                      </span>
                    </div>

                    <div className="space-y-1.5 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
                        <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                          {ride.pickup_address || `${Number(ride.pickup_lat).toFixed(4)}, ${Number(ride.pickup_lng).toFixed(4)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" />
                        <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                          {ride.destination_address || `${Number(ride.destination_lat).toFixed(4)}, ${Number(ride.destination_lng).toFixed(4)}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        {Number(ride.distance_km) > 0 && (
                          <span>{Number(ride.distance_km).toFixed(1)} km</span>
                        )}
                        {ride.promo_code && (
                          <span className="text-green-600 dark:text-green-400">🏷 Promo</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-bold text-gray-900 dark:text-white">
                          {formatFare(Number(ride.fare_final || ride.fare_estimate || 0))}
                        </p>
                        {ride.status === 'completed' && (
                          <button
                            onClick={() => navigate('/ride/receipt', { state: { ride } })}
                            className="text-xs text-primary-600 dark:text-primary-400 font-semibold hover:underline"
                          >
                            Receipt →
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
