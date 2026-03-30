-- Migration 004: Rating tags, favorite locations, driver earnings view

-- 1. Add tags column to ratings table
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]';

-- 2. Create favorite_locations table
CREATE TABLE IF NOT EXISTS favorite_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Saved Place',
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'star',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast user lookup
CREATE INDEX IF NOT EXISTS idx_favorite_locations_user_id ON favorite_locations(user_id);

-- RLS for favorite_locations
ALTER TABLE favorite_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorites"
  ON favorite_locations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favorites"
  ON favorite_locations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own favorites"
  ON favorite_locations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites"
  ON favorite_locations FOR DELETE
  USING (auth.uid() = user_id);

-- 3. Create a view for driver earnings aggregation
CREATE OR REPLACE VIEW driver_earnings AS
SELECT
  r.driver_id,
  COUNT(*) AS total_rides,
  COALESCE(SUM(r.fare_final), 0) AS total_earnings,
  COALESCE(SUM(CASE WHEN r.completed_at::date = CURRENT_DATE THEN r.fare_final ELSE 0 END), 0) AS today_earnings,
  COALESCE(SUM(CASE WHEN r.completed_at >= date_trunc('week', CURRENT_DATE) THEN r.fare_final ELSE 0 END), 0) AS week_earnings,
  COALESCE(SUM(CASE WHEN r.completed_at >= date_trunc('month', CURRENT_DATE) THEN r.fare_final ELSE 0 END), 0) AS month_earnings
FROM rides r
WHERE r.status = 'completed' AND r.driver_id IS NOT NULL
GROUP BY r.driver_id;

-- Index for faster earnings queries
CREATE INDEX IF NOT EXISTS idx_rides_driver_completed ON rides(driver_id, completed_at) WHERE status = 'completed';
