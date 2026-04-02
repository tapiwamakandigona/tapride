// Fare configuration — override via environment or future remote config
export const FARE_CONFIG = {
  baseFare: Number(import.meta.env.VITE_FARE_BASE) || 2.0,
  perKmRate: Number(import.meta.env.VITE_FARE_PER_KM) || 0.5,
  minFare: Number(import.meta.env.VITE_FARE_MIN) || 3.0,
  currency: import.meta.env.VITE_FARE_CURRENCY || 'USD',
  symbol: import.meta.env.VITE_FARE_SYMBOL || '$',
};

export function calculateFare(distanceKm: number): number {
  const clamped = Math.max(0, distanceKm);
  const fare = FARE_CONFIG.baseFare + FARE_CONFIG.perKmRate * clamped;
  return Math.max(fare, FARE_CONFIG.minFare);
}

export function formatFare(amount: number): string {
  return `${FARE_CONFIG.symbol}${amount.toFixed(2)}`;
}
