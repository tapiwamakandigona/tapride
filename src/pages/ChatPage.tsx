import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../hooks/useChat';
import { useRide } from '../hooks/useRide';
import { supabase } from '../lib/supabase';
import ChatBubble from '../components/Chat/ChatBubble';
import Spinner, { PageSpinner } from '../components/ui/Spinner';

export default function ChatPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { currentRide, initializing } = useRide();
  const { messages, sendMessage, loading: chatLoading } = useChat(currentRide?.id ?? null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [otherPersonName, setOtherPersonName] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // [INTENT] Keep chat scrolled to newest message as they arrive in real-time
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // [INTENT] Prevent chat screen from rendering without a ride context
  // [CONSTRAINT] Wait for initializing to finish to avoid flash-redirect on page refresh
  useEffect(() => {
    if (!initializing && !currentRide) {
      navigate(-1);
    }
  }, [currentRide, initializing, navigate]);

  // [INTENT] Resolve the other party's display name for the chat header
  // [EDGE-CASE] Join data may be missing if ride was fetched without profile join — falls back to direct profile query
  const isDriver = profile?.user_type === 'driver';
  useEffect(() => {
    if (!currentRide) return;

    // [INTENT] Prefer name from ride join to avoid an extra DB round-trip
    const nameFromJoin = isDriver
      ? currentRide.rider?.full_name
      : currentRide.driver?.full_name;

    if (nameFromJoin) {
      setOtherPersonName(nameFromJoin);
      return;
    }

    // [INTENT] Direct profile fetch when join data is unavailable (e.g., ride re-fetched without joins)
    const otherId = isDriver ? currentRide.rider_id : currentRide.driver_id;
    if (!otherId) return;

    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', otherId)
      .single()
      .then(({ data }) => {
        if (data?.full_name) setOtherPersonName(data.full_name);
      });
  }, [currentRide, isDriver]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setSendError('');
    try {
      const result = await sendMessage(trimmed);
      if (result?.error) {
        setSendError('Failed to send message');
      } else {
        setInput('');
      }
    } catch {
      setSendError('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const otherName = otherPersonName || (isDriver ? 'Rider' : 'Driver');

  if (initializing) return <PageSpinner />;

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <button
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-700 dark:text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">
            {otherName}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {messages.length} message{messages.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {chatLoading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Spinner size="sm" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <p className="text-gray-400 dark:text-gray-500 text-sm">
                No messages yet. Start the conversation!
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <ChatBubble
              key={msg.id}
              message={msg}
              isOwn={msg.sender_id === user?.id}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Send error */}
      {sendError && (
        <div className="px-4 py-1">
          <p className="text-red-500 text-xs text-center">{sendError}</p>
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex-shrink-0"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          maxLength={500}
          className="flex-1 px-4 py-2.5 rounded-full border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          aria-label="Send message"
          className="w-10 h-10 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white rounded-full flex items-center justify-center transition-colors flex-shrink-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </form>
    </div>
  );
}
