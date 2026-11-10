/**
 * src/utils/platform-keys.ts (docs/apple-tasks/MAC-UI.md): the Mac app writes the shortcuts with the
 * Mac glyphs, everything else keeps the words; the two catalogue hints that spell "Ctrl+S" / "Ctrl+L"
 * (German: "Strg+S" / "Strg+L") are rewritten in the Mac app only, in all 20 languages, with the rest
 * of the sentence intact. The platform is passed explicitly; the last two blocks drive the default -
 * the real `isMacApp()` of src/offline/session.ts - through the Tauri shell's global and the user
 * agent, as session.test.ts does, so no module is mocked. The render-site block uses createElement:
 * this is a .ts file, as the brief names it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { screen } from '@testing-library/react';
import { LOCALE_CODES, t } from '@shared/i18n';
import { SHORTCUTS } from '@/constants/shortcuts';
import { EntryForm } from '@/pages/entries/EntryForm';
import { ET } from '@/pages/entries/texts';
import { emptyEntryValues, useEntryForm } from '@/pages/entries/useEntryForm';
import { SecuritySection } from '@/pages/settings/SecuritySection';
import { ST } from '@/pages/settings/texts';
import { renderWithProviders } from '@/test/render';
import { MAC_COMMAND, MAC_OPTION, MAC_SHIFT, platformizeHint, shortcutLabel } from './platform-keys';

/** U+200E LEFT-TO-RIGHT MARK: `platformizeHint` puts it before the glyph (invisible; keeps "⌘S" in order in a Hebrew or Arabic sentence). */
const LRM = '‎';

/** Every key combination the dialog lists and its Mac wording. */
const LABELS: [string, string][] = [
  ['Alt+1', '⌥1'],
  ['Alt+9', '⌥9'],
  ['Alt+0', '⌥0'],
  ['Alt+←', '⌥←'],
  ['Ctrl+N', '⌘N'],
  ['Ctrl+K', '⌘K'],
  ['Ctrl+L', '⌘L'],
  ['Ctrl+S', '⌘S'],
  ['Shift+?', '⇧?'],
  ['Esc', 'Esc'],
];

const HEBREW_SAVE = 'אפשר גם ללחוץ Ctrl+S';
const ARABIC_LOCK = 'يمكن أيضًا القفل في أي لحظة باستخدام Ctrl+L.';
const GERMAN_SAVE = 'Du kannst auch Strg+S drücken';
const ENGLISH_SAVE = 'You can also press Ctrl+S';

/** The user agents of the two desktop WebViews: WKWebView in the Mac app, WebView2 on Windows. */
const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)';
const WINDOWS_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0';
/** Safari on a Mac: the web UI the diary server serves, never the Mac app. */
const MAC_SAFARI_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';

/** The Tauri shell's global (src/api/client.ts `isTauri`): the Windows and the Mac app have it, a browser never. */
function tauriShell(on: boolean): void {
  const w = window as unknown as Record<string, unknown>;
  if (on) w.__TAURI_INTERNALS__ = {};
  else delete w.__TAURI_INTERNALS__;
}
/** What the page reports as `navigator.userAgent` (jsdom's own one is neither Mac nor Windows). */
const userAgent = (ua: string) => vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(ua);

describe('shortcutLabel', () => {
  it('the glyphs are the Unicode key symbols', () => {
    expect(MAC_COMMAND).toBe('⌘');
    expect(MAC_OPTION).toBe('⌥');
    expect(MAC_SHIFT).toBe('⇧');
  });

  it.each(LABELS)('Mac app: %s -> %s', (keys, mac) => {
    expect(shortcutLabel(keys, true)).toBe(mac);
  });

  it('covers every combination the dialog lists: no modifier word and no "+" is left behind', () => {
    expect(SHORTCUTS.length).toBeGreaterThan(0);
    for (const { keys } of SHORTCUTS) {
      const mac = shortcutLabel(keys, true);
      expect(mac, keys).not.toMatch(/Ctrl|Alt|Shift|\+/);
      if (keys !== 'Esc') expect(mac, keys).toMatch(/^[⌘⌥⇧]./);
    }
  });

  it('is idempotent: a label already in Mac glyphs changes no further', () => {
    for (const [keys] of LABELS) {
      const once = shortcutLabel(keys, true);
      expect(shortcutLabel(once, true)).toBe(once);
    }
  });

  it('several modifiers: every word becomes its glyph, in order', () => {
    expect(shortcutLabel('Ctrl+Shift+S', true)).toBe('⌘⇧S');
    expect(shortcutLabel('Ctrl+Alt+Delete', true)).toBe('⌘⌥Delete');
  });

  it('outside the Mac app (the Windows app, the web UI) the text is returned unchanged', () => {
    for (const [keys] of LABELS) expect(shortcutLabel(keys, false)).toBe(keys);
    expect(shortcutLabel('Ctrl+Shift+S', false)).toBe('Ctrl+Shift+S');
  });
});

