import { useState, useEffect, useCallback } from 'react';
import {
  APP_VERSION,
  checkForUpdateFromGitHub,
  downloadAndInstallUpdate,
  type UpdateInfo,
  type DownloadProgress,
} from '../lib/version';

export interface VersionState {
  /** True while the initial check is in progress */
  checking: boolean;
  currentVersion: string;
  latestVersion: string;
  /** An update exists (newer version on GitHub) */
  updateAvailable: boolean;
  /** The update is forced (current < min_version in Supabase) */
  forced: boolean;
  downloadUrl: string | null;
  releaseNotes: string | null;
  apkSize: number | null;
  /** True while APK is being downloaded/installed */
  downloading: boolean;
  downloadProgress: DownloadProgress | null;
  downloadError: string | null;
  /** Call to start the download + install flow */
  triggerUpdate: () => void;
  /** Re-run the version check */
  recheck: () => void;
}

export function useVersionCheck(): VersionState {
  const [checking, setChecking] = useState(true);
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const doCheck = useCallback(async () => {
    setChecking(true);
    const hardTimeout = setTimeout(() => setChecking(false), 5000);
    try {
      const result = await checkForUpdateFromGitHub();
      setInfo(result);
    } catch {
      // Silently fail — treat as no update
    } finally {
      clearTimeout(hardTimeout);
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    doCheck();
  }, [doCheck]);

  const triggerUpdate = useCallback(async () => {
    if (!info?.downloadUrl) return;
    setDownloading(true);
    setDownloadError(null);
    setDownloadProgress(null);
    try {
      await downloadAndInstallUpdate(info.downloadUrl, (p) => setDownloadProgress(p));
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  }, [info]);

  return {
    checking,
    currentVersion: APP_VERSION,
    latestVersion: info?.latestVersion ?? APP_VERSION,
    updateAvailable: info?.available ?? false,
    forced: info?.forced ?? false,
    downloadUrl: info?.downloadUrl ?? null,
    releaseNotes: info?.releaseNotes ?? null,
    apkSize: info?.apkSize ?? null,
    downloading,
    downloadProgress,
    downloadError,
    triggerUpdate,
    recheck: doCheck,
  };
}
