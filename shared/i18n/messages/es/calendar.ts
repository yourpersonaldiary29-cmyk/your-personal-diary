/** es - calendar messages. Keys are prefixed 'calendar.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Calendar page (src/pages/CalendarPage.tsx) -------------------------------------------
  'calendar.title': 'Calendario',
  'calendar.nav.previousMonth': 'Mes anterior',
  'calendar.nav.nextMonth': 'Mes siguiente',
  'calendar.nav.label': 'Navegación del calendario',
  'calendar.select.month': 'Mes',
  'calendar.select.year': 'Año',
  // The calendar-system select ("Gregorian / Hebrew / Hijri"); it decides the day numbers and the holidays of the grid
  'calendar.select.system': 'Calendario',
  'calendar.system.gregorian': 'Gregoriano',
  'calendar.system.hebrew': 'Hebreo',
  'calendar.system.hijri': 'Hégira (islámico)',
  // {label} = one of the calendar.system.* names
  'calendar.system.unsupported': '{label} (no compatible con este navegador)',
  'calendar.system.legend':
    'Calendario mostrado: {label}. Los números de los días y las festividades siguen este calendario; el intervalo del mes en los otros calendarios aparece encima de la tabla.',

  // The month's span in the two calendars that are NOT the selected one: one full sentence each, shown above the table.
  // {month} = the month title ("Tishri 5787", "September 2026"); the "Lead" forms open the line with it.
  // Gregorian span: {from} / {to} = civil dates in the language's numeric form ("12/09/2026"; "12.09.2026" in Hebrew)
  'calendar.span.gregorian': '{month} va del {from} al {to}',
  // Hebrew span: {from} / {to} = full Hebrew dates ("19 Elul 5786")
  'calendar.span.hebrewLead': '{month} en el calendario hebreo: del {from} al {to}',
  'calendar.span.hebrew': 'En el calendario hebreo: del {from} al {to}',
  // Hijri span: {from} / {to} = full Hijri dates ("1 Rabiʻ II 1448")
  'calendar.span.hijriLead': '{month} en el calendario de la Hégira: del {from} al {to}',
  'calendar.span.hijri': 'En el calendario de la Hégira: del {from} al {to}',

  // Month grid cells ---------------------------------------------------------------------
  // Short metric texts printed in a cell ("Md 7 · En 6"); the legend below explains them
  'calendar.cell.mood': 'Án {value}',
  'calendar.cell.energy': 'En {value}',
  'calendar.cell.habits': 'Hábitos {done}/{total}',
  // Visible marker of a day with entries ("● entry" / "● 3 entries")
  'calendar.cell.entryMarker': '● {count, plural, one {# entrada} other {# entradas}}',
  // Accessible name of a cell: "{weekday} {date}" then ": " then the details
  // {weekday} = "Monday", {date} = "7 September" or the full date in the selected calendar ("1 Tishri 5787")
  'calendar.cell.date': '{weekday}, {date}',
  // {details} = comma-separated list: the holidays of the selected calendar, mood, energy, habits, entries
  'calendar.cell.aria': '{date}: {details}',
  'calendar.cell.ariaToday': 'Hoy, {date}: {details}',
  'calendar.cell.hasEntry': '{count, plural, one {tiene una entrada} other {# entradas}}',
  'calendar.cell.habitsDone': '{done} de {total} hábitos completados',
  'calendar.cell.noData': 'sin datos',
  'calendar.legend':
    'Leyenda: Án = estado de ánimo medio, En = energía media, Hábitos = completados sobre el total de hábitos. ● marca un día con alguna entrada.',
  'calendar.keyboardHint':
    'Navegación con el teclado: las flechas mueven entre días, Inicio/Fin llevan al principio y al final de la semana, RePág/AvPág cambian de mes e Intro abre el resumen del día.',

  // Holidays and the selected calendar's date (src/pages/entries/CalendarExtras.tsx, DayPage.tsx, EntryPage.tsx)
  // Day page subtitle: {value} = the full date in that calendar
  'calendar.extras.hebrewDateValue': 'Fecha hebrea: {value}',
  'calendar.extras.hijriDateValue': 'Fecha de la Hégira (islámica): {value}',
  'calendar.extras.holidaysHeading': 'Festividades y celebraciones',
  // "+N" badge when a cell has more holidays than it can show, and its tooltip
  'calendar.extras.more': '+{count}',
  // {names} = comma-separated holiday names
  'calendar.extras.moreTitle': 'Y {count} más: {names}',
  'calendar.extras.legendTitle': 'Leyenda de festividades',
  'calendar.extras.hijriNote': 'Las fechas y festividades islámicas siguen el calendario Umm al-Qura y pueden variar en un día.',
  // Shown when the remembered calendar is unavailable in this browser (the Gregorian calendar is shown instead)
  'calendar.extras.hebrewUnsupported':
    'Este navegador no es compatible con el calendario hebreo, así que no se muestran la fecha hebrea ni las festividades judías.',
  'calendar.extras.hijriUnsupported':
    'Este navegador no es compatible con el calendario de la Hégira, así que no se muestran la fecha de la Hégira ni las festividades musulmanas.',
  // Multi-day holidays: "Day 2 of 8"
  'calendar.extras.dayOf': 'Día {index} de {count}',
};
export default messages;
