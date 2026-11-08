/**
 * Saves a partial AppSettings change and announces the outcome.
 * Every settings control calls `save(patch, message)`: the message is announced
 * politely on success; on failure the localised error is stored (shown in an
 * Alert by the section) and announced assertively.
 */
import { useCallback, useState } from 'react';
import type { AppSettings } from '@shared/types';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { useSettings } from '@/context/SettingsContext';
import { errorMessage } from '@/utils/errors';

export interface SettingsSaver {
  /** Resolves true when the change was saved. */
  save: (patch: Partial<AppSettings>, message: string) => Promise<boolean>;
  /** Localised error of the last failed save, null otherwise. */
  error: string | null;
  saving: boolean;
}

export function useSettingsSaver(): SettingsSaver {
  const { update } = useSettings();
  const { announce } = useAnnouncer();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = useCallback(
    async (patch: Partial<AppSettings>, message: string) => {
      setSaving(true);
      setError(null);
      try {
        await update(patch);
        announce(message, 'polite');
        return true;
      } catch (e) {
        const text = errorMessage(e);
        setError(text);
        announce(text, 'assertive');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [update, announce],
  );

  return { save, error, saving };
}
