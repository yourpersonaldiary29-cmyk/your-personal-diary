/**
 * User-facing strings of the entry, timeline, day and calendar pages, resolved
 * through the message catalogues (keys 'entries.*' and 'calendar.*' under
 * shared/i18n/messages) in the current UI language. Every value is a getter or
 * a function, so call sites (`ET.save`, `ET.weekRange(from, to)`) always read
 * the language selected at that moment; pages and tests share one wording.
 */
import type { CalendarSystem } from '@shared/calendars/month-view';
import type { Locale } from '@shared/i18n';
import { getCurrentLocale, tr, trWith } from '@/i18n/runtime';
import { formatNumber } from '@/utils/format';

export const ET = {
  // Page titles
  get newEntryTitle() { return tr('entries.title.new'); },
  get editEntryTitle() { return tr('entries.title.edit'); },
  get diaryTitle() { return tr('entries.title.diary'); },
  /** Heading shown while an entry loads. */
  get loadingTitle() { return tr('entries.title.loading'); },
  get calendarTitle() { return tr('calendar.title'); },
  get untitled() { return tr('entries.untitled'); },

  // Field labels (form order)
  get date() { return tr('entries.field.date'); },
  get time() { return tr('entries.field.time'); },
  get title() { return tr('entries.field.title'); },
  get body() { return tr('entries.field.body'); },
  get mood() { return tr('entries.field.mood'); },
  get emotions() { return tr('entries.field.emotions'); },
  get energy() { return tr('entries.field.energy'); },
  get stress() { return tr('entries.field.stress'); },
  get sleepQuality() { return tr('entries.field.sleepQuality'); },
  get sleepHours() { return tr('entries.field.sleepHours'); },
  get exercise() { return tr('entries.field.exercise'); },
  get exerciseType() { return tr('entries.field.exerciseType'); },
  get events() { return tr('entries.field.events'); },
  get people() { return tr('entries.field.people'); },
  get location() { return tr('entries.field.location'); },
  get notes() { return tr('entries.field.notes'); },
  get tags() { return tr('entries.field.tags'); },
  get hoursUnit() { return tr('entries.field.hoursUnit'); },
  get ratingLow() { return tr('entries.rating.low'); },
  get ratingHigh() { return tr('entries.rating.high'); },
  get stressLow() { return tr('entries.stress.low'); },
  get stressHigh() { return tr('entries.stress.high'); },
  get bodyHint() { return tr('entries.hint.body'); },
  get tagsHint() { return tr('entries.hint.tags'); },
  get peopleHint() { return tr('entries.hint.people'); },
  get eventsHint() { return tr('entries.hint.events'); },
  get exerciseTypeHint() { return tr('entries.hint.exerciseType'); },
  get noExercise() { return tr('entries.exercise.none'); },
  /** "30 minutes (walking)": `duration` is already formatted. */
  exerciseWithType: (duration: string, type: string) => tr('entries.exercise.withType', { duration, type }),

  // Actions
  get save() { return tr('entries.action.save'); },
  get saveHint() { return tr('entries.action.saveHint'); },
  get cancel() { return tr('entries.action.cancel'); },
  get edit() { return tr('entries.action.edit'); },
  get delete() { return tr('entries.action.delete'); },
  get open() { return tr('entries.action.open'); },
  /** Accessible name of an entry's "open" link: "Open: {title}". */
  openNamed: (title: string) => tr('entries.action.openNamed', { title }),
  /** Accessible name of an entry's "edit" link: "Edit: {title}". */
  editNamed: (title: string) => tr('entries.action.editNamed', { title }),
  get deleteTitle() { return tr('entries.delete.title'); },
  get deleteMessage() { return tr('entries.delete.message'); },
  get saved() { return tr('entries.saved'); },
  get deleted() { return tr('entries.deleted'); },
  get toDay() { return tr('entries.nav.toDay'); },
  get toDiary() { return tr('entries.nav.toDiary'); },
  get newEntry() { return tr('entries.nav.newEntry'); },
  get newEntryForDay() { return tr('entries.nav.newEntryForDay'); },
  /** "Created {timestamp}" with an already formatted timestamp. */
  createdAt: (timestamp: string) => tr('entries.meta.createdAt', { timestamp }),
  updatedAt: (timestamp: string) => tr('entries.meta.updatedAt', { timestamp }),

  // Read view
  get detailsHeading() { return tr('entries.details.heading'); },
  get bodyHeading() { return tr('entries.details.body'); },
  get notesHeading() { return tr('entries.details.notes'); },
  get tagsHeading() { return tr('entries.details.tags'); },
  get emotionsHeading() { return tr('entries.details.emotions'); },
  get eventsHeading() { return tr('entries.details.events'); },
  get peopleHeading() { return tr('entries.details.people'); },
  get metricsLabel() { return tr('entries.details.metricsLabel'); },
  get noEmotions() { return tr('entries.details.noEmotions'); },
  get noTags() { return tr('entries.details.noTags'); },
  get notFoundTitle() { return tr('entries.notFound.title'); },
  get notFoundText() { return tr('entries.notFound.text'); },
  get invalidDateTitle() { return tr('entries.invalidDate.title'); },
  get invalidDateText() { return tr('entries.invalidDate.text'); },

  // Metric badges (the value is already formatted: "7", "7.5 hours")
  moodBadge: (value: string) => tr('entries.badge.mood', { value }),
  energyBadge: (value: string) => tr('entries.badge.energy', { value }),
  stressBadge: (value: string) => tr('entries.badge.stress', { value }),
  sleepBadge: (value: string) => tr('entries.badge.sleep', { value }),

  // Timeline
  get viewLabel() { return tr('entries.timeline.viewLabel'); },
  get viewDay() { return tr('entries.timeline.viewDay'); },
  get viewWeek() { return tr('entries.timeline.viewWeek'); },
  get viewMonth() { return tr('entries.timeline.viewMonth'); },
  get viewYear() { return tr('entries.timeline.viewYear'); },
  get previous() { return tr('entries.timeline.previous'); },
  get next() { return tr('entries.timeline.next'); },
  get today() { return tr('entries.timeline.today'); },
  get goToDate() { return tr('entries.timeline.goToDate'); },
  get textFilter() { return tr('entries.timeline.textFilter'); },
  get textFilterHint() { return tr('entries.timeline.textFilterHint'); },
  get tagFilter() { return tr('entries.timeline.tagFilter'); },
  get allTags() { return tr('entries.timeline.allTags'); },
  /** Option text of the tag filter: "{tag} ({count})". */
  tagOption: (tag: string, count: number) => tr('entries.timeline.tagOption', { tag, count }),
  get loadMore() { return tr('entries.timeline.loadMore'); },
  loadedMore: (count: number) => tr('entries.timeline.loadedMore', { count }),
  get noEntriesTitle() { return tr('entries.timeline.noEntriesTitle'); },
  get noEntriesText() { return tr('entries.timeline.noEntriesText'); },
  get noEntriesFiltered() { return tr('entries.timeline.noEntriesFiltered'); },
  get yearFilterNote() { return tr('entries.timeline.yearFilterNote'); },
  /** "Week {from} - {to}" with already formatted short dates. */
  weekRange: (from: string, to: string) => tr('entries.timeline.weekRange', { from, to }),
  yearLabel: (year: number) => tr('entries.timeline.yearLabel', { year }),
  get monthColumn() { return tr('entries.timeline.monthColumn'); },
  get entriesColumn() { return tr('entries.timeline.entriesColumn'); },
  get moodColumn() { return tr('entries.timeline.moodColumn'); },
  openMonth: (month: string) => tr('entries.timeline.openMonth', { month }),
  entriesCount: (count: number) => tr('entries.timeline.entriesCount', { count }),
  resultsCount: (shown: number, total: number) =>
    shown === total ? tr('entries.timeline.resultsAll', { count: total }) : tr('entries.timeline.resultsPartial', { shown, total }),
  get navLabel() { return tr('entries.timeline.navLabel'); },
  /** Day heading with a relative label: "{date} ({relative})". */
  dayWithRelative: (date: string, relative: string) => tr('entries.timeline.dayWithRelative', { date, relative }),
  /** Short date followed by the time in a timeline card. */
  cardDateTime: (date: string, time: string) => tr('entries.timeline.cardDateTime', { date, time }),

  // Day page
  get dayAverages() { return tr('entries.day.averages'); },
  get moodAvg() { return tr('entries.day.moodAvg'); },
  get energyAvg() { return tr('entries.day.energyAvg'); },
  get stressAvg() { return tr('entries.day.stressAvg'); },
  get sleepHoursTile() { return tr('entries.day.sleepHoursTile'); },
  get entriesTile() { return tr('entries.day.entriesTile'); },
  get dayEntries() { return tr('entries.day.entries'); },
  /** Section heading with the number of entries: "Entries of the day (2)". */
  dayEntriesCount: (count: number) => tr('entries.day.entriesCount', { count }),
  get dayHabits() { return tr('entries.day.habits'); },
  get noHabitLogs() { return tr('entries.day.noHabitLogs'); },
  get noDayEntries() { return tr('entries.day.noEntries'); },
  get habitColumn() { return tr('entries.day.habitColumn'); },
  get valueColumn() { return tr('entries.day.valueColumn'); },
  get targetColumn() { return tr('entries.day.targetColumn'); },
  get statusColumn() { return tr('entries.day.statusColumn'); },
  get completed() { return tr('entries.day.completed'); },
  get notCompleted() { return tr('entries.day.notCompleted'); },
  get previousDay() { return tr('entries.day.previousDay'); },
  get nextDay() { return tr('entries.day.nextDay'); },
  /** "{value} {unit}" with an already formatted number. */
  valueWithUnit: (value: string, unit: string) => tr('entries.day.valueWithUnit', { value, unit }),

  // Calendar
  get previousMonth() { return tr('calendar.nav.previousMonth'); },
  get nextMonth() { return tr('calendar.nav.nextMonth'); },
  get monthSelect() { return tr('calendar.select.month'); },
  get yearSelect() { return tr('calendar.select.year'); },
  get calendarNav() { return tr('calendar.nav.label'); },
  /** The calendar-system select ("Calendar") and its options (keys = CalendarSystem). */
  get calendarSystem() { return tr('calendar.select.system'); },
  get systemLabels(): Record<CalendarSystem, string> {
    return { gregorian: tr('calendar.system.gregorian'), hebrew: tr('calendar.system.hebrew'), hijri: tr('calendar.system.hijri') };
  },
  systemLabel: (system: CalendarSystem) => tr(`calendar.system.${system}`),
  systemUnsupportedOption: (label: string) => tr('calendar.system.unsupported', { label }),
  systemLegend: (label: string) => tr('calendar.system.legend', { label }),
  /**
   * The month's span in the calendars that are not the selected one, one full sentence each, shown above the grid:
   * `month` = the view title, `from` / `to` already formatted. A month view carries its own language, so these take
   * the locale explicitly (default: the current UI language). The "Lead" forms open the line with the month title.
   */
  spanGregorian: (month: string, from: string, to: string, locale: Locale = getCurrentLocale()) =>
    trWith(locale)('calendar.span.gregorian', { month, from, to }),
  spanHebrewLead: (month: string, from: string, to: string, locale: Locale = getCurrentLocale()) =>
    trWith(locale)('calendar.span.hebrewLead', { month, from, to }),
  spanHebrew: (from: string, to: string, locale: Locale = getCurrentLocale()) => trWith(locale)('calendar.span.hebrew', { from, to }),
  spanHijriLead: (month: string, from: string, to: string, locale: Locale = getCurrentLocale()) =>
    trWith(locale)('calendar.span.hijriLead', { month, from, to }),
  spanHijri: (from: string, to: string, locale: Locale = getCurrentLocale()) => trWith(locale)('calendar.span.hijri', { from, to }),
  /** Short cell texts ("Md 7", "En 6", "Habits 3/5", "● entry"); the value is already formatted. */
  moodCell: (value: string) => tr('calendar.cell.mood', { value }),
  energyCell: (value: string) => tr('calendar.cell.energy', { value }),
  habitsCell: (done: number, total: number) => tr('calendar.cell.habits', { done, total }),
  entryMarker: (count: number) => tr('calendar.cell.entryMarker', { count }),
  /** Accessible-name pieces of a cell: "{weekday} {date}", then "{date}: {details}" (with a "Today" prefix on today). */
  cellDate: (weekday: string, date: string) => tr('calendar.cell.date', { weekday, date }),
  cellAria: (date: string, details: string, isToday: boolean) => tr(isToday ? 'calendar.cell.ariaToday' : 'calendar.cell.aria', { date, details }),
  hasEntry: (count: number) => tr('calendar.cell.hasEntry', { count }),
  habitsDone: (done: number, total: number) => tr('calendar.cell.habitsDone', { done, total }),
  get noData() { return tr('calendar.cell.noData'); },
  get legend() { return tr('calendar.legend'); },
  get keyboardHint() { return tr('calendar.keyboardHint'); },
} as const;

