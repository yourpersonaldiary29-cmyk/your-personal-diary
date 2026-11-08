import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import type { Entry } from '@shared/types';
import * as api from '@/api';
import { ApiClientError } from '@/api';
import { T } from '@/constants/texts';
import { setCurrentLocale } from '@/i18n/runtime';
import { pinLocaleForTests } from '@/i18n/test-utils';
import { ET } from '@/pages/entries';
import { LocationDisplay, assertiveRegion, currentPath, politeRegion, renderWithProviders } from '@/test/render';
import NewEntryPage from './NewEntryPage';

vi.mock('@/api', async (importOriginal) => {
  const { createApiMock } = await import('@/test/api-mock');
  return createApiMock(await importOriginal());
});

// The field labels and validation messages below are asserted in Hebrew.
pinLocaleForTests('he');

// The full form (18 emotion checkboxes, four rating groups, autosizing text
// areas) makes every keystroke re-render a large tree; the first test of the
// file also pays the module warm-up, so it needs more than the 5s default.
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
    events: ['פגישה'],
    people: ['דנה'],
    location: 'תל אביב',
    notes: 'הערה',
    tags: ['עבודה'],
    createdAt: '2026-09-07T06:30:00.000Z',
    updatedAt: '2026-09-07T06:30:00.000Z',
    ...overrides,
  };
}

function renderPage(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/new" element={<NewEntryPage />} />
      <Route path="/entry/:id/edit" element={<NewEntryPage />} />
      <Route path="*" element={<LocationDisplay />} />
    </Routes>,
    { auth: 'authenticated', route },
  );
}

