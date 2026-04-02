import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('notifications', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('playNewRequestSound', () => {
    it('does not throw when AudioContext is unavailable', async () => {
      // Remove AudioContext
      const orig = (window as any).AudioContext;
      delete (window as any).AudioContext;
      delete (window as any).webkitAudioContext;

      const { playNewRequestSound } = await import('../lib/notifications');
      expect(() => playNewRequestSound()).not.toThrow();

      (window as any).AudioContext = orig;
    });
  });

  describe('vibrateDevice', () => {
    it('calls navigator.vibrate when available', async () => {
      const vibrateMock = vi.fn();
      Object.defineProperty(navigator, 'vibrate', {
        value: vibrateMock,
        writable: true,
        configurable: true,
      });

      const { vibrateDevice } = await import('../lib/notifications');
      vibrateDevice();
      expect(vibrateMock).toHaveBeenCalledWith([200, 100, 200]);
    });

    it('does not throw when vibrate is unavailable', async () => {
      const desc = Object.getOwnPropertyDescriptor(navigator, 'vibrate');
      Object.defineProperty(navigator, 'vibrate', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const { vibrateDevice } = await import('../lib/notifications');
      expect(() => vibrateDevice()).not.toThrow();

      if (desc) Object.defineProperty(navigator, 'vibrate', desc);
    });
  });
});
