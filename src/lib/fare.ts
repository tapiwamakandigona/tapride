// ============================================
// TapRide Dynamic Pricing Engine
// Zimbabwe market — USD currency
// ============================================

import { supabase } from './supabase';

// --- Types ---

export type RideType = 'economy' | 'comfort' | 'xl';

export interface PricingBreakdown {
  rideType: RideType;
  baseFare: number;
  distanceCharge: number;
  timeCharge: number;
  subtotal: number;
  timeMultiplier: number;
  surgeMultiplier: number;
  rideTypeMultiplier: number;
  totalMultiplier: number;
  minimumFare: number;
  finalFare: number;
  distanceKm: number;
  durationMin: number;
}

// --- Constants ---

const BASE_FARE = 2.0;
const PER_KM_RATE = 0.50;
const PER_MIN_RATE = 0.15;

const RIDE_TYPE_MULTIPLIERS: Record<RideType, number> = {
  economy: 1.0,
  comfort: 1.4,
  xl: 1.8,
};

const MINIMUM_FARES: Record<RideType, number> = {
  economy: 3,
  comfort: 5,
  xl: 7,
};

// --- Time-of-day multiplier ---

export function getTimeMultiplier(date: Date = new Date()): number {
  const hour = date.getHours();
  // Peak morning 6-9 AM, peak evening 4-7 PM
  if ((hour >= 6 && hour < 9) || (hour >= 16 && hour < 19)) return 1.5;
  // Late night 10 PM - 5 AM
  if (hour >= 22 || hour < 5) return 1.3;
  // Off-peak
  return 1.0;
}

// --- Surge multiplier (from app_config) ---

let cachedSurge: { value: number; fetchedAt: number } | null = null;
const SURGE_CACHE_MS = 30_000; // 30s cache

export async function getSurgeMultiplier(): Promise<number> {
  if (cachedSurge && Date.now() - cachedSurge.fetchedAt < SURGE_CACHE_MS) {
    return cachedSurge.value;
  }
  try {
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'surge_multiplier')
      .maybeSingle();
    const val = data ? parseFloat(data.value) : 1.0;
    const clamped = Math.min(3.0, Math.max(1.0, isNaN(val) ? 1.0 : val));
    cachedSurge = { value: clamped, fetchedAt: Date.now() };
    return clamped;
  } catch {
    return cachedSurge?.value ?? 1.0;
  }
}

// --- Main pricing function ---

export async function calculateDynamicFare(
  distanceKm: number,
  durationMin: number,
  rideType: RideType = 'economy',
  date?: Date,
): Promise<PricingBreakdown> {
  const timeMultiplier = getTimeMultiplier(date);
  const surgeMultiplier = await getSurgeMultiplier();
  const rideTypeMultiplier = RIDE_TYPE_MULTIPLIERS[rideType];
  const minimumFare = MINIMUM_FARES[rideType];

  const distanceCharge = PER_KM_RATE * distanceKm;
  const timeCharge = PER_MIN_RATE * durationMin;
  const subtotal = BASE_FARE + distanceCharge + timeCharge;

  const totalMultiplier = timeMultiplier * surgeMultiplier * rideTypeMultiplier;
  const calculated = subtotal * totalMultiplier;
  const finalFare = Math.max(calculated, minimumFare);

  return {
    rideType,
    baseFare: BASE_FARE,
    distanceCharge: round2(distanceCharge),
    timeCharge: round2(timeCharge),
    subtotal: round2(subtotal),
    timeMultiplier,
    surgeMultiplier,
    rideTypeMultiplier,
    totalMultiplier: round2(totalMultiplier),
    minimumFare,
    finalFare: round2(finalFare),
    distanceKm,
    durationMin,
  };
}

// Synchronous convenience (uses default surge=1.0 when async isn't possible)
export function calculateFare(distanceKm: number, durationMin: number = 0, rideType: RideType = 'economy'): number {
  const timeMultiplier = getTimeMultiplier();
  const rideTypeMultiplier = RIDE_TYPE_MULTIPLIERS[rideType];
  const minimumFare = MINIMUM_FARES[rideType];

  const subtotal = BASE_FARE + PER_KM_RATE * distanceKm + PER_MIN_RATE * durationMin;
  const calculated = subtotal * timeMultiplier * rideTypeMultiplier;
  return round2(Math.max(calculated, minimumFare));
}

export function formatFare(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
