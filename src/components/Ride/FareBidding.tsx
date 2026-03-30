import { useState } from 'react';
import { formatFare } from '../../lib/fare';
import { useBidding } from '../../hooks/useBidding';

interface FareBiddingProps {
  rideId: string;
  fareEstimate: number;
}

export default function FareBidding({ rideId, fareEstimate }: FareBiddingProps) {
  const { bids, latestPendingBid, acceptedBid, loading, placeBid, respondToBid, BID_MIN_PERCENT, BID_MAX_PERCENT } = useBidding(rideId);
  const minBid = Math.round(fareEstimate * BID_MIN_PERCENT * 100) / 100;
  const maxBid = Math.round(fareEstimate * BID_MAX_PERCENT * 100) / 100;
  const [bidAmount, setBidAmount] = useState(fareEstimate);

  const handlePropose = async () => {
    const clamped = Math.min(maxBid, Math.max(minBid, bidAmount));
    await placeBid(clamped, 'rider_initial');
  };

  const handleCounter = async () => {
    const clamped = Math.min(maxBid, Math.max(minBid, bidAmount));
    await placeBid(clamped, 'rider_counter');
  };

  // If a bid was accepted
  if (acceptedBid) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
        <p className="text-sm font-semibold text-green-700 dark:text-green-400">
          ✅ Fare agreed: {formatFare(acceptedBid.amount)}
        </p>
      </div>
    );
  }

  // Show driver's counter-offer if pending
  const driverCounter = latestPendingBid?.bid_type === 'driver_counter' ? latestPendingBid : null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">Propose Your Fare</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Est: {formatFare(fareEstimate)}
        </p>
      </div>

      {driverCounter ? (
        <div className="space-y-3">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              Driver countered: <span className="font-bold">{formatFare(driverCounter.amount)}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => respondToBid(driverCounter.id, 'accepted')}
              disabled={loading}
              className="flex-1 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-semibold text-sm disabled:opacity-50 transition-colors"
            >
              Accept
            </button>
            <button
              onClick={() => respondToBid(driverCounter.id, 'declined')}
              disabled={loading}
              className="flex-1 py-2 rounded-lg border border-red-300 dark:border-red-700 text-red-500 font-semibold text-sm disabled:opacity-50 transition-colors"
            >
              Decline
            </button>
          </div>
          {/* Counter-offer slider */}
          <div>
            <input
              type="range"
              min={minBid}
              max={maxBid}
              step={0.5}
              value={bidAmount}
              onChange={(e) => setBidAmount(parseFloat(e.target.value))}
              className="w-full accent-primary-600"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>{formatFare(minBid)}</span>
              <span className="font-bold text-primary-600 dark:text-primary-400">{formatFare(bidAmount)}</span>
              <span>{formatFare(maxBid)}</span>
            </div>
            <button
              onClick={handleCounter}
              disabled={loading}
              className="w-full mt-2 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm disabled:opacity-50 transition-colors"
            >
              {loading ? 'Sending...' : 'Counter Offer'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            type="range"
            min={minBid}
            max={maxBid}
            step={0.5}
            value={bidAmount}
            onChange={(e) => setBidAmount(parseFloat(e.target.value))}
            className="w-full accent-primary-600"
          />
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{formatFare(minBid)}</span>
            <span className="font-bold text-lg text-primary-600 dark:text-primary-400">{formatFare(bidAmount)}</span>
            <span>{formatFare(maxBid)}</span>
          </div>
          <button
            onClick={handlePropose}
            disabled={loading || bids.some(b => b.bid_type === 'rider_initial' && b.status === 'pending')}
            className="w-full py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm disabled:opacity-50 transition-colors"
          >
            {loading ? 'Sending...' : bids.some(b => b.bid_type === 'rider_initial' && b.status === 'pending') ? 'Waiting for driver...' : 'Propose Fare'}
          </button>
        </div>
      )}
    </div>
  );
}
