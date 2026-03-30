import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export type BidType = 'rider_initial' | 'driver_counter' | 'rider_counter';
export type BidStatus = 'pending' | 'accepted' | 'declined' | 'expired';

export interface FareBid {
  id: string;
  ride_id: string;
  bidder_id: string;
  amount: number;
  bid_type: BidType;
  status: BidStatus;
  created_at: string;
  expires_at: string;
}

const BID_MIN_PERCENT = 0.7;
const BID_MAX_PERCENT = 1.5;

export function useBidding(rideId: string | null) {
  const { user } = useAuth();
  const [bids, setBids] = useState<FareBid[]>([]);
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Fetch bids for ride
  const fetchBids = useCallback(async () => {
    if (!rideId) return;
    const { data } = await supabase
      .from('fare_bids')
      .select('*')
      .eq('ride_id', rideId)
      .order('created_at', { ascending: true });
    if (data && mountedRef.current) setBids(data as FareBid[]);
  }, [rideId]);

  // Realtime subscription
  useEffect(() => {
    if (!rideId) return;
    fetchBids();

    const channel = supabase
      .channel(`bids-${rideId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'fare_bids',
        filter: `ride_id=eq.${rideId}`,
      }, () => { fetchBids(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [rideId, fetchBids]);

  // Place a bid
  const placeBid = async (amount: number, bidType: BidType) => {
    if (!rideId || !user) throw new Error('Not authenticated');
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('fare_bids')
        .insert({
          ride_id: rideId,
          bidder_id: user.id,
          amount,
          bid_type: bidType,
          status: 'pending',
          expires_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data as FareBid;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  // Respond to a bid (accept/decline)
  const respondToBid = async (bidId: string, status: 'accepted' | 'declined') => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('fare_bids')
        .update({ status })
        .eq('id', bidId);
      if (error) throw new Error(error.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  // Get latest pending bid
  const latestPendingBid = bids.filter(b => b.status === 'pending').slice(-1)[0] || null;
  const acceptedBid = bids.find(b => b.status === 'accepted') || null;

  return {
    bids,
    latestPendingBid,
    acceptedBid,
    loading,
    placeBid,
    respondToBid,
    fetchBids,
    BID_MIN_PERCENT,
    BID_MAX_PERCENT,
  };
}
