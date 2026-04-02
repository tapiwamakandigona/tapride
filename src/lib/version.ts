import { supabase } from './supabase';
import { compareVersions } from './version-utils';

export const APP_VERSION = '1.0.1';

export async function checkForUpdate(): Promise<{ required: boolean; latestVersion: string }> {
  try {
    // Try both possible keys for backwards compatibility
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .in('key', ['min_version', 'min_app_version'])
      .limit(1)
      .maybeSingle();

    if (!data) return { required: false, latestVersion: APP_VERSION };

    const minVersion = data.value;
    const required = compareVersions(APP_VERSION, minVersion) < 0;
    return { required, latestVersion: minVersion };
  } catch {
    return { required: false, latestVersion: APP_VERSION };
  }
}
