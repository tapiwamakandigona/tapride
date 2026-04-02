import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Message } from '../types';

// [INTENT] Realtime chat for an active ride — fetch history + subscribe to new messages
// [CONSTRAINT] Subscription INSERT events can race with initial fetch — dedup by message id
// [EDGE-CASE] rideId=null when no active ride — must no-op cleanly and clear state

export function useChat(rideId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!rideId) return;
    if (mountedRef.current) { setLoading(true); setError(null); }

    try {
      const { data, error: fetchErr } = await supabase
        .from('messages')
        .select('*')
        .eq('ride_id', rideId)
        .order('created_at', { ascending: true });

      if (!mountedRef.current) return;
      if (fetchErr) {
        setError(fetchErr.message);
        console.warn('[TapRide] fetchMessages error:', fetchErr.message);
      } else {
        setMessages(data ?? []);
      }
    } catch (err) {
      // [EDGE-CASE] Network completely down — supabase client may throw
      if (mountedRef.current) {
        const msg = err instanceof Error ? err.message : 'Failed to load messages';
        setError(msg);
        console.warn('[TapRide] fetchMessages exception:', err);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [rideId]);

  const sendMessage = useCallback(async (content: string) => {
    if (!user || !rideId || !content.trim()) return { error: 'Missing user, ride, or content' };

    try {
      const { error: sendErr } = await supabase.from('messages').insert({
        ride_id: rideId,
        sender_id: user.id,
        content: content.trim(),
      });
      return { error: sendErr?.message ?? null };
    } catch (err) {
      // [EDGE-CASE] Unhandled rejection if network fails during send
      const msg = err instanceof Error ? err.message : 'Send failed';
      return { error: msg };
    }
  }, [user, rideId]);

  // [INTENT] Subscribe to new messages and merge them into state without duplicates
  // [EDGE-CASE] rideId changes (user navigates between rides) — old subscription must tear down
  useEffect(() => {
    if (!rideId) {
      setMessages([]);
      return;
    }

    fetchMessages();

    const channel = supabase
      .channel(`chat-${rideId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `ride_id=eq.${rideId}`,
      }, (payload) => {
        if (!mountedRef.current) return;
        const newMsg = payload.new as Message;
        setMessages((prev) => {
          // [CONSTRAINT] Dedup: subscription fires before or after fetch returns
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [rideId, fetchMessages]);

  return { messages, loading, error, sendMessage };
}
