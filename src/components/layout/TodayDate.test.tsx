import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import { DEFAULT_CALENDAR_EXTRAS } from '@shared/calendars';
import { renderWithProviders } from '@/test/render';
import { TodayDate } from './TodayDate';

describe('TodayDate', () => {
  beforeEach(() => {
    // Two seconds before civil midnight, 12 -> 13 September 2026.
    vi.useFakeTimers({ now: new Date(2026, 8, 12, 23, 59, 58) });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the Gregorian date in the UI language and moves to the next day at midnight', () => {
    renderWithProviders(<TodayDate />, { auth: 'anonymous' });
    const time = screen.getByText('יום שבת, 12 בספטמבר 2026');
    expect(time.tagName).toBe('TIME');
    expect(time).toHaveAttribute('datetime', '2026-09-12');
    expect(time.parentElement).toHaveTextContent(/2026$/);

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    const next = screen.getByText('יום ראשון, 13 בספטמבר 2026');
    expect(next).toHaveAttribute('datetime', '2026-09-13');
    expect(next.parentElement).toHaveTextContent(/2026$/);
  });

  it('shows only the Gregorian date even when the Hebrew-calendar extra is on', () => {
    renderWithProviders(<TodayDate />, { auth: 'anonymous', settings: { calendarExtras: { ...DEFAULT_CALENDAR_EXTRAS, hebrewDates: true } } });
    const time = screen.getByText('יום שבת, 12 בספטמבר 2026');
    expect(time.parentElement).toHaveTextContent(/2026$/);
    expect(time.parentElement).not.toHaveTextContent('תשפ״ז');
    expect(document.querySelector('.header__date-extra')).toBeNull();
  });

  it('formats the date in the UI language (English)', () => {
    renderWithProviders(<TodayDate />, { auth: 'anonymous', locale: 'en' });
    const time = screen.getByText('Saturday, 12 September 2026');
    expect(time).toHaveAttribute('datetime', '2026-09-12');
  });
});
