/**
 * GitHub Pages SPA compatibility utilities.
 *
 * GitHub Pages doesn't support SPA routing natively — any path that isn't a
 * real file returns 404. We use a custom 404.html that encodes the original
 * URL into query params (?p=...&q=...&h=...) and redirects to index.html.
 * This module decodes that redirect and restores the original URL via
 * history.replaceState before React ever mounts.
 */

/** Returns true if the app is running on GitHub Pages (not localhost). */
export function isGitHubPages(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.location.hostname.endsWith('.github.io')
  );
}

/**
 * If the current URL contains GitHub Pages SPA redirect params (?p=...),
 * decode them and restore the real URL via replaceState.
 * Must be called BEFORE React renders so the router sees the correct path.
 */
export function handleGitHubPagesRedirect(): void {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  const encodedPath = params.get('p');

  if (!encodedPath) return; // Not a redirect — normal load

  const path = decodeURIComponent(encodedPath);
  const query = params.get('q') ? '?' + decodeURIComponent(params.get('q')!) : '';
  const hash = params.get('h') ? decodeURIComponent(params.get('h')!) : '';

  // Reconstruct: /tapride + /some/path + ?key=val + #hash
  const base = window.location.pathname.replace(/\/$/, ''); // e.g. "/tapride"
  const restoredUrl = base + path + query + hash;

  window.history.replaceState(null, '', restoredUrl);
}

/**
 * Unregister any stale service workers that may have been registered
 * by previous deployments (e.g. CRA or PWA setups). Stale service workers
 * can intercept requests and serve outdated cached content, causing
 * "stuck on loading" after deploys.
 */
export function unregisterServiceWorkers(): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((r) => r.unregister());
    });
  }
}
