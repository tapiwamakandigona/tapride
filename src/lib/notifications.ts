/**
 * Audio/haptic notification utilities for ride events.
 */

/** Play a two-tone beep using Web Audio API */
export function playNewRequestSound(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();

    const beep = (freq: number, startAt: number, endAt: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime + startAt);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + endAt);
      osc.start(ctx.currentTime + startAt);
      osc.stop(ctx.currentTime + endAt);
    };

    beep(880, 0, 0.5);
    beep(1100, 0.3, 0.8);

    // Close context after sounds finish to free resources
    setTimeout(() => ctx.close().catch(() => {}), 1000);
  } catch {
    // Not all browsers support AudioContext
  }
}

/** Vibrate the device if supported */
export function vibrateDevice(): void {
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
  } catch {
    // Silently fail
  }
}
