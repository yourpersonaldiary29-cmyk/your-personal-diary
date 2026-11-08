/**
 * Druze holidays as observed in Israel: Eid al-Adha (the principal Druze
 * holiday, on the Hijri calendar) and the three annual ziyarat (pilgrimages)
 * on fixed civil dates.
 *
 * `name` / `note` are the Hebrew texts (backward compatibility); `nameKey` /
 * `noteKey` point at the 'holidays.*' catalogue for every UI language.
 */
import type { Holiday } from '../types';
import { isHijriCalendarSupported, toHijriDate } from '../hijri';
import { addDaysIso, compareIso, toIsoDate } from '../civil';
import { hijriNote, hijriNoteKey } from './muslim';
import { holidayNameKey, multiDay, scanCivilYear } from './scan';

export const NOTE_OFFICIAL_HOLIDAY = 'יום החג הרשמי';
export const NOTE_KEY_OFFICIAL_HOLIDAY = 'holidays.note.officialHoliday';

export const DRUZE_HOLIDAY_IDS: readonly string[] = [
  'druze.eid-al-adha',
  'druze.nabi-shuayb',
  'druze.al-khadr',
  'druze.nabi-sablan',
];

const EID_AL_ADHA_KEY = holidayNameKey('druze.eid-al-adha');
const NABI_SHUAYB_KEY = holidayNameKey('druze.nabi-shuayb');
const AL_KHADR_KEY = holidayNameKey('druze.al-khadr');
const NABI_SABLAN_KEY = holidayNameKey('druze.nabi-sablan');

/** Eid al-Adha (10-13 Dhu al-Hijjah) anchored on the civil day `iso`, for the year scanner. */
export function druzeHolidaysAnchoredOn(iso: string): Holiday[] {
  if (!isHijriCalendarSupported()) return [];
  const hd = toHijriDate(iso);
  if (hd.month !== 12 || hd.day !== 10) return [];
  const note = hijriNote();
  const noteKey = hijriNoteKey();
  const out: Holiday[] = [];
  for (let i = 1; i <= 4; i++) {
    out.push({
      id: 'druze.eid-al-adha',
      tradition: 'druze',
      name: 'עיד אל-אדחא',
      nameKey: EID_AL_ADHA_KEY,
      kind: 'major',
      date: i === 1 ? iso : addDaysIso(iso, i - 1),
      ...multiDay(i, 4),
      note,
      noteKey,
    });
  }
  return out;
}

/** The fixed-date ziyarat of the Gregorian `year`. */
export function druzeFixedHolidaysForYear(year: number): Holiday[] {
  const out: Holiday[] = [];
  out.push({ id: 'druze.al-khadr', tradition: 'druze', name: 'זיארת אל-ח׳דר', nameKey: AL_KHADR_KEY, kind: 'major', date: toIsoDate(year, 1, 25) });
  for (let i = 1; i <= 4; i++) {
    const h: Holiday = {
      id: 'druze.nabi-shuayb',
      tradition: 'druze',
      name: 'זיארת נבי שועייב',
      nameKey: NABI_SHUAYB_KEY,
      kind: i === 1 ? 'major' : 'minor',
      date: toIsoDate(year, 4, 24 + i),
      ...multiDay(i, 4),
    };
    if (i === 1) {
      h.note = NOTE_OFFICIAL_HOLIDAY;
      h.noteKey = NOTE_KEY_OFFICIAL_HOLIDAY;
    }
    out.push(h);
  }
  out.push({ id: 'druze.nabi-sablan', tradition: 'druze', name: 'זיארת נבי סבלאן', nameKey: NABI_SABLAN_KEY, kind: 'major', date: toIsoDate(year, 9, 10) });
  return out;
}

/** Every Druze holiday day inside the Gregorian `year`, sorted by date. */
export function druzeHolidaysForYear(year: number): Holiday[] {
  const out = [...druzeFixedHolidaysForYear(year), ...scanCivilYear(year, druzeHolidaysAnchoredOn)];
  out.sort((a, b) => compareIso(a.date, b.date));
  return out;
}
