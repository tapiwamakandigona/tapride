import { describe, it, expect } from 'vitest';
import { calculateFare, formatFare } from '../lib/fare';

describe('calculateFare', () => {
  it('returns minimum fare for very short distances', () => {
    expect(calculateFare(0)).toBe(3.0); // base $2 + 0 = $2, but min is $3
    expect(calculateFare(0.5)).toBe(3.0); // base $2 + $0.25 = $2.25, still below min
  });

  it('returns base + per_km for longer distances', () => {
    // 10 km: $2 + $5 = $7
    expect(calculateFare(10)).toBe(7.0);
  });

  it('handles fractional distances', () => {
    // 5.5 km: $2 + $2.75 = $4.75
    expect(calculateFare(5.5)).toBe(4.75);
  });

  it('returns minimum fare at the threshold', () => {
    // $3 min fare: base $2 + $0.50 * x >= $3 => x >= 2
    expect(calculateFare(2)).toBe(3.0);
  });

  it('exceeds minimum fare above threshold', () => {
    // 3 km: $2 + $1.50 = $3.50
    expect(calculateFare(3)).toBe(3.5);
  });

  it('handles large distances', () => {
    // 100 km: $2 + $50 = $52
    expect(calculateFare(100)).toBe(52.0);
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
});
