/**
 * The calendar page at the new lower bounds of its year select (CALENDAR-YEARS.md): 1980 (Gregorian),
 * 5731 = תשל״א (Hebrew) and the current Hijri year - 40 (Hijri). Each is offered by the year select,
 * choosing it asks the api for that month and the answer is drawn in the grid; the year before it is
 * not offered. The api is mocked here; the server / mobile core answer for those months is covered by
 * server/test/calendar-years.test.ts and mobile/test/calendar-years.test.ts, the offline cache by
 * src/utils/calendar-years.offline.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { monthViewContaining, monthViewFor } from '@shared/calendars/month-view';
import type { CalendarDay, CalendarMonth } from '@shared/types';
import * as api from '@/api';
import { setCurrentLocale } from '@/i18n/runtime';
import { pinLocaleForTests } from '@/i18n/test-utils';
import { ET } from '@/pages/entries';
import { LocationDisplay, renderWithProviders } from '@/test/render';
import { daysInMonth, todayIso } from '@/utils/dates';
import CalendarPage from './CalendarPage';

vi.mock('@/api', async (importOriginal) => {
  const { createApiMock } = await import('@/test/api-mock');
  return createApiMock(await importOriginal());
});

vi.setConfig({ testTimeout: 20_000 });

pinLocaleForTests('he');

const pad = (n: number) => String(n).padStart(2, '0');

/** Fictional days with data, one inside each lower-bound month. */
const DATA: Record<string, Partial<CalendarDay>> = {
  '1980-01-15': { mood: 6, hasEntry: true, entryCount: 1, titles: ['ינואר 1980'] },
  '1980-09-07': { mood: 5, hasEntry: true, entryCount: 1, titles: ['ספטמבר 1980'] },
  '1970-10-01': { mood: 7, hasEntry: true, entryCount: 1, titles: ['ראש השנה תשל״א'] },
};

function day(date: string): CalendarDay {
  return { date, mood: null, energy: null, stress: null, sleepHours: null, hasEntry: false, entryCount: 0, habitsCompleted: 0, habitsTotal: 0, titles: [], ...DATA[date] };
}

function monthData(year: number, month: number): CalendarMonth {
  return { year, month, days: Array.from({ length: daysInMonth(year, month) }, (_, i) => day(`${year}-${pad(month)}-${pad(i + 1)}`)) };
}

let hijriDataDay = '';

function rangeData(from: string, to: string): CalendarDay[] {
  const dates = [...Object.keys(DATA), hijriDataDay].filter((d) => d && d >= from && d <= to).sort();
  return dates.map((d) => (d === hijriDataDay ? { ...day(d), mood: 4, hasEntry: true, entryCount: 1 } : day(d)));
}

/** The query string of the page's URL (the month it shows). */
function SearchDisplay() {
  return <p data-testid="search">{useLocation().search}</p>;
}

function renderPage(route: string) {
  return renderWithProviders(
    <Routes>
      <Route
        path="/calendar"
        element={
          <>
            <CalendarPage />
            <SearchDisplay />
          </>
        }
      />
      <Route path="*" element={<LocationDisplay />} />
    </Routes>,
    { auth: 'authenticated', route },
  );
}

const search = () => screen.getByTestId('search').textContent;

function yearSelect(): HTMLSelectElement {
  return screen.getByRole('combobox', { name: ET.yearSelect }) as HTMLSelectElement;
}

function yearValues(): string[] {
  return within(yearSelect())
    .getAllByRole('option')
    .map((o) => (o as HTMLOptionElement).value);
}

