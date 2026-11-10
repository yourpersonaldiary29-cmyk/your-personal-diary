import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { LocationDisplay, currentPath, renderWithProviders, sampleUser, type ProviderOptions } from '@/test/render';
import { shortcutHintsAvailable, useKeyboardShortcuts } from './useKeyboardShortcuts';

function Harness({ onShowShortcuts }: { onShowShortcuts?: () => void }) {
  useKeyboardShortcuts({ onShowShortcuts });
  return (
    <>
      <input aria-label="שדה" />
      <Routes>
        <Route path="*" element={<LocationDisplay />} />
      </Routes>
    </>
  );
}

function renderHarness(options: ProviderOptions = {}, onShowShortcuts?: () => void) {
  return renderWithProviders(<Harness onShowShortcuts={onShowShortcuts} />, { auth: 'authenticated', route: '/', ...options });
}

describe('useKeyboardShortcuts', () => {
  it('Alt+3 navigates to /diary (third nav item)', async () => {
    renderHarness();
    fireEvent.keyDown(window, { key: '3', code: 'Digit3', altKey: true });
    await waitFor(() => expect(currentPath()).toBe('/diary'));
  });

  it('Alt+0 navigates to /settings even when anonymous, but Alt+3 does not', async () => {
    renderHarness({ auth: 'anonymous' });
    fireEvent.keyDown(window, { key: '3', code: 'Digit3', altKey: true });
    await new Promise((r) => setTimeout(r, 10));
    expect(currentPath()).toBe('/');
    fireEvent.keyDown(window, { key: '0', code: 'Digit0', altKey: true });
    await waitFor(() => expect(currentPath()).toBe('/settings'));
  });

  it('Ctrl+N -> /new and Ctrl+K -> /search', async () => {
    renderHarness();
    fireEvent.keyDown(window, { key: 'n', code: 'KeyN', ctrlKey: true });
    await waitFor(() => expect(currentPath()).toBe('/new'));
    fireEvent.keyDown(window, { key: 'k', code: 'KeyK', ctrlKey: true });
    await waitFor(() => expect(currentPath()).toBe('/search'));
  });

  it('Ctrl+L locks the diary', () => {
    const lock = vi.fn();
    renderHarness({ lock: { lock } });
    fireEvent.keyDown(window, { key: 'l', code: 'KeyL', ctrlKey: true });
    expect(lock).toHaveBeenCalledTimes(1);
  });

  it('Shift+? opens the shortcuts dialog, except while typing in a field', () => {
    const onShowShortcuts = vi.fn();
    renderHarness({}, onShowShortcuts);
    fireEvent.keyDown(window, { key: '?', code: 'Slash', shiftKey: true });
    expect(onShowShortcuts).toHaveBeenCalledTimes(1);
    const input = screen.getByRole('textbox', { name: 'שדה' });
    fireEvent.keyDown(input, { key: '?', code: 'Slash', shiftKey: true });
    expect(onShowShortcuts).toHaveBeenCalledTimes(1);
  });

  it('Alt+digit still works while typing in a field (Ctrl/Alt combos are global)', async () => {
    renderHarness();
    const input = screen.getByRole('textbox', { name: 'שדה' });
    fireEvent.keyDown(input, { key: '5', code: 'Digit5', altKey: true });
    await waitFor(() => expect(currentPath()).toBe('/habits'));
  });

  it('Option+digit on a Mac keyboard: the layout types a symbol ("¡" for Option+1), the digit is read from e.code', async () => {
    renderHarness({ route: '/diary' });
    fireEvent.keyDown(window, { key: '¡', code: 'Digit1', altKey: true });
    await waitFor(() => expect(currentPath()).toBe('/'));
  });

  it('the Command key counts as Ctrl (Mac app): Cmd+N -> /new, Cmd+L locks', async () => {
    const lock = vi.fn();
    renderHarness({ lock: { lock } });
    fireEvent.keyDown(window, { key: 'n', code: 'KeyN', metaKey: true });
    await waitFor(() => expect(currentPath()).toBe('/new'));
    fireEvent.keyDown(window, { key: 'l', code: 'KeyL', metaKey: true });
    expect(lock).toHaveBeenCalledTimes(1);
  });

  it('ignores AltGr (Ctrl+Alt) combinations used to type characters', async () => {
    renderHarness();
    fireEvent.keyDown(window, { key: '3', code: 'Digit3', altKey: true, ctrlKey: true });
    await new Promise((r) => setTimeout(r, 10));
    expect(currentPath()).toBe('/');
  });

  it('does nothing while locked', async () => {
    renderHarness({ lock: { locked: true } });
    fireEvent.keyDown(window, { key: '3', code: 'Digit3', altKey: true });
    await new Promise((r) => setTimeout(r, 10));
    expect(currentPath()).toBe('/');
  });

  it('Ctrl+L does nothing for the guest of the tour mode (no password could unlock the diary)', async () => {
    const lock = vi.fn();
    renderHarness({ lock: { lock }, user: { ...sampleUser, guest: true } });
    fireEvent.keyDown(window, { key: 'l', code: 'KeyL', ctrlKey: true });
    expect(lock).not.toHaveBeenCalled();
    // The other shortcuts keep working for a guest.
    fireEvent.keyDown(window, { key: 'n', code: 'KeyN', ctrlKey: true });
    await waitFor(() => expect(currentPath()).toBe('/new'));
  });
});

