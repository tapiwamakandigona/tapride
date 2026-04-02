// [INTENT] Audio/haptic feedback for ride events (new request, status changes)
// [CONSTRAINT] Must degrade gracefully — many mobile webviews restrict AudioContext and vibration
// [EDGE-CASE] iOS Safari requires AudioContext creation inside a user gesture; this may silently fail for programmatic calls

/** Play a two-tone ascending beep to signal a new ride request */
export function playNewRequestSound(): void {
  try {
    const AudioCtx = window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
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

    // [INTENT] Free AudioContext resources after playback completes
    // [CONSTRAINT] Must wait longer than the last beep endAt (0.8s) before closing
    setTimeout(() => ctx.close().catch(() => {}), 1200);
  } catch {
    // [EDGE-CASE] Browser doesn't support AudioContext at all — silent no-op
  }
}

/** Vibrate device if the Vibration API is available */
export function vibrateDevice(): void {
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
  } catch {
    // [EDGE-CASE] Some Capacitor/webview environments throw on vibrate
  }
}
