import { supabase } from './supabase';

export const APP_VERSION = '1.0.0';

export async function checkForUpdate(): Promise<{ required: boolean; latestVersion: string }> {
  try {
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'min_app_version')
      .single();

    if (!data) return { required: false, latestVersion: APP_VERSION };

    const minVersion = data.value;
    const required = compareVersions(APP_VERSION, minVersion) < 0;
    return { required, latestVersion: minVersion };
  } catch {
    return { required: false, latestVersion: APP_VERSION };
  }
}

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
