/** fr - calendar messages. Keys are prefixed 'calendar.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Calendar page (src/pages/CalendarPage.tsx) -------------------------------------------
  'calendar.title': 'Calendrier',
  'calendar.nav.previousMonth': 'Mois précédent',
  'calendar.nav.nextMonth': 'Mois suivant',
  'calendar.nav.label': 'Navigation dans le calendrier',
  'calendar.select.month': 'Mois',
  'calendar.select.year': 'Année',
  // The calendar-system select ("Gregorian / Hebrew / Hijri"); it decides the day numbers and the holidays of the grid
  'calendar.select.system': 'Calendrier',
  'calendar.system.gregorian': 'Grégorien',
  'calendar.system.hebrew': 'Hébraïque',
  'calendar.system.hijri': 'Hégirien (islamique)',
  // {label} = one of the calendar.system.* names
  'calendar.system.unsupported': '{label} (non pris en charge par ce navigateur)',
  'calendar.system.legend':
    'Calendrier affiché : {label}. Les numéros des jours et les fêtes suivent ce calendrier ; la correspondance du mois dans les autres calendriers apparaît au-dessus du tableau.',

  // The month's span in the two calendars that are NOT the selected one: one full sentence each, shown above the table.
  // {month} = the month title ("Tishri 5787", "September 2026"); the "Lead" forms open the line with it.
  // Gregorian span: {from} / {to} = civil dates in the language's numeric form ("12/09/2026"; "12.09.2026" in Hebrew)
  'calendar.span.gregorian': '{month} s’étend du {from} au {to}',
  // Hebrew span: {from} / {to} = full Hebrew dates ("19 Elul 5786")
  'calendar.span.hebrewLead': '{month} dans le calendrier hébraïque : du {from} au {to}',
  'calendar.span.hebrew': 'Dans le calendrier hébraïque : du {from} au {to}',
  // Hijri span: {from} / {to} = full Hijri dates ("1 Rabiʻ II 1448")
  'calendar.span.hijriLead': '{month} dans le calendrier hégirien : du {from} au {to}',
  'calendar.span.hijri': 'Dans le calendrier hégirien : du {from} au {to}',

  // Month grid cells ---------------------------------------------------------------------
  // Short metric texts printed in a cell ("Md 7 · En 6"); the legend below explains them
  'calendar.cell.mood': 'Hu {value}',
  'calendar.cell.energy': 'Én {value}',
  'calendar.cell.habits': 'Hab. {done}/{total}',
  // Visible marker of a day with entries ("● entry" / "● 3 entries")
  'calendar.cell.entryMarker': '● {count, plural, one {# entrée} other {# entrées}}',
  // Accessible name of a cell: "{weekday} {date}" then ": " then the details
  // {weekday} = "Monday", {date} = "7 September" or the full date in the selected calendar ("1 Tishri 5787")
  'calendar.cell.date': '{weekday} {date}',
  // {details} = comma-separated list: the holidays of the selected calendar, mood, energy, habits, entries
  'calendar.cell.aria': '{date} : {details}',
  'calendar.cell.ariaToday': 'Aujourd’hui, {date} : {details}',
  'calendar.cell.hasEntry': '{count, plural, =1 {une entrée} one {# entrée} other {# entrées}}',
  'calendar.cell.habitsDone': 'habitudes accomplies : {done} sur {total}',
  'calendar.cell.noData': 'aucune donnée',
  'calendar.legend': 'Légende : Hu = humeur moyenne, Én = énergie moyenne, Hab. = habitudes accomplies sur l’ensemble des habitudes. ● signale un jour avec une entrée.',
  'calendar.keyboardHint':
    'Navigation au clavier : les flèches passent d’un jour à l’autre, Origine/Fin vont au début et à la fin de la semaine, Page préc./Page suiv. changent de mois, Entrée ouvre le résumé de la journée.',

  // Holidays and the selected calendar's date (src/pages/entries/CalendarExtras.tsx, DayPage.tsx, EntryPage.tsx)
  // Day page subtitle: {value} = the full date in that calendar
  'calendar.extras.hebrewDateValue': 'Date hébraïque : {value}',
  'calendar.extras.hijriDateValue': 'Date hégirienne (islamique) : {value}',
  'calendar.extras.holidaysHeading': 'Fêtes et commémorations',
  // "+N" badge when a cell has more holidays than it can show, and its tooltip
  'calendar.extras.more': '+{count}',
  // {names} = comma-separated holiday names
  'calendar.extras.moreTitle': 'Et {count} de plus : {names}',
  'calendar.extras.legendTitle': 'Légende des fêtes',
  'calendar.extras.hijriNote': 'Les dates et les fêtes islamiques suivent le calendrier Umm al-Qura et peuvent varier d’un jour.',
  // Shown when the remembered calendar is unavailable in this browser (the Gregorian calendar is shown instead)
  'calendar.extras.hebrewUnsupported':
    'Ce navigateur ne prend pas en charge le calendrier hébraïque : la date hébraïque et les fêtes juives ne sont donc pas affichées.',
  'calendar.extras.hijriUnsupported':
    'Ce navigateur ne prend pas en charge le calendrier hégirien : la date hégirienne et les fêtes musulmanes ne sont donc pas affichées.',
  // Multi-day holidays: "Day 2 of 8"
  'calendar.extras.dayOf': 'Jour {index} sur {count}',
};
export default messages;