// docs/apple-tasks/MAC-UI.md: on a Mac, Option is the key that types characters (the Mac's AltGr) and
// Option+← moves the caret one word back, so inside a field the Mac app leaves both to macOS. The
// platform is the real `isMacApp()` of src/offline/session.ts - the Tauri shell's global AND a
// Macintosh user agent - driven as session.test.ts does; `fireEvent` answers false when the hook
// called preventDefault (the key was swallowed: no character typed, no caret moved).
describe('useKeyboardShortcuts: the Option key inside a field in the Mac app', () => {
  /** The user agents of the two desktop WebViews: WKWebView in the Mac app, WebView2 on Windows. */
  const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)';
  const WINDOWS_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0';
  /** Safari on a Mac: the web UI the diary server serves, never the Mac app. */
  const MAC_SAFARI_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';

  /** Puts the test in an app shell (the Tauri global: Windows and Mac app) or a browser, with this user agent. */
  function platform(shell: boolean, userAgent: string): void {
    if (shell) (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(userAgent);
  }

  /** A short wait, as the other "nothing happens" tests above, so a navigation would have shown. */
  const settle = () => new Promise((r) => setTimeout(r, 10));

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
    vi.restoreAllMocks();
  });

  it('Option+digit in a field types the character of the layout ("[" is Option+5 on a German Mac keyboard, "¡" Option+1 on a US one): no navigation, nothing swallowed', async () => {
    platform(true, MAC_UA);
    renderHarness({ route: '/diary' });
    const input = screen.getByRole('textbox', { name: 'שדה' });
    expect(fireEvent.keyDown(input, { key: '[', code: 'Digit5', altKey: true })).toBe(true);
    expect(fireEvent.keyDown(input, { key: '¡', code: 'Digit1', altKey: true })).toBe(true);
    expect(fireEvent.keyDown(input, { key: 'º', code: 'Digit0', altKey: true })).toBe(true);
    await settle();
    expect(currentPath()).toBe('/diary');
  });

  it('Option+← in a field moves the caret one word back: no navigation, nothing swallowed', async () => {
    platform(true, MAC_UA);
    renderHarness({ route: '/diary' });
    const input = screen.getByRole('textbox', { name: 'שדה' });
    expect(fireEvent.keyDown(input, { key: 'ArrowLeft', code: 'ArrowLeft', altKey: true })).toBe(true);
    await settle();
    expect(currentPath()).toBe('/diary');
  });

  it('outside a field ⌥1..⌥0 and ⌥← navigate as the dialog says, and the Command shortcuts work inside a field too', async () => {
    const lock = vi.fn();
    platform(true, MAC_UA);
    renderHarness({ route: '/diary', lock: { lock } });
    expect(fireEvent.keyDown(window, { key: '¡', code: 'Digit1', altKey: true })).toBe(false);
    await waitFor(() => expect(currentPath()).toBe('/'));
    fireEvent.keyDown(window, { key: '£', code: 'Digit3', altKey: true });
    await waitFor(() => expect(currentPath()).toBe('/diary'));
    expect(fireEvent.keyDown(window, { key: 'ArrowLeft', code: 'ArrowLeft', altKey: true })).toBe(false);
    await waitFor(() => expect(currentPath()).toBe('/'));
    const input = screen.getByRole('textbox', { name: 'שדה' });
    expect(fireEvent.keyDown(input, { key: 'n', code: 'KeyN', metaKey: true })).toBe(false);
    await waitFor(() => expect(currentPath()).toBe('/new'));
    fireEvent.keyDown(input, { key: 'k', code: 'KeyK', metaKey: true });
    await waitFor(() => expect(currentPath()).toBe('/search'));
    fireEvent.keyDown(input, { key: 'l', code: 'KeyL', metaKey: true });
    expect(lock).toHaveBeenCalledTimes(1);
  });

  it('the Windows app keeps Alt+digit and Alt+← global inside a field, as before', async () => {
    platform(true, WINDOWS_UA);
    renderHarness({ route: '/diary' });
    const input = screen.getByRole('textbox', { name: 'שדה' });
    expect(fireEvent.keyDown(input, { key: '5', code: 'Digit5', altKey: true })).toBe(false);
    await waitFor(() => expect(currentPath()).toBe('/habits'));
    expect(fireEvent.keyDown(input, { key: 'ArrowLeft', code: 'ArrowLeft', altKey: true })).toBe(false);
    await waitFor(() => expect(currentPath()).toBe('/'));
  });

  it('the web UI in a browser on a Mac (no app shell) keeps them global inside a field too, as before', async () => {
    platform(false, MAC_SAFARI_UA);
    renderHarness({ route: '/diary' });
    const input = screen.getByRole('textbox', { name: 'שדה' });
    expect(fireEvent.keyDown(input, { key: '[', code: 'Digit5', altKey: true })).toBe(false);
    await waitFor(() => expect(currentPath()).toBe('/habits'));
    expect(fireEvent.keyDown(input, { key: 'ArrowLeft', code: 'ArrowLeft', altKey: true })).toBe(false);
    await waitFor(() => expect(currentPath()).toBe('/'));
  });
});

describe('shortcutHintsAvailable', () => {
  /** Makes matchMedia answer `fine` for the "(hover: hover) and (pointer: fine)" query. */
  function pointer(fine: boolean) {
    return vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: fine && query.includes('pointer: fine'),
          media: query,
          onchange: null,
          addListener: () => undefined,
          removeListener: () => undefined,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          dispatchEvent: () => false,
        }) as unknown as MediaQueryList,
    );
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('desktop / browser build: shortcut hints are always shown, whatever the pointer', () => {
    pointer(false);
    expect(shortcutHintsAvailable()).toBe(true);
  });

  it('phone app: hidden on a touch screen, shown with a keyboard and a fine pointer', () => {
    vi.stubGlobal('__MOBILE__', true);
    pointer(false);
    expect(shortcutHintsAvailable()).toBe(false);
    vi.restoreAllMocks();
    pointer(true);
    expect(shortcutHintsAvailable()).toBe(true);
  });
});
