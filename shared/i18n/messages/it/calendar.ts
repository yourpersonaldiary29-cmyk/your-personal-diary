/** it - calendar messages. Keys are prefixed 'calendar.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Calendar page (src/pages/CalendarPage.tsx) -------------------------------------------
  'calendar.title': 'Calendario',
  'calendar.nav.previousMonth': 'Mese precedente',
  'calendar.nav.nextMonth': 'Mese successivo',
  'calendar.nav.label': 'Navigazione nel calendario',
  'calendar.select.month': 'Mese',
  'calendar.select.year': 'Anno',
  // The calendar-system select ("Gregorian / Hebrew / Hijri"); it decides the day numbers and the holidays of the grid
  'calendar.select.system': 'Calendario',
  'calendar.system.gregorian': 'Gregoriano',
  'calendar.system.hebrew': 'Ebraico',
  'calendar.system.hijri': 'Islamico (Egira)',
  // {label} = one of the calendar.system.* names
  'calendar.system.unsupported': '{label} (non supportato da questo browser)',
  'calendar.system.legend':
    'Calendario visualizzato: {label}. I numeri dei giorni e le festività seguono questo calendario; la corrispondenza del mese negli altri calendari compare sopra la tabella.',

  // The month's span in the two calendars that are NOT the selected one: one full sentence each, shown above the table.
  // {month} = the month title ("Tishri 5787", "September 2026"); the "Lead" forms open the line with it.
  // Gregorian span: {from} / {to} = civil dates in the language's numeric form ("12/09/2026"; "12.09.2026" in Hebrew)
  'calendar.span.gregorian': '{month} va dal {from} al {to}',
  // Hebrew span: {from} / {to} = full Hebrew dates ("19 Elul 5786")
  'calendar.span.hebrewLead': '{month} nel calendario ebraico: dal {from} al {to}',
  'calendar.span.hebrew': 'Nel calendario ebraico: dal {from} al {to}',
  // Hijri span: {from} / {to} = full Hijri dates ("1 Rabiʻ II 1448")
  'calendar.span.hijriLead': '{month} nel calendario islamico: dal {from} al {to}',
  'calendar.span.hijri': 'Nel calendario islamico: dal {from} al {to}',

  // Month grid cells ---------------------------------------------------------------------
  // Short metric texts printed in a cell ("Md 7 · En 6"); the legend below explains them
  'calendar.cell.mood': 'Um {value}',
  'calendar.cell.energy': 'En {value}',
  'calendar.cell.habits': 'Ab. {done}/{total}',
  // Visible marker of a day with entries ("● entry" / "● 3 entries")
  'calendar.cell.entryMarker': '● {count, plural, one {# voce} other {# voci}}',
  // Accessible name of a cell: "{weekday} {date}" then ": " then the details
  // {weekday} = "Monday", {date} = "7 September" or the full date in the selected calendar ("1 Tishri 5787")
  'calendar.cell.date': '{weekday} {date}',
  // {details} = comma-separated list: the holidays of the selected calendar, mood, energy, habits, entries
  'calendar.cell.aria': '{date}: {details}',
  'calendar.cell.ariaToday': 'Oggi, {date}: {details}',
  'calendar.cell.hasEntry': '{count, plural, one {una voce} other {# voci}}',
  'calendar.cell.habitsDone': 'abitudini completate: {done} su {total}',
  'calendar.cell.noData': 'nessun dato',
  'calendar.legend': 'Legenda: Um = umore medio, En = energia media, Ab. = abitudini completate sul totale. ● indica un giorno con una voce.',
  'calendar.keyboardHint':
    'Navigazione da tastiera: le frecce spostano tra i giorni, Home/Fine vanno all’inizio e alla fine della settimana, PagSu/PagGiù cambiano mese, Invio apre il riepilogo della giornata.',

  // Holidays and the selected calendar's date (src/pages/entries/CalendarExtras.tsx, DayPage.tsx, EntryPage.tsx)
  // Day page subtitle: {value} = the full date in that calendar
  'calendar.extras.hebrewDateValue': 'Data ebraica: {value}',
  'calendar.extras.hijriDateValue': 'Data islamica (Egira): {value}',
  'calendar.extras.holidaysHeading': 'Festività e ricorrenze',
  // "+N" badge when a cell has more holidays than it can show, and its tooltip
  'calendar.extras.more': '+{count}',
  // {names} = comma-separated holiday names
  'calendar.extras.moreTitle': 'E altre {count}: {names}',
  'calendar.extras.legendTitle': 'Legenda delle festività',
  'calendar.extras.hijriNote': 'Le date e le festività islamiche seguono il calendario Umm al-Qura e possono variare di un giorno.',
  // Shown when the remembered calendar is unavailable in this browser (the Gregorian calendar is shown instead)
  'calendar.extras.hebrewUnsupported':
    'Questo browser non supporta il calendario ebraico, perciò la data ebraica e le festività ebraiche non vengono mostrate.',
  'calendar.extras.hijriUnsupported':
    'Questo browser non supporta il calendario islamico, perciò la data islamica e le festività musulmane non vengono mostrate.',
  // Multi-day holidays: "Day 2 of 8"
  'calendar.extras.dayOf': 'Giorno {index} di {count}',
};
export default messages;
