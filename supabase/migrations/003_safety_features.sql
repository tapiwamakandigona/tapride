-- 003: Safety Features, Promo Codes, Scheduling, Driver Verification

-- ============================================
-- SOS ALERTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.sos_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sos_alerts_ride_id ON public.sos_alerts(ride_id);
CREATE INDEX IF NOT EXISTS idx_sos_alerts_user_id ON public.sos_alerts(user_id);

-- ============================================
-- PROFILE EXTENSIONS
-- ============================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS drivers_license_url TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_registration_url TEXT,
  ADD COLUMN IF NOT EXISTS profile_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected'));

-- ============================================
-- PROMO CODES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(10,2) NOT NULL,
  max_uses INTEGER NOT NULL DEFAULT 100,
  current_uses INTEGER NOT NULL DEFAULT 0,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  min_fare NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- USER PROMOS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_promos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  promo_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  ride_id UUID REFERENCES public.rides(id) ON DELETE SET NULL,
  discount_applied NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_promos_user_id ON public.user_promos(user_id);

-- ============================================
-- RIDES EXTENSIONS
-- ============================================
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS promo_code TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ride_type TEXT DEFAULT 'economy'
    CHECK (ride_type IN ('economy', 'comfort', 'xl'));

-- ============================================
-- APP CONFIG: scheduled rides
-- ============================================
INSERT INTO public.app_config (key, value)
VALUES ('scheduled_rides_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- RLS FOR NEW TABLES
-- ============================================
ALTER TABLE public.sos_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_promos ENABLE ROW LEVEL SECURITY;

-- SOS alerts: users can create and view own
CREATE POLICY "Users can create SOS alerts"
  ON public.sos_alerts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own SOS alerts"
  ON public.sos_alerts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own SOS alerts"
  ON public.sos_alerts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Promo codes: readable by all authenticated
CREATE POLICY "Promo codes are readable"
  ON public.promo_codes FOR SELECT
  TO authenticated
  USING (true);

-- User promos: own records only
CREATE POLICY "Users can view own promos"
  ON public.user_promos FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own promos"
  ON public.user_promos FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- REALTIME FOR SOS
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.sos_alerts;
