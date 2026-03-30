/**
 * Haptic feedback utility — wraps Capacitor Haptics with web fallback.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getHaptics(): Promise<any> {
  try {
    // Dynamic import — resolves only when @capacitor/haptics is installed
    const mod = '@capacitor/haptics';
    return await import(/* @vite-ignore */ mod);
  } catch {
    return null;
  }
}

function webVibrate(pattern: number | number[]) {
  try {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  } catch {
    // no-op
  }
}

export async function lightTap() {
  const h = await getHaptics();
  if (h?.Haptics) {
    await h.Haptics.impact({ style: h.ImpactStyle?.Light ?? 'LIGHT' });
  } else {
    webVibrate(10);
  }
}

export async function mediumTap() {
  const h = await getHaptics();
  if (h?.Haptics) {
    await h.Haptics.impact({ style: h.ImpactStyle?.Medium ?? 'MEDIUM' });
  } else {
    webVibrate(20);
  }
}

export async function heavyTap() {
  const h = await getHaptics();
  if (h?.Haptics) {
    await h.Haptics.impact({ style: h.ImpactStyle?.Heavy ?? 'HEAVY' });
  } else {
    webVibrate(40);
  }
}

export async function success() {
  const h = await getHaptics();
  if (h?.Haptics) {
    await h.Haptics.notification({ type: h.NotificationType?.Success ?? 'SUCCESS' });
  } else {
    webVibrate([20, 50, 20]);
  }
}

export async function error() {
  const h = await getHaptics();
  if (h?.Haptics) {
    await h.Haptics.notification({ type: h.NotificationType?.Error ?? 'ERROR' });
  } else {
    webVibrate([40, 30, 40, 30, 40]);
  }
}
