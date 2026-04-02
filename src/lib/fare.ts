// [INTENT] Configurable fare calculation — all magic numbers externalized
// [CONSTRAINT] Environment overrides must parse to valid numbers; NaN falls back to defaults via || operator
// [EDGE-CASE] Negative distance (bad GPS data) is clamped to 0 before calculation

export const FARE_CONFIG = {
  baseFare: Number(import.meta.env.VITE_FARE_BASE) || 2.0,
  perKmRate: Number(import.meta.env.VITE_FARE_PER_KM) || 0.5,
  minFare: Number(import.meta.env.VITE_FARE_MIN) || 3.0,
  currency: import.meta.env.VITE_FARE_CURRENCY || 'USD',
  symbol: import.meta.env.VITE_FARE_SYMBOL || '$',
} as const;

export function calculateFare(distanceKm: number): number {
  // [EDGE-CASE] GPS jitter or reversed pickup/dest can produce negative distance
  const clamped = Math.max(0, distanceKm);
  const fare = FARE_CONFIG.baseFare + FARE_CONFIG.perKmRate * clamped;
  return Math.round(Math.max(fare, FARE_CONFIG.minFare) * 100) / 100;
}

export function formatFare(amount: number): string {
  return `${FARE_CONFIG.symbol}${amount.toFixed(2)}`;
}
