import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateFare, getTimeMultiplier, formatFare } from '../lib/fare';
import type { RideType } from '../lib/fare';

// We test the synchronous calculateFare (surge=1.0) and getTimeMultiplier.
// calculateFare depends on getTimeMultiplier(new Date()), so we freeze time for deterministic tests.

function fakeDate(hour: number): Date {
  return new Date(2026, 0, 15, hour, 0, 0); // Jan 15 2026, given hour
}

describe('getTimeMultiplier', () => {
  it('returns 1.5 during morning peak (6-9 AM)', () => {
    expect(getTimeMultiplier(fakeDate(6))).toBe(1.5);
    expect(getTimeMultiplier(fakeDate(7))).toBe(1.5);
    expect(getTimeMultiplier(fakeDate(8))).toBe(1.5);
  });

  it('returns 1.5 during evening peak (4-7 PM)', () => {
    expect(getTimeMultiplier(fakeDate(16))).toBe(1.5);
    expect(getTimeMultiplier(fakeDate(17))).toBe(1.5);
    expect(getTimeMultiplier(fakeDate(18))).toBe(1.5);
  });

  it('returns 1.3 during late night (10 PM - 5 AM)', () => {
    expect(getTimeMultiplier(fakeDate(22))).toBe(1.3);
    expect(getTimeMultiplier(fakeDate(23))).toBe(1.3);
    expect(getTimeMultiplier(fakeDate(0))).toBe(1.3);
    expect(getTimeMultiplier(fakeDate(3))).toBe(1.3);
    expect(getTimeMultiplier(fakeDate(4))).toBe(1.3);
  });

  it('returns 1.0 during off-peak hours', () => {
    expect(getTimeMultiplier(fakeDate(9))).toBe(1.0);
    expect(getTimeMultiplier(fakeDate(12))).toBe(1.0);
    expect(getTimeMultiplier(fakeDate(15))).toBe(1.0);
  });

  it('boundary: hour 5 is off-peak, hour 19 is off-peak', () => {
    expect(getTimeMultiplier(fakeDate(5))).toBe(1.0);
    expect(getTimeMultiplier(fakeDate(19))).toBe(1.0);
  });
});

describe('calculateFare', () => {
  let dateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Fix "now" to 12:00 (off-peak, multiplier 1.0) for predictable results
    vi.useFakeTimers();
    vi.setSystemTime(fakeDate(12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- Economy (multiplier 1.0, min $3) ---

  it('returns economy minimum fare for 0 distance', () => {
    // subtotal = $2 + 0 + 0 = $2 * 1.0 * 1.0 = $2, below min $3
    expect(calculateFare(0)).toBe(3.0);
  });

  it('returns economy minimum for short distance', () => {
    // 1 km, 0 min: $2 + $0.50 = $2.50, below min
    expect(calculateFare(1)).toBe(3.0);
  });

  it('calculates economy fare for 10 km, 0 min', () => {
    // $2 + $5 = $7
    expect(calculateFare(10)).toBe(7.0);
  });

  it('calculates economy fare with duration', () => {
    // 10 km, 15 min: $2 + $5 + $2.25 = $9.25
    expect(calculateFare(10, 15)).toBe(9.25);
  });

  it('handles fractional distances', () => {
    // 5.5 km, 0 min: $2 + $2.75 = $4.75
    expect(calculateFare(5.5)).toBe(4.75);
  });

  it('handles large distances', () => {
    // 100 km, 0 min: $2 + $50 = $52
    expect(calculateFare(100)).toBe(52.0);
  });

  it('handles very large distances', () => {
    // 500 km: $2 + $250 = $252
    expect(calculateFare(500)).toBe(252.0);
  });

  // --- Comfort (multiplier 1.4, min $5) ---

  it('returns comfort minimum fare for 0 distance', () => {
    // $2 * 1.4 = $2.80, below min $5
    expect(calculateFare(0, 0, 'comfort')).toBe(5.0);
  });

  it('calculates comfort fare for 10 km', () => {
    // ($2 + $5) * 1.4 = $9.80
    expect(calculateFare(10, 0, 'comfort')).toBe(9.8);
  });

  it('calculates comfort fare with duration', () => {
    // ($2 + $5 + $2.25) * 1.4 = $9.25 * 1.4 = $12.95
    expect(calculateFare(10, 15, 'comfort')).toBe(12.95);
  });

  // --- XL (multiplier 1.8, min $7) ---

  it('returns XL minimum fare for 0 distance', () => {
    // $2 * 1.8 = $3.60, below min $7
    expect(calculateFare(0, 0, 'xl')).toBe(7.0);
  });

  it('calculates XL fare for 10 km', () => {
    // ($2 + $5) * 1.8 = $12.60
    expect(calculateFare(10, 0, 'xl')).toBe(12.6);
  });

  // --- Edge cases ---

  it('returns minimum fare when calculated equals minimum exactly', () => {
    // Economy min $3. Need subtotal * 1.0 = $3 => subtotal = $3 => distance = ($3 - $2) / $0.50 = 2 km
    expect(calculateFare(2, 0, 'economy')).toBe(3.0);
  });

  it('exceeds minimum just above threshold', () => {
    // 2.1 km: $2 + $1.05 = $3.05
    expect(calculateFare(2.1, 0, 'economy')).toBe(3.05);
  });
});

describe('calculateFare with time multipliers', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('applies peak multiplier during morning rush', () => {
    vi.useFakeTimers();
    vi.setSystemTime(fakeDate(7)); // 1.5x
    // 10 km economy: ($2 + $5) * 1.5 = $10.50
    expect(calculateFare(10)).toBe(10.5);
  });

  it('applies late-night multiplier', () => {
    vi.useFakeTimers();
    vi.setSystemTime(fakeDate(23)); // 1.3x
    // 10 km economy: ($2 + $5) * 1.3 = $9.10
    expect(calculateFare(10)).toBe(9.1);
  });

  it('stacks time and ride type multipliers', () => {
    vi.useFakeTimers();
    vi.setSystemTime(fakeDate(7)); // 1.5x time
    // 10 km comfort: ($2 + $5) * 1.5 * 1.4 = $7 * 2.1 = $14.70
    expect(calculateFare(10, 0, 'comfort')).toBe(14.7);
  });
});

describe('formatFare', () => {
  it('formats fare with dollar sign and 2 decimal places', () => {
    expect(formatFare(7)).toBe('$7.00');
  });

  it('formats zero', () => {
    expect(formatFare(0)).toBe('$0.00');
  });

  it('formats decimal amounts', () => {
    expect(formatFare(4.75)).toBe('$4.75');
  });

  it('rounds to 2 decimal places', () => {
    expect(formatFare(3.456)).toBe('$3.46');
  });

  it('handles large amounts', () => {
    expect(formatFare(1234.5)).toBe('$1234.50');
  });

  it('formats single-cent amounts', () => {
    expect(formatFare(0.1)).toBe('$0.10');
  });
});
