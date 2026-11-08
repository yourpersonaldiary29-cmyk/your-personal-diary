/** ro - calendar messages. Keys are prefixed 'calendar.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Calendar page (src/pages/CalendarPage.tsx) -------------------------------------------
  'calendar.title': 'Calendar',
  'calendar.nav.previousMonth': 'Luna anterioară',
  'calendar.nav.nextMonth': 'Luna următoare',
  'calendar.nav.label': 'Navigare în calendar',
  'calendar.select.month': 'Luna',
  'calendar.select.year': 'Anul',
  'calendar.select.system': 'Calendar',
  'calendar.system.gregorian': 'Gregorian',
  'calendar.system.hebrew': 'Ebraic',
  'calendar.system.hijri': 'Hijri (islamic)',
  'calendar.system.unsupported': '{label} (nu este acceptat în acest browser)',
  'calendar.system.legend':
    'Calendar afișat: {label}. Numerele zilelor și sărbătorile urmează acest calendar; intervalul lunii în celelalte calendare apare deasupra tabelului.',

  // The month's span in the two calendars that are NOT the selected one
  'calendar.span.gregorian': '{month} se întinde de la {from} până la {to}',
  'calendar.span.hebrewLead': '{month} în calendarul ebraic: de la {from} până la {to}',
  'calendar.span.hebrew': 'În calendarul ebraic: de la {from} până la {to}',
  'calendar.span.hijriLead': '{month} în calendarul hijri: de la {from} până la {to}',
  'calendar.span.hijri': 'În calendarul hijri: de la {from} până la {to}',

  // Month grid cells ---------------------------------------------------------------------
  'calendar.cell.mood': 'Dp {value}',
  'calendar.cell.energy': 'En {value}',
  'calendar.cell.habits': 'Ob. {done}/{total}',
  'calendar.cell.entryMarker': '● {count, plural, one {# însemnare} few {# însemnări} other {# de însemnări}}',
  'calendar.cell.date': '{weekday}, {date}',
  'calendar.cell.aria': '{date}: {details}',
  'calendar.cell.ariaToday': 'Astăzi, {date}: {details}',
  'calendar.cell.hasEntry': '{count, plural, one {are o însemnare} few {# însemnări} other {# de însemnări}}',
  'calendar.cell.habitsDone':
    '{done} din {total, plural, one {# obicei îndeplinit} few {# obiceiuri îndeplinite} other {# de obiceiuri îndeplinite}}',
  'calendar.cell.noData': 'fără date',
  'calendar.legend':
    'Legendă: Dp = dispoziția medie, En = energia medie, Ob. = obiceiuri îndeplinite din total. ● marchează o zi cu însemnare.',
  'calendar.keyboardHint':
    'Navigare cu tastatura: săgețile te mută de la o zi la alta, Home/End la începutul și sfârșitul săptămânii, PageUp/PageDown de la o lună la alta, iar Enter deschide rezumatul zilei.',

  // Holidays and the selected calendar's date (src/pages/entries/CalendarExtras.tsx, DayPage.tsx, EntryPage.tsx)
  'calendar.extras.hebrewDateValue': 'Data ebraică: {value}',
  'calendar.extras.hijriDateValue': 'Data hijri (islamică): {value}',
  'calendar.extras.holidaysHeading': 'Sărbători și zile speciale',
  'calendar.extras.more': '+{count}',
  'calendar.extras.moreTitle': 'Încă {count}: {names}',
  'calendar.extras.legendTitle': 'Legenda sărbătorilor',
  'calendar.extras.hijriNote': 'Datele și sărbătorile islamice urmează calendarul Umm al-Qura și pot varia cu o zi.',
  'calendar.extras.hebrewUnsupported':
    'Acest browser nu acceptă calendarul ebraic, de aceea data ebraică și sărbătorile evreiești nu sunt afișate.',
  'calendar.extras.hijriUnsupported':
    'Acest browser nu acceptă calendarul hijri, de aceea data hijri și sărbătorile musulmane nu sunt afișate.',
  'calendar.extras.dayOf': 'Ziua {index} din {count}',
};
export default messages;
