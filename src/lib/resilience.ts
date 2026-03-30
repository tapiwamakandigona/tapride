/**
 * Resilience utilities — timeouts, retries, and network checks.
 */

/** Wrap a promise with a timeout. Rejects with TimeoutError if not resolved in `ms`. */
export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Operation timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

export function withTimeout<T>(promise: Promise<T> | PromiseLike<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
    Promise.resolve(promise).then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/** Retry a function with exponential backoff. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  delayMs = 1000,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, delayMs * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}

/** Quick online check — navigator.onLine + optional fetch probe. */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/** Probe actual connectivity by hitting Supabase health or a known endpoint. */
export async function probeConnectivity(url?: string): Promise<boolean> {
  if (!isOnline()) return false;
  try {
    const target = url || 'https://bswikdlxlutpdaweuohi.supabase.co/rest/v1/';
    await withTimeout(fetch(target, { method: 'HEAD', mode: 'no-cors' }), 3000);
    return true;
  } catch {
    return false;
  }
}