/** Fields whose labels appear inside validation messages. */
export type EntryValidationField =
  | 'mood'
  | 'energy'
  | 'stress'
  | 'sleepQuality'
  | 'title'
  | 'body'
  | 'exerciseType'
  | 'location'
  | 'notes'
  | 'events'
  | 'people'
  | 'tags'
  | 'emotions';

/** Label of a field as used inside the validation messages ("The field "Title" is too long"). */
export function entryValidationLabel(field: EntryValidationField): string {
  return tr(`entries.validation.label.${field}`);
}

/** Server-compatible validation messages (same wording as server/src/db/entries-repo.ts). */
export const ENTRY_MESSAGES = {
  get dateRequired() { return tr('entries.validation.dateRequired'); },
  get dateInvalid() { return tr('entries.validation.dateInvalid'); },
  get timeRequired() { return tr('entries.validation.timeRequired'); },
  get timeInvalid() { return tr('entries.validation.timeInvalid'); },
  tooLong: (label: string, max: number) => tr('entries.validation.tooLong', { label, max: formatNumber(max, 0) }),
  rating: (label: string) => tr('entries.validation.rating', { label }),
  get sleepHours() { return tr('entries.validation.sleepHours'); },
  get exerciseMinutes() { return tr('entries.validation.exerciseMinutes'); },
  itemTooLong: (label: string, max: number) => tr('entries.validation.itemTooLong', { label, max: formatNumber(max, 0) }),
  tooManyItems: (label: string, max: number) => tr('entries.validation.tooManyItems', { label, max: formatNumber(max, 0) }),
  unknownEmotion: (key: string) => tr('entries.validation.unknownEmotion', { key }),
} as const;