describe('CalendarPage: the earliest years of each calendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.calendar.month).mockImplementation(async (year: number, month: number) => monthData(year, month));
    vi.mocked(api.calendar.range).mockImplementation(async (from: string, to: string) => rangeData(from, to));
  });

  it('Gregorian: 1980 is offered (1979 is not); choosing it loads September 1980 from the api and draws its data', async () => {
    const { user } = renderPage('/calendar?year=2026&month=9');
    await screen.findByText('ספטמבר 2026', { selector: 'caption' });
    expect(yearValues()[0]).toBe('1980');
    expect(yearValues()).not.toContain('1979');

    await user.selectOptions(yearSelect(), '1980');
    await screen.findByText('ספטמבר 1980', { selector: 'caption' });
    expect(api.calendar.month).toHaveBeenLastCalledWith(1980, 9);
    expect(screen.getByRole('button', { name: 'יום ראשון 7 בספטמבר: מצב רוח 5, יש רשומה' })).toHaveTextContent('● רשומה');
    expect(yearSelect()).toHaveValue('1980');
  });

  it('Gregorian: a link to January 1980 opens that month', async () => {
    renderPage('/calendar?year=1980&month=1');
    await screen.findByText('ינואר 1980', { selector: 'caption' });
    expect(api.calendar.month).toHaveBeenCalledWith(1980, 1);
    expect(screen.getByRole('button', { name: 'יום שלישי 15 בינואר: מצב רוח 6, יש רשומה' })).toBeInTheDocument();
  });

  it('Hebrew: תשל״א (5731) is offered (5730 is not); choosing it loads Tishrei 5731 from the api', async () => {
    const { user } = renderPage('/calendar?system=hebrew&year=5787&month=1');
    await screen.findByText('תשרי תשפ״ז', { selector: 'caption' });
    expect(within(yearSelect()).getAllByRole('option')[0]).toHaveTextContent('תשל״א (5731)');
    expect(yearValues()[0]).toBe('5731');
    expect(yearValues()).not.toContain('5730');

    await user.selectOptions(yearSelect(), '5731');
    const caption = await screen.findByText('תשרי תשל״א', { selector: 'caption' });
    expect(api.calendar.range).toHaveBeenLastCalledWith('1970-10-01', '1970-10-30');
    const first = within(caption.closest('table') as HTMLElement).getAllByRole('button')[0];
    expect(first).toHaveAttribute('data-date', '1970-10-01');
    expect(first).toHaveAccessibleName(/^יום חמישי א׳ בתשרי תשל״א: .*מצב רוח 7, יש רשומה$/);
  });

  it('Hebrew: a link to 5730 is refused (clamped to 5731)', async () => {
    renderPage('/calendar?system=hebrew&year=5730&month=1');
    await screen.findByText('תשרי תשל״א', { selector: 'caption' });
    expect(api.calendar.range).toHaveBeenCalledWith('1970-10-01', '1970-10-30');
  });

  it('Hijri: the current Hijri year - 40 is offered (the year before is not); choosing it loads its month from the api', async () => {
    const current = monthViewContaining('hijri', todayIso(), 'he').year;
    const first = current - 40;
    const target = monthViewFor('hijri', first, 1, 'he');
    hijriDataDay = target.days[9].iso;
    const { user } = renderPage(`/calendar?system=hijri&year=${current}&month=1`);
    await screen.findByText(monthViewFor('hijri', current, 1, 'he').title, { selector: 'caption' });
    expect(yearValues()[0]).toBe(String(first));
    expect(yearValues()).not.toContain(String(first - 1));

    await user.selectOptions(yearSelect(), String(first));
    const caption = await screen.findByText(target.title, { selector: 'caption' });
    expect(api.calendar.range).toHaveBeenLastCalledWith(target.firstDay, target.lastDay);
    const tenth = within(caption.closest('table') as HTMLElement).getAllByRole('button')[9];
    expect(tenth).toHaveAttribute('data-date', hijriDataDay);
    expect(tenth).toHaveAccessibleName(/מצב רוח 4, יש רשומה$/);
  });

  it('in English the Hebrew year 5731 reads as digits and its month as Tishri 5731', async () => {
    setCurrentLocale('en');
    const { user } = renderPage('/calendar?system=hebrew&year=5787&month=1');
    await screen.findByText('Tishri 5787', { selector: 'caption' });
    expect(within(yearSelect()).getAllByRole('option')[0]).toHaveTextContent(/^5731$/);
    await user.selectOptions(yearSelect(), '5731');
    await screen.findByText('Tishri 5731', { selector: 'caption' });
    expect(api.calendar.range).toHaveBeenLastCalledWith('1970-10-01', '1970-10-30');
  });
});

/**
 * The month buttons and the keyboard at the first / last year of a calendar: the month beyond it is refused
 * and the page stays where it is. Before, a Hebrew / Hijri month just outside the years the URL accepts was
 * written to the URL, the URL clamped its year and the page jumped to another month chosen by today's date
 * (from Tishrei 5731 "previous" opened Cheshvan 5731, and the two buttons looped).
 */
