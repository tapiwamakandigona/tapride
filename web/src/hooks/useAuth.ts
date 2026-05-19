/**
 * Authentication hook — wraps Appwrite Account API.
 * Provides login, register, logout and password-reset helpers,
 * and loads the current session + profile on mount.
 */
import { useState, useEffect, useCallback } from 'react';
import { ID, Query, AppwriteException } from 'appwrite';
import { account, databases, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite';
import { useAuthStore } from '@/store/authStore';
import type { Profile, UserRole } from '@/types';
import { logger } from '@/lib/logger';

export function useAuth() {
  const { user, profile, isLoading, setUser, setProfile, setLoading, clear } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  /** Load the current session and profile once on mount */
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const u = await account.get();
        if (cancelled) return;
        setUser(u);

        // Fetch profile from DB
        const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.PROFILES, [
          Query.equal('userId', u.$id),
        ]);
        if (!cancelled && res.documents.length > 0) {
          setProfile(res.documents[0] as unknown as Profile);
        }
      } catch {
        if (!cancelled) clear();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    init();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      await account.createEmailPasswordSession(email, password);
      const u = await account.get();
      setUser(u);

      const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.PROFILES, [
        Query.equal('userId', u.$id),
      ]);
      if (res.documents.length > 0) {
        setProfile(res.documents[0] as unknown as Profile);
      }
      return true;
    } catch (e) {
      const msg = e instanceof AppwriteException ? e.message : 'Login failed';
      setError(msg);
      logger.error('login error', e);
      return false;
    }
  }, [setUser, setProfile]);

  const register = useCallback(async (
    email: string,
    password: string,
    fullName: string,
    phone: string,
    role: UserRole,
  ) => {
    setError(null);
    try {
      const newUser = await account.create(ID.unique(), email, password, fullName);
      await account.createEmailPasswordSession(email, password);
      setUser(await account.get());

      // Create profile document
      const profileDoc = await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.PROFILES,
        ID.unique(),
        {
          userId: newUser.$id,
          name: fullName,
          email,
          phone,
          role,
          rating: 5.0,
          totalRides: 0,
          isOnline: false,
        },
      );
      setProfile(profileDoc as unknown as Profile);
      return true;
    } catch (e) {
      const msg = e instanceof AppwriteException ? e.message : 'Registration failed';
      setError(msg);
      logger.error('register error', e);
      return false;
    }
  }, [setUser, setProfile]);

  const logout = useCallback(async () => {
    try {
      await account.deleteSession('current');
    } catch (e) {
      logger.error('logout error', e);
    } finally {
      clear();
    }
  }, [clear]);

  const sendPasswordReset = useCallback(async (email: string) => {
    setError(null);
    try {
      await account.createRecovery(email, `${window.location.origin}/reset-password`);
      return true;
    } catch (e) {
      const msg = e instanceof AppwriteException ? e.message : 'Failed to send reset email';
      setError(msg);
      return false;
    }
  }, []);

  return { user, profile, isLoading, error, login, register, logout, sendPasswordReset };
}
