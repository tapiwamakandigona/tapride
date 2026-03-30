import { describe, it, expect } from 'vitest';
import { distanceToPickup } from '../lib/matching';

describe('distanceToPickup', () => {
  it('returns 0 for identical coordinates', () => {
    expect(distanceToPickup(0, 0, 0, 0)).toBe(0);
  });

  it('calculates short distance accurately', () => {
    // ~1.11 km for 0.01 degree latitude
    const dist = distanceToPickup(0, 0, 0.01, 0);
    expect(dist).toBeCloseTo(1.11, 1);
  });

  it('is symmetric', () => {
    const d1 = distanceToPickup(10, 20, 30, 40);
    const d2 = distanceToPickup(30, 40, 10, 20);
    expect(d1).toBeCloseTo(d2, 10);
  });

  it('handles negative coordinates (southern hemisphere)', () => {
    // Harare to Bulawayo ~440 km
    const dist = distanceToPickup(-17.8292, 31.0522, -20.1325, 28.6265);
    expect(dist).toBeGreaterThan(350);
    expect(dist).toBeLessThan(500);
  });

  it('calculates typical pickup distance (a few km)', () => {
    // Two points ~3 km apart in Harare
    const dist = distanceToPickup(-17.8292, 31.0522, -17.8100, 31.0700);
    expect(dist).toBeGreaterThan(1);
    expect(dist).toBeLessThan(5);
  });

  it('handles same latitude different longitude', () => {
    // At equator, 1 degree longitude ≈ 111 km
    const dist = distanceToPickup(0, 0, 0, 1);
    expect(dist).toBeCloseTo(111.2, 0);
  });

  it('handles antipodal-ish points (large distance)', () => {
    // North pole area to south pole area
    const dist = distanceToPickup(89, 0, -89, 0);
    expect(dist).toBeGreaterThan(19000);
    expect(dist).toBeLessThan(20100);
  });
});

describe('formatDistance (utility)', () => {
  // distanceToPickup returns km as a number. We test formatting at the UI level.
  it('returns a positive number for non-zero inputs', () => {
    const dist = distanceToPickup(-17.8292, 31.0522, -17.81, 31.06);
    expect(dist).toBeGreaterThan(0);
    expect(typeof dist).toBe('number');
    expect(Number.isFinite(dist)).toBe(true);
  });
});