describe('CalendarPage: the month buttons and keys at the first and last year', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.calendar.month).mockImplementation(async (year: number, month: number) => monthData(year, month));
    vi.mocked(api.calendar.range).mockImplementation(async (from: string, to: string) => rangeData(from, to));
  });

  const rangeStarts = () => vi.mocked(api.calendar.range).mock.calls.map(([from]) => from);

  it('Hebrew: at Tishrei תשל״א "previous month" is refused; "next month" and back still move one month', async () => {
    const { user } = renderPage('/calendar?system=hebrew&year=5731&month=1');
    await screen.findByText('תשרי תשל״א', { selector: 'caption' });
    expect(search()).toBe('?system=hebrew&year=5731&month=1');

    await user.click(screen.getByRole('button', { name: ET.previousMonth }));
    await user.click(screen.getByRole('button', { name: ET.previousMonth }));
    expect(search()).toBe('?system=hebrew&year=5731&month=1');
    expect(screen.getByText('תשרי תשל״א', { selector: 'caption' })).toBeInTheDocument();
    expect(new Set(rangeStarts())).toEqual(new Set(['1970-10-01']));

    await user.click(screen.getByRole('button', { name: ET.nextMonth }));
    await screen.findByText('חשוון תשל״א', { selector: 'caption' });
    expect(search()).toBe('?system=hebrew&year=5731&month=2');
    await user.click(screen.getByRole('button', { name: ET.previousMonth }));
    await screen.findByText('תשרי תשל״א', { selector: 'caption' });
    expect(search()).toBe('?system=hebrew&year=5731&month=1');
  });

  it('Hebrew: PageUp, ArrowUp and the previous day (ArrowRight, RTL) on 1 Tishrei תשל״א keep the month and the focus', async () => {
    const { user } = renderPage('/calendar?system=hebrew&year=5731&month=1');
    const caption = await screen.findByText('תשרי תשל״א', { selector: 'caption' });
    const first = within(caption.closest('table') as HTMLElement).getAllByRole('button')[0];
    expect(first).toHaveAttribute('data-date', '1970-10-01');
    act(() => first.focus());

    for (const key of ['{PageUp}', '{ArrowUp}', '{ArrowRight}']) {
      await user.keyboard(key);
      expect(first, key).toHaveFocus();
      expect(search(), key).toBe('?system=hebrew&year=5731&month=1');
    }
    expect(screen.getByText('תשרי תשל״א', { selector: 'caption' })).toBeInTheDocument();
    expect(new Set(rangeStarts())).toEqual(new Set(['1970-10-01']));

    // Inside the month the keys still work: the next day (ArrowLeft, RTL).
    await user.keyboard('{ArrowLeft}');
    expect(within(caption.closest('table') as HTMLElement).getAllByRole('button')[1]).toHaveFocus();
  });

  it('Hijri: at Muharram 1390 (the earliest Hijri month the page shows) "previous month" is refused', async () => {
    const muharram = monthViewFor('hijri', 1390, 1, 'he');
    const { user } = renderPage('/calendar?system=hijri&year=1390&month=1');
    await screen.findByText(muharram.title, { selector: 'caption' });

    await user.click(screen.getByRole('button', { name: ET.previousMonth }));
    expect(search()).toBe('?system=hijri&year=1390&month=1');
    expect(screen.getByText(muharram.title, { selector: 'caption' })).toBeInTheDocument();
    expect(new Set(rangeStarts())).toEqual(new Set([muharram.firstDay]));

    await user.click(screen.getByRole('button', { name: ET.nextMonth }));
    await screen.findByText(monthViewFor('hijri', 1390, 2, 'he').title, { selector: 'caption' });
    expect(search()).toBe('?system=hijri&year=1390&month=2');
  });

  it('the last years: "next month" is refused at Elul 5960 and at Dhu al-Hijjah 1626', async () => {
    for (const [system, year] of [
      ['hebrew', 5960],
      ['hijri', 1626],
    ] as const) {
      const last = monthViewFor(system, year, 12, 'he');
      const route = `?system=${system}&year=${year}&month=12`;
      const { user, unmount } = renderPage(`/calendar${route}`);
      await screen.findByText(last.title, { selector: 'caption' });
      await user.click(screen.getByRole('button', { name: ET.nextMonth }));
      expect(search(), system).toBe(route);
      expect(screen.getByText(last.title, { selector: 'caption' })).toBeInTheDocument();
      await waitFor(() => expect(new Set(rangeStarts()), system).toEqual(new Set([last.firstDay])));
      unmount();
      vi.mocked(api.calendar.range).mockClear();
    }
  });
});