describe('platformizeHint', () => {
  it('Mac app: "Ctrl+S" becomes "⌘S" (behind a left-to-right mark), "Ctrl+L" becomes "⌘L"', () => {
    expect(platformizeHint(ENGLISH_SAVE, true)).toBe(`You can also press ${LRM}⌘S`);
    expect(platformizeHint('You can also lock at any moment with Ctrl+L.', true)).toBe(`You can also lock at any moment with ${LRM}⌘L.`);
  });

  it('a Hebrew and an Arabic hint keep every other character; only the shortcut token changes', () => {
    const hebrew = platformizeHint(HEBREW_SAVE, true);
    expect(hebrew).toBe(`אפשר גם ללחוץ ${LRM}⌘S`);
    expect(hebrew.replace(`${LRM}⌘S`, 'Ctrl+S')).toBe(HEBREW_SAVE);
    const arabic = platformizeHint(ARABIC_LOCK, true);
    expect(arabic).toBe(`يمكن أيضًا القفل في أي لحظة باستخدام ${LRM}⌘L.`);
    expect(arabic.replace(`${LRM}⌘L`, 'Ctrl+L')).toBe(ARABIC_LOCK);
  });

  it('German spells the key "Strg": "Strg+S" becomes "⌘S" too (a Mac keyboard has no Strg key)', () => {
    expect(platformizeHint(GERMAN_SAVE, true)).toBe(`Du kannst auch ${LRM}⌘S drücken`);
  });

  it('is idempotent and leaves a text that does not spell "Ctrl+<letter>" alone', () => {
    const once = platformizeHint(HEBREW_SAVE, true);
    expect(platformizeHint(once, true)).toBe(once);
    for (const text of ['', 'Esc', 'Shift+?', 'ctrl+s', 'Control+S', 'press Ctrl + S', 'אפשר לשמור']) expect(platformizeHint(text, true)).toBe(text);
  });

  it('outside the Mac app the hint is returned unchanged, whatever the language', () => {
    for (const text of [HEBREW_SAVE, ARABIC_LOCK, GERMAN_SAVE, ENGLISH_SAVE]) expect(platformizeHint(text, false)).toBe(text);
  });

  it('all 20 catalogues: both hints spell the shortcut; the Mac app shows "⌘S" / "⌘L" and nothing else moves', () => {
    const hints: [string, string][] = [
      ['entries.action.saveHint', 'S'],
      ['settings.security.lockNowHint', 'L'],
    ];
    expect(LOCALE_CODES).toHaveLength(20);
    for (const locale of LOCALE_CODES) {
      for (const [key, letter] of hints) {
        const text = t(locale, key);
        const token = /\b(?:Ctrl|Strg)\+([A-Z])\b/.exec(text);
        expect(token, `${locale} ${key}: ${text}`).not.toBeNull();
        const [spelled, found] = token as RegExpExecArray;
        expect(found, `${locale} ${key}`).toBe(letter);
        const mac = platformizeHint(text, true);
        expect(mac, `${locale} ${key}`).toBe(text.replace(spelled, `${LRM}⌘${letter}`));
        expect(mac, `${locale} ${key}`).not.toMatch(/Ctrl|Strg/);
        expect(platformizeHint(text, false), `${locale} ${key}`).toBe(text);
      }
    }
  });
});

