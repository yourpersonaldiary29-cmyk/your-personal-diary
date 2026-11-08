import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { holidayNote, holidaysOn, kindLabel, traditionLabel } from '@shared/calendars';
import type { DaySummary, Entry } from '@shared/types';
import * as api from '@/api';
import { setCurrentLocale } from '@/i18n/runtime';
import { pinLocaleForTests } from '@/i18n/test-utils';
import { CX, ET } from '@/pages/entries';
import { LocationDisplay, renderWithProviders } from '@/test/render';
import { CALENDAR_SYSTEM_KEY } from '@/utils/calendar-extras';
import DayPage from './DayPage';

vi.mock('@/api', async (importOriginal) => {
  const { createApiMock } = await import('@/test/api-mock');
  return createApiMock(await importOriginal());
});

// The dates, units and labels below are asserted in Hebrew.
pinLocaleForTests('he');

// Two full <EntryDetails> trees plus a table per render; under the full
// parallel suite the 5s default is too tight.
vi.setConfig({ testTimeout: 20_000 });

function entry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 1,
    date: '2026-09-07',
    time: '08:30',
    title: 'בוקר',
    body: 'טקסט הבוקר',
    mood: 7,
    emotions: ['happy'],
    energy: 6,
    stress: 3,
    sleepQuality: 8,
    sleepHours: 7.5,
    exerciseMinutes: 30,
    exerciseType: 'הליכה',
    events: [],
    people: [],
    location: '',
    notes: '',
    tags: ['עבודה'],
    createdAt: '2026-09-07T06:30:00.000Z',
    updatedAt: '2026-09-07T06:30:00.000Z',
    ...overrides,
  };
}

const summary: DaySummary = {
  date: '2026-09-07',
  entries: [entry(), entry({ id: 2, time: '20:00', title: 'ערב', mood: 5, body: 'טקסט הערב', tags: [] })],
  habitLogs: [
    {
      log: { id: 9, habitId: 3, date: '2026-09-07', value: 8, completed: true, note: '' },
      habitName: 'שתיית מים',
      unit: 'כוסות',
      target: 8,
      frequency: 'daily',
    },
    {
      log: { id: 10, habitId: 4, date: '2026-09-07', value: 10, completed: false, note: '' },
      habitName: 'הליכה',
      unit: 'דקות',
      target: 30,
      frequency: 'daily',
    },
  ],
  moodAvg: 6,
  energyAvg: 6,
  stressAvg: 3,
  sleepHours: 7.5,
};

/** Remembers the calendar system the way the calendar page does (localStorage is cleared after each test). */
function storeSystem(system: 'gregorian' | 'hebrew' | 'hijri') {
  window.localStorage.setItem(CALENDAR_SYSTEM_KEY, JSON.stringify(system));
}

function renderPage(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/day/:date" element={<DayPage />} />
      <Route path="*" element={<LocationDisplay />} />
    </Routes>,
    { auth: 'authenticated', route },
  );
}

function subtitle(): HTMLElement {
  return document.querySelector('.page-title__subtitle') as HTMLElement;
}

