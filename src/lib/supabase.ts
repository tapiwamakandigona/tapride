import { createClient, SupabaseClient } from '@supabase/supabase-js';

// [INTENT] Create singleton Supabase client from environment variables
// [CONSTRAINT] Warn at module load if credentials missing — prevents silent auth failures
// [EDGE-CASE] Vite injects env at build time; missing vars produce empty string, not undefined
// [CHANGE] No longer throws — renders a visible error instead of white screen
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase: SupabaseClient;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[TapRide] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
    'Auth and data features will not work. Check your .env file or GitHub Secrets.'
  );
  // Create a dummy client pointed at localhost so the app still renders
  // (auth/data calls will fail gracefully instead of white-screening)
  supabase = createClient('http://localhost:0', 'missing-key');
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export { supabase };
