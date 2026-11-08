/**
 * Per-account data kept on this device (review finding: recent search questions were device-wide
 * plaintext and shown to the next account): keyed by account, cleared on sign-out / deletion, and
 * useLocalStorageState never writes one account's value under another account's key.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLocalStorageState } from '@/hooks/useLocalStorageState';
import { readUserLocale, storeUserLocale } from '@/i18n/runtime';
import { clearSignedOutAccountData, forgetAccountOnThisDevice, LEGACY_RECENT_QUESTIONS_KEY, recentQuestionsKey } from './deviceData';

afterEach(() => window.localStorage.clear());

describe('device data per account', () => {
  it('sign-out removes the account list and the old shared one, and keeps other accounts and the language', () => {
    window.localStorage.setItem(recentQuestionsKey('u_a'), '["a"]');
    window.localStorage.setItem(recentQuestionsKey('u_b'), '["b"]');
    window.localStorage.setItem(LEGACY_RECENT_QUESTIONS_KEY, '["shared"]');
    storeUserLocale('u_a', 'he');
    clearSignedOutAccountData('u_a');
    expect(window.localStorage.getItem(recentQuestionsKey('u_a'))).toBeNull();
    expect(window.localStorage.getItem(LEGACY_RECENT_QUESTIONS_KEY)).toBeNull();
    expect(window.localStorage.getItem(recentQuestionsKey('u_b'))).toBe('["b"]');
    expect(readUserLocale('u_a')).toBe('he');
    forgetAccountOnThisDevice('u_a');
    expect(readUserLocale('u_a')).toBeNull();
  });

  it('useLocalStorageState reads the new key when it changes and never copies the old value over', () => {
    window.localStorage.setItem(recentQuestionsKey('u_a'), '["question of a"]');
    const { result, rerender } = renderHook(({ id }) => useLocalStorageState<string[]>(recentQuestionsKey(id), []), { initialProps: { id: 'u_a' } });
    expect(result.current[0]).toEqual(['question of a']);
    rerender({ id: 'u_b' });
    expect(result.current[0]).toEqual([]);
    expect(window.localStorage.getItem(recentQuestionsKey('u_b'))).toBeNull();
    act(() => result.current[1](['question of b']));
    expect(window.localStorage.getItem(recentQuestionsKey('u_b'))).toBe('["question of b"]');
    expect(window.localStorage.getItem(recentQuestionsKey('u_a'))).toBe('["question of a"]');
  });
});