describe('DayPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.entries.day).mockResolvedValue(summary);
  });

  it('lists the averages, every entry in full and the habit logs of the day', async () => {
    renderPage('/day/2026-09-07');

    expect(screen.getByRole('heading', { level: 1, name: 'יום שני, 7 בספטמבר 2026' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 2, name: ET.dayEntriesCount(2) })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'רשומות היום (2)' })).toBeInTheDocument();
    expect(api.entries.day).toHaveBeenCalledWith('2026-09-07');

    // Averages as text tiles.
    const tiles = within(screen.getByRole('list', { name: ET.dayAverages }));
    expect(tiles.getByText(ET.moodAvg).nextElementSibling).toHaveTextContent('6.0');
    expect(tiles.getByText(ET.stressAvg).nextElementSibling).toHaveTextContent('3.0');
    expect(tiles.getByText(ET.sleepHoursTile).nextElementSibling).toHaveTextContent('7.5 שעות');
    expect(tiles.getByText(ET.entriesTile).nextElementSibling).toHaveTextContent('2');

    // Entries with the shared details component.
    expect(screen.getByRole('heading', { level: 3, name: '08:30 · בוקר' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: '20:00 · ערב' })).toBeInTheDocument();
    expect(screen.getByText('טקסט הבוקר')).toBeInTheDocument();
    expect(screen.getByText('טקסט הערב')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: ET.openNamed('בוקר') })).toHaveAttribute('href', '/entry/1');
    expect(screen.getByRole('link', { name: ET.editNamed('ערב') })).toHaveAttribute('href', '/entry/2/edit');
    expect(screen.getByRole('link', { name: 'ערוך: ערב' })).toHaveTextContent(/^ערוך$/);

    // Habit logs table.
    const water = screen.getByRole('row', { name: /שתיית מים/ });
    expect(within(water).getByRole('rowheader')).toHaveTextContent('שתיית מים');
    expect(within(water).getAllByRole('cell').map((c) => c.textContent)).toEqual(['8 כוסות', '8 כוסות', ET.completed]);
    const walk = screen.getByRole('row', { name: /הליכה/ });
    expect(within(walk).getAllByRole('cell').map((c) => c.textContent)).toEqual(['10 דקות', '30 דקות', ET.notCompleted]);

    // Navigation.
    expect(screen.getByRole('link', { name: ET.newEntryForDay })).toHaveAttribute('href', '/new?date=2026-09-07');
    expect(screen.getByRole('link', { name: ET.previousDay })).toHaveAttribute('href', '/day/2026-09-06');
    expect(screen.getByRole('link', { name: ET.nextDay })).toHaveAttribute('href', '/day/2026-09-08');
  });

  it('shows empty states when the day has no entries and no habit logs', async () => {
    vi.mocked(api.entries.day).mockResolvedValue({ ...summary, entries: [], habitLogs: [], moodAvg: null, energyAvg: null, stressAvg: null, sleepHours: null });
    renderPage('/day/2026-09-07');
    expect(await screen.findByRole('heading', { level: 3, name: ET.noDayEntries })).toBeInTheDocument();
    expect(screen.getByText(ET.noHabitLogs)).toBeInTheDocument();
    const tiles = within(screen.getByRole('list', { name: ET.dayAverages }));
    expect(tiles.getByText(ET.moodAvg).nextElementSibling).toHaveTextContent('לא דווח');
  });

  it('rejects a malformed date without calling the API', () => {
    renderPage('/day/not-a-date');
    expect(screen.getByRole('heading', { level: 1, name: ET.invalidDateTitle })).toBeInTheDocument();
    expect(api.entries.day).not.toHaveBeenCalled();
    expect(screen.queryByRole('region', { name: CX.holidaysHeading })).not.toBeInTheDocument();
  });

  it('renders the page in English when the UI language is English', async () => {
    setCurrentLocale('en');
    storeSystem('hebrew');
    renderPage('/day/2026-09-07');
    expect(screen.getByRole('heading', { level: 1, name: 'Monday, 7 September 2026' })).toBeInTheDocument();
    expect(subtitle()).toHaveTextContent('Hebrew date: 25 Elul 5786');
    expect(await screen.findByRole('heading', { level: 2, name: 'Entries of the day (2)' })).toBeInTheDocument();
    const tiles = within(screen.getByRole('list', { name: 'Day averages' }));
    expect(tiles.getByText('Sleep hours').nextElementSibling).toHaveTextContent('7.5 hours');
    const water = screen.getByRole('row', { name: /שתיית מים/ });
    expect(within(water).getAllByRole('cell').map((c) => c.textContent)).toEqual(['8 כוסות', '8 כוסות', 'Completed']);
    expect(screen.getByRole('link', { name: 'Open: בוקר' })).toHaveAttribute('href', '/entry/1');
    expect(screen.getByRole('link', { name: 'Previous day' })).toHaveAttribute('href', '/day/2026-09-06');
  });

  it('writes the entry times with the 12-hour clock in Arabic, like the entry page does', async () => {
    setCurrentLocale('ar');
    renderPage('/day/2026-09-07');
    const evening = await screen.findByRole('heading', { level: 3, name: /ערב/ });
    expect(evening).toHaveTextContent(/^08:00\sم · ערב$/);
    expect(evening.querySelector('time')).toHaveAttribute('datetime', '2026-09-07T20:00');
    expect(screen.getByRole('heading', { level: 3, name: /בוקר/ })).toHaveTextContent(/^08:30\sص · בוקר$/);
  });

  describe('calendar system (remembered by the calendar page)', () => {
    it('Gregorian (the default): the civil date only, and no Jewish holiday on Rosh Hashana', async () => {
      renderPage('/day/2026-09-12');
      expect(screen.getByRole('heading', { level: 1, name: 'יום שבת, 12 בספטמבר 2026' })).toBeInTheDocument();
      expect(subtitle()).toHaveTextContent(/^[^·]*$/);
      expect(subtitle()).not.toHaveTextContent('תשפ״ז');
      expect(subtitle()).not.toHaveTextContent('1448');
      expect(screen.queryByRole('region', { name: CX.holidaysHeading })).not.toBeInTheDocument();
      await screen.findByRole('heading', { level: 2, name: ET.dayEntriesCount(2) });
    });

    it('Gregorian: lists the Christian holiday of the day only (18 February 2026 is also Rosh Chodesh Adar and the start of Ramadan)', async () => {
      renderPage('/day/2026-02-18');
      const section = screen.getByRole('region', { name: CX.holidaysHeading });
      expect(within(section).getByRole('heading', { level: 2, name: CX.holidaysHeading })).toBeInTheDocument();
      const items = within(section).getAllByRole('listitem');
      expect(items).toHaveLength(1);
      expect(items[0]).toHaveTextContent('יום רביעי של האפר');
      expect(items[0]).toHaveTextContent(`${traditionLabel('christian', 'he')} · ${kindLabel('major', 'he')}`);
      expect(items[0].querySelector('.holiday-badge')).toHaveAttribute('data-tradition', 'christian');
      expect(within(section).queryByText('תחילת רמדאן')).toBeNull();
      await screen.findByRole('heading', { level: 2, name: ET.dayEntriesCount(2) });
    });

    it('Hebrew: shows the Hebrew date under the heading and the Jewish holidays of the day', async () => {
      storeSystem('hebrew');
      renderPage('/day/2026-09-12');
      expect(screen.getByRole('heading', { level: 1, name: 'יום שבת, 12 בספטמבר 2026' })).toBeInTheDocument();
      expect(subtitle()).toHaveTextContent(CX.hebrewDateValue('א׳ בתשרי תשפ״ז'));
      expect(subtitle()).toHaveTextContent('תאריך עברי: א׳ בתשרי תשפ״ז');
      expect(subtitle()).not.toHaveTextContent('1448');

      const section = screen.getByRole('region', { name: CX.holidaysHeading });
      const items = within(section).getAllByRole('listitem');
      expect(items).toHaveLength(1);
      expect(items[0]).toHaveTextContent('ראש השנה');
      expect(items[0]).toHaveTextContent(`${traditionLabel('jewish', 'he')} · ${kindLabel('major', 'he')} · ${CX.dayOf(1, 2)}`);
      expect(items[0].querySelector('.holiday-badge')).toHaveAttribute('data-tradition', 'jewish');

      // The rest of the page is unaffected.
      expect(await screen.findByRole('heading', { level: 2, name: ET.dayEntriesCount(2) })).toBeInTheDocument();
    });

    it('Hebrew: a day without Jewish holidays has no holiday list', async () => {
      storeSystem('hebrew');
      renderPage('/day/2026-09-07');
      expect(subtitle()).toHaveTextContent(CX.hebrewDateValue('כ״ה באלול תשפ״ו'));
      expect(screen.queryByRole('region', { name: CX.holidaysHeading })).not.toBeInTheDocument();
      await screen.findByRole('heading', { level: 2, name: ET.dayEntriesCount(2) });
    });

    it('Hijri: shows the Hijri date and the Muslim and Druze holidays with their notes', async () => {
      storeSystem('hijri');
      const first = renderPage('/day/2026-02-18');
      expect(subtitle()).toHaveTextContent(CX.hijriDateValue('1 ברמדאן 1447'));
      expect(subtitle()).toHaveTextContent('תאריך הג׳רי (מוסלמי): 1 ברמדאן 1447');
      expect(subtitle()).not.toHaveTextContent('אדר');
      const section = screen.getByRole('region', { name: CX.holidaysHeading });
      const items = within(section).getAllByRole('listitem');
      expect(items).toHaveLength(1);
      expect(items[0]).toHaveTextContent('תחילת רמדאן');
      expect(items[0]).toHaveTextContent(traditionLabel('muslim', 'he'));
      expect(items[0]).toHaveTextContent(holidayNote(holidaysOn('2026-02-18', ['muslim'])[0], 'he')!);
      await screen.findByRole('heading', { level: 2, name: ET.dayEntriesCount(2) });
      first.unmount();

      // Eid al-Adha is both Muslim and Druze.
      renderPage('/day/2026-05-27');
      const eid = within(screen.getByRole('region', { name: CX.holidaysHeading })).getAllByRole('listitem');
      expect(eid.map((li) => li.querySelector('.holiday-badge')?.getAttribute('data-tradition'))).toEqual(['muslim', 'druze']);
      await screen.findByRole('heading', { level: 2, name: ET.dayEntriesCount(2) });
    });
  });
});
