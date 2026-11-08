/** System bars follow the theme (WP-9). */
import { describe, expect, it, vi } from 'vitest';
import { followThemeWithSystemBars, systemBarsStyleFor } from './ui';

describe('systemBarsStyleFor', () => {
  it('light page -> dark icons (LIGHT); dark and high-contrast pages -> light icons (DARK); system follows the phone', () => {
    expect(systemBarsStyleFor('light', true)).toBe('LIGHT');
    expect(systemBarsStyleFor('dark', false)).toBe('DARK');
    expect(systemBarsStyleFor('high-contrast', false)).toBe('DARK');
    expect(systemBarsStyleFor('system', true)).toBe('DARK');
    expect(systemBarsStyleFor('system', false)).toBe('LIGHT');
    expect(systemBarsStyleFor(null, true)).toBe('DARK');
  });
});

describe('followThemeWithSystemBars', () => {
  function fakeQuery(matches: boolean) {
    const listeners = new Set<() => void>();
    const query = {
      matches,
      addEventListener: (_: 'change', fn: () => void) => listeners.add(fn),
      removeEventListener: (_: 'change', fn: () => void) => listeners.delete(fn),
      flip() {
        query.matches = !query.matches;
        for (const fn of listeners) fn();
      },
      listeners,
    };
    return query;
  }

  it('applies now, on a data-theme change and on a phone theme change, without repeating a style', async () => {
    const root = document.createElement('html');
    root.setAttribute('data-theme', 'system');
    const query = fakeQuery(false);
    const setStyle = vi.fn(async () => undefined);
    const stop = followThemeWithSystemBars({ setStyle }, { root, darkQuery: query as unknown as MediaQueryList });
    expect(setStyle).toHaveBeenLastCalledWith({ style: 'LIGHT' });

    root.setAttribute('data-theme', 'dark');
    await new Promise((r) => setTimeout(r, 0));
    expect(setStyle).toHaveBeenLastCalledWith({ style: 'DARK' });
    expect(setStyle).toHaveBeenCalledTimes(2);

    root.setAttribute('data-theme', 'high-contrast');
    await new Promise((r) => setTimeout(r, 0));
    expect(setStyle).toHaveBeenCalledTimes(2);

    root.setAttribute('data-theme', 'system');
    await new Promise((r) => setTimeout(r, 0));
    expect(setStyle).toHaveBeenLastCalledWith({ style: 'LIGHT' });
    query.flip();
    expect(setStyle).toHaveBeenLastCalledWith({ style: 'DARK' });

    stop();
    expect(query.listeners.size).toBe(0);
    const calls = setStyle.mock.calls.length;
    root.setAttribute('data-theme', 'light');
    await new Promise((r) => setTimeout(r, 0));
    expect(setStyle).toHaveBeenCalledTimes(calls);
  });

  it('a failing plugin is logged and retried on the next change', async () => {
    const root = document.createElement('html');
    root.setAttribute('data-theme', 'light');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const setStyle = vi.fn().mockRejectedValueOnce(new Error('no bars')).mockResolvedValue(undefined);
    const stop = followThemeWithSystemBars({ setStyle }, { root, darkQuery: null });
    await Promise.resolve();
    await Promise.resolve();
    expect(warn).toHaveBeenCalled();
    root.setAttribute('data-theme', 'light');
    root.setAttribute('data-theme', 'dark');
    await new Promise((r) => setTimeout(r, 0));
    expect(setStyle).toHaveBeenCalledTimes(2);
    stop();
    warn.mockRestore();
  });
});
