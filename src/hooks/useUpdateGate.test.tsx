/**
 * What holds the "Update needed" screen back besides the leave guard (src/hooks/useUpdateGate.ts): the holds of
 * the pages (the entry editor during a save) and text typed on the current page. The whole flow in the running
 * app is in src/pages/UpdateRequired.app.test.tsx; that the first character typed on a page stays, page by
 * page in the whole app, in src/pages/TypingFirstCharacter.app.test.tsx.
 *
 * The typing tests run with the browser's order of an event's listeners (src/test/browser-event-order.ts): in a
 * browser whatever the gate's capture-phase listener makes React schedule is rendered BEFORE React's own
 * handler sees the event - a notification there cost the first character of every page in release 1.1.0
 * before it was released.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Profiler, useState, useSyncExternalStore } from 'react';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { installBrowserEventOrder, withBrowserEventOrder } from '@/test/browser-event-order';
import { __resetUpdateGateForTests, isTypedTextTarget, isUpdateScreenHeld, subscribeUpdateScreenHeld, useUpdateGate, useUpdateScreenHold } from './useUpdateGate';

afterEach(() => __resetUpdateGateForTests());

function input(type: string): HTMLInputElement {
  const el = document.createElement('input');
  el.type = type;
  return el;
}

describe('isTypedTextTarget', () => {
  it('text fields, text areas and editable regions hold typed text', () => {
    for (const type of ['text', 'search', 'email', 'number', 'url', 'tel', 'date', 'time']) expect(isTypedTextTarget(input(type))).toBe(true);
    expect(isTypedTextTarget(document.createElement('textarea'))).toBe(true);
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    document.body.appendChild(editable);
    // jsdom does not compute isContentEditable; a browser reports true here.
    expect(isTypedTextTarget(editable)).toBe(editable.isContentEditable === true);
    editable.remove();
  });

  it('a password, a checkbox, a choice list or a slider is not text that could be lost', () => {
    for (const type of ['password', 'checkbox', 'radio', 'range', 'file', 'color']) expect(isTypedTextTarget(input(type))).toBe(false);
    expect(isTypedTextTarget(document.createElement('select'))).toBe(false);
    expect(isTypedTextTarget(null)).toBe(false);
  });
});

describe('useUpdateScreenHold', () => {
  it('holds while active and releases when inactive or unmounted', () => {
    expect(isUpdateScreenHeld()).toBe(false);
    const { rerender, unmount } = renderHook(({ active }) => useUpdateScreenHold(active), { initialProps: { active: true } });
    expect(isUpdateScreenHeld()).toBe(true);
    rerender({ active: false });
    expect(isUpdateScreenHeld()).toBe(false);
    rerender({ active: true });
    expect(isUpdateScreenHeld()).toBe(true);
    unmount();
    expect(isUpdateScreenHeld()).toBe(false);
  });
});

/** A page with one controlled text field under a component that uses the gate (as App does), and a way to another page. */
function GatedPage() {
  useUpdateGate({ platform: 'windows', appVersion: '1.1.0' });
  const [note, setNote] = useState('');
  const navigate = useNavigate();
  return (
    <>
      <label>
        test: note
        <input value={note} onChange={(e) => setNote(e.currentTarget.value)} />
      </label>
      <button type="button" onClick={() => navigate('/other')}>
        test: another page
      </button>
    </>
  );
}

