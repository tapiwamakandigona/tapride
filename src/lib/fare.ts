const BASE_FARE = 2.0;
const PER_KM_RATE = 0.5;
const MIN_FARE = 3.0;

export function calculateFare(distanceKm: number): number {
  const fare = BASE_FARE + PER_KM_RATE * distanceKm;
  return Math.max(fare, MIN_FARE);
}

export function formatFare(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
