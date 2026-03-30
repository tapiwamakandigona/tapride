import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useVersionCheck } from '../hooks/useVersion';

export default function Splash() {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const version = useVersionCheck();
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  useEffect(() => {
    if (loading || version.checking) return;

    if (version.updateAvailable) {
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
  }, [user, profile, loading, version.checking, version.updateAvailable, navigate]);

  const handleSkip = () => {
    setShowUpdateModal(false);
    // Let the normal navigation happen
    if (!user) {
      navigate('/login', { replace: true });
    } else if (profile?.user_type === 'driver') {
      navigate('/driver', { replace: true });
    } else {
      navigate('/rider', { replace: true });
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

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

      {/* Update Modal */}
      {showUpdateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-xl">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/40 rounded-xl flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-primary-600 dark:text-primary-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {version.forced ? 'Update Required' : 'Update Available'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  v{version.currentVersion} → v{version.latestVersion}
                </p>
              </div>
            </div>

            {/* Release Notes */}
            {version.releaseNotes && (
              <div className="mb-4 max-h-48 overflow-y-auto rounded-xl bg-gray-50 dark:bg-gray-700/50 p-3">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
                  What's New
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                  {version.releaseNotes}
                </p>
              </div>
            )}

            {/* APK size */}
            {version.apkSize && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                Download size: {formatBytes(version.apkSize)}
              </p>
            )}

            {/* Download progress */}
            {version.downloading && version.downloadProgress && (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <span>Downloading…</span>
                  <span>{version.downloadProgress.percent}%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-600 rounded-full transition-all duration-300"
                    style={{ width: `${version.downloadProgress.percent}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {formatBytes(version.downloadProgress.bytesDownloaded)} / {formatBytes(version.downloadProgress.bytesTotal)}
                </p>
              </div>
            )}

            {/* Error */}
            {version.downloadError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
                <p className="text-sm text-red-600 dark:text-red-400">
                  {version.downloadError}
                </p>
              </div>
            )}

            {/* Buttons */}
            <div className="space-y-2">
              <button
                onClick={version.triggerUpdate}
                disabled={version.downloading}
                className="w-full bg-primary-600 text-white py-3 rounded-xl font-semibold hover:bg-primary-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {version.downloading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Downloading…
                  </>
                ) : version.downloadError ? (
                  'Retry Download'
                ) : (
                  'Update Now'
                )}
              </button>

              {!version.forced && !version.downloading && (
                <button
                  onClick={handleSkip}
                  className="w-full text-gray-500 dark:text-gray-400 py-2 text-sm font-medium hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  Skip for now
                </button>
              )}
            </div>

            {version.forced && (
              <p className="text-xs text-center text-gray-400 dark:text-gray-500 mt-3">
                This update is required to continue using TapRide
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
