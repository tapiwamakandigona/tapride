const USER_AGENT = 'TapRide/1.0 (tapiwamakandigona@github)';

// Simple rate limiter: enforce min 1s between Nominatim requests
let lastNominatimCall = 0;
async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastNominatimCall;
  if (elapsed < 1100) {
    await new Promise((r) => setTimeout(r, 1100 - elapsed));
  }
  lastNominatimCall = Date.now();
}

export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

export function formatAddress(lat: number, lng: number): string {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

// Reverse geocode using OpenStreetMap Nominatim (free, no API key)
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    await waitForRateLimit();
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=18`,
      {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': USER_AGENT,
        },
      }
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

// Forward geocode (address search) using Nominatim
export interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export async function searchAddress(query: string): Promise<NominatimResult[]> {
  if (!query || query.length < 3) return [];
  try {
    await waitForRateLimit();
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': USER_AGENT,
        },
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data as NominatimResult[];
  } catch {
    return [];
  }
}

// Get route from OSRM (free, no API key)
export interface RouteResult {
  distanceKm: number;
  durationMin: number;
  coordinates: [number, number][]; // [lat, lng] pairs for polyline
}

export async function getRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<RouteResult | null> {
  try {
    // OSRM uses lng,lat order
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes?.length) return null;

    const route = data.routes[0];
    // GeoJSON coordinates are [lng, lat] — convert to [lat, lng] for Leaflet
    const coordinates: [number, number][] = route.geometry.coordinates.map(
      (c: [number, number]) => [c[1], c[0]] as [number, number]
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
