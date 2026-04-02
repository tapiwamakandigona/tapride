import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Message } from '../types';

export function useChat(rideId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch messages for a ride
  const fetchMessages = useCallback(async () => {
    if (!rideId) return;
    setLoading(true);
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('ride_id', rideId)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
    setLoading(false);
  }, [rideId]);

  // Send a message
  const sendMessage = async (content: string) => {
    if (!user || !rideId || !content.trim()) return;
    const { error } = await supabase.from('messages').insert({
      ride_id: rideId,
      sender_id: user.id,
      content: content.trim(),
    });
    return { error: error?.message ?? null };
  };

  // Subscribe to new messages
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
        setMessages((prev) => [...prev, payload.new as Message]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [rideId, fetchMessages]);

  return { messages, loading, sendMessage };
}
