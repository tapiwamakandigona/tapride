import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, metadata?: Record<string, string>) => Promise<{ error: string | null; userType?: string }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null; userType?: string }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
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

  useEffect(() => {
    // Safety timeout: if loading doesn't resolve in 8s, force it off
    const timeout = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          console.warn('[TapRide] Auth loading timed out — forcing loading=false');
          return false;
        }
        return prev;
      });
    }, 8000);

    // Get initial session — wrapped in try/catch to ALWAYS finish loading
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      try {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          await fetchProfile(s.user.id);
        }
      } catch (err) {
        console.warn('[TapRide] Error during initial auth:', err);
      } finally {
        setLoading(false);
      }
    }).catch((err) => {
      console.warn('[TapRide] getSession failed:', err);
      setLoading(false);
    });

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

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signUp = async (email: string, password: string, metadata?: Record<string, string>) => {
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: metadata ? { data: metadata } : undefined,
    });

    if (error) {
      return { error: error.message };
    }

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
        // Don't fail signup entirely, but warn
      }

      // Fetch the profile so it's immediately available
      const fetched = await fetchProfile(data.user.id);
      if (fetched) userType = fetched.user_type;
    }

    return { error: null, userType };
  };

  const signIn = async (email: string, password: string) => {
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { error: error.message };
    }

    // Immediately fetch profile and return userType for correct navigation
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

    // Sanitize: only allow known fields
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

    const { error } = await supabase
      .from('profiles')
      .upsert(sanitized);
    if (!error) await fetchProfile(user.id);
    return { error: error?.message ?? null };
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signUp, signIn, signOut, updateProfile, refreshProfile }}>
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
