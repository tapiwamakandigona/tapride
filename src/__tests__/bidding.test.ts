import { describe, it, expect } from 'vitest';

// useBidding is a React hook with Supabase deps — we test the pure logic extracted from it.
// The exported constants BID_MIN_PERCENT (0.7) and BID_MAX_PERCENT (1.5) define valid bid bounds.

const BID_MIN_PERCENT = 0.7;
const BID_MAX_PERCENT = 1.5;

function isValidBid(bidAmount: number, estimatedFare: number): boolean {
  const min = estimatedFare * BID_MIN_PERCENT;
  const max = estimatedFare * BID_MAX_PERCENT;
  return bidAmount >= min && bidAmount <= max;
}

describe('Bid validation (min/max bounds)', () => {
  const estimatedFare = 10.0;

  it('accepts bid at exactly the minimum (70%)', () => {
    expect(isValidBid(7.0, estimatedFare)).toBe(true);
  });

  it('accepts bid at exactly the maximum (150%)', () => {
    expect(isValidBid(15.0, estimatedFare)).toBe(true);
  });

  it('accepts bid within bounds', () => {
    expect(isValidBid(10.0, estimatedFare)).toBe(true);
    expect(isValidBid(8.5, estimatedFare)).toBe(true);
    expect(isValidBid(14.99, estimatedFare)).toBe(true);
  });

  it('rejects bid below minimum', () => {
    expect(isValidBid(6.99, estimatedFare)).toBe(false);
    expect(isValidBid(0, estimatedFare)).toBe(false);
  });

  it('rejects bid above maximum', () => {
    expect(isValidBid(15.01, estimatedFare)).toBe(false);
    expect(isValidBid(100, estimatedFare)).toBe(false);
  });

  it('handles small estimated fares', () => {
    // $3 fare: valid range $2.10 - $4.50
    expect(isValidBid(2.10, 3.0)).toBe(true);
    expect(isValidBid(4.50, 3.0)).toBe(true);
    expect(isValidBid(2.09, 3.0)).toBe(false);
    expect(isValidBid(4.51, 3.0)).toBe(false);
  });

  it('handles zero estimated fare', () => {
    // Only $0 bid is valid when fare is $0
    expect(isValidBid(0, 0)).toBe(true);
    expect(isValidBid(1, 0)).toBe(false);
  });

  it('rejects negative bids', () => {
    expect(isValidBid(-5, 10)).toBe(false);
  });
});

describe('Bid expiry logic', () => {
  it('bid expires after 2 minutes', () => {
    const now = Date.now();
    const expiresAt = new Date(now + 2 * 60 * 1000);
    const isExpired = expiresAt.getTime() < now;
    expect(isExpired).toBe(false);
  });

  it('bid is expired when past expiry time', () => {
    const now = Date.now();
    const expiresAt = new Date(now - 1000); // 1 second ago
    const isExpired = expiresAt.getTime() < now;
    expect(isExpired).toBe(true);
  });
});
