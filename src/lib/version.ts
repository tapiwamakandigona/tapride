import { supabase } from './supabase';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

export const APP_VERSION = '2.0.0';

const GITHUB_REPO = 'tapiwamakandigona/tapride';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

// ---------- Types ----------

export interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
  }>;
}

export interface UpdateInfo {
  available: boolean;
  forced: boolean;
  currentVersion: string;
  latestVersion: string;
  downloadUrl: string | null;
  releaseNotes: string | null;
  apkSize: number | null;
}

// ---------- Version comparison ----------

export function compareVersions(a: string, b: string): number {
  const normalize = (v: string) => v.replace(/^v/, '');
  const pa = normalize(a).split('.').map(Number);
  const pb = normalize(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

// ---------- GitHub Releases ----------

export async function getLatestRelease(): Promise<GitHubRelease | null> {
  try {
    const res = await fetch(GITHUB_API, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as GitHubRelease;
  } catch {
    return null;
  }
}

function findApkAsset(release: GitHubRelease) {
  return release.assets.find(
    (a) => a.name.endsWith('.apk') && a.name.toLowerCase().includes('tapride'),
  ) ?? release.assets.find((a) => a.name.endsWith('.apk')) ?? null;
}

// ---------- Supabase fallback (min_version / forced update check) ----------

async function getMinVersionFromSupabase(): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .in('key', ['min_version', 'min_app_version'])
      .limit(1)
      .maybeSingle();
    return data?.value ?? null;
  } catch {
    return null;
  }
}

// ---------- Main check ----------

export async function checkForUpdateFromGitHub(): Promise<UpdateInfo> {
  const base: UpdateInfo = {
    available: false,
    forced: false,
    currentVersion: APP_VERSION,
    latestVersion: APP_VERSION,
    downloadUrl: null,
    releaseNotes: null,
    apkSize: null,
  };

  // 1. Try GitHub releases
  const release = await getLatestRelease();
  if (release) {
    const latestTag = release.tag_name.replace(/^v/, '');
    if (compareVersions(APP_VERSION, latestTag) < 0) {
      const apk = findApkAsset(release);
      base.available = true;
      base.latestVersion = latestTag;
      base.downloadUrl = apk?.browser_download_url ?? null;
      base.releaseNotes = release.body ?? null;
      base.apkSize = apk?.size ?? null;
    }
  }

  // 2. Check Supabase for forced update (min_version)
  const minVersion = await getMinVersionFromSupabase();
  if (minVersion && compareVersions(APP_VERSION, minVersion) < 0) {
    base.forced = true;
    // If GitHub didn't detect update but Supabase says there is one, mark available
    if (!base.available) {
      base.available = true;
      base.latestVersion = minVersion;
    }
  }

  return base;
}

// Legacy compat
export async function checkForUpdate(): Promise<{ required: boolean; latestVersion: string }> {
  const info = await checkForUpdateFromGitHub();
  return { required: info.forced, latestVersion: info.latestVersion };
}

// ---------- Download & Install ----------

export type DownloadProgress = {
  /** 0-100 */
  percent: number;
  bytesDownloaded: number;
  bytesTotal: number;
};

/**
 * Download an APK and trigger the Android install prompt.
 *
 * Android requirements (handled at build time):
 *   - AndroidManifest.xml needs: <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />
 *   - For Android 7+ a FileProvider is needed to share the APK URI with the installer.
 *     Capacitor's default FileProvider config usually covers this.
 *   - For Android 8+ the user must allow "Install unknown apps" for the app.
 */
export async function downloadAndInstallUpdate(
  url: string,
  onProgress?: (p: DownloadProgress) => void,
): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    // Web: just reload (the new build is already deployed)
    window.location.reload();
    return;
  }

  // --- Native Android path ---
  // Download APK via fetch with progress tracking
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);

  const contentLength = Number(response.headers.get('content-length') || 0);
  const reader = response.body?.getReader();
  if (!reader) throw new Error('ReadableStream not supported');

  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress?.({
      percent: contentLength ? Math.round((received / contentLength) * 100) : 0,
      bytesDownloaded: received,
      bytesTotal: contentLength,
    });
  }

  // Combine chunks into a single Uint8Array → base64
  const blob = new Blob(chunks as unknown as BlobPart[]);
  const base64 = await blobToBase64(blob);

  const fileName = 'TapRide-update.apk';

  // Write to app's external cache using Filesystem plugin
  await Filesystem.writeFile({
    path: fileName,
    data: base64,
    directory: Directory.Cache,
  });

  // Get the file URI
  const fileInfo = await Filesystem.getUri({
    path: fileName,
    directory: Directory.Cache,
  });

  // Open the APK to trigger Android's install prompt.
  // We use the Capacitor-native intent bridge if available,
  // otherwise fall back to window.open which works on many Android webviews.
  try {
    // Try to trigger install via Android intent using Capacitor's native bridge
    // This calls a custom method we register via a small Java plugin (see android/ folder)
    // If unavailable, the catch block uses Browser fallback
    const { App: CapApp } = await import('@capacitor/app');
    if (CapApp && typeof (CapApp as any).openUrl === 'function') {
      await (CapApp as any).openUrl({ url: fileInfo.uri });
      return;
    }
  } catch {
    // Plugin not available, try fallback
  }

  // Fallback: open the file URI directly — Android's content handler will pick it up
  // On many Android WebViews this triggers the package installer
  window.open(fileInfo.uri, '_system');
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Strip the data:*;base64, prefix
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
