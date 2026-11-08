/** en - calendar messages. Keys are prefixed 'calendar.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Calendar page (src/pages/CalendarPage.tsx) -------------------------------------------
  'calendar.title': 'Calendar',
  'calendar.nav.previousMonth': 'Previous month',
  'calendar.nav.nextMonth': 'Next month',
  'calendar.nav.label': 'Calendar navigation',
  'calendar.select.month': 'Month',
  'calendar.select.year': 'Year',
  // The calendar-system select ("Gregorian / Hebrew / Hijri"); it decides the day numbers and the holidays of the grid
  'calendar.select.system': 'Calendar',
  'calendar.system.gregorian': 'Gregorian',
  'calendar.system.hebrew': 'Hebrew',
  'calendar.system.hijri': 'Hijri (Islamic)',
  // {label} = one of the calendar.system.* names
  'calendar.system.unsupported': '{label} (not supported in this browser)',
  'calendar.system.legend':
    'Calendar shown: {label}. The day numbers and the holidays follow this calendar; the span of the month in the other calendars appears above the table.',

  // The month's span in the two calendars that are NOT the selected one: one full sentence each, shown above the table.
  // {month} = the month title ("Tishri 5787", "September 2026"); the "Lead" forms open the line with it.
  // Gregorian span: {from} / {to} = civil dates in the language's numeric form ("12/09/2026"; "12.09.2026" in Hebrew)
  'calendar.span.gregorian': '{month} runs from {from} to {to}',
  // Hebrew span: {from} / {to} = full Hebrew dates ("19 Elul 5786")
  'calendar.span.hebrewLead': '{month} in the Hebrew calendar: from {from} to {to}',
  'calendar.span.hebrew': 'In the Hebrew calendar: from {from} to {to}',
  // Hijri span: {from} / {to} = full Hijri dates ("1 Rabiʻ II 1448")
  'calendar.span.hijriLead': '{month} in the Hijri calendar: from {from} to {to}',
  'calendar.span.hijri': 'In the Hijri calendar: from {from} to {to}',

  // Month grid cells ---------------------------------------------------------------------
  // Short metric texts printed in a cell ("Md 7 · En 6"); the legend below explains them
  'calendar.cell.mood': 'Md {value}',
  'calendar.cell.energy': 'En {value}',
  'calendar.cell.habits': 'Habits {done}/{total}',
  // Visible marker of a day with entries ("● entry" / "● 3 entries")
  'calendar.cell.entryMarker': '● {count, plural, one {# entry} other {# entries}}',
  // Accessible name of a cell: "{weekday} {date}" then ": " then the details
  // {weekday} = "Monday", {date} = "7 September" or the full date in the selected calendar ("1 Tishri 5787")
  'calendar.cell.date': '{weekday} {date}',
  // {details} = comma-separated list: the holidays of the selected calendar, mood, energy, habits, entries
  'calendar.cell.aria': '{date}: {details}',
  'calendar.cell.ariaToday': 'Today, {date}: {details}',
  'calendar.cell.hasEntry': '{count, plural, one {has an entry} other {# entries}}',
  'calendar.cell.habitsDone': '{done} of {total} habits completed',
  'calendar.cell.noData': 'no data',
  'calendar.legend': 'Legend: Md = mean mood, En = mean energy, Habits = completed out of all habits. ● marks a day with an entry.',
  'calendar.keyboardHint':
    'Keyboard navigation: arrow keys move between days, Home/End to the start and end of the week, PageUp/PageDown between months, Enter opens the day summary.',

  // Holidays and the selected calendar's date (src/pages/entries/CalendarExtras.tsx, DayPage.tsx, EntryPage.tsx)
  // Day page subtitle: {value} = the full date in that calendar
  'calendar.extras.hebrewDateValue': 'Hebrew date: {value}',
  'calendar.extras.hijriDateValue': 'Hijri (Islamic) date: {value}',
  'calendar.extras.holidaysHeading': 'Holidays and observances',
  // "+N" badge when a cell has more holidays than it can show, and its tooltip
  'calendar.extras.more': '+{count}',
  // {names} = comma-separated holiday names
  'calendar.extras.moreTitle': 'And {count} more: {names}',
  'calendar.extras.legendTitle': 'Holiday legend',
  'calendar.extras.hijriNote': 'Islamic dates and holidays follow the Umm al-Qura calendar and may shift by one day.',
  // Shown when the remembered calendar is unavailable in this browser (the Gregorian calendar is shown instead)
  'calendar.extras.hebrewUnsupported':
    'This browser does not support the Hebrew calendar, so the Hebrew date and the Jewish holidays are not shown.',
  'calendar.extras.hijriUnsupported':
    'This browser does not support the Hijri calendar, so the Hijri date and the Muslim holidays are not shown.',
  // Multi-day holidays: "Day 2 of 8"
  'calendar.extras.dayOf': 'Day {index} of {count}',
};
export default messages;