describe('the default platform is isMacApp(): the Tauri shell AND a Macintosh user agent', () => {
  afterEach(() => {
    tauriShell(false);
    vi.restoreAllMocks();
  });

  it('Mac app: the glyphs, in the dialog rows too', () => {
    tauriShell(true);
    userAgent(MAC_UA);
    expect(shortcutLabel('Ctrl+N')).toBe('⌘N');
    expect(shortcutLabel('Alt+1')).toBe('⌥1');
    expect(platformizeHint(ENGLISH_SAVE)).toBe(`You can also press ${LRM}⌘S`);
    expect(SHORTCUTS.map((s) => s.label)).toEqual(SHORTCUTS.map((s) => shortcutLabel(s.keys, true)));
    // The data itself never changes: the hook keeps reading "Alt+1", "Ctrl+N"...
    expect(SHORTCUTS.map((s) => s.keys)).toContain('Ctrl+N');
  });

  it('Windows app (the shell, a Windows user agent): the words', () => {
    tauriShell(true);
    userAgent(WINDOWS_UA);
    expect(shortcutLabel('Ctrl+N')).toBe('Ctrl+N');
    expect(platformizeHint(ENGLISH_SAVE)).toBe(ENGLISH_SAVE);
    expect(SHORTCUTS.map((s) => s.label)).toEqual(SHORTCUTS.map((s) => s.keys));
  });

  it('web UI, Safari on a Mac included (no shell): the words, whatever the user agent says', () => {
    userAgent(MAC_SAFARI_UA);
    expect(shortcutLabel('Alt+1')).toBe('Alt+1');
    expect(platformizeHint(HEBREW_SAVE)).toBe(HEBREW_SAVE);
    expect(SHORTCUTS.map((s) => s.label)).toEqual(SHORTCUTS.map((s) => s.keys));
  });
});

// The two places that render the hints (docs/apple-tasks/MAC-UI.md deliverable 2): the entry form's
// "You can also press Ctrl+S" and the Security card's "You can also lock at any moment with Ctrl+L."
describe('the two render sites of the hints', () => {
  /** The entry form with an empty new entry, as the "New entry" page renders it. */
  function Form() {
    const form = useEntryForm(emptyEntryValues());
    return createElement(EntryForm, { form, onSubmit: () => undefined, onCancel: () => undefined });
  }

  afterEach(() => {
    tauriShell(false);
    vi.restoreAllMocks();
  });

  it('Mac app: "⌘S" under the form buttons and "⌘L" in the Security card (Hebrew, the test language)', () => {
    tauriShell(true);
    userAgent(MAC_UA);
    const save = platformizeHint(ET.saveHint, true);
    expect(save).toBe(`אפשר גם ללחוץ ${LRM}⌘S`);
    const { unmount } = renderWithProviders(createElement(Form));
    expect(screen.getByText(save)).toBeInTheDocument();
    expect(screen.queryByText(ET.saveHint)).toBeNull();
    unmount();
    const lock = platformizeHint(ST.lockNowHint, true);
    expect(lock).toBe(`אפשר לנעול בכל רגע גם עם ${LRM}⌘L.`);
    renderWithProviders(createElement(SecuritySection), { auth: 'authenticated' });
    expect(screen.getByText(lock)).toBeInTheDocument();
    expect(screen.queryByText(ST.lockNowHint)).toBeNull();
  });

  it('Windows app: the catalogue strings as they are', () => {
    tauriShell(true);
    userAgent(WINDOWS_UA);
    expect(ET.saveHint).toContain('Ctrl+S');
    expect(ST.lockNowHint).toContain('Ctrl+L');
    const { unmount } = renderWithProviders(createElement(Form));
    expect(screen.getByText(ET.saveHint)).toBeInTheDocument();
    unmount();
    renderWithProviders(createElement(SecuritySection), { auth: 'authenticated' });
    expect(screen.getByText(ST.lockNowHint)).toBeInTheDocument();
  });

  it('web UI in a browser on a Mac: the catalogue strings as they are', () => {
    userAgent(MAC_SAFARI_UA);
    const { unmount } = renderWithProviders(createElement(Form));
    expect(screen.getByText(ET.saveHint)).toBeInTheDocument();
    unmount();
    renderWithProviders(createElement(SecuritySection), { auth: 'authenticated' });
    expect(screen.getByText(ST.lockNowHint)).toBeInTheDocument();
  });
});
