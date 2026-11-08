import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { Dialog } from '@/components/a11y/Dialog';
import { clearLeaveGuard, useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { __resetBackHandlerForTests, handleBack, registerBackLayer, setBackNavigator, type BackNavigator } from './back-handler';

function fakeNavigator(overrides: Partial<BackNavigator> = {}): BackNavigator & { back: ReturnType<typeof vi.fn>; goHome: ReturnType<typeof vi.fn> } {
  return {
    canGoBack: () => false,
    isHome: () => true,
    back: vi.fn(),
    goHome: vi.fn(),
    ...overrides,
  } as BackNavigator & { back: ReturnType<typeof vi.fn>; goHome: ReturnType<typeof vi.fn> };
}

function TwoDialogs({ lock = false }: { lock?: boolean }) {
  const [first, setFirst] = useState(true);
  const [second, setSecond] = useState(true);
  return (
    <>
      <Dialog open={first} onClose={() => setFirst(false)} title="First" className={lock ? 'dialog--lock' : undefined} closeOnEscape={!lock}>
        <button type="button">in first</button>
      </Dialog>
      {!lock && (
        <Dialog open={second} onClose={() => setSecond(false)} title="Second">
          <button type="button">in second</button>
        </Dialog>
      )}
    </>
  );
}

function DirtyForm() {
  const { dialog } = useUnsavedChangesGuard(true);
  return <>{dialog}</>;
}

describe('handleBack', () => {
  afterEach(() => {
    __resetBackHandlerForTests();
    clearLeaveGuard();
    window.history.replaceState(null, '', '#/');
  });

  it('reports exit on the home page with nothing behind it', () => {
    const nav = fakeNavigator();
    setBackNavigator(nav);
    expect(handleBack()).toBe('exit');
    expect(nav.back).not.toHaveBeenCalled();
    expect(nav.goHome).not.toHaveBeenCalled();
  });

  it('goes back one page when there is one', () => {
    const nav = fakeNavigator({ canGoBack: () => true, isHome: () => false });
    setBackNavigator(nav);
    expect(handleBack()).toBe('navigated');
    expect(nav.back).toHaveBeenCalledTimes(1);
    expect(nav.goHome).not.toHaveBeenCalled();
  });

  it('goes back from the home page too while there is history', () => {
    const nav = fakeNavigator({ canGoBack: () => true, isHome: () => true });
    setBackNavigator(nav);
    expect(handleBack()).toBe('navigated');
    expect(nav.back).toHaveBeenCalledTimes(1);
  });

  it('goes to the home page from a page with nothing behind it', () => {
    const nav = fakeNavigator({ canGoBack: () => false, isHome: () => false });
    setBackNavigator(nav);
    expect(handleBack()).toBe('navigated');
    expect(nav.goHome).toHaveBeenCalledTimes(1);
    expect(nav.back).not.toHaveBeenCalled();
  });

  it('closes the top-most open dialog first, one per press, and only then navigates', async () => {
    const nav = fakeNavigator({ canGoBack: () => true, isHome: () => false });
    setBackNavigator(nav);
    render(<TwoDialogs />);
    // The second dialog opened last and holds the focus.
    expect(screen.getByRole('button', { name: 'in second' })).toHaveFocus();

    let result = '';
    act(() => {
      result = handleBack();
    });
    expect(result).toBe('closed-dialog');
    await waitFor(() => expect(screen.queryByText('in second')).not.toBeInTheDocument());
    expect(screen.getByText('in first')).toBeInTheDocument();
    expect(nav.back).not.toHaveBeenCalled();

    act(() => {
      result = handleBack();
    });
    expect(result).toBe('closed-dialog');
    await waitFor(() => expect(screen.queryByText('in first')).not.toBeInTheDocument());
    expect(nav.back).not.toHaveBeenCalled();

    expect(handleBack()).toBe('navigated');
    expect(nav.back).toHaveBeenCalledTimes(1);
  });

  it('never closes the lock screen: Back leaves the app instead', () => {
    const nav = fakeNavigator({ canGoBack: () => true, isHome: () => false });
    setBackNavigator(nav);
    render(<TwoDialogs lock />);
    let result = '';
    act(() => {
      result = handleBack();
    });
    expect(result).toBe('exit');
    expect(screen.getByText('in first')).toBeInTheDocument();
    expect(nav.back).not.toHaveBeenCalled();
  });

  it('closes a registered overlay that is not a dialog, the last registered first', () => {
    const nav = fakeNavigator({ canGoBack: () => true, isHome: () => false });
    setBackNavigator(nav);
    const closeA = vi.fn();
    const closeB = vi.fn();
    const unregisterA = registerBackLayer(closeA);
    const unregisterB = registerBackLayer(closeB);

    expect(handleBack()).toBe('closed-dialog');
    expect(closeB).toHaveBeenCalledTimes(1);
    expect(closeA).not.toHaveBeenCalled();
    unregisterB();

    expect(handleBack()).toBe('closed-dialog');
    expect(closeA).toHaveBeenCalledTimes(1);
    unregisterA();

    expect(handleBack()).toBe('navigated');
    expect(nav.back).toHaveBeenCalledTimes(1);
  });

  it('honours the unsaved-changes guard: asks first, leaves only after "Leave"', async () => {
    const nav = fakeNavigator({ canGoBack: () => true, isHome: () => false });
    setBackNavigator(nav);
    render(<DirtyForm />);

    let result = '';
    act(() => {
      result = handleBack();
    });
    expect(result).toBe('navigated');
    expect(nav.back).not.toHaveBeenCalled();
    // The question is open; a second Back closes it (= stay on the page).
    const question = await screen.findByRole('dialog');
    expect(question).toHaveAttribute('open');
    act(() => {
      result = handleBack();
    });
    expect(result).toBe('closed-dialog');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(nav.back).not.toHaveBeenCalled();

    // Asked again and confirmed: now the page changes.
    act(() => {
      handleBack();
    });
    const again = await screen.findByRole('dialog');
    const leave = again.querySelector<HTMLButtonElement>('.dialog__footer .btn--danger');
    expect(leave).not.toBeNull();
    act(() => leave?.click());
    await waitFor(() => expect(nav.back).toHaveBeenCalledTimes(1));
  });

  it('without the shell it uses the location hash: home with no history is an exit', () => {
    window.history.replaceState(null, '', '#/');
    expect(handleBack()).toBe('exit');
  });

  it('without the shell it uses the browser history when the router recorded a previous page', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    window.history.replaceState({ idx: 2 }, '', '#/diary');
    expect(handleBack()).toBe('navigated');
    expect(back).toHaveBeenCalledTimes(1);
    back.mockRestore();
  });
});
