import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  UNSAVED_LEAVE,
  UNSAVED_STAY,
  UNSAVED_TITLE,
  clearLeaveGuard,
  confirmNavigation,
  hasActiveLeaveGuard,
  useUnsavedChangesGuard,
} from './useUnsavedChangesGuard';

let lastResult: boolean | null = null;

function Form({ initiallyDirty = false }: { initiallyDirty?: boolean }) {
  const [dirty, setDirty] = useState(initiallyDirty);
  const { confirmLeave, dialog, prompting } = useUnsavedChangesGuard(dirty);
  return (
    <>
      <button type="button" onClick={() => setDirty(true)}>
        שנה
      </button>
      <button
        type="button"
        onClick={() => {
          void confirmLeave().then((ok) => {
            lastResult = ok;
          });
        }}
      >
        עזוב
      </button>
      <p data-testid="prompting">{String(prompting)}</p>
      {dialog}
    </>
  );
}

describe('useUnsavedChangesGuard', () => {
  afterEach(() => {
    lastResult = null;
    clearLeaveGuard();
  });

  it('resolves true immediately when the form is clean and registers no global guard', async () => {
    const user = userEvent.setup();
    render(<Form />);
    expect(hasActiveLeaveGuard()).toBe(false);
    await user.click(screen.getByRole('button', { name: 'עזוב' }));
    await waitFor(() => expect(lastResult).toBe(true));
    // A closed <dialog> is not in the accessibility tree, so check the element itself.
    expect(document.querySelector('dialog')).not.toHaveAttribute('open');
    await expect(confirmNavigation()).resolves.toBe(true);
  });

  it('when dirty: opens the dialog; "הישאר" resolves false, "עזוב בלי לשמור" resolves true', async () => {
    const user = userEvent.setup();
    render(<Form initiallyDirty />);
    expect(hasActiveLeaveGuard()).toBe(true);

    await user.click(screen.getByRole('button', { name: 'עזוב' }));
    const dialog = await screen.findByRole('dialog', { name: UNSAVED_TITLE });
    expect(dialog).toHaveAttribute('open');
    expect(screen.getByTestId('prompting')).toHaveTextContent('true');
    await user.click(screen.getByRole('button', { name: UNSAVED_STAY }));
    await waitFor(() => expect(lastResult).toBe(false));
    expect(dialog).not.toHaveAttribute('open');

    await user.click(screen.getByRole('button', { name: 'עזוב' }));
    await user.click(await screen.findByRole('button', { name: UNSAVED_LEAVE }));
    await waitFor(() => expect(lastResult).toBe(true));
  });

  it('the global confirmNavigation() shares the same dialog', async () => {
    const user = userEvent.setup();
    render(<Form initiallyDirty />);
    let global: boolean | null = null;
    act(() => {
      void confirmNavigation().then((ok) => {
        global = ok;
      });
    });
    await user.click(await screen.findByRole('button', { name: UNSAVED_LEAVE }));
    await waitFor(() => expect(global).toBe(true));
  });

  it('adds a beforeunload handler only while dirty', async () => {
    const user = userEvent.setup();
    render(<Form />);
    const clean = new Event('beforeunload', { cancelable: true });
    fireEvent(window, clean);
    expect(clean.defaultPrevented).toBe(false);

    await user.click(screen.getByRole('button', { name: 'שנה' }));
    const dirtyEvent = new Event('beforeunload', { cancelable: true });
    fireEvent(window, dirtyEvent);
    expect(dirtyEvent.defaultPrevented).toBe(true);
  });

  it('unregisters the guard on unmount', () => {
    const { unmount } = render(<Form initiallyDirty />);
    expect(hasActiveLeaveGuard()).toBe(true);
    unmount();
    expect(hasActiveLeaveGuard()).toBe(false);
  });

  it('exposes the confirm helper as a stable function', () => {
    const spy = vi.fn();
    function Probe() {
      const { confirmLeave } = useUnsavedChangesGuard(true);
      spy(confirmLeave);
      return null;
    }
    const { rerender } = render(<Probe />);
    rerender(<Probe />);
    expect(spy.mock.calls[0][0]).toBe(spy.mock.calls[1][0]);
  });
});
