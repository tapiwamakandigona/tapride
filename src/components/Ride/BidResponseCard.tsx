import { useState } from 'react';
import { formatFare } from '../../lib/fare';
import { useBidding } from '../../hooks/useBidding';

interface BidResponseCardProps {
  rideId: string;
  fareEstimate: number;
}

export default function BidResponseCard({ rideId, fareEstimate }: BidResponseCardProps) {
  const { latestPendingBid, acceptedBid, loading, placeBid, respondToBid, BID_MIN_PERCENT, BID_MAX_PERCENT } = useBidding(rideId);
  const minBid = Math.round(fareEstimate * BID_MIN_PERCENT * 100) / 100;
  const maxBid = Math.round(fareEstimate * BID_MAX_PERCENT * 100) / 100;
  const [counterAmount, setCounterAmount] = useState(fareEstimate);
  const [showCounter, setShowCounter] = useState(false);

  if (acceptedBid) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 border border-green-200 dark:border-green-800">
        <p className="text-sm font-semibold text-green-700 dark:text-green-400">
          ✅ Fare agreed: {formatFare(acceptedBid.amount)}
        </p>
      </div>
    );
  }

  const riderBid = latestPendingBid &&
    (latestPendingBid.bid_type === 'rider_initial' || latestPendingBid.bid_type === 'rider_counter')
    ? latestPendingBid : null;

  if (!riderBid) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
        Waiting for rider's fare proposal...
      </div>
    );
  }

  const handleCounter = async () => {
    const clamped = Math.min(maxBid, Math.max(minBid, counterAmount));
    await respondToBid(riderBid.id, 'declined');
    await placeBid(clamped, 'driver_counter');
    setShowCounter(false);
  };

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 border border-yellow-200 dark:border-yellow-800 space-y-3">
      <div>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Rider proposed: <span className="font-bold text-lg text-primary-600 dark:text-primary-400">{formatFare(riderBid.amount)}</span>
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Estimate was {formatFare(fareEstimate)}
        </p>
      </div>

      {showCounter ? (
        <div className="space-y-2">
          <input
            type="range"
            min={minBid}
            max={maxBid}
            step={0.5}
            value={counterAmount}
            onChange={(e) => setCounterAmount(parseFloat(e.target.value))}
            className="w-full accent-primary-600"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>{formatFare(minBid)}</span>
            <span className="font-bold text-primary-600">{formatFare(counterAmount)}</span>
            <span>{formatFare(maxBid)}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCounter}
              disabled={loading}
              className="flex-1 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm disabled:opacity-50"
            >
              {loading ? '...' : 'Send Counter'}
            </button>
            <button
              onClick={() => setShowCounter(false)}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => respondToBid(riderBid.id, 'accepted')}
            disabled={loading}
            className="flex-1 py-2.5 rounded-lg bg-green-500 hover:bg-green-600 text-white font-semibold text-sm disabled:opacity-50 transition-colors"
          >
            Accept
          </button>
          <button
            onClick={() => { setCounterAmount(fareEstimate); setShowCounter(true); }}
            disabled={loading}
            className="flex-1 py-2.5 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white font-semibold text-sm disabled:opacity-50 transition-colors"
          >
            Counter
          </button>
          <button
            onClick={() => respondToBid(riderBid.id, 'declined')}
            disabled={loading}
            className="flex-1 py-2.5 rounded-lg border border-red-300 dark:border-red-700 text-red-500 font-semibold text-sm disabled:opacity-50 transition-colors"
          >
            Decline
          </button>
        </div>
      )}
    </div>
  );
}
