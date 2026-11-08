/**
 * Account switch (docs/android-tasks/OFFLINE-DESIGN.md section 4.8 "Another account signs in"): the app
 * tree is keyed by the account, so when a DIFFERENT account signs in on this device nothing the previous
 * account's pages held in memory survives. Signing out, or signing in again as the same account, keeps
 * the key (the first sign-in of a run does not remount either).
 */
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAccountGeneration } from './App';

describe('useAccountGeneration (the key of the app tree)', () => {
  it('changes only when a different account signs in', () => {
    const { result, rerender } = renderHook(({ id }: { id: string | null }) => useAccountGeneration(id), { initialProps: { id: null as string | null } });
    expect(result.current).toBe(0);
    rerender({ id: 'u_0123456789abcdef' }); // Dana signs in: the first account of the run
    expect(result.current).toBe(0);
    rerender({ id: null }); // signed out
    expect(result.current).toBe(0);
    rerender({ id: 'u_0123456789abcdef' }); // Dana again
    expect(result.current).toBe(0);
    rerender({ id: null });
    rerender({ id: 'u_fedcba9876543210' }); // Lior: a different account
    expect(result.current).toBe(1);
    rerender({ id: 'u_fedcba9876543210' });
    expect(result.current).toBe(1);
    rerender({ id: 'u_0123456789abcdef' }); // back to Dana
    expect(result.current).toBe(2);
  });
});
