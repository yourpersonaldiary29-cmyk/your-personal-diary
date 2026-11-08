/** bg - calendar messages. Keys are prefixed 'calendar.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Calendar page (src/pages/CalendarPage.tsx) -------------------------------------------
  'calendar.title': 'Календар',
  'calendar.nav.previousMonth': 'Предишен месец',
  'calendar.nav.nextMonth': 'Следващ месец',
  'calendar.nav.label': 'Навигация в календара',
  'calendar.select.month': 'Месец',
  'calendar.select.year': 'Година',
  // The calendar-system select ("Gregorian / Hebrew / Hijri"); it decides the day numbers and the holidays of the grid
  'calendar.select.system': 'Календар',
  'calendar.system.gregorian': 'Григориански',
  'calendar.system.hebrew': 'Еврейски',
  'calendar.system.hijri': 'Ислямски (хиджра)',
  // {label} = one of the calendar.system.* names
  'calendar.system.unsupported': '{label} (не се поддържа в този браузър)',
  'calendar.system.legend':
    'Показан календар: {label}. Номерата на дните и празниците следват този календар; обхватът на месеца в другите календари е посочен над таблицата.',

  // The month's span in the two calendars that are NOT the selected one: one full sentence each, shown above the table.
  // {month} = the month title ("Tishri 5787", "September 2026"); the "Lead" forms open the line with it.
  // Gregorian span: {from} / {to} = civil dates in the language's numeric form ("12/09/2026"; "12.09.2026" in Hebrew)
  'calendar.span.gregorian': '{month}: от {from} до {to}',
  // Hebrew span: {from} / {to} = full Hebrew dates ("19 Elul 5786")
  'calendar.span.hebrewLead': '{month} по еврейския календар: от {from} до {to}',
  'calendar.span.hebrew': 'По еврейския календар: от {from} до {to}',
  // Hijri span: {from} / {to} = full Hijri dates ("1 Rabiʻ II 1448")
  'calendar.span.hijriLead': '{month} по календара хиджра: от {from} до {to}',
  'calendar.span.hijri': 'По календара хиджра: от {from} до {to}',

  // Month grid cells ---------------------------------------------------------------------
  // Short metric texts printed in a cell ("Md 7 · En 6"); the legend below explains them
  'calendar.cell.mood': 'Н {value}',
  'calendar.cell.energy': 'Е {value}',
  'calendar.cell.habits': 'Навици {done}/{total}',
  // Visible marker of a day with entries ("● entry" / "● 3 entries")
  'calendar.cell.entryMarker': '● {count, plural, one {# запис} other {# записа}}',
  // Accessible name of a cell: "{weekday} {date}" then ": " then the details
  // {weekday} = "Monday", {date} = "7 September" or the full date in the selected calendar ("1 Tishri 5787")
  'calendar.cell.date': '{weekday}, {date}',
  // {details} = comma-separated list: the holidays of the selected calendar, mood, energy, habits, entries
  'calendar.cell.aria': '{date}: {details}',
  'calendar.cell.ariaToday': 'Днес, {date}: {details}',
  'calendar.cell.hasEntry': '{count, plural, one {има запис} other {# записа}}',
  'calendar.cell.habitsDone': 'изпълнени навици: {done} от {total}',
  'calendar.cell.noData': 'няма данни',
  'calendar.legend':
    'Легенда: Н = средно настроение, Е = средна енергия, Навици = изпълнени от всички навици. ● отбелязва ден със запис.',
  'calendar.keyboardHint':
    'Навигация с клавиатурата: стрелките местят между дните, Home/End - към началото и края на седмицата, PageUp/PageDown - между месеците, Enter отваря обобщението на деня.',

  // Holidays and the selected calendar's date (src/pages/entries/CalendarExtras.tsx, DayPage.tsx, EntryPage.tsx)
  // Day page subtitle: {value} = the full date in that calendar
  'calendar.extras.hebrewDateValue': 'Дата по еврейския календар: {value}',
  'calendar.extras.hijriDateValue': 'Дата по ислямския календар (хиджра): {value}',
  'calendar.extras.holidaysHeading': 'Празници и паметни дати',
  // "+N" badge when a cell has more holidays than it can show, and its tooltip
  'calendar.extras.more': '+{count}',
  // {names} = comma-separated holiday names
  'calendar.extras.moreTitle': 'И още {count}: {names}',
  'calendar.extras.legendTitle': 'Легенда на празниците',
  'calendar.extras.hijriNote':
    'Ислямските дати и празници следват календара Умм ал-Кура и може да се изместят с един ден.',
  // Shown when the remembered calendar is unavailable in this browser (the Gregorian calendar is shown instead)
  'calendar.extras.hebrewUnsupported':
    'Този браузър не поддържа еврейския календар, затова еврейската дата и еврейските празници не се показват.',
  'calendar.extras.hijriUnsupported':
    'Този браузър не поддържа календара хиджра, затова датата по хиджра и мюсюлманските празници не се показват.',
  // Multi-day holidays: "Day 2 of 8"
  'calendar.extras.dayOf': 'Ден {index} от {count}',
};
export default messages;
