/** ru - calendar messages. Keys are prefixed 'calendar.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Calendar page (src/pages/CalendarPage.tsx) -------------------------------------------
  'calendar.title': 'Календарь',
  'calendar.nav.previousMonth': 'Предыдущий месяц',
  'calendar.nav.nextMonth': 'Следующий месяц',
  'calendar.nav.label': 'Навигация по календарю',
  'calendar.select.month': 'Месяц',
  'calendar.select.year': 'Год',
  // The calendar-system select ("Gregorian / Hebrew / Hijri"); it decides the day numbers and the holidays of the grid
  'calendar.select.system': 'Календарь',
  'calendar.system.gregorian': 'Григорианский',
  'calendar.system.hebrew': 'Еврейский',
  'calendar.system.hijri': 'Исламский (хиджра)',
  // {label} = one of the calendar.system.* names
  'calendar.system.unsupported': '{label} (не поддерживается в этом браузере)',
  'calendar.system.legend':
    'Показан календарь: {label}. Номера дней и праздники соответствуют этому календарю; границы месяца в других календарях указаны над таблицей.',

  // The month's span in the two calendars that are NOT the selected one: one full sentence each, shown above the table.
  // {month} = the month title ("Tishri 5787", "September 2026"); the "Lead" forms open the line with it.
  // Gregorian span: {from} / {to} = civil dates in the language's numeric form ("12/09/2026"; "12.09.2026" in Hebrew)
  'calendar.span.gregorian': '{month}: с {from} по {to}',
  // Hebrew span: {from} / {to} = full Hebrew dates ("19 Elul 5786")
  'calendar.span.hebrewLead': '{month} по еврейскому календарю: с {from} по {to}',
  'calendar.span.hebrew': 'По еврейскому календарю: с {from} по {to}',
  // Hijri span: {from} / {to} = full Hijri dates ("1 Rabiʻ II 1448")
  'calendar.span.hijriLead': '{month} по календарю хиджры: с {from} по {to}',
  'calendar.span.hijri': 'По календарю хиджры: с {from} по {to}',

  // Month grid cells ---------------------------------------------------------------------
  // Short metric texts printed in a cell ("Md 7 · En 6"); the legend below explains them
  'calendar.cell.mood': 'Н {value}',
  'calendar.cell.energy': 'Э {value}',
  'calendar.cell.habits': 'Привычки {done}/{total}',
  // Visible marker of a day with entries ("● entry" / "● 3 entries")
  'calendar.cell.entryMarker': '● {count, plural, one {# запись} few {# записи} many {# записей} other {# записи}}',
  // Accessible name of a cell: "{weekday} {date}" then ": " then the details
  // {weekday} = "Monday", {date} = "7 September" or the full date in the selected calendar ("1 Tishri 5787")
  'calendar.cell.date': '{weekday}, {date}',
  // {details} = comma-separated list: the holidays of the selected calendar, mood, energy, habits, entries
  'calendar.cell.aria': '{date}: {details}',
  'calendar.cell.ariaToday': 'Сегодня, {date}: {details}',
  'calendar.cell.hasEntry':
    '{count, plural, =1 {есть запись} one {# запись} few {# записи} many {# записей} other {# записи}}',
  'calendar.cell.habitsDone': 'выполнено привычек: {done} из {total}',
  'calendar.cell.noData': 'нет данных',
  'calendar.legend':
    'Обозначения: Н - среднее настроение, Э - средняя энергия, Привычки - выполнено из всех привычек. ● отмечает день с записью.',
  'calendar.keyboardHint':
    'Управление с клавиатуры: стрелки - переход между днями, Home/End - к началу и концу недели, PageUp/PageDown - между месяцами, Enter открывает итоги дня.',

  // Holidays and the selected calendar's date (src/pages/entries/CalendarExtras.tsx, DayPage.tsx, EntryPage.tsx)
  // Day page subtitle: {value} = the full date in that calendar
  'calendar.extras.hebrewDateValue': 'Дата по еврейскому календарю: {value}',
  'calendar.extras.hijriDateValue': 'Дата по исламскому календарю (хиджра): {value}',
  'calendar.extras.holidaysHeading': 'Праздники и памятные даты',
  // "+N" badge when a cell has more holidays than it can show, and its tooltip
  'calendar.extras.more': '+{count}',
  // {names} = comma-separated holiday names
  'calendar.extras.moreTitle': 'И ещё {count}: {names}',
  'calendar.extras.legendTitle': 'Обозначения праздников',
  'calendar.extras.hijriNote':
    'Исламские даты и праздники указаны по календарю Умм аль-Кура и могут сдвигаться на один день.',
  // Shown when the remembered calendar is unavailable in this browser (the Gregorian calendar is shown instead)
  'calendar.extras.hebrewUnsupported':
    'Этот браузер не поддерживает еврейский календарь, поэтому еврейская дата и еврейские праздники не показаны.',
  'calendar.extras.hijriUnsupported':
    'Этот браузер не поддерживает календарь хиджры, поэтому дата по хиджре и мусульманские праздники не показаны.',
  // Multi-day holidays: "Day 2 of 8"
  'calendar.extras.dayOf': 'День {index} из {count}',
};
export default messages;
