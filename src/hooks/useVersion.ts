import { useState, useEffect, useRef } from 'react';
import { checkForUpdate, APP_VERSION } from '../lib/version';

// [INTENT] Check if the app needs a forced update on mount
// [CONSTRAINT] One-shot check — no polling; version gate UI handles the rest
// [EDGE-CASE] Component may unmount before async check completes (fast navigation)

export function useVersionCheck() {
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [latestVersion, setLatestVersion] = useState(APP_VERSION);
  const [checking, setChecking] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    checkForUpdate()
      .then(({ required, latestVersion: v }) => {
        if (!mountedRef.current) return;
        setNeedsUpdate(required);
        setLatestVersion(v);
        setChecking(false);
      })
      .catch(() => {
        if (mountedRef.current) setChecking(false);
      });

    return () => { mountedRef.current = false; };
  }, []);

  return { needsUpdate, latestVersion, currentVersion: APP_VERSION, checking };
}
