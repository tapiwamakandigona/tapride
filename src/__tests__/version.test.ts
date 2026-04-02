import { describe, it, expect } from 'vitest';
import { compareVersions } from '../lib/version-utils';

// We test the compare logic directly since checkForUpdate needs Supabase
// Extract for testability

describe('compareVersions', () => {
  it('returns 0 for equal versions', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  });

  it('returns -1 when a < b', () => {
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
    expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
  });

  it('returns 1 when a > b', () => {
    expect(compareVersions('1.1.0', '1.0.9')).toBe(1);
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
  });

  it('handles missing patch segments', () => {
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
  });
});
