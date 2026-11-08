import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { ANNOUNCEMENT_TTL_MS, AnnouncerProvider, joinAnnouncements, useAnnouncer, type AnnouncerContextValue } from './AnnouncerContext';

function Probe({ onReady }: { onReady: (api: AnnouncerContextValue) => void }) {
  const api = useAnnouncer();
  useEffect(() => {
    onReady(api);
  }, [api, onReady]);
  return null;
}

function setup(): AnnouncerContextValue {
  const holder: { api?: AnnouncerContextValue } = {};
  render(
    <AnnouncerProvider>
      <Probe
        onReady={(a) => {
          holder.api = a;
        }}
      />
    </AnnouncerProvider>,
  );
  if (!holder.api) throw new Error('announcer not ready');
  return holder.api;
}

const polite = () => screen.getByTestId('live-region-polite');
const assertive = () => screen.getByTestId('live-region-assertive');

describe('AnnouncerProvider', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('joins messages that arrive before the first one was spoken instead of dropping it', () => {
    vi.useFakeTimers();
    const { announce } = setup();
    act(() => {
      announce('The entry was saved');
      announce('Entry');
    });
    act(() => vi.advanceTimersByTime(60));
    expect(polite()).toHaveTextContent('The entry was saved. Entry');
  });

  it('a later message replaces a spoken one; the same text twice is not doubled', () => {
    vi.useFakeTimers();
    const { announce } = setup();
    act(() => announce('First.'));
    act(() => vi.advanceTimersByTime(60));
    act(() => {
      announce('Second');
      announce('Second');
    });
    act(() => vi.advanceTimersByTime(60));
    expect(polite().textContent).toBe('Second');
  });

  it('empties a region some time after it spoke, so the message does not linger on other pages', () => {
    vi.useFakeTimers();
    const { announce } = setup();
    act(() => announce('There are 2 errors in the form.', 'assertive'));
    act(() => vi.advanceTimersByTime(60));
    expect(assertive()).toHaveTextContent('There are 2 errors in the form.');
    act(() => vi.advanceTimersByTime(ANNOUNCEMENT_TTL_MS));
    expect(assertive()).toBeEmptyDOMElement();
  });

  it('clear() empties both regions and drops a message still waiting for its tick', () => {
    vi.useFakeTimers();
    const { announce, clear } = setup();
    act(() => announce('There are 2 errors in the form.', 'assertive'));
    act(() => vi.advanceTimersByTime(60));
    act(() => announce('Saved'));
    act(() => clear());
    act(() => vi.advanceTimersByTime(60));
    expect(assertive()).toBeEmptyDOMElement();
    expect(polite()).toBeEmptyDOMElement();
    act(() => announce('Next'));
    act(() => vi.advanceTimersByTime(60));
    expect(polite()).toHaveTextContent('Next');
  });

  it('joinAnnouncements adds a full stop only when the first message has no closing punctuation', () => {
    expect(joinAnnouncements('Saved', 'Entry')).toBe('Saved. Entry');
    expect(joinAnnouncements('Saved.', 'Entry')).toBe('Saved. Entry');
    expect(joinAnnouncements('נשמר؟', 'רשומה')).toBe('נשמר؟ רשומה');
    expect(joinAnnouncements('Same', 'Same')).toBe('Same');
  });
});
