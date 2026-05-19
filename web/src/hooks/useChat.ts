/**
 * Chat hook — sends messages and subscribes to real-time
 * message updates for a given rideId.
 */
import { useState, useEffect, useCallback } from 'react';
import { ID, Query, AppwriteException } from 'appwrite';
import { databases, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite';
import { useAuthStore } from '@/store/authStore';
import type { Message } from '@/types';
import { logger } from '@/lib/logger';
import { useRealtime } from './useRealtime';

/**
 * @param rideId - The ride to subscribe chat messages for
 */
export function useChat(rideId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, profile } = useAuthStore();

  // Load existing messages on mount / when rideId changes
  useEffect(() => {
    if (!rideId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.MESSAGES, [
          Query.equal('rideId', rideId),
          Query.orderAsc('$createdAt'),
          Query.limit(100),
        ]);
        if (!cancelled) setMessages(res.documents as unknown as Message[]);
      } catch (e) {
        logger.error('useChat load', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [rideId]);

  // Polling fallback every 3 s for new messages
  useEffect(() => {
    if (!rideId) return;
    const interval = setInterval(async () => {
      try {
        const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.MESSAGES, [
          Query.equal('rideId', rideId),
          Query.orderAsc('$createdAt'),
          Query.limit(100),
        ]);
        setMessages(res.documents as unknown as Message[]);
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [rideId]);

  // Subscribe to new messages via Realtime
  useRealtime<Message>(
    rideId
      ? `databases.${DATABASE_ID}.collections.${COLLECTIONS.MESSAGES}.documents`
      : '',
    (event) => {
      const msg = event.payload;
      if (msg.rideId !== rideId) return;

      if (event.events.some((e) => e.includes('.create'))) {
        setMessages((prev) => {
          if (prev.find((m) => m.$id === msg.$id)) return prev;
          return [...prev, msg];
        });
      }
    },
  );

  /** Send a chat message */
  const sendMessage = useCallback(async (content: string): Promise<boolean> => {
    if (!user || !profile || !rideId || !content.trim()) return false;
    setError(null);
    try {
      await databases.createDocument(DATABASE_ID, COLLECTIONS.MESSAGES, ID.unique(), {
        rideId,
        senderId: user.$id,
        senderName: profile.name,
        content: content.trim(),
        createdAt: new Date().toISOString(),
      });
      return true;
    } catch (e) {
      const msg = e instanceof AppwriteException ? e.message : 'Failed to send message';
      setError(msg);
      logger.error('sendMessage', e);
      return false;
    }
  }, [user, profile, rideId]);

  return { messages, loading, error, sendMessage };
}
