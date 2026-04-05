// [INTENT] Password reset request page — sends a reset link to the user's email
// [CONSTRAINT] Uses Supabase redirectTo so the reset callback lands on our /reset-password route

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import AlertError from '../components/ui/AlertError';
import Spinner from '../components/ui/Spinner';
import Footer from '../components/ui/Footer';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  // [INTENT] Request password reset email via Supabase Auth
  // [EDGE-CASE] Supabase returns success even if email doesn't exist (security — no enumeration)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://tapiwamakandigona.github.io/tapride/reset-password',
      });
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setSent(true);
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  // [INTENT] Success state — confirm email was sent
  if (sent) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 px-6">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-primary-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Check your email</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            We sent a password reset link to <span className="font-semibold text-gray-900 dark:text-white">{email}</span>.
          </p>
          <Link
            to="/login"
            className="text-primary-600 dark:text-primary-400 font-semibold hover:underline"
          >
            Back to Sign In
          </Link>
        </div>
        <div className="mt-8"><Footer /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 pt-12 pb-8 px-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
            <svg
              viewBox="0 0 100 100"
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="30" cy="70" r="6" fill="currentColor" />
              <circle cx="70" cy="30" r="6" fill="currentColor" />
              <path d="M30 70 C30 45, 70 55, 70 30" />
            </svg>
          </div>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            TapRide
          </span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mt-6">
          Forgot password?
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Enter your email and we'll send you a reset link
        </p>
      </div>

      {/* Form */}
      <div className="flex-1 px-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <AlertError message={error} />}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-semibold py-3 rounded-xl transition-colors shadow-lg shadow-primary-600/25"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner size="sm" className="border-white/30 border-t-white" />
                Sending...
              </span>
            ) : (
              'Send Reset Link'
            )}
          </button>
        </form>

        <p className="text-center mt-6 text-gray-500 dark:text-gray-400">
          <Link
            to="/login"
            className="text-primary-600 dark:text-primary-400 font-semibold hover:underline"
          >
            Back to Sign In
          </Link>
        </p>
      </div>

      <div className="flex-shrink-0">
        <Footer />
      </div>
    </div>
  );
}
