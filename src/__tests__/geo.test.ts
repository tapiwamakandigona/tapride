import { describe, it, expect } from 'vitest';
import { haversineDistance, formatAddress } from '../lib/geo';

describe('haversineDistance', () => {
  it('returns 0 for same coordinates', () => {
    const dist = haversineDistance(0, 0, 0, 0);
    expect(dist).toBe(0);
  });

  it('calculates correct distance between known cities', () => {
    // Harare to Bulawayo ~ 440 km
    const dist = haversineDistance(-17.8292, 31.0522, -20.1325, 28.6265);
    expect(dist).toBeGreaterThan(350);
    expect(dist).toBeLessThan(500);
  });

  it('calculates short distances accurately', () => {
    // ~1.11 km (1 degree lat ~ 111 km, 0.01 ~ 1.11 km)
    const dist = haversineDistance(0, 0, 0.01, 0);
    expect(dist).toBeCloseTo(1.11, 1);
  });

  it('is symmetric', () => {
    const d1 = haversineDistance(10, 20, 30, 40);
    const d2 = haversineDistance(30, 40, 10, 20);
    expect(d1).toBeCloseTo(d2, 10);
  });

  it('handles negative coordinates', () => {
    const dist = haversineDistance(-33.8688, 151.2093, -37.8136, 144.9631);
    // Sydney to Melbourne ~ 714 km
    expect(dist).toBeGreaterThan(600);
    expect(dist).toBeLessThan(800);
  });
});

describe('formatAddress', () => {
  it('formats coordinates to 4 decimal places', () => {
    expect(formatAddress(12.34567, -45.67891)).toBe('12.3457, -45.6789');
  });

  it('handles zero coordinates', () => {
    expect(formatAddress(0, 0)).toBe('0.0000, 0.0000');
  });

  it('handles whole numbers', () => {
    expect(formatAddress(10, 20)).toBe('10.0000, 20.0000');
  });
});
