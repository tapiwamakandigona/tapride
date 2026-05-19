/**
 * RideHistory page — paginated list of past rides for the current user.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RideCard } from '@/components/RideCard';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useRide } from '@/hooks/useRide';
import type { Ride } from '@/types';

/** Displays all historical rides for the signed-in user. */
const RideHistory: React.FC = () => {
  const navigate = useNavigate();
  const { fetchHistory, loading } = useRide();
  const [rides, setRides] = useState<Ride[]>([]);

  useEffect(() => {
    fetchHistory().then(setRides);
  }, [fetchHistory]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="bg-white px-4 py-4 shadow-sm">
        <h1 className="text-lg font-bold text-gray-900">Ride History</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 space-y-3">
        {loading && (
          <div className="flex justify-center py-10">
            <LoadingSpinner label="Loading…" />
          </div>
        )}

        {!loading && rides.length === 0 && (
          <div className="rounded-xl bg-white border border-gray-100 p-8 text-center">
            <div className="text-4xl mb-2">📋</div>
            <p className="text-sm text-gray-500">No rides yet</p>
          </div>
        )}

        {rides.map((ride) => (
          <RideCard
            key={ride.$id}
            ride={ride}
            onClick={() => {
              if (ride.status === 'inprogress' || ride.status === 'accepted') {
                navigate(`/ride/${ride.$id}`);
              }
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default RideHistory;
