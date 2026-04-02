import { useState, useCallback, useEffect, useRef } from 'react';
import type { GeoPosition } from '../types';

// [INTENT] Provide reactive GPS position with one-shot and continuous watch modes
// [CONSTRAINT] Must clean up watchPosition on unmount — geolocation watches are global and leak
// [EDGE-CASE] Capacitor webview may not have navigator.geolocation; autoStart must handle gracefully

export function useLocation(autoStart = true) {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // [INTENT] Auto-cleanup any active watch on unmount — prevents leak if consumer forgot
      if (watchIdRef.current !== null) {
        navigator.geolocation?.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  const getCurrentLocation = useCallback((): Promise<GeoPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const msg = 'Geolocation not supported';
        if (mountedRef.current) setError(msg);
        reject(new Error(msg));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const geo: GeoPosition = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
          };
          if (mountedRef.current) {
            setPosition(geo);
            setError(null);
          }
          resolve(geo);
        },
        (err) => {
          if (mountedRef.current) setError(err.message);
          reject(err);
        },
        // [CONSTRAINT] enableHighAccuracy needed for ride-hailing precision
        // [EDGE-CASE] 10s timeout covers cold GPS fix on first load
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
      );
    });
  }, []);

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      if (mountedRef.current) setError('Geolocation not supported');
      return () => {};
    }

    // [INTENT] Prevent double-watch — return cleanup for existing watch instead
    if (watchIdRef.current !== null) {
      return () => {
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
          if (mountedRef.current) setWatching(false);
        }
      };
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        if (mountedRef.current) {
          setPosition({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
          });
          setError(null);
        }
      },
      (err) => {
        if (mountedRef.current) setError(err.message);
      },
      // [CONSTRAINT] 3s maximumAge for continuous tracking — tighter than one-shot
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 },
    );

    watchIdRef.current = id;
    if (mountedRef.current) setWatching(true);

    return () => {
      navigator.geolocation.clearWatch(id);
      watchIdRef.current = null;
      if (mountedRef.current) setWatching(false);
    };
  }, []);

  // [INTENT] Get initial position on mount so the map centers on user immediately
  // [CONSTRAINT] Only fires once (empty deps); error state is set inside getCurrentLocation
  // [EDGE-CASE] autoStart=false for components that only need on-demand location (e.g., settings)
  useEffect(() => {
    if (autoStart) {
      getCurrentLocation().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { position, error, watching, getCurrentLocation, startWatching };
}
