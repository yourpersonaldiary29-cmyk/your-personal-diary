/**
 * What holds the "Update needed" screen back besides the leave guard (src/hooks/useUpdateGate.ts): the holds of
 * the pages (the entry editor during a save) and text typed on the current page. The whole flow in the running
 * app is in src/pages/UpdateRequired.app.test.tsx.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { __resetUpdateGateForTests, isTypedTextTarget, isUpdateScreenHeld, useUpdateScreenHold } from './useUpdateGate';

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
