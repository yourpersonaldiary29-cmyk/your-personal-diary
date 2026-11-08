/** pt - calendar messages. Keys are prefixed 'calendar.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Calendar page (src/pages/CalendarPage.tsx) -------------------------------------------
  'calendar.title': 'Calendário',
  'calendar.nav.previousMonth': 'Mês anterior',
  'calendar.nav.nextMonth': 'Mês seguinte',
  'calendar.nav.label': 'Navegação do calendário',
  'calendar.select.month': 'Mês',
  'calendar.select.year': 'Ano',
  // The calendar-system select ("Gregorian / Hebrew / Hijri"); it decides the day numbers and the holidays of the grid
  'calendar.select.system': 'Calendário',
  'calendar.system.gregorian': 'Gregoriano',
  'calendar.system.hebrew': 'Hebraico',
  'calendar.system.hijri': 'Hégira (islâmico)',
  // {label} = one of the calendar.system.* names
  'calendar.system.unsupported': '{label} (não suportado neste navegador)',
  'calendar.system.legend':
    'Calendário apresentado: {label}. Os números dos dias e as festividades seguem este calendário; o intervalo do mês nos outros calendários aparece acima da tabela.',

  // The month's span in the two calendars that are NOT the selected one: one full sentence each, shown above the table.
  // {month} = the month title ("Tishri 5787", "September 2026"); the "Lead" forms open the line with it.
  // Gregorian span: {from} / {to} = civil dates in the language's numeric form ("12/09/2026"; "12.09.2026" in Hebrew)
  'calendar.span.gregorian': '{month} decorre de {from} a {to}',
  // Hebrew span: {from} / {to} = full Hebrew dates ("19 Elul 5786")
  'calendar.span.hebrewLead': '{month} no calendário hebraico: de {from} a {to}',
  'calendar.span.hebrew': 'No calendário hebraico: de {from} a {to}',
  // Hijri span: {from} / {to} = full Hijri dates ("1 Rabiʻ II 1448")
  'calendar.span.hijriLead': '{month} no calendário da Hégira: de {from} a {to}',
  'calendar.span.hijri': 'No calendário da Hégira: de {from} a {to}',

  // Month grid cells ---------------------------------------------------------------------
  // Short metric texts printed in a cell ("Md 7 · En 6"); the legend below explains them
  'calendar.cell.mood': 'Hu {value}',
  'calendar.cell.energy': 'En {value}',
  'calendar.cell.habits': 'Hábitos {done}/{total}',
  // Visible marker of a day with entries ("● entry" / "● 3 entries")
  'calendar.cell.entryMarker': '● {count, plural, one {# entrada} other {# entradas}}',
  // Accessible name of a cell: "{weekday} {date}" then ": " then the details
  // {weekday} = "Monday", {date} = "7 September" or the full date in the selected calendar ("1 Tishri 5787")
  'calendar.cell.date': '{weekday}, {date}',
  // {details} = comma-separated list: the holidays of the selected calendar, mood, energy, habits, entries
  'calendar.cell.aria': '{date}: {details}',
  'calendar.cell.ariaToday': 'Hoje, {date}: {details}',
  'calendar.cell.hasEntry': '{count, plural, one {tem uma entrada} other {# entradas}}',
  'calendar.cell.habitsDone': '{done} de {total} hábitos concluídos',
  'calendar.cell.noData': 'sem dados',
  'calendar.legend':
    'Legenda: Hu = humor médio, En = energia média, Hábitos = concluídos do total de hábitos. ● assinala um dia com pelo menos uma entrada.',
  'calendar.keyboardHint':
    'Navegação por teclado: as setas movem entre dias, Home/End vão para o início e o fim da semana, Page Up/Page Down mudam de mês e Enter abre o resumo do dia.',

  // Holidays and the selected calendar's date (src/pages/entries/CalendarExtras.tsx, DayPage.tsx, EntryPage.tsx)
  // Day page subtitle: {value} = the full date in that calendar
  'calendar.extras.hebrewDateValue': 'Data hebraica: {value}',
  'calendar.extras.hijriDateValue': 'Data da Hégira (islâmica): {value}',
  'calendar.extras.holidaysHeading': 'Festividades e celebrações',
  // "+N" badge when a cell has more holidays than it can show, and its tooltip
  'calendar.extras.more': '+{count}',
  // {names} = comma-separated holiday names
  'calendar.extras.moreTitle': 'E mais {count}: {names}',
  'calendar.extras.legendTitle': 'Legenda das festividades',
  'calendar.extras.hijriNote': 'As datas e festividades islâmicas seguem o calendário Umm al-Qura e podem variar um dia.',
  // Shown when the remembered calendar is unavailable in this browser (the Gregorian calendar is shown instead)
  'calendar.extras.hebrewUnsupported':
    'Este navegador não suporta o calendário hebraico, pelo que a data hebraica e as festividades judaicas não são apresentadas.',
  'calendar.extras.hijriUnsupported':
    'Este navegador não suporta o calendário da Hégira, pelo que a data da Hégira e as festividades muçulmanas não são apresentadas.',
  // Multi-day holidays: "Day 2 of 8"
  'calendar.extras.dayOf': 'Dia {index} de {count}',
};
export default messages;
