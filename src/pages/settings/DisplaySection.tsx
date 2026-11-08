/**
 * "Display" card: theme, text size, reduced motion and the first day of the
 * week. Works for anonymous visitors too (SettingsContext keeps a local
 * preview). Every change is saved immediately and announced.
 *
 * The calendar toggles that used to live here are gone: the calendar-system
 * menu on the calendar page decides what is shown (AppSettings.calendarExtras
 * is kept for compatibility but is no longer edited from the UI).
 *
 * The option lists are built per render so their labels follow the UI language.
 */
import type { AppSettings } from '@shared/types';
import { Alert } from '@/components/ui/Alert';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { RadioGroup, type RadioOption } from '@/components/ui/RadioGroup';
import { Select, type SelectOption } from '@/components/ui/Select';
import { THEME_OPTIONS } from '@/constants/settings';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { ST, type FontScaleSize } from './texts';
import { useSettingsSaver } from './useSettingsSaver';

/** Text-size presets: multiplier of the base font size and the percentage shown in the label. */
export const FONT_SCALE_PRESETS: { value: string; size: FontScaleSize; percent: number }[] = [
  { value: '0.9', size: 'small', percent: 90 },
  { value: '1', size: 'normal', percent: 100 },
  { value: '1.15', size: 'large', percent: 115 },
  { value: '1.3', size: 'veryLarge', percent: 130 },
  { value: '1.5', size: 'huge', percent: 150 },
];

/** Theme radio options with labels in the current UI language (values from THEME_OPTIONS). */
export function themeOptions(): RadioOption<AppSettings['theme']>[] {
  return THEME_OPTIONS.map(({ value }) => ({ value, label: ST.themeLabel(value) }));
}

/** Text-size select options in the current UI language. */
export function fontScalePresets(): SelectOption[] {
  return FONT_SCALE_PRESETS.map(({ value, size, percent }) => ({ value, label: ST.fontScaleOption(size, percent) }));
}

type FirstDay = '0' | '1';

function firstDayOptions(): RadioOption<FirstDay>[] {
  return [
    { value: '0', label: ST.sunday },
    { value: '1', label: ST.monday },
  ];
}

/** The select options, extended with the current value when it is not a preset. */
export function fontScaleOptions(current: number): SelectOption[] {
  const presets = fontScalePresets();
  const value = String(current);
  if (presets.some((o) => o.value === value)) return presets;
  return [...presets, { value, label: ST.customScale(Math.round(current * 100)) }];
}

export function DisplaySection() {
  const { settings } = useSettings();
  const { status } = useAuth();
  const { save, error } = useSettingsSaver();
  const themes = themeOptions();
  const scaleOptions = fontScaleOptions(settings.fontScale);

  const onTheme = (theme: AppSettings['theme']) => {
    const label = themes.find((o) => o.value === theme)?.label ?? theme;
    void save({ theme }, ST.themeChanged(label));
  };

  const onFontScale = (value: string) => {
    const label = scaleOptions.find((o) => o.value === value)?.label ?? value;
    void save({ fontScale: Number(value) }, ST.fontScaleChanged(label));
  };

  const onReduceMotion = (checked: boolean) => {
    void save({ reduceMotion: checked }, checked ? ST.reduceMotionOn : ST.reduceMotionOff);
  };

  const onFirstDay = (value: FirstDay) => {
    const firstDayOfWeek = value === '1' ? 1 : 0;
    void save({ firstDayOfWeek }, ST.firstDayChanged(firstDayOfWeek === 1 ? ST.monday : ST.sunday));
  };

  return (
    <Card title={ST.display}>
      <div className="stack">
        {status !== 'authenticated' && <p className="text-muted">{ST.displayAnonymousHint}</p>}
        {error && <Alert kind="error">{error}</Alert>}
        <RadioGroup<AppSettings['theme']> legend={ST.theme} name="theme" options={themes} value={settings.theme} onChange={onTheme} inline />
        <Select id="settings-font-scale" label={ST.fontScale} options={scaleOptions} value={String(settings.fontScale)} onChange={onFontScale} />
        <Checkbox id="settings-reduce-motion" label={ST.reduceMotion} hint={ST.reduceMotionHint} checked={settings.reduceMotion} onChange={onReduceMotion} />
        <RadioGroup<FirstDay>
          legend={ST.firstDayOfWeek}
          name="firstDayOfWeek"
          options={firstDayOptions()}
          value={settings.firstDayOfWeek === 1 ? '1' : '0'}
          onChange={onFirstDay}
          inline
        />
      </div>
    </Card>
  );
}
