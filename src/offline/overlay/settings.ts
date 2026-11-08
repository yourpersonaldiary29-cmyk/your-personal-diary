/** Overlay of `GET /api/settings` (section 4.6, row "AppSettings"): the merged patch applied. */
import type { AppSettings } from '@shared/types';
import type { Effects } from './effects';

export function overlaySettings(settings: AppSettings, fx: Effects): AppSettings {
  return fx.settings ? { ...settings, ...fx.settings } : settings;
}
