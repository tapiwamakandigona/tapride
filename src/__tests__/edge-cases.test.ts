import { describe, it, expect } from 'vitest';
import { calculateFare } from '../lib/fare';
import { haversineDistance } from '../lib/geo';

describe('calculateFare edge cases', () => {
  it('clamps negative distance to minimum fare', () => {
    // Negative distance is nonsensical — should still return min fare
    expect(calculateFare(-10)).toBe(3.0);
  });

  it('handles zero correctly', () => {
    expect(calculateFare(0)).toBe(3.0);
  });

  it('handles very large distances', () => {
    const fare = calculateFare(10000);
    expect(fare).toBeGreaterThan(0);
    expect(fare).toBe(5002); // 2 + 0.5 * 10000
  });
});

describe('haversineDistance edge cases', () => {
  it('handles antipodal points', () => {
    // North pole to south pole ~ 20015 km
    const dist = haversineDistance(90, 0, -90, 0);
    expect(dist).toBeCloseTo(20015, -2);
  });

  it('handles equator wrap', () => {
    // Two points on equator 180° apart ~ 20015 km
    const dist = haversineDistance(0, 0, 0, 180);
    expect(dist).toBeCloseTo(20015, -2);
  });

  it('returns positive for any pair of valid coordinates', () => {
    const dist = haversineDistance(-17.8292, 31.0522, 51.5074, -0.1278);
    expect(dist).toBeGreaterThan(0);
  });
});
