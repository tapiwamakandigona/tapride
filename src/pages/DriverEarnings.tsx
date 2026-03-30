import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLoadingTimeout } from '../hooks/useLoadingTimeout';
import RetryError from '../components/Layout/RetryError';
import { supabase } from '../lib/supabase';
import { formatFare } from '../lib/fare';
import type { Ride } from '../types';

interface DailyEarning {
  date: string;
  amount: number;
}

export default function DriverEarnings() {
  const { user } = useAuth();
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [weekEarnings, setWeekEarnings] = useState(0);
  const [monthEarnings, setMonthEarnings] = useState(0);
  const [allTimeEarnings, setAllTimeEarnings] = useState(0);
  const [recentRides, setRecentRides] = useState<Ride[]>([]);
  const [dailyChart, setDailyChart] = useState<DailyEarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const { slow, timedOut } = useLoadingTimeout(loading);

  useEffect(() => {
    if (!user) return;
    fetchEarnings();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchEarnings = async () => {
    if (!user) return;
    setLoading(true);
    setFetchError(false);

    try {
      // Fetch all completed rides for this driver
      const { data: rides } = await supabase
        .from('rides')
        .select('*')
        .eq('driver_id', user.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false });

      if (!rides) {
        setLoading(false);
        return;
      }

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      let today = 0, week = 0, month = 0, allTime = 0;

      const dailyMap: Record<string, number> = {};

      for (const ride of rides) {
        const fare = Number(ride.fare_final) || 0;
        const completedAt = ride.completed_at ? new Date(ride.completed_at) : null;
        allTime += fare;

        if (completedAt) {
          if (completedAt >= todayStart) today += fare;
          if (completedAt >= weekStart) week += fare;
          if (completedAt >= monthStart) month += fare;

          // Daily chart (last 7 days)
          const dateKey = completedAt.toISOString().slice(0, 10);
          dailyMap[dateKey] = (dailyMap[dateKey] || 0) + fare;
        }
      }

      setTodayEarnings(today);
      setWeekEarnings(week);
      setMonthEarnings(month);
      setAllTimeEarnings(allTime);
      setRecentRides(rides.slice(0, 10));

      // Build last 7 days chart
      const chartData: DailyEarning[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(todayStart);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        chartData.push({ date: key, amount: dailyMap[key] || 0 });
      }
      setDailyChart(chartData);
    } catch (err) {
      console.warn('[TapRide] Failed to fetch earnings:', err);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  };

  const maxChartAmount = Math.max(...dailyChart.map(d => d.amount), 1);

  const formatDay = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en', { weekday: 'short' });
  };

  if (loading) {
    if (timedOut || fetchError) {
      return <RetryError message="Couldn't load earnings" onRetry={fetchEarnings} />;
    }
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 gap-2">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        {slow && <p className="text-sm text-gray-400 dark:text-gray-500">Taking longer than expected…</p>}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 pb-24">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 bg-white dark:bg-gray-900">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Earnings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track your income</p>
      </div>

      {/* Earnings Cards */}
      <div className="px-4 grid grid-cols-2 gap-3 mb-6">
        <EarningsCard label="Today" amount={todayEarnings} color="bg-green-500" />
        <EarningsCard label="This Week" amount={weekEarnings} color="bg-blue-500" />
        <EarningsCard label="This Month" amount={monthEarnings} color="bg-purple-500" />
        <EarningsCard label="All Time" amount={allTimeEarnings} color="bg-primary-600" />
      </div>

      {/* Daily Chart */}
      <div className="px-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Last 7 Days</h3>
          <div className="flex items-end justify-between gap-2 h-32">
            {dailyChart.map((day) => (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  {day.amount > 0 ? `$${day.amount.toFixed(0)}` : ''}
                </span>
                <div
                  className="w-full bg-primary-500 dark:bg-primary-400 rounded-t-md transition-all"
                  style={{
                    height: `${Math.max((day.amount / maxChartAmount) * 100, day.amount > 0 ? 8 : 2)}%`,
                    minHeight: '2px',
                  }}
                />
                <span className="text-[10px] text-gray-400 dark:text-gray-500">{formatDay(day.date)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cash Out Button */}
      <div className="px-4 mb-6">
        <button className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold transition-colors flex items-center justify-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          Cash Out
        </button>
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-1">Coming soon</p>
      </div>

      {/* Recent Rides */}
      <div className="px-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Recent Rides</h3>
        {recentRides.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 text-center">
            <p className="text-gray-400 dark:text-gray-500">No completed rides yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentRides.map((ride) => (
              <div
                key={ride.id}
                className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm flex items-center justify-between"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {ride.destination_address || 'Destination'}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {ride.completed_at
                      ? new Date(ride.completed_at).toLocaleDateString('en', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Completed'}
                    {Number(ride.distance_km) > 0 && ` · ${Number(ride.distance_km).toFixed(1)} km`}
                  </p>
                </div>
                <span className="text-sm font-bold text-green-600 dark:text-green-400 ml-3">
                  +{formatFare(Number(ride.fare_final) || 0)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EarningsCard({ label, amount, color }: { label: string; amount: number; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <p className="text-xl font-bold text-gray-900 dark:text-white">{formatFare(amount)}</p>
    </div>
  );
}
