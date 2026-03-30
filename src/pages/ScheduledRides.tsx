import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLoadingTimeout } from '../hooks/useLoadingTimeout';
import RetryError from '../components/Layout/RetryError';
import { supabase } from '../lib/supabase';
import { formatFare } from '../lib/fare';
import type { Ride } from '../types';

export default function ScheduledRides() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const { slow, timedOut } = useLoadingTimeout(loading);

  const fetchScheduled = async () => {
    if (!user) return;
    setLoading(true);
    setFetchError(false);
    try {
    const { data } = await supabase
      .from('rides')
      .select('*')
      .eq('rider_id', user.id)
      .not('scheduled_for', 'is', null)
      .in('status', ['requested'])
      .gte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(20);

    setRides((data as Ride[]) || []);
    } catch {
      setFetchError(true);
    } finally {
    setLoading(false);
    }
  };

  useEffect(() => { fetchScheduled(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCancel = async (rideId: string) => {
    setCancellingId(rideId);
    await supabase.from('rides').update({ status: 'cancelled' }).eq('id', rideId);
    setRides((prev) => prev.filter((r) => r.id !== rideId));
    setCancellingId(null);
  };

  const formatScheduledDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <div className="px-4 pt-6 pb-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-700 dark:text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Scheduled Rides</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{rides.length} upcoming</p>
        </div>
      </div>

      <div className="flex-1 px-4 py-4">
        {loading ? (
          (timedOut || fetchError) ? (
            <RetryError message="Couldn't load scheduled rides" onRetry={fetchScheduled} />
          ) : (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
            {slow && <p className="text-sm text-gray-400 dark:text-gray-500">Taking longer than expected…</p>}
          </div>
          )
        ) : rides.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 font-medium">No scheduled rides</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Schedule a ride from the home screen</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rides.map((ride) => (
              <div key={ride.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    📅 {ride.scheduled_for ? formatScheduledDate(ride.scheduled_for) : ''}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary-100 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400 capitalize">
                    {ride.ride_type || 'economy'}
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
                  <p className="font-bold text-gray-900 dark:text-white">{formatFare(Number(ride.fare_estimate || 0))}</p>
                  <button
                    onClick={() => handleCancel(ride.id)}
                    disabled={cancellingId === ride.id}
                    className="text-xs text-red-500 font-semibold hover:underline disabled:opacity-50"
                  >
                    {cancellingId === ride.id ? 'Cancelling...' : 'Cancel'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
