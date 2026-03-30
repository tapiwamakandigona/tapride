import { useState, useEffect } from 'react';
import { useVersionCheck } from '../../hooks/useVersion';

export default function UpdateBanner() {
  const { updateAvailable, forced, latestVersion, triggerUpdate, downloading } = useVersionCheck();
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed state if a new version appears
  useEffect(() => {
    setDismissed(false);
  }, [latestVersion]);

  // Don't show: no update, forced (handled by Splash modal), or dismissed
  if (!updateAvailable || forced || dismissed) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9998] bg-primary-600 text-white px-4 py-2.5 flex items-center justify-between text-sm">
      <button
        onClick={triggerUpdate}
        disabled={downloading}
        className="flex-1 text-left font-medium"
      >
        {downloading ? 'Downloading update…' : `New version v${latestVersion} available — tap to update`}
      </button>
      {!downloading && (
        <button
          onClick={() => setDismissed(true)}
          className="ml-3 p-1 rounded-full hover:bg-white/20 transition-colors"
          aria-label="Dismiss"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}
