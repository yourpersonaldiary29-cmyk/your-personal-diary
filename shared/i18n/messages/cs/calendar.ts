/** cs - calendar messages. Keys are prefixed 'calendar.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Calendar page (src/pages/CalendarPage.tsx) -------------------------------------------
  'calendar.title': 'Kalendář',
  'calendar.nav.previousMonth': 'Předchozí měsíc',
  'calendar.nav.nextMonth': 'Další měsíc',
  'calendar.nav.label': 'Navigace v kalendáři',
  'calendar.select.month': 'Měsíc',
  'calendar.select.year': 'Rok',
  'calendar.select.system': 'Kalendář',
  'calendar.system.gregorian': 'Gregoriánský',
  'calendar.system.hebrew': 'Židovský',
  'calendar.system.hijri': 'Hidžra (islámský)',
  'calendar.system.unsupported': '{label} (v tomto prohlížeči nepodporováno)',
  'calendar.system.legend':
    'Zobrazený kalendář: {label}. Čísla dnů a svátky se řídí tímto kalendářem; rozsah měsíce v ostatních kalendářích je uveden nad tabulkou.',

  // The month's span in the two calendars that are NOT the selected one
  'calendar.span.gregorian': '{month} trvá od {from} do {to}',
  'calendar.span.hebrewLead': '{month} v židovském kalendáři: od {from} do {to}',
  'calendar.span.hebrew': 'V židovském kalendáři: od {from} do {to}',
  'calendar.span.hijriLead': '{month} v islámském kalendáři: od {from} do {to}',
  'calendar.span.hijri': 'V islámském kalendáři: od {from} do {to}',

  // Month grid cells ---------------------------------------------------------------------
  'calendar.cell.mood': 'Nál {value}',
  'calendar.cell.energy': 'En {value}',
  'calendar.cell.habits': 'Návyky {done}/{total}',
  'calendar.cell.entryMarker': '● {count, plural, one {# záznam} few {# záznamy} many {# záznamu} other {# záznamů}}',
  'calendar.cell.date': '{weekday} {date}',
  'calendar.cell.aria': '{date}: {details}',
  'calendar.cell.ariaToday': 'Dnes, {date}: {details}',
  'calendar.cell.hasEntry': '{count, plural, one {je tu záznam} few {# záznamy} many {# záznamu} other {# záznamů}}',
  'calendar.cell.habitsDone': 'návyky: splněno {done} z {total}',
  'calendar.cell.noData': 'žádná data',
  'calendar.legend': 'Legenda: Nál = průměrná nálada, En = průměrná energie, Návyky = splněné ze všech návyků. ● označuje den se záznamem.',
  'calendar.keyboardHint':
    'Ovládání klávesnicí: šipky přecházejí mezi dny, Home/End na začátek a konec týdne, PageUp/PageDown mezi měsíci, Enter otevře přehled dne.',

  // Holidays and the selected calendar's date (src/pages/entries/CalendarExtras.tsx, DayPage.tsx, EntryPage.tsx)
  'calendar.extras.hebrewDateValue': 'Židovské datum: {value}',
  'calendar.extras.hijriDateValue': 'Islámské datum (hidžra): {value}',
  'calendar.extras.holidaysHeading': 'Svátky a významné dny',
  'calendar.extras.more': '+{count}',
  'calendar.extras.moreTitle': 'A ještě {count}: {names}',
  'calendar.extras.legendTitle': 'Legenda svátků',
  'calendar.extras.hijriNote': 'Islámská data a svátky se řídí kalendářem Umm al-Kurá a mohou se posunout o jeden den.',
  'calendar.extras.hebrewUnsupported':
    'Tento prohlížeč nepodporuje židovský kalendář, proto se židovské datum ani židovské svátky nezobrazují.',
  'calendar.extras.hijriUnsupported':
    'Tento prohlížeč nepodporuje islámský kalendář, proto se islámské datum ani muslimské svátky nezobrazují.',
  'calendar.extras.dayOf': 'Den {index} z {count}',
};
export default messages;
