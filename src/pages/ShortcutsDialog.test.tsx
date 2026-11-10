/**
 * The "Keyboard shortcuts" dialog writes the key combinations the way the running platform does
 * (docs/apple-tasks/MAC-UI.md): the Mac app shows the Mac glyphs ("⌘N", "⌥1"), the Windows app and
 * the web UI - also in a browser on a Mac - keep the words ("Ctrl+N", "Alt+1"). The platform is the
 * real `isMacApp()` of src/offline/session.ts, driven through the Tauri shell's global and the user
 * agent exactly as session.test.ts does; no module is mocked.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { NAV_ITEMS } from '@shared/constants';
import { renderWithProviders } from '@/test/render';
import ShortcutsDialog from './ShortcutsDialog';

/** The user agents of the two desktop WebViews: WKWebView in the Mac app, WebView2 on Windows. */
const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)';
const WINDOWS_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0';
/** Safari on a Mac: the web UI the diary server serves, never the Mac app. */
const MAC_SAFARI_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';

/** The exact key column of the dialog, top to bottom, outside the Mac app... */
const WORDS = [...NAV_ITEMS.map((item) => `Alt+${item.key}`), 'Alt+←', 'Ctrl+N', 'Ctrl+K', 'Ctrl+L', 'Shift+?', 'Ctrl+S', 'Esc'];
/** ...and in the Mac app (the strings docs/MAC-RELEASE.he.md may quote). */
const GLYPHS = [...NAV_ITEMS.map((item) => `⌥${item.key}`), '⌥←', '⌘N', '⌘K', '⌘L', '⇧?', '⌘S', 'Esc'];

/** The Tauri shell's global (src/api/client.ts `isTauri`): the Windows and the Mac app have it, a browser never. */
function tauriShell(on: boolean): void {
  const w = window as unknown as Record<string, unknown>;
  if (on) w.__TAURI_INTERNALS__ = {};
  else delete w.__TAURI_INTERNALS__;
}
/** What the page reports as `navigator.userAgent` (jsdom's own one is neither Mac nor Windows). */
const userAgent = (ua: string) => vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(ua);

/** The text of every <kbd> of the dialog, in table order. */
function keyColumn(): string[] {
  return Array.from(document.querySelectorAll('kbd'), (cell) => cell.textContent ?? '');
}

function renderDialog() {
  return renderWithProviders(<ShortcutsDialog open onClose={() => undefined} />);
}

describe('ShortcutsDialog: the key column follows the platform', () => {
  afterEach(() => {
    tauriShell(false);
    vi.restoreAllMocks();
  });

  it('Mac app (Tauri shell + Macintosh user agent): "⌘N" and "⌥1", every row in Mac glyphs, "Esc" as it is', () => {
    tauriShell(true);
    userAgent(MAC_UA);
    renderDialog();
    expect(screen.getByText('⌘N')).toBeInTheDocument();
    expect(screen.getByText('⌥1')).toBeInTheDocument();
    expect(screen.queryByText('Ctrl+N')).toBeNull();
    expect(screen.queryByText('Alt+1')).toBeNull();
    expect(keyColumn()).toEqual(GLYPHS);
    expect(GLYPHS).toHaveLength(NAV_ITEMS.length + 7);
  });

  it('Windows app (Tauri shell + Windows user agent): "Ctrl+N" and "Alt+1" as before', () => {
    tauriShell(true);
    userAgent(WINDOWS_UA);
    renderDialog();
    expect(screen.getByText('Ctrl+N')).toBeInTheDocument();
    expect(screen.getByText('Alt+1')).toBeInTheDocument();
    expect(screen.queryByText('⌘N')).toBeNull();
    expect(keyColumn()).toEqual(WORDS);
  });

  it('web UI in a browser, Safari on a Mac included (no Tauri shell): the words, whatever the user agent says', () => {
    userAgent(MAC_SAFARI_UA);
    renderDialog();
    expect(screen.getByText('Ctrl+N')).toBeInTheDocument();
    expect(screen.getByText('Alt+1')).toBeInTheDocument();
    expect(screen.queryByText('⌘N')).toBeNull();
    expect(screen.queryByText('⌥1')).toBeNull();
    expect(keyColumn()).toEqual(WORDS);
  });

  it('the key stays a <kbd> in the first column, so assistive technology still announces it as keyboard input', () => {
    tauriShell(true);
    userAgent(MAC_UA);
    renderDialog();
    const cell = screen.getByText('⌘N');
    expect(cell.tagName).toBe('KBD');
    const row = cell.closest('tr');
    expect(row?.cells[0]).toContainElement(cell);
    // The description column is untouched by the platform (Hebrew, the test language).
    expect(row?.cells[1]).toHaveTextContent(/\S/);
    expect(row?.cells[1].textContent).not.toContain('⌘');
  });
});
