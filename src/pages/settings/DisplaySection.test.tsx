import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { DEFAULT_CALENDAR_EXTRAS } from '@shared/calendars';
import type { AppSettings } from '@shared/types';
import { SettingsContext } from '@/context/SettingsContext';
import { setCurrentLocale } from '@/i18n/runtime';
import { pinLocaleForTests } from '@/i18n/test-utils';
import { fakeSettings, politeRegion, renderWithProviders } from '@/test/render';
import { DisplaySection, fontScaleOptions, themeOptions } from './DisplaySection';
import { ST } from './texts';

/** Renders the section with a fake settings context whose `update` mock the test can inspect. */
function renderSection(overrides: Partial<AppSettings> = {}) {
  const ctx = fakeSettings(overrides);
  const result = renderWithProviders(
    <SettingsContext.Provider value={ctx}>
      <DisplaySection />
    </SettingsContext.Provider>,
    { auth: 'authenticated' },
  );
  return { ...result, ctx };
}

describe('DisplaySection (Hebrew wording)', () => {
  pinLocaleForTests('he');

  it('renders theme, text size, reduced motion and first day of the week - and no calendar toggles any more', () => {
    renderSection();
    expect(screen.getByRole('heading', { name: 'תצוגה' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: ST.theme })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /^גודל הטקסט/ })).toHaveDisplayValue('רגיל (100%)');
    expect(screen.getByRole('checkbox', { name: /^הפחתת תנועה/ })).not.toBeChecked();
    expect(screen.getByRole('group', { name: ST.firstDayOfWeek })).toBeInTheDocument();
    // The six calendar checkboxes are gone (the calendar-system menu decides what is shown).
    expect(screen.queryByRole('group', { name: 'לוח שנה' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    expect(screen.queryByText(/תאריך עברי|תאריך הג׳רי|חגים ומועדים/)).not.toBeInTheDocument();
    // The language name never appears outside the language picker.
    expect(document.body.textContent).not.toContain('עברית');
  });

  it('saves and announces the reduced-motion switch and the first day of the week', async () => {
    const { user, ctx } = renderSection();
    await user.click(screen.getByRole('checkbox', { name: /^הפחתת תנועה/ }));
    expect(ctx.update).toHaveBeenCalledWith({ reduceMotion: true });
    await waitFor(() => expect(politeRegion()).toHaveTextContent('הפחתת תנועה הופעלה.'));
    await user.click(screen.getByRole('radio', { name: 'שני' }));
    expect(ctx.update).toHaveBeenCalledWith({ firstDayOfWeek: 1 });
    await waitFor(() => expect(politeRegion()).toHaveTextContent('השבוע יתחיל ביום שני.'));
  });

  it('leaves calendarExtras alone (kept in AppSettings, no longer edited here)', async () => {
    const stored = { ...DEFAULT_CALENDAR_EXTRAS, hebrewDates: false };
    const { user, ctx } = renderSection({ calendarExtras: stored });
    await user.click(screen.getByRole('radio', { name: 'כהה' }));
    expect(ctx.update).toHaveBeenCalledTimes(1);
    expect(ctx.update).toHaveBeenCalledWith({ theme: 'dark' });
    for (const call of vi.mocked(ctx.update).mock.calls) expect(call[0]).not.toHaveProperty('calendarExtras');
  });
});

describe('DisplaySection - option labels follow the UI language', () => {
  it('builds theme and text-size options in English and in Hebrew', () => {
    setCurrentLocale('en');
    expect(themeOptions().map((o) => o.label)).toEqual(['Follow the system', 'Light', 'Dark', 'High contrast']);
    expect(fontScaleOptions(1).map((o) => o.label)).toEqual(['Small (90%)', 'Normal (100%)', 'Large (115%)', 'Very large (130%)', 'Huge (150%)']);
    expect(fontScaleOptions(1.2).at(-1)).toEqual({ value: '1.2', label: 'Custom (120%)' });

    setCurrentLocale('he');
    expect(themeOptions().map((o) => o.label)).toEqual(['לפי המערכת', 'בהיר', 'כהה', 'ניגודיות גבוהה']);
    expect(fontScaleOptions(1).map((o) => o.label)).toEqual(['קטן (90%)', 'רגיל (100%)', 'גדול (115%)', 'גדול מאוד (130%)', 'ענק (150%)']);
    expect(fontScaleOptions(1.2).at(-1)).toEqual({ value: '1.2', label: 'מותאם אישית (120%)' });
    setCurrentLocale('en');
  });

  it('announces the theme and the first day of the week in the current language', async () => {
    setCurrentLocale('en');
    const { user, ctx } = renderSection();
    const display = screen.getByRole('heading', { name: 'Display' }).closest('section') as HTMLElement;
    expect(within(display).getAllByRole('checkbox')).toHaveLength(1);
    await user.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(ctx.update).toHaveBeenCalledWith({ theme: 'dark' });
    await waitFor(() => expect(politeRegion()).toHaveTextContent('Theme updated: Dark'));
    await user.click(screen.getByRole('radio', { name: 'Monday' }));
    expect(ctx.update).toHaveBeenCalledWith({ firstDayOfWeek: 1 });
    await waitFor(() => expect(politeRegion()).toHaveTextContent('The week will start on Monday.'));
  });
});
