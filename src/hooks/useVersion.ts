import { useState, useEffect } from 'react';
import { checkForUpdate, APP_VERSION } from '../lib/version';

export function useVersionCheck() {
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [latestVersion, setLatestVersion] = useState(APP_VERSION);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkForUpdate().then(({ required, latestVersion: v }) => {
      setNeedsUpdate(required);
      setLatestVersion(v);
      setChecking(false);
    }).catch(() => {
      setChecking(false);
    });
  }, []);

  return { needsUpdate, latestVersion, currentVersion: APP_VERSION, checking };
}
