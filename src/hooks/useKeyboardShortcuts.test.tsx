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
