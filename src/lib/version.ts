import { supabase } from './supabase';

// [INTENT] App version for forced-update checks against server-side min_version
// [CONSTRAINT] Must be semver — compareVersions parses up to 3 numeric segments
export const APP_VERSION = '2.0.0';

// [INTENT] Check if the running app version is below the server-mandated minimum
// [EDGE-CASE] app_config table may not exist yet, or key may use legacy name — try both
// [EDGE-CASE] Network failure or missing config → assume no update required (fail-open)
export async function checkForUpdate(): Promise<{ required: boolean; latestVersion: string }> {
  try {
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .in('key', ['min_version', 'min_app_version'])
      .limit(1)
      .maybeSingle();

    if (!data?.value) return { required: false, latestVersion: APP_VERSION };

    const minVersion = data.value;
    const required = compareVersions(APP_VERSION, minVersion) < 0;
    return { required, latestVersion: minVersion };
  } catch {
    return { required: false, latestVersion: APP_VERSION };
  }
}

// [INTENT] Compare two semver strings: returns -1, 0, or 1
// [CONSTRAINT] Only handles numeric major.minor.patch — no pre-release tags
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}
