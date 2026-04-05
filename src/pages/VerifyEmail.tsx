// [INTENT] Handle Supabase email verification callback after user clicks the link in their email.
// [CONSTRAINT] Supabase appends auth tokens to the URL hash (#access_token=...&type=signup).
//   The Supabase JS client automatically picks these up via onAuthStateChange when the page loads.
//   We just need to wait for the auth state to resolve, show a branded success/error screen,
//   and redirect the user to their dashboard.
// [CONSTRAINT] The Supabase dashboard "Site URL" or "Redirect URLs" must include:
//   https://tapiwamakandigona.github.io/tapride/verify
//   Without this, Supabase will redirect to localhost after email confirmation.
// [EDGE-CASE] User may land here without a valid token (e.g., expired link, direct navigation).
//   In that case, show an error state with a link back to login.
// [EDGE-CASE] The 404.html SPA hack for GitHub Pages converts /verify into a query-string redirect,
//   but the #hash fragment is preserved by browsers during redirects, so auth tokens survive.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// [INTENT] Possible states for the verification flow
type VerifyState = 'loading' | 'success' | 'error';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const [state, setState] = useState<VerifyState>('loading');
  const [countdown, setCountdown] = useState(5);

  // [INTENT] Once auth finishes loading, determine if verification succeeded.
  // [CONSTRAINT] If user exists after auth resolves, Supabase successfully processed the token.
  // [EDGE-CASE] Auth loading may take up to 8s (AUTH_LOADING_TIMEOUT_MS in AuthContext).
  useEffect(() => {
    if (loading) return;

    if (user) {
      setState('success');
    } else {
      // [EDGE-CASE] No user after auth loaded = invalid/expired token or direct navigation
      setState('error');
    }
  }, [user, loading]);

  // [INTENT] Auto-redirect to the correct dashboard after a short countdown.
  // [CONSTRAINT] Only starts countdown after verification succeeds AND profile is loaded
  //   (profile determines driver vs rider routing).
  // [EDGE-CASE] Profile may be null briefly after auth resolves — wait for it.
  useEffect(() => {
    if (state !== 'success') return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          const path = profile?.user_type === 'driver' ? '/driver' : '/rider';
          navigate(path, { replace: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [state, profile, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary-600 to-primary-800 dark:from-gray-900 dark:to-gray-800 px-6">
      {/* [INTENT] TapRide logo — matches Splash page branding for visual consistency */}
      <div className="mb-8">
        <div className="w-20 h-20 bg-white dark:bg-gray-700 rounded-2xl shadow-2xl flex items-center justify-center">
          <svg
            viewBox="0 0 100 100"
            className="w-12 h-12 text-primary-600 dark:text-primary-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="30" cy="70" r="8" fill="currentColor" />
            <circle cx="70" cy="30" r="8" fill="currentColor" />
            <path d="M30 70 C30 45, 70 55, 70 30" />
            <path d="M62 22 L70 30 L62 38" />
          </svg>
        </div>
      </div>

      {/* [INTENT] Card container for the verification status message */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full shadow-xl text-center">
        {state === 'loading' && (
          <>
            {/* [INTENT] Show spinner while Supabase processes the auth token from the URL hash */}
            <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Verifying your email...
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              Please wait while we confirm your account.
            </p>
          </>
        )}

        {state === 'success' && (
          <>
            {/* [INTENT] Green checkmark icon for success state */}
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-8 h-8 text-green-600 dark:text-green-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Email Verified! 🎉
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Your account has been confirmed. Welcome to TapRide!
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Redirecting in {countdown} seconds...
            </p>
            {/* [INTENT] Manual redirect button in case user doesn't want to wait */}
            <button
              onClick={() => {
                const path = profile?.user_type === 'driver' ? '/driver' : '/rider';
                navigate(path, { replace: true });
              }}
              className="mt-4 w-full bg-primary-600 text-white py-3 rounded-xl font-semibold hover:bg-primary-700 transition-colors"
            >
              Go to Dashboard
            </button>
          </>
        )}

        {state === 'error' && (
          <>
            {/* [INTENT] Red X icon for error/expired link state */}
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-8 h-8 text-red-600 dark:text-red-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Verification Failed
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              The verification link may have expired or is invalid. Please try signing up again or request a new verification email.
            </p>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="w-full bg-primary-600 text-white py-3 rounded-xl font-semibold hover:bg-primary-700 transition-colors"
            >
              Go to Login
            </button>
          </>
        )}
      </div>

      {/* [INTENT] Subtle branding footer — matches Splash page */}
      <p className="mt-8 text-primary-200/60 dark:text-gray-500 text-sm">
        TapRide — Your ride, one tap away
      </p>
    </div>
  );
}
