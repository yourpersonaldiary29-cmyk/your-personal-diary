/** pl - calendar messages. Keys are prefixed 'calendar.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Calendar page (src/pages/CalendarPage.tsx) -------------------------------------------
  'calendar.title': 'Kalendarz',
  'calendar.nav.previousMonth': 'Poprzedni miesiąc',
  'calendar.nav.nextMonth': 'Następny miesiąc',
  'calendar.nav.label': 'Nawigacja kalendarza',
  'calendar.select.month': 'Miesiąc',
  'calendar.select.year': 'Rok',
  // The calendar-system select ("Gregorian / Hebrew / Hijri"); it decides the day numbers and the holidays of the grid
  'calendar.select.system': 'Kalendarz',
  'calendar.system.gregorian': 'Gregoriański',
  'calendar.system.hebrew': 'Hebrajski',
  'calendar.system.hijri': 'Hidżry (muzułmański)',
  // {label} = one of the calendar.system.* names
  'calendar.system.unsupported': '{label} (nieobsługiwany w tej przeglądarce)',
  'calendar.system.legend':
    'Wyświetlany kalendarz: {label}. Numery dni i święta są zgodne z tym kalendarzem; zakres miesiąca w pozostałych kalendarzach widać nad tabelą.',

  // The month's span in the two calendars that are NOT the selected one: one full sentence each, shown above the table.
  // {month} = the month title ("Tishri 5787", "September 2026"); the "Lead" forms open the line with it.
  'calendar.span.gregorian': '{month} trwa od {from} do {to}',
  'calendar.span.hebrewLead': '{month} w kalendarzu hebrajskim: od {from} do {to}',
  'calendar.span.hebrew': 'W kalendarzu hebrajskim: od {from} do {to}',
  'calendar.span.hijriLead': '{month} w kalendarzu hidżry: od {from} do {to}',
  'calendar.span.hijri': 'W kalendarzu hidżry: od {from} do {to}',

  // Month grid cells ---------------------------------------------------------------------
  // Short metric texts printed in a cell ("Ns 7 · En 6"); the legend below explains them
  'calendar.cell.mood': 'Ns {value}',
  'calendar.cell.energy': 'En {value}',
  'calendar.cell.habits': 'Nawyki {done}/{total}',
  'calendar.cell.entryMarker': '● {count, plural, one {# wpis} few {# wpisy} many {# wpisów} other {# wpisu}}',
  'calendar.cell.date': '{weekday}, {date}',
  'calendar.cell.aria': '{date}: {details}',
  'calendar.cell.ariaToday': 'Dzisiaj, {date}: {details}',
  'calendar.cell.hasEntry': '{count, plural, one {jest wpis} few {# wpisy} many {# wpisów} other {# wpisu}}',
  'calendar.cell.habitsDone': 'wykonane nawyki: {done} z {total}',
  'calendar.cell.noData': 'brak danych',
  'calendar.legend':
    'Legenda: Ns = średni nastrój, En = średnia energia, Nawyki = wykonane spośród wszystkich nawyków. ● oznacza dzień z wpisem.',
  'calendar.keyboardHint':
    'Nawigacja klawiaturą: strzałki przenoszą między dniami, Home/End – na początek i koniec tygodnia, PageUp/PageDown – między miesiącami, Enter otwiera podsumowanie dnia.',

  // Holidays and the selected calendar's date (src/pages/entries/CalendarExtras.tsx, DayPage.tsx, EntryPage.tsx)
  'calendar.extras.hebrewDateValue': 'Data hebrajska: {value}',
  'calendar.extras.hijriDateValue': 'Data według kalendarza hidżry: {value}',
  'calendar.extras.holidaysHeading': 'Święta i dni szczególne',
  'calendar.extras.more': '+{count}',
  'calendar.extras.moreTitle': 'I jeszcze {count}: {names}',
  'calendar.extras.legendTitle': 'Legenda świąt',
  'calendar.extras.hijriNote': 'Daty i święta muzułmańskie są zgodne z kalendarzem Umm al-Kura i mogą się przesunąć o jeden dzień.',
  'calendar.extras.hebrewUnsupported':
    'Ta przeglądarka nie obsługuje kalendarza hebrajskiego, dlatego data hebrajska i święta żydowskie nie są wyświetlane.',
  'calendar.extras.hijriUnsupported':
    'Ta przeglądarka nie obsługuje kalendarza hidżry, dlatego data hidżry i święta muzułmańskie nie są wyświetlane.',
  // Multi-day holidays: "Day 2 of 8"
  'calendar.extras.dayOf': 'Dzień {index} z {count}',
};
export default messages;
