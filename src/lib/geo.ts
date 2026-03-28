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
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=18`,
      { headers: { 'Accept-Language': 'en' } }
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
