import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import type { Entry } from '@shared/types';
import * as api from '@/api';
import { ApiClientError } from '@/api';
import { setCurrentLocale } from '@/i18n/runtime';
import { pinLocaleForTests } from '@/i18n/test-utils';
import { ET } from '@/pages/entries';
import { LocationDisplay, currentPath, politeRegion, renderWithProviders } from '@/test/render';
import { CALENDAR_SYSTEM_KEY } from '@/utils/calendar-extras';
import EntryPage from './EntryPage';

vi.mock('@/api', async (importOriginal) => {
  const { createApiMock } = await import('@/test/api-mock');
  return createApiMock(await importOriginal());
});

// The dates, values and labels below are asserted in Hebrew.
pinLocaleForTests('he');

// Dialog open/close cycles with focus management; under the full parallel
// suite the 5s default is too tight.
vi.setConfig({ testTimeout: 20_000 });

function sampleEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 42,
    date: '2026-09-07',
    time: '08:30',
    title: 'בוקר טוב',
    body: 'שורה ראשונה\nשורה שנייה',
    mood: 7,
    emotions: ['happy', 'calm'],
    energy: 6,
    stress: 3,
    sleepQuality: 8,
    sleepHours: 7.5,
    exerciseMinutes: 30,
    exerciseType: 'הליכה',
    events: ['פגישה חשובה'],
    people: ['דנה'],
    location: 'תל אביב',
    notes: 'הערה קטנה',
    tags: ['עבודה', 'משפחה'],
    createdAt: '2026-09-07T06:30:00.000Z',
    updatedAt: '2026-09-07T06:30:00.000Z',
    ...overrides,
  };
}

function renderPage(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/entry/:id" element={<EntryPage />} />
      <Route path="*" element={<LocationDisplay />} />
    </Routes>,
    { auth: 'authenticated', route },
  );
}

