import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { withTimeout, withRetry } from '../lib/resilience';
import type { Profile } from '../types';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  /** true when auth timed out or errored — lets UI show retry */
  authError: boolean;
  retryAuth: () => void;
  signUp: (email: string, password: string, metadata?: Record<string, string>) => Promise<{ error: string | null; userType?: string }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null; userType?: string }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

/** Hard ceiling — loading MUST be false within this many ms, no matter what. */
const AUTH_HARD_TIMEOUT_MS = 3000;
/** Timeout for getSession call itself. */
const GET_SESSION_TIMEOUT_MS = 2500;
/** Timeout for profile fetch. */
const PROFILE_TIMEOUT_MS = 2000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [initAttempt, setInitAttempt] = useState(0);

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single(),
        PROFILE_TIMEOUT_MS,
      );
      if (error) {
        console.warn('[TapRide] Failed to fetch profile:', error.message);
        setProfile(null);
        return null;
      }
      setProfile(data);
      return data;
    } catch (err) {
      console.warn('[TapRide] Profile fetch exception:', err);
      setProfile(null);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  /** Core init — called on mount and on retry. */
  const initAuth = useCallback(async () => {
    setLoading(true);
    setAuthError(false);

    // Hard safety timeout — loading ALWAYS becomes false.
    const hardTimeout = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          console.warn('[TapRide] Auth hard timeout — forcing loading=false');
          setAuthError(true);
          return false;
        }
        return prev;
      });
    }, AUTH_HARD_TIMEOUT_MS);

    try {
      // Race getSession against a timeout
      const { data: { session: s } } = await withTimeout(
        supabase.auth.getSession(),
        GET_SESSION_TIMEOUT_MS,
      );

      setSession(s);
      setUser(s?.user ?? null);

      if (s?.user) {
        // Profile fetch is non-blocking for loading — if it fails, user still gets through
        await fetchProfile(s.user.id);
      }
    } catch (err) {
      console.warn('[TapRide] Auth init failed:', err);
      // Timed out or network error — clear everything, let app redirect to login
      setSession(null);
      setUser(null);
      setProfile(null);
      setAuthError(true);
    } finally {
      clearTimeout(hardTimeout);
      setLoading(false);
    }
  }, [fetchProfile]);

  // Run init on mount and when retry is triggered
  useEffect(() => {
    initAuth();
  }, [initAuth, initAttempt]);

  // Listen for auth state changes (login/logout from other tabs, token refresh)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      try {
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

    return () => { subscription.unsubscribe(); };
  }, [fetchProfile]);

  const retryAuth = useCallback(() => {
    setInitAttempt((n) => n + 1);
  }, []);

  const signUp = async (email: string, password: string, metadata?: Record<string, string>) => {
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

    return { error: null, userType };
  };

  const signIn = async (email: string, password: string) => {
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };

    let userType = 'rider';
    if (data.user) {
      const fetched = await fetchProfile(data.user.id);
      if (fetched) userType = fetched.user_type;
    }

    return { error: null, userType };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: 'Not authenticated' };

    const allowedFields = [
      'full_name', 'phone', 'avatar_url', 'user_type',
      'vehicle_make', 'vehicle_model', 'vehicle_color', 'license_plate',
      'is_online', 'current_lat', 'current_lng',
      'emergency_contact_name', 'emergency_contact_phone',
      'drivers_license_url', 'vehicle_registration_url', 'profile_photo_url',
      'verification_status',
    ];
    const sanitized: Record<string, unknown> = { id: user.id };
    for (const key of allowedFields) {
      if (key in updates) {
        sanitized[key] = (updates as Record<string, unknown>)[key];
      }
    }

    const { error } = await supabase.from('profiles').upsert(sanitized);
    if (!error) await fetchProfile(user.id);
    return { error: error?.message ?? null };
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, authError, retryAuth, signUp, signIn, signOut, updateProfile, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
