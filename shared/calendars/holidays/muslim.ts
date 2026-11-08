/**
 * Muslim holidays on the Umm al-Qura calendar (`toHijriDate`). The actual
 * observance depends on the sighting of the new moon, so every entry carries a
 * note saying the date may move by a day.
 *
 * `name` / `note` are the Hebrew texts (backward compatibility); `nameKey` /
 * `noteKey` point at the 'holidays.*' catalogue for every UI language.
 */
import type { Holiday, HolidayKind } from '../types';
import { hijriCalendarName, isHijriCalendarSupported, toHijriDate } from '../hijri';
import { addDaysIso } from '../civil';
import { holidayNameKey, multiDay, scanCivilYear } from './scan';

export const UMM_AL_QURA_NOTE = 'לפי לוח אום אל-קורא; המועד בפועל נקבע לפי ראיית הירח ועשוי לזוז ביום אחד';
/** The tabular calendar itself is up to two days from Umm al-Qura (e.g. 1 Muharram 1447, 1 Ramadan 1451), before moon sighting. */
export const CIVIL_HIJRI_NOTE = 'לפי הלוח ההג׳רי האריתמטי; המועד בפועל נקבע לפי ראיית הירח ועשוי לזוז ביום או יומיים';

export const UMM_AL_QURA_NOTE_KEY = 'holidays.note.ummAlQura';
export const CIVIL_HIJRI_NOTE_KEY = 'holidays.note.civilHijri';

/** The note attached to every Muslim (and Druze Eid) entry, depending on the calendar in use. */
export function hijriNote(): string {
  return hijriCalendarName() === 'islamic-civil' ? CIVIL_HIJRI_NOTE : UMM_AL_QURA_NOTE;
}

/** Catalogue key of `hijriNote()`. */
export function hijriNoteKey(): string {
  return hijriCalendarName() === 'islamic-civil' ? CIVIL_HIJRI_NOTE_KEY : UMM_AL_QURA_NOTE_KEY;
}

interface Rule {
  id: string;
  /** 1 = Muharram .. 12 = Dhu al-Hijjah */
  month: number;
  day: number;
  name: string;
  kind: HolidayKind;
  dayCount?: number;
}

const RULES: Rule[] = [
  { id: 'muslim.hijri-new-year', month: 1, day: 1, name: 'ראש השנה ההג׳רי', kind: 'major' },
  { id: 'muslim.ashura', month: 1, day: 10, name: 'עאשוראא', kind: 'major' },
  { id: 'muslim.mawlid', month: 3, day: 12, name: 'מולד הנביא', kind: 'major' },
  { id: 'muslim.isra-miraj', month: 7, day: 27, name: 'אל-איסראא ואל-מעראג׳', kind: 'major' },
  { id: 'muslim.ramadan-start', month: 9, day: 1, name: 'תחילת רמדאן', kind: 'minor' },
  { id: 'muslim.laylat-al-qadr', month: 9, day: 27, name: 'לילת אל-קדר', kind: 'minor' },
  { id: 'muslim.eid-al-fitr', month: 10, day: 1, name: 'עיד אל-פיטר', kind: 'major', dayCount: 3 },
  { id: 'muslim.arafah', month: 12, day: 9, name: 'יום ערפה', kind: 'minor' },
  { id: 'muslim.eid-al-adha', month: 12, day: 10, name: 'עיד אל-אדחא', kind: 'major', dayCount: 4 },
];

export const MUSLIM_HOLIDAY_IDS: readonly string[] = RULES.map((r) => r.id);

/** Holidays anchored on the civil day `iso` (all their days), for the year scanner. */
export function muslimHolidaysAnchoredOn(iso: string): Holiday[] {
  if (!isHijriCalendarSupported()) return [];
  const hd = toHijriDate(iso);
  const out: Holiday[] = [];
  const note = hijriNote();
  const noteKey = hijriNoteKey();
  for (const rule of RULES) {
    if (rule.month !== hd.month || rule.day !== hd.day) continue;
    const count = rule.dayCount ?? 1;
    const nameKey = holidayNameKey(rule.id);
    for (let i = 1; i <= count; i++) {
      out.push({
        id: rule.id,
        tradition: 'muslim',
        name: rule.name,
        nameKey,
        kind: rule.kind,
        date: i === 1 ? iso : addDaysIso(iso, i - 1),
        ...multiDay(i, count),
        note,
        noteKey,
      });
    }
  }
  return out;
}

/** Every Muslim holiday day that falls inside the Gregorian `year`, sorted by date. */
export function muslimHolidaysForYear(year: number): Holiday[] {
  if (!isHijriCalendarSupported()) return [];
  return scanCivilYear(year, muslimHolidaysAnchoredOn);
}