describe('EntryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('appends the date in the calendar system remembered by the calendar page to the subtitle, unless it is Gregorian', async () => {
    vi.mocked(api.entries.get).mockResolvedValue(sampleEntry());
    const first = renderPage('/entry/42');
    await screen.findByRole('heading', { level: 1, name: 'בוקר טוב' });
    expect(document.querySelector('.page-title__subtitle')).toHaveTextContent(/^יום שני, 7 בספטמבר 2026 בשעה 08:30$/);
    first.unmount();

    window.localStorage.setItem(CALENDAR_SYSTEM_KEY, JSON.stringify('hebrew'));
    const second = renderPage('/entry/42');
    await screen.findByRole('heading', { level: 1, name: 'בוקר טוב' });
    expect(document.querySelector('.page-title__subtitle')).toHaveTextContent('יום שני, 7 בספטמבר 2026 בשעה 08:30 · כ״ה באלול תשפ״ו');
    second.unmount();

    window.localStorage.setItem(CALENDAR_SYSTEM_KEY, JSON.stringify('hijri'));
    renderPage('/entry/42');
    await screen.findByRole('heading', { level: 1, name: 'בוקר טוב' });
    expect(document.querySelector('.page-title__subtitle')).toHaveTextContent('יום שני, 7 בספטמבר 2026 בשעה 08:30 · 25 ברביע אל-אוול 1448');
  });

  it('renders the title, date/time, metrics, emotions, lists, body with line breaks and tag links', async () => {
    vi.mocked(api.entries.get).mockResolvedValue(sampleEntry());
    renderPage('/entry/42');

    expect(await screen.findByRole('heading', { level: 1, name: 'בוקר טוב' })).toBeInTheDocument();
    expect(api.entries.get).toHaveBeenCalledWith(42);
    expect(screen.getByText('יום שני, 7 בספטמבר 2026 בשעה 08:30')).toBeInTheDocument();

    // Definition list values (null would read "לא דווח").
    expect(screen.getByText('7 מתוך 10')).toBeInTheDocument();
    expect(screen.getByText('7.5 שעות')).toBeInTheDocument();
    expect(screen.getByText('30 דקות (הליכה)')).toBeInTheDocument();
    expect(screen.getByText('תל אביב')).toBeInTheDocument();

    // Emotions as badges with Hebrew labels, events / people as lists.
    expect(screen.getByText('שמח')).toBeInTheDocument();
    expect(screen.getByText('רגוע')).toBeInTheDocument();
    expect(screen.getByText('פגישה חשובה')).toBeInTheDocument();
    expect(screen.getByText('דנה')).toBeInTheDocument();

    // Body keeps line breaks.
    const body = screen.getByTestId('entry-body');
    expect(body).toHaveTextContent('שורה ראשונה');
    expect(body.textContent).toContain('\n');
    expect(body).toHaveStyle({ whiteSpace: 'pre-wrap' });
    expect(screen.getByTestId('entry-notes')).toHaveTextContent('הערה קטנה');

    // Tags link to the filtered timeline, opened on the entry's own period (so the entry is in the results).
    expect(screen.getByRole('link', { name: '#עבודה' })).toHaveAttribute('href', `/diary?tag=${encodeURIComponent('עבודה')}&date=2026-09-07`);
    expect(screen.getByRole('link', { name: '#משפחה' })).toHaveAttribute('href', `/diary?tag=${encodeURIComponent('משפחה')}&date=2026-09-07`);

    // Actions.
    expect(screen.getByRole('link', { name: ET.edit })).toHaveAttribute('href', '/entry/42/edit');
    expect(screen.getByRole('link', { name: ET.toDay })).toHaveAttribute('href', '/day/2026-09-07');
    expect(screen.getByRole('button', { name: ET.delete })).toBeInTheDocument();
  });

  it('renders the read view in English when the UI language is English', async () => {
    setCurrentLocale('en');
    vi.mocked(api.entries.get).mockResolvedValue(sampleEntry({ updatedAt: '2026-09-08T06:30:00.000Z' }));
    renderPage('/entry/42');
    expect(await screen.findByRole('heading', { level: 1, name: 'בוקר טוב' })).toBeInTheDocument();
    expect(document.querySelector('.page-title__subtitle')).toHaveTextContent(/^Monday, 7 September 2026 at 08:30$/);
    expect(screen.getByText('7 of 10')).toBeInTheDocument();
    expect(screen.getByText('7.5 hours')).toBeInTheDocument();
    expect(screen.getByText('30 minutes (הליכה)')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Entry details' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/entry/42/edit');
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    const meta = document.querySelector('.entry-meta') as HTMLElement;
    expect(meta).toHaveTextContent(/^Created .+ · Updated .+$/);
    expect(meta).not.toHaveTextContent('נוצרה');
  });

  it('falls back to "רשומה ללא כותרת" and "לא דווח" for missing values', async () => {
    vi.mocked(api.entries.get).mockResolvedValue(
      sampleEntry({ title: '', mood: null, sleepHours: null, exerciseMinutes: null, exerciseType: '', location: '', emotions: [], tags: [] }),
    );
    renderPage('/entry/42');
    expect(await screen.findByRole('heading', { level: 1, name: ET.untitled })).toBeInTheDocument();
    expect(screen.getAllByText('לא דווח').length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText(ET.noEmotions)).toBeInTheDocument();
    expect(screen.getByText(ET.noTags)).toBeInTheDocument();
  });

  it('delete flow: confirmation dialog -> api.entries.remove -> toast + navigate to /diary', async () => {
    vi.mocked(api.entries.get).mockResolvedValue(sampleEntry());
    vi.mocked(api.entries.remove).mockResolvedValue(undefined);
    const { user } = renderPage('/entry/42');
    await screen.findByRole('heading', { level: 1, name: 'בוקר טוב' });

    await user.click(screen.getByRole('button', { name: ET.delete }));
    const dialog = screen.getByRole('dialog', { name: ET.deleteTitle });
    expect(dialog).toHaveTextContent(ET.deleteMessage);
    expect(api.entries.remove).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: ET.delete }));
    await waitFor(() => expect(api.entries.remove).toHaveBeenCalledWith(42));
    await waitFor(() => expect(currentPath()).toBe('/diary'));
    await waitFor(() => expect(politeRegion()).toHaveTextContent(ET.deleted));
  });

  it('cancelling the dialog keeps the entry', async () => {
    vi.mocked(api.entries.get).mockResolvedValue(sampleEntry());
    const { user } = renderPage('/entry/42');
    await screen.findByRole('heading', { level: 1, name: 'בוקר טוב' });
    await user.click(screen.getByRole('button', { name: ET.delete }));
    const dialog = screen.getByRole('dialog', { name: ET.deleteTitle });
    await user.click(within(dialog).getByRole('button', { name: 'ביטול' }));
    await waitFor(() => expect(dialog).not.toHaveAttribute('open'));
    expect(api.entries.remove).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 1, name: 'בוקר טוב' })).toBeInTheDocument();
  });

  it('shows an empty state for an unknown entry (404) and for a malformed id', async () => {
    vi.mocked(api.entries.get).mockRejectedValue(new ApiClientError(404, { code: 'NOT_FOUND', message: 'לא נמצא: הרשומה' }));
    const { unmount } = renderPage('/entry/999');
    expect(await screen.findByRole('heading', { level: 2, name: ET.notFoundTitle })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: ET.toDiary })).toHaveAttribute('href', '/diary');
    unmount();

    vi.mocked(api.entries.get).mockClear();
    renderPage('/entry/abc');
    expect(screen.getByRole('heading', { level: 2, name: ET.notFoundTitle })).toBeInTheDocument();
    expect(api.entries.get).not.toHaveBeenCalled();
  });
});