function renderGatedPage() {
  return render(
    <MemoryRouter initialEntries={['/first']}>
      <Routes>
        <Route path="*" element={<GatedPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("typing on a page with the gate, in the browser's order of events", () => {
  withBrowserEventOrder();

  it('a controlled field keeps its first character (and every other one)', async () => {
    const user = userEvent.setup();
    renderGatedPage();
    const field = screen.getByRole('textbox', { name: 'test: note' });
    await user.type(field, 'Hello');
    expect(field).toHaveValue('Hello');
  });

  it('a first input that arrives as one event (a paste, a word the phone keyboard inserts at once) stays whole', async () => {
    const user = userEvent.setup();
    renderGatedPage();
    const field = screen.getByRole('textbox', { name: 'test: note' });
    await user.click(field);
    await user.paste('A whole word');
    expect(field).toHaveValue('A whole word');
  });

  it('the first text input holds the screen at once and tells no subscriber; leaving the page releases it and tells them', async () => {
    renderGatedPage();
    const field = screen.getByRole('textbox', { name: 'test: note' });
    const listener = vi.fn();
    const unsubscribe = subscribeUpdateScreenHeld(listener);
    try {
      expect(isUpdateScreenHeld()).toBe(false);
      fireEvent.input(field, { target: { value: 'H' } });
      // Synchronously after the event, without a timer: held - and nobody was made to render meanwhile.
      expect(isUpdateScreenHeld()).toBe(true);
      // Not later either: a notification deferred with queueMicrotask or Promise.then is the same fault in a
      // browser (it runs in the same checkpoint, before React's handler), but the helper above cannot see it -
      // it flushes only what React has already scheduled. So wait a whole task before looking.
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(listener).not.toHaveBeenCalled();
      expect(field).toHaveValue('H');
      fireEvent.input(field, { target: { value: 'He' } });
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(listener).not.toHaveBeenCalled();
      // Leaving the page releases the hold, and the subscribers hear it (the screen may appear now).
      fireEvent.click(screen.getByRole('button', { name: 'test: another page' }));
      expect(isUpdateScreenHeld()).toBe(false);
      expect(listener).toHaveBeenCalled();
    } finally {
      unsubscribe();
    }
  });

  it('one typed character is one render of the page: nothing in the listener makes React render, at once or put off', async () => {
    // The rule itself: a setState inside the gate's listener - also one put off with queueMicrotask or
    // Promise.then, which the helper above cannot see and which loses the character in a browser just the same -
    // shows here as a second render of the page for one typed character. (A put-off notification of the store
    // does not: by then the page has rendered with the store's new value, so React has nothing to render. The
    // test above sees that one - no subscriber is called.)
    const rendered = vi.fn();
    render(
      <MemoryRouter initialEntries={['/first']}>
        <Profiler id="test: page" onRender={rendered}>
          <Routes>
            <Route path="*" element={<GatedPage />} />
          </Routes>
        </Profiler>
      </MemoryRouter>,
    );
    const field = screen.getByRole('textbox', { name: 'test: note' });
    // Whatever is still scheduled is rendered when this returns (a put-off render started meanwhile included).
    const settle = () =>
      act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
    await settle();
    rendered.mockClear();
    fireEvent.input(field, { target: { value: 'H' } });
    await settle();
    expect(field).toHaveValue('H');
    // The field's own onChange, and nothing else.
    expect(rendered).toHaveBeenCalledTimes(1);
  });

  it('typing counts even when a handler stops the event (the listener is in the capture phase on the document)', async () => {
    // React's stopPropagation() stops the native event at the root container, below the document: a listener
    // of the bubble phase would never hear it, and the screen could replace the text being typed.
    function StoppingPage() {
      useUpdateGate({ platform: 'windows', appVersion: '1.1.0' });
      const [note, setNote] = useState('');
      return (
        <label>
          test: stopped note
          <input value={note} onInput={(e) => e.stopPropagation()} onChange={(e) => setNote(e.currentTarget.value)} />
        </label>
      );
    }
    const bubbled = vi.fn();
    document.addEventListener('input', bubbled);
    try {
      const user = userEvent.setup();
      render(
        <MemoryRouter initialEntries={['/first']}>
          <StoppingPage />
        </MemoryRouter>,
      );
      const field = screen.getByRole('textbox', { name: 'test: stopped note' });
      await user.type(field, 'Hello');
      expect(field).toHaveValue('Hello');
      // The event really was stopped before it bubbled to the document...
      expect(bubbled).not.toHaveBeenCalled();
      // ...and the gate heard it all the same: the screen waits.
      expect(isUpdateScreenHeld()).toBe(true);
    } finally {
      document.removeEventListener('input', bubbled);
    }
  });
});

describe('the browser-order helper itself (src/test/browser-event-order.ts)', () => {
  it("flushes what a document listener scheduled before React's own handler sees the event", async () => {
    // A store that a capture-phase listener on the document changes and notifies - the fault of 1.1.0 in small.
    let typed = false;
    const subscribers = new Set<() => void>();
    const onInput = () => {
      if (typed) return;
      typed = true;
      for (const s of [...subscribers]) s();
    };
    function Field() {
      const [value, setValue] = useState('');
      // Reads the store as useUpdateGate does.
      const seen = useSyncStoreValue(subscribers, () => typed);
      return (
        <label>
          test: field {String(seen)}
          <input value={value} onChange={(e) => setValue(e.currentTarget.value)} />
        </label>
      );
    }
    document.addEventListener('input', onInput, true);
    const uninstall = installBrowserEventOrder();
    try {
      const user = userEvent.setup();
      render(<Field />);
      const field = screen.getByRole('textbox');
      await user.type(field, 'Hello');
      // As in a real browser: the re-render ran between the listeners and the first key was lost.
      expect(field).toHaveValue('ello');
    } finally {
      uninstall();
      document.removeEventListener('input', onInput, true);
    }
  });
});

function useSyncStoreValue(subscribers: Set<() => void>, get: () => boolean): boolean {
  return useSyncExternalStore(
    (listener) => {
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    },
    get,
    get,
  );
}
