import { createClient } from '@supabase/supabase-js';

// [INTENT] Create singleton Supabase client from environment variables
// [CONSTRAINT] Fail loudly at module load if credentials missing — prevents silent auth failures
// [EDGE-CASE] Vite injects env at build time; missing vars produce empty string, not undefined
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[TapRide] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
    'Set them in your .env file.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
