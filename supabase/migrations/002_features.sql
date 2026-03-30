-- ============================================
-- 002_features.sql — Bidding, Matching, Cancellations
-- ============================================

-- Seed surge multiplier
INSERT INTO public.app_config (key, value)
VALUES ('surge_multiplier', '1.0')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- Add ride_type to rides
-- ============================================
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS ride_type TEXT NOT NULL DEFAULT 'economy'
    CHECK (ride_type IN ('economy', 'comfort', 'xl'));

-- ============================================
-- FARE BIDS TABLE (InDrive-style bidding)
-- ============================================
CREATE TABLE IF NOT EXISTS public.fare_bids (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  bidder_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  bid_type TEXT NOT NULL CHECK (bid_type IN ('rider_initial', 'driver_counter', 'rider_counter')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '2 minutes')
);

CREATE INDEX IF NOT EXISTS idx_fare_bids_ride_id ON public.fare_bids(ride_id);
CREATE INDEX IF NOT EXISTS idx_fare_bids_status ON public.fare_bids(status);

-- RLS
ALTER TABLE public.fare_bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bid participants can view bids"
  ON public.fare_bids FOR SELECT
  TO authenticated
  USING (
    bidder_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.rides
      WHERE rides.id = fare_bids.ride_id
      AND (rides.rider_id = auth.uid() OR rides.driver_id = auth.uid())
    )
  );

CREATE POLICY "Authenticated users can create bids"
  ON public.fare_bids FOR INSERT
  TO authenticated
  WITH CHECK (bidder_id = auth.uid());

CREATE POLICY "Bid participants can update bids"
  ON public.fare_bids FOR UPDATE
  TO authenticated
  USING (
    bidder_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.rides
      WHERE rides.id = fare_bids.ride_id
      AND (rides.rider_id = auth.uid() OR rides.driver_id = auth.uid())
    )
  );

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.fare_bids;

-- ============================================
-- CANCELLATION FIELDS on profiles
-- ============================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cancellation_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancellation_fee_balance NUMERIC(10,2) NOT NULL DEFAULT 0;

-- ============================================
-- SMART DRIVER MATCHING — PostGIS RPC
-- ============================================
CREATE OR REPLACE FUNCTION public.find_nearby_drivers(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_km DOUBLE PRECISION DEFAULT 10,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  driver_id UUID,
  full_name TEXT,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_color TEXT,
  license_plate TEXT,
  rating NUMERIC,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  distance_km DOUBLE PRECISION
)
LANGUAGE sql STABLE
AS $$
  SELECT
    dl.driver_id,
    p.full_name,
    p.vehicle_make,
    p.vehicle_model,
    p.vehicle_color,
    p.license_plate,
    p.rating,
    dl.lat,
    dl.lng,
    ST_DistanceSphere(
      ST_MakePoint(dl.lng, dl.lat),
      ST_MakePoint(p_lng, p_lat)
    ) / 1000.0 AS distance_km
  FROM public.driver_locations dl
  JOIN public.profiles p ON p.id = dl.driver_id
  WHERE p.is_online = true
    AND p.user_type = 'driver'
    AND ST_DistanceSphere(
      ST_MakePoint(dl.lng, dl.lat),
      ST_MakePoint(p_lng, p_lat)
    ) <= p_radius_km * 1000
  ORDER BY distance_km ASC
  LIMIT p_limit;
$$;
