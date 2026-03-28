import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useVersionCheck } from '../hooks/useVersion';

export default function Splash() {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const { needsUpdate, latestVersion, checking } = useVersionCheck();
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  useEffect(() => {
    if (loading || checking) return;

    if (needsUpdate) {
      setShowUpdateModal(true);
      return;
    }

    const timer = setTimeout(() => {
      if (!user) {
        navigate('/login', { replace: true });
      } else if (profile?.user_type === 'driver') {
        navigate('/driver', { replace: true });
      } else {
        navigate('/rider', { replace: true });
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [user, profile, loading, checking, needsUpdate, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary-600 to-primary-800 dark:from-gray-900 dark:to-gray-800">
      {/* Logo */}
      <div className="animate-fade-in mb-8">
        <div className="w-28 h-28 bg-white dark:bg-gray-700 rounded-3xl shadow-2xl flex items-center justify-center">
          <svg
            viewBox="0 0 100 100"
            className="w-16 h-16 text-primary-600 dark:text-primary-400"
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

      {/* App Name */}
      <h1 className="text-5xl font-bold text-white mb-2 animate-slide-up">
        TapRide
      </h1>
      <p className="text-primary-200 dark:text-gray-400 text-lg animate-slide-up">
        Your ride, one tap away
      </p>

      {/* Loading indicator */}
      <div className="mt-12 animate-pulse">
        <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>

      {/* Branding */}
      <p className="absolute bottom-8 text-primary-200/60 dark:text-gray-500 text-sm">
        Made by Tapiwa Makandigona
      </p>

      {/* Force Update Modal */}
      {showUpdateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Update Required
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              A new version ({latestVersion}) is available. Please update to continue
              using TapRide.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-primary-600 text-white py-3 rounded-xl font-semibold hover:bg-primary-700 transition-colors"
            >
              Refresh App
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
