// [INTENT] Geo utilities: haversine distance, geocoding (Nominatim), routing (OSRM)
// [CONSTRAINT] Nominatim requires ≥1s between requests and a valid User-Agent per usage policy
// [CONSTRAINT] All external API calls return safe fallbacks on failure — never throw to caller

const USER_AGENT = import.meta.env.VITE_NOMINATIM_UA || 'TapRide/1.0';

// [INTENT] Enforce Nominatim rate limit globally across all callers in this module
// [EDGE-CASE] Multiple rapid geocode calls from typeahead — each waits its turn
let lastNominatimCall = 0;
async function waitForRateLimit(signal?: AbortSignal): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastNominatimCall;
  if (elapsed < 1100) {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        resolve();
      }, 1100 - elapsed);
      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    });
  }
  lastNominatimCall = Date.now();
}

// [INTENT] Straight-line distance between two GPS coords — used as fallback when OSRM unavailable
// [CONSTRAINT] Returns km; Earth radius constant = 6371km (mean)
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// [INTENT] Human-readable coordinate string when geocoding fails
export function formatAddress(lat: number, lng: number): string {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

// [INTENT] Convert GPS coords to a street address via Nominatim reverse geocoding
// [EDGE-CASE] Network failure, rate limit hit, or no address data → returns formatted lat/lng
// [CONSTRAINT] AbortSignal support allows caller to cancel stale requests (e.g., map drag)
export async function reverseGeocode(
  lat: number, lng: number, signal?: AbortSignal,
): Promise<string> {
  try {
    await waitForRateLimit(signal);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=18`,
      {
        headers: { 'Accept-Language': 'en', 'User-Agent': USER_AGENT },
        signal,
      },
    );
    if (!res.ok) return formatAddress(lat, lng);
    const data = await res.json();
    if (data.address) {
      const a = data.address;
      const parts = [
        a.road || a.pedestrian || a.footway || '',
        a.suburb || a.neighbourhood || '',
        a.city || a.town || a.village || '',
      ].filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : formatAddress(lat, lng);
    }
    return data.display_name?.split(',').slice(0, 3).join(',') || formatAddress(lat, lng);
  } catch {
    return formatAddress(lat, lng);
  }
}

export interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

// [INTENT] Forward geocode — convert user text input to lat/lng candidates
// [CONSTRAINT] Minimum 3 chars to avoid overly broad Nominatim queries
// [EDGE-CASE] AbortSignal lets caller cancel when user keeps typing (debounce pattern)
export async function searchAddress(
  query: string, signal?: AbortSignal,
): Promise<NominatimResult[]> {
  if (!query || query.length < 3) return [];
  try {
    await waitForRateLimit(signal);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`,
      {
        headers: { 'Accept-Language': 'en', 'User-Agent': USER_AGENT },
        signal,
      },
    );
    if (!res.ok) return [];
    return (await res.json()) as NominatimResult[];
  } catch {
    return [];
  }
}

export interface RouteResult {
  distanceKm: number;
  durationMin: number;
  coordinates: [number, number][]; // [lat, lng] pairs for Leaflet polyline
}

// [INTENT] Get driving route between two points via OSRM public demo server
// [CONSTRAINT] OSRM uses lng,lat order (opposite of Leaflet) — must swap on input and output
// [EDGE-CASE] OSRM demo server can be slow/down — returns null on any failure
export async function getRoute(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number,
  signal?: AbortSignal,
): Promise<RouteResult | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes?.length) return null;

    const route = data.routes[0];
    // [CONSTRAINT] GeoJSON = [lng, lat]; Leaflet needs [lat, lng]
    const coordinates: [number, number][] = route.geometry.coordinates.map(
      (c: [number, number]) => [c[1], c[0]] as [number, number],
    );

    return {
      distanceKm: route.distance / 1000,
      durationMin: route.duration / 60,
      coordinates,
    };
  } catch {
    return null;
  }
}
