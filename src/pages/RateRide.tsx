import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRide } from '../hooks/useRide';
import { supabase } from '../lib/supabase';
import { formatFare } from '../lib/fare';

export default function RateRide() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { currentRide, clearCurrentRide } = useRide();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const isDriver = profile?.user_type === 'driver';

  const handleSubmit = async () => {
    if (rating === 0 || !currentRide || !user) return;

    setLoading(true);
    try {
      const ratedId = isDriver ? currentRide.rider_id : currentRide.driver_id;

      await supabase.from('ratings').insert({
        ride_id: currentRide.id,
        rater_id: user.id,
        rated_id: ratedId,
        score: rating,
        comment: comment.trim() || null,
      });

      setSubmitted(true);

      // Navigate after a short delay
      setTimeout(() => {
        clearCurrentRide();
        navigate(isDriver ? '/driver' : '/rider', { replace: true });
      }, 1500);
    } catch {
      // Still navigate on error
      clearCurrentRide();
      navigate(isDriver ? '/driver' : '/rider', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    clearCurrentRide();
    navigate(isDriver ? '/driver' : '/rider', { replace: true });
  };

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
          {currentRide && (
            <p className="text-center text-2xl font-bold text-primary-600 dark:text-primary-400 mb-4">
              {formatFare(currentRide.fare_final || currentRide.fare_estimate || 0)}
            </p>
          )}

          {currentRide && (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
                <p className="text-gray-600 dark:text-gray-400 truncate">
                  {currentRide.pickup_address || 'Pickup'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" />
                <p className="text-gray-600 dark:text-gray-400 truncate">
                  {currentRide.destination_address || 'Destination'}
                </p>
              </div>
              {currentRide.distance_km && (
                <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                  Distance: {currentRide.distance_km.toFixed(1)} km
                </p>
              )}
            </div>
          )}
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
