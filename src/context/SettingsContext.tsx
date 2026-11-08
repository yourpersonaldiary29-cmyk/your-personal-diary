/**
 * Application settings (AppSettings from the server).
 *
 * - Loads `GET /api/settings` once the user is authenticated.
 * - Applies theme / font scale / reduced motion to <html> and syncs the
 *   offline privacy mode with the network guard.
 * - Display preferences are cached in localStorage so the login/welcome pages
 *   keep the user's look before a session exists.
 * - `update(patch)` saves to the server when authenticated; when anonymous it
 *   only changes the local preview (theme etc.).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppSettings } from '@shared/types';
import { settings as settingsApi, setOfflinePrivacyMode } from '@/api';
import { DEFAULT_APP_SETTINGS, FONT_SCALE_MAX, FONT_SCALE_MIN, UI_PREFS_KEY } from '@/constants/settings';
import { T } from '@/constants/texts';
import { useAuth } from './AuthContext';

export interface SettingsContextValue {
  settings: AppSettings;
  /** True once the server copy has been loaded for the current session. */
  loaded: boolean;
  /** Load error (localised message), if any. */
  error: string | null;
  /** Saves a partial change (server when logged in) and applies it immediately. */
  update: (patch: Partial<AppSettings>) => Promise<AppSettings>;
  /** Re-fetches from the server. */
  reload: () => Promise<void>;
}

export const SettingsContext = createContext<SettingsContextValue | null>(null);

type UiPrefs = Pick<AppSettings, 'theme' | 'fontScale' | 'reduceMotion'>;

function readCachedPrefs(): Partial<UiPrefs> {
  try {
    const raw = localStorage.getItem(UI_PREFS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<UiPrefs>;
    const out: Partial<UiPrefs> = {};
    if (parsed.theme && ['system', 'light', 'dark', 'high-contrast'].includes(parsed.theme)) out.theme = parsed.theme;
    if (typeof parsed.fontScale === 'number' && Number.isFinite(parsed.fontScale)) out.fontScale = parsed.fontScale;
    if (typeof parsed.reduceMotion === 'boolean') out.reduceMotion = parsed.reduceMotion;
    return out;
  } catch {
    return {};
  }
}

function writeCachedPrefs(s: AppSettings): void {
  try {
    const prefs: UiPrefs = { theme: s.theme, fontScale: s.fontScale, reduceMotion: s.reduceMotion };
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable */
  }
}

/** Applies display settings to the document root. Exported for tests. */
export function applyDisplaySettings(s: AppSettings): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', s.theme);
  const scale = Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, s.fontScale || 1));
  root.style.setProperty('--font-scale', String(scale));
  root.setAttribute('data-reduce-motion', s.reduceMotion ? 'true' : 'false');
  setOfflinePrivacyMode(s.offlinePrivacyMode);
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(() => ({ ...DEFAULT_APP_SETTINGS, ...readCachedPrefs() }));
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Apply to <html> whenever the effective settings change.
  useEffect(() => {
    applyDisplaySettings(settings);
  }, [settings]);

  const load = useCallback(async () => {
    try {
      const fresh = await settingsApi.get();
      setSettings(fresh);
      writeCachedPrefs(fresh);
      setLoaded(true);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : T.settingsLoadFailed);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      void load();
    } else if (status === 'anonymous') {
      // Keep the cached display prefs, reset everything else to defaults.
      setSettings({ ...DEFAULT_APP_SETTINGS, ...readCachedPrefs() });
      setLoaded(false);
    }
  }, [status, load]);

  const update = useCallback(
    async (patch: Partial<AppSettings>) => {
      if (status === 'authenticated') {
        const saved = await settingsApi.update(patch);
        setSettings(saved);
        writeCachedPrefs(saved);
        return saved;
      }
      const next = { ...settingsRef.current, ...patch };
      setSettings(next);
      writeCachedPrefs(next);
      return next;
    },
    [status],
  );

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, loaded, error, update, reload: load }),
    [settings, loaded, error, update, load],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

/** Access settings. Must be used inside SettingsProvider. */
export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
