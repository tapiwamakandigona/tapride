import { useState, useEffect, useCallback } from 'react';
import type { GeoPosition } from '../types';

export function useLocation() {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);

  const getCurrentLocation = useCallback((): Promise<GeoPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const msg = 'Geolocation not supported';
        setError(msg);
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
          setPosition(geo);
          setError(null);
          resolve(geo);
        },
        (err) => {
          setError(err.message);
          reject(err);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );
    });
  }, []);

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return () => {};
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
        });
        setError(null);
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
    );

    setWatching(true);
    return () => {
      navigator.geolocation.clearWatch(id);
      setWatching(false);
    };
  }, []);

  useEffect(() => {
    getCurrentLocation().catch(() => {});
  }, [getCurrentLocation]);

  return { position, error, watching, getCurrentLocation, startWatching };
}
