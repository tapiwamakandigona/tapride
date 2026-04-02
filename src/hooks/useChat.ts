import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Message } from '../types';

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

  // Fetch messages for a ride
  const fetchMessages = useCallback(async () => {
    if (!rideId) return;
    if (mountedRef.current) { setLoading(true); setError(null); }
    const { data, error: fetchErr } = await supabase
      .from('messages')
      .select('*')
      .eq('ride_id', rideId)
      .order('created_at', { ascending: true });
    if (mountedRef.current) {
      if (fetchErr) {
        setError(fetchErr.message);
        console.warn('[TapRide] fetchMessages error:', fetchErr.message);
      } else if (data) {
        setMessages(data);
      }
      setLoading(false);
    }
  }, [rideId]);

  // Send a message
  const sendMessage = async (content: string) => {
    if (!user || !rideId || !content.trim()) return;
    const { error: sendErr } = await supabase.from('messages').insert({
      ride_id: rideId,
      sender_id: user.id,
      content: content.trim(),
    });
    return { error: sendErr?.message ?? null };
  };

  // Subscribe to new messages — dedup by id
  useEffect(() => {
    if (!rideId) return;
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
          // Deduplicate — subscription can fire for messages already in state
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [rideId, fetchMessages]);

  return { messages, loading, error, sendMessage };
}