describe('NewEntryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.entries.tags).mockResolvedValue([{ name: 'עבודה', count: 3 }]);
    vi.mocked(api.entries.people).mockResolvedValue([{ name: 'דנה', count: 2 }]);
    vi.mocked(api.entries.locations).mockResolvedValue([{ name: 'בית', count: 5 }]);
  });

  it('honours ?date= and ?time=, submits an EntryInput with normalised tags and opens the saved entry', async () => {
    vi.mocked(api.entries.create).mockResolvedValue(sampleEntry({ id: 42 }));
    const { user } = renderPage('/new?date=2026-09-07&time=08:30');

    expect(screen.getByRole('heading', { level: 1, name: ET.newEntryTitle })).toBeInTheDocument();
    expect(screen.getByLabelText(/^תאריך/)).toHaveValue('2026-09-07');
    expect(screen.getByLabelText(/^שעה/)).toHaveValue('08:30');

    await user.type(screen.getByRole('textbox', { name: ET.title }), 'בוקר טוב');
    // With suggestions loaded the tag box carries a datalist (combobox role): query by label.
    const tags = screen.getByLabelText(ET.tags);
    await user.type(tags, '#עבודה{Enter}');
    await user.type(tags, ' עבודה {Enter}');
    expect(screen.getByRole('button', { name: 'הסר #עבודה' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'הסר עבודה' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: ET.save }));

    await waitFor(() => expect(api.entries.create).toHaveBeenCalledTimes(1));
    expect(api.entries.create).toHaveBeenCalledWith(
      expect.objectContaining({
        date: '2026-09-07',
        time: '08:30',
        title: 'בוקר טוב',
        tags: ['עבודה'],
        mood: null,
        emotions: [],
        sleepHours: null,
        exerciseMinutes: null,
      }),
    );
    await waitFor(() => expect(currentPath()).toBe('/entry/42'));
    await waitFor(() => expect(politeRegion()).toHaveTextContent(ET.saved));
    expect(await screen.findByText(ET.saved, { selector: '.toast__text' })).toBeInTheDocument();
  });

  it('Ctrl+S submits the form', async () => {
    vi.mocked(api.entries.create).mockResolvedValue(sampleEntry({ id: 5 }));
    const { user } = renderPage('/new');
    await user.type(screen.getByRole('textbox', { name: ET.title }), 'קיצור');
    await user.keyboard('{Control>}s{/Control}');
    await waitFor(() => expect(api.entries.create).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(currentPath()).toBe('/entry/5'));
  });

  it('edit mode: a mood out of range shows an error linked via aria-describedby, focuses the slider and does not save', async () => {
    vi.mocked(api.entries.get).mockResolvedValue(sampleEntry({ id: 7, mood: 12 }));
    const { user } = renderPage('/entry/7/edit');

    expect(screen.getByRole('heading', { level: 1, name: ET.editEntryTitle })).toBeInTheDocument();
    const mood = await screen.findByRole('slider', { name: ET.mood });
    await waitFor(() => expect(screen.getByRole('textbox', { name: ET.title })).toHaveValue('בוקר טוב'));
    expect(api.entries.get).toHaveBeenCalledWith(7);

    await user.click(screen.getByRole('button', { name: ET.save }));

    expect(mood).toHaveAttribute('aria-invalid', 'true');
    expect(mood.getAttribute('aria-describedby')).toContain('entry-mood-error');
    expect(mood).toHaveAccessibleDescription('מצב הרוח חייב להיות מספר שלם בין 1 ל-10');
    expect(mood).toHaveFocus();
    await waitFor(() => expect(assertiveRegion()).toHaveTextContent(T.fixErrors(1)));
    expect(api.entries.update).not.toHaveBeenCalled();
    expect(api.entries.create).not.toHaveBeenCalled();
  });

  it('edit mode: saves through update and calls remove after confirming deletion', async () => {
    vi.mocked(api.entries.get).mockResolvedValue(sampleEntry({ id: 7 }));
    vi.mocked(api.entries.update).mockResolvedValue(sampleEntry({ id: 7, title: 'ערוך' }));
    const { user } = renderPage('/entry/7/edit');
    const title = await screen.findByRole('textbox', { name: ET.title });
    await waitFor(() => expect(title).toHaveValue('בוקר טוב'));

    await user.clear(title);
    await user.type(title, 'ערוך');
    await user.click(screen.getByRole('button', { name: ET.save }));
    await waitFor(() => expect(api.entries.update).toHaveBeenCalledTimes(1));
    expect(api.entries.update).toHaveBeenCalledWith(7, expect.objectContaining({ title: 'ערוך', tags: ['עבודה'], mood: 7 }));
    await waitFor(() => expect(currentPath()).toBe('/entry/7'));
  });

  it('maps a server VALIDATION error to its field and focuses it', async () => {
    vi.mocked(api.entries.create).mockRejectedValue(
      new ApiClientError(400, { code: 'VALIDATION', message: 'השדה "מיקום" ארוך מדי (עד 200 תווים)', field: 'location' }),
    );
    const { user } = renderPage('/new');
    await user.click(screen.getByRole('button', { name: ET.save }));

    // The location box offers a datalist, which gives it the combobox role: query it by label.
    const location = screen.getByLabelText(ET.location);
    await waitFor(() => expect(location).toHaveAttribute('aria-invalid', 'true'));
    expect(location).toHaveAccessibleDescription(/ארוך מדי/);
    expect(location).toHaveFocus();
    // Still on the form (no navigation happened).
    expect(screen.queryByTestId('location')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: ET.newEntryTitle })).toBeInTheDocument();
  });

  it('shows non-field server errors in an alert and stays on the page', async () => {
    vi.mocked(api.entries.create).mockRejectedValue(new ApiClientError(0, { code: 'OTHER', message: T.noServer }));
    const { user } = renderPage('/new');
    await user.click(screen.getByRole('button', { name: ET.save }));
    await waitFor(() => expect(document.querySelector('.alert--error:not([role])')).toHaveTextContent(T.noServer));
    expect(screen.getByRole('heading', { level: 1, name: ET.newEntryTitle })).toBeInTheDocument();
  });

  it('renders the form in English when the UI language is English', async () => {
    setCurrentLocale('en');
    renderPage('/new?date=2026-09-07&time=08:30');
    expect(screen.getByRole('heading', { level: 1, name: 'New entry' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Date/)).toHaveValue('2026-09-07');
    expect(screen.getByRole('textbox', { name: 'Title' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Mood' })).toBeInTheDocument();
    expect(screen.getByLabelText('Tags')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByText('You can also press Ctrl+S')).toBeInTheDocument();
    expect(screen.getByText('What happened today? How did you feel? Feel free to write at length.')).toBeInTheDocument();
  });

  it('edit mode with an unknown id shows the not-found state', async () => {
    vi.mocked(api.entries.get).mockRejectedValue(new ApiClientError(404, { code: 'NOT_FOUND', message: 'לא נמצא: הרשומה' }));
    renderPage('/entry/999/edit');
    expect(await screen.findByRole('heading', { level: 2, name: ET.notFoundTitle })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: ET.toDiary })).toHaveAttribute('href', '/diary');
  });
});
