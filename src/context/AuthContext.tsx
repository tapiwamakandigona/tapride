import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, metadata?: Record<string, string>) => Promise<{ error: string | null; userType?: string; confirmationRequired?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null; userType?: string }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// [INTENT] Safety net — if Supabase auth hangs (network, extension interference), unblock the UI
// [CONSTRAINT] 8s is generous enough for slow mobile networks but prevents infinite loading spinner
const AUTH_LOADING_TIMEOUT_MS = 8000;

// [INTENT] Allowlist prevents accidental write of sensitive or computed fields to profiles table
const PROFILE_ALLOWED_FIELDS = [
  'full_name', 'phone', 'avatar_url', 'user_type',
  'vehicle_make', 'vehicle_model', 'vehicle_color', 'license_plate',
  'is_online', 'current_lat', 'current_lng',
] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  // [INTENT] Monotonic counter discards stale profile fetches from overlapping auth events
  // [EDGE-CASE] getSession and onAuthStateChange both trigger fetchProfile — second call must win
  const profileFetchId = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const fetchId = ++profileFetchId.current;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      // [CONSTRAINT] Discard result if a newer fetch was issued while this one was in-flight
      if (fetchId !== profileFetchId.current || !mountedRef.current) return null;

      if (error) {
        console.warn('[TapRide] Failed to fetch profile:', error.message);
        setProfile(null);
        return null;
      }
      setProfile(data);
      return data;
    } catch (err) {
      console.warn('[TapRide] Profile fetch exception:', err);
      if (fetchId === profileFetchId.current && mountedRef.current) setProfile(null);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  useEffect(() => {
    // [INTENT] Force loading=false if auth initialization hangs
    const timeout = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          console.warn('[TapRide] Auth loading timed out — forcing loading=false');
          return false;
        }
        return prev;
      });
    }, AUTH_LOADING_TIMEOUT_MS);

    // [INTENT] Bootstrap auth state from existing session (cookie/localStorage)
    // [CONSTRAINT] Must ALWAYS set loading=false — wrapped in try/finally to guarantee it
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      try {
        if (!mountedRef.current) return;
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          await fetchProfile(s.user.id);
        }
      } catch (err) {
        console.warn('[TapRide] Error during initial auth:', err);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }).catch((err) => {
      console.warn('[TapRide] getSession failed:', err);
      if (mountedRef.current) setLoading(false);
    });

    // [INTENT] React to sign-in, sign-out, token refresh events from Supabase
    // [EDGE-CASE] SIGNED_OUT event with s=null — must clear profile
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      try {
        if (!mountedRef.current) return;
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          await fetchProfile(s.user.id);
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.warn('[TapRide] Auth state change error:', err);
      }
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // [INTENT] Register new user and create their profile row in one flow
  // [CONSTRAINT] Profile upsert failure is non-fatal — user can still log in, profile will be created on next update
  // [EDGE-CASE] Supabase may require email verification — data.user exists but session may be null
  const signUp = useCallback(async (email: string, password: string, metadata?: Record<string, string>) => {
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: metadata ? { data: metadata } : undefined,
    });

    if (error) return { error: error.message };

    let userType = metadata?.user_type || 'rider';

    if (data.user && metadata) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        email,
        full_name: metadata.full_name || '',
        phone: metadata.phone || '',
        user_type: metadata.user_type || 'rider',
        vehicle_make: metadata.vehicle_make || null,
        vehicle_model: metadata.vehicle_model || null,
        vehicle_color: metadata.vehicle_color || null,
        license_plate: metadata.license_plate || null,
      });

      if (profileError) {
        console.error('[TapRide] Profile upsert failed after signup:', profileError.message);
      }

      const fetched = await fetchProfile(data.user.id);
      if (fetched) userType = fetched.user_type;
    }

    // [EDGE-CASE] Supabase returns user but no session when email confirmation is required
    const confirmationRequired = !!(data.user && !data.session);
    return { error: null, userType, confirmationRequired };
  }, [fetchProfile]);

  // [INTENT] Sign in and immediately return userType for navigation routing
  // [EDGE-CASE] Profile fetch may fail on first login if profile row doesn't exist yet — defaults to 'rider'
  const signIn = useCallback(async (email: string, password: string) => {
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };

    let userType = 'rider';
    if (data.user) {
      const fetched = await fetchProfile(data.user.id);
      if (fetched) userType = fetched.user_type;
    }

    return { error: null, userType };
  }, [fetchProfile]);

  // [INTENT] Clear all auth state — Supabase handles token cleanup
  // [CONSTRAINT] Driver location row must be deleted so signed-out drivers don't appear on rider maps
  // [EDGE-CASE] signOut may throw on network failure — catch to ensure local state clears
  const signOut = useCallback(async () => {
    try {
      // [INTENT] Clean up driver_locations so signed-out drivers don't ghost on rider maps
      if (user && profile?.user_type === 'driver') {
        await supabase.from('driver_locations').delete().eq('driver_id', user.id);
      }
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[TapRide] signOut error:', err);
    }
    if (mountedRef.current) {
      setProfile(null);
      setUser(null);
      setSession(null);
    }
  }, [user, profile?.user_type]);

  // [INTENT] Partial profile update with field allowlist to prevent injection of computed/admin fields
  // [CONSTRAINT] Upsert requires id — always included from authenticated user
  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    if (!user) return { error: 'Not authenticated' };

    const sanitized: Record<string, unknown> = { id: user.id };
    for (const key of PROFILE_ALLOWED_FIELDS) {
      if (key in updates) {
        sanitized[key] = (updates as Record<string, unknown>)[key];
      }
    }

    const { error } = await supabase.from('profiles').upsert(sanitized);
    if (!error && mountedRef.current) await fetchProfile(user.id);
    return { error: error?.message ?? null };
  }, [user, fetchProfile]);

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signUp, signIn, signOut, updateProfile, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// [INTENT] Typed hook with runtime guard — crashes fast if used outside AuthProvider
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
