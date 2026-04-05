-- ============================================
-- 002_security.sql — Server-side validation for rides
-- ============================================

-- ============================================
-- 1. ONLY DRIVERS CAN ACCEPT RIDES
-- Trigger validates that the user setting status to 'accepted'
-- actually has user_type = 'driver' in profiles.
-- ============================================

CREATE OR REPLACE FUNCTION public.validate_driver_accepts_ride()
RETURNS TRIGGER AS $$
DECLARE
  _user_type TEXT;
BEGIN
  -- Only check when transitioning from 'requested' to 'accepted'
  IF OLD.status = 'requested' AND NEW.status = 'accepted' THEN
    SELECT user_type INTO _user_type
    FROM public.profiles
    WHERE id = auth.uid();

    IF _user_type IS NULL OR _user_type != 'driver' THEN
      RAISE EXCEPTION 'Only drivers can accept rides';
    END IF;

    -- Ensure driver_id is set to the accepting driver
    IF NEW.driver_id IS NULL OR NEW.driver_id != auth.uid() THEN
      NEW.driver_id := auth.uid();
    END IF;

    -- Set accepted_at timestamp
    NEW.accepted_at := now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_validate_driver_accepts ON public.rides;
CREATE TRIGGER trg_validate_driver_accepts
  BEFORE UPDATE ON public.rides
  FOR EACH ROW EXECUTE FUNCTION public.validate_driver_accepts_ride();


-- ============================================
-- 2. SERVER-SIDE FARE VALIDATION
-- Recalculates fare from distance_km on INSERT to prevent
-- a modified client from submitting fare_estimate = 0.
-- Formula: max(base_fare + per_km * distance_km, min_fare)
--   base_fare = 2.0, per_km = 0.5, min_fare = 3.0
-- Overrides fare_estimate if it deviates >10% from expected.
-- ============================================

CREATE OR REPLACE FUNCTION public.validate_fare_estimate()
RETURNS TRIGGER AS $$
DECLARE
  _base_fare  NUMERIC := 2.0;
  _per_km     NUMERIC := 0.5;
  _min_fare   NUMERIC := 3.0;
  _expected   NUMERIC;
  _deviation  NUMERIC;
BEGIN
  _expected := GREATEST(_base_fare + _per_km * NEW.distance_km, _min_fare);

  -- Calculate deviation; guard against zero expected
  IF _expected > 0 THEN
    _deviation := ABS(NEW.fare_estimate - _expected) / _expected;
  ELSE
    _deviation := 1; -- force override if expected is somehow 0
  END IF;

  -- Override if submitted fare deviates more than 10%
  IF _deviation > 0.10 THEN
    NEW.fare_estimate := ROUND(_expected, 2);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_validate_fare ON public.rides;
CREATE TRIGGER trg_validate_fare
  BEFORE INSERT ON public.rides
  FOR EACH ROW EXECUTE FUNCTION public.validate_fare_estimate();


-- ============================================
-- 3. AUTO-EXPIRE STALE RIDE REQUESTS
-- Marks rides as 'cancelled' if they've been in 'requested'
-- status for more than 10 minutes.
--
-- NOTE: Supabase free tier does not include pg_cron.
-- Call this function on a schedule via:
--   - A Supabase Edge Function invoked by an external cron (e.g. cron-job.org)
--   - pg_cron if available: SELECT cron.schedule('expire-rides', '*/2 * * * *', $$SELECT public.expire_stale_requests()$$);
-- ============================================

CREATE OR REPLACE FUNCTION public.expire_stale_requests()
RETURNS INTEGER AS $$
DECLARE
  _count INTEGER;
BEGIN
  UPDATE public.rides
  SET status = 'cancelled'
  WHERE status = 'requested'
    AND created_at < now() - INTERVAL '10 minutes';

  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- 4. RATE LIMIT: ONE ACTIVE RIDE PER RIDER
-- Prevents a rider from creating a new ride if they already
-- have one in 'requested', 'accepted', or 'in_progress' status.
-- ============================================

CREATE OR REPLACE FUNCTION public.enforce_one_active_ride()
RETURNS TRIGGER AS $$
DECLARE
  _active_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO _active_count
  FROM public.rides
  WHERE rider_id = NEW.rider_id
    AND status IN ('requested', 'accepted', 'in_progress');

  IF _active_count > 0 THEN
    RAISE EXCEPTION 'You already have an active ride. Complete or cancel it before requesting a new one.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_one_active_ride ON public.rides;
CREATE TRIGGER trg_one_active_ride
  BEFORE INSERT ON public.rides
  FOR EACH ROW EXECUTE FUNCTION public.enforce_one_active_ride();
