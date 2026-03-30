import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { formatFare } from '../lib/fare';
import type { Ride } from '../types';

export default function RateRide() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();

  // Read the completed ride from router state (passed by ActiveRide)
  const stateRide: Ride | null = (location.state as { ride?: Ride } | null)?.ride ?? null;

  const [ride, setRide] = useState<Ride | null>(stateRide);
  const [rideLoading, setRideLoading] = useState(!stateRide);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const isDriver = profile?.user_type === 'driver';
  const homePath = isDriver ? '/driver' : '/rider';

  // Fallback: fetch last completed ride from DB if location.state is null (page refresh)
  useEffect(() => {
    if (stateRide || !user) {
      setRideLoading(false);
      return;
    }

    const fetchLastCompletedRide = async () => {
      try {
        const column = isDriver ? 'driver_id' : 'rider_id';
        const { data } = await supabase
          .from('rides')
          .select('*')
          .eq(column, user.id)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data) {
          setRide(data);
        }
      } catch (err) {
        console.warn('[TapRide] Failed to fetch last completed ride:', err);
      } finally {
        setRideLoading(false);
      }
    };

    fetchLastCompletedRide();
  }, [stateRide, user, isDriver]);

  const handleSubmit = async () => {
    if (rating === 0 || !ride || !user) return;

    // Guard: the person being rated must exist
    const ratedId = isDriver ? ride.rider_id : ride.driver_id;
    if (!ratedId) {
      // Can't rate if there's no counterpart — just navigate home
      navigate(homePath, { replace: true });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('ratings').insert({
        ride_id: ride.id,
        rater_id: user.id,
        rated_id: ratedId,
        score: rating,
        comment: comment.trim() || null,
      });

      if (error) throw error;

      setSubmitted(true);

      // Navigate to receipt after a short delay
      setTimeout(() => {
        navigate('/ride/receipt', { replace: true, state: { ride } });
      }, 1500);
    } catch {
      // Still navigate on error
      navigate(homePath, { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    navigate(homePath, { replace: true });
  };

  // Loading state for DB fallback
  if (rideLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // If no ride data was found even after DB fallback, show message
  if (!ride) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">No ride data available.</p>
          <button
            onClick={() => navigate(homePath, { replace: true })}
            className="bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-700 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="text-center animate-fade-in">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-green-600 dark:text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Thank you!
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Your rating has been submitted
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 p-4">
      <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full">
        {/* Ride summary */}
        <div className="w-full bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm mb-6">
          <h2 className="text-center text-lg font-semibold text-gray-900 dark:text-white mb-1">
            Ride Completed
          </h2>
          <p className="text-center text-2xl font-bold text-primary-600 dark:text-primary-400 mb-4">
            {formatFare(Number(ride.fare_final || ride.fare_estimate) || 0)}
          </p>

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
              <p className="text-gray-600 dark:text-gray-400 truncate">
                {ride.pickup_address || 'Pickup'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" />
              <p className="text-gray-600 dark:text-gray-400 truncate">
                {ride.destination_address || 'Destination'}
              </p>
            </div>
            {Number(ride.distance_km) > 0 && (
              <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                Distance: {Number(ride.distance_km).toFixed(1)} km
              </p>
            )}
          </div>
        </div>

        {/* Rating */}
        <div className="w-full bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
          <h3 className="text-center font-semibold text-gray-900 dark:text-white mb-1">
            Rate your {isDriver ? 'rider' : 'driver'}
          </h3>
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-4">
            How was your experience?
          </p>

          {/* Stars */}
          <div className="flex justify-center gap-2 mb-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="transition-transform hover:scale-110"
                aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`w-10 h-10 ${
                    star <= (hoveredRating || rating)
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-gray-300 dark:text-gray-600'
                  } transition-colors`}
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </button>
            ))}
          </div>

          {/* Comment */}
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Leave a comment (optional)"
            rows={3}
            maxLength={500}
            className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all resize-none mb-4"
          />

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleSkip}
              className="px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Skip
            </button>
            <button
              onClick={handleSubmit}
              disabled={rating === 0 || loading}
              className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? 'Submitting...' : 'Submit Rating'}
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-4">
        <p className="text-gray-400 dark:text-gray-600 text-xs">
          Made by Tapiwa Makandigona
        </p>
      </div>
    </div>
  );
}
