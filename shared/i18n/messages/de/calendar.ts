/** de - calendar messages. Keys are prefixed 'calendar.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Calendar page (src/pages/CalendarPage.tsx) -------------------------------------------
  'calendar.title': 'Kalender',
  'calendar.nav.previousMonth': 'Vorheriger Monat',
  'calendar.nav.nextMonth': 'Nächster Monat',
  'calendar.nav.label': 'Kalendernavigation',
  'calendar.select.month': 'Monat',
  'calendar.select.year': 'Jahr',
  'calendar.select.system': 'Kalender',
  'calendar.system.gregorian': 'Gregorianisch',
  'calendar.system.hebrew': 'Hebräisch',
  'calendar.system.hijri': 'Hidschri (islamisch)',
  'calendar.system.unsupported': '{label} (in diesem Browser nicht unterstützt)',
  'calendar.system.legend':
    'Angezeigter Kalender: {label}. Tageszahlen und Feiertage richten sich nach diesem Kalender; der Zeitraum des Monats in den anderen Kalendern steht über der Tabelle.',

  // The month's span in the two calendars that are NOT the selected one
  'calendar.span.gregorian': '{month} reicht vom {from} bis zum {to}',
  'calendar.span.hebrewLead': '{month} im hebräischen Kalender: von {from} bis {to}',
  'calendar.span.hebrew': 'Im hebräischen Kalender: von {from} bis {to}',
  'calendar.span.hijriLead': '{month} im Hidschri-Kalender: von {from} bis {to}',
  'calendar.span.hijri': 'Im Hidschri-Kalender: von {from} bis {to}',

  // Month grid cells ---------------------------------------------------------------------
  'calendar.cell.mood': 'St {value}',
  'calendar.cell.energy': 'En {value}',
  'calendar.cell.habits': 'Gew. {done}/{total}',
  'calendar.cell.entryMarker': '● {count, plural, one {# Eintrag} other {# Einträge}}',
  'calendar.cell.date': '{weekday}, {date}',
  'calendar.cell.aria': '{date}: {details}',
  'calendar.cell.ariaToday': 'Heute, {date}: {details}',
  'calendar.cell.hasEntry': '{count, plural, one {hat einen Eintrag} other {# Einträge}}',
  'calendar.cell.habitsDone': '{done} von {total} Gewohnheiten erledigt',
  'calendar.cell.noData': 'keine Daten',
  'calendar.legend':
    'Legende: St = durchschnittliche Stimmung, En = durchschnittliche Energie, Gew. = erledigte von allen Gewohnheiten. ● markiert einen Tag mit Eintrag.',
  'calendar.keyboardHint':
    'Tastaturnavigation: Pfeiltasten wechseln zwischen den Tagen, Pos1/Ende springen zum Anfang und Ende der Woche, Bild auf/Bild ab wechseln den Monat, die Eingabetaste öffnet die Tagesübersicht.',

  // Holidays and the selected calendar's date (src/pages/entries/CalendarExtras.tsx, DayPage.tsx, EntryPage.tsx)
  'calendar.extras.hebrewDateValue': 'Hebräisches Datum: {value}',
  'calendar.extras.hijriDateValue': 'Hidschri-Datum (islamisch): {value}',
  'calendar.extras.holidaysHeading': 'Feier- und Gedenktage',
  'calendar.extras.more': '+{count}',
  'calendar.extras.moreTitle': 'Und {count} weitere: {names}',
  'calendar.extras.legendTitle': 'Legende der Feiertage',
  'calendar.extras.hijriNote': 'Islamische Daten und Feiertage folgen dem Umm-al-Qura-Kalender und können um einen Tag abweichen.',
  'calendar.extras.hebrewUnsupported':
    'Dieser Browser unterstützt den hebräischen Kalender nicht. Das hebräische Datum und die jüdischen Feiertage werden daher nicht angezeigt.',
  'calendar.extras.hijriUnsupported':
    'Dieser Browser unterstützt den Hidschri-Kalender nicht. Das Hidschri-Datum und die islamischen Feiertage werden daher nicht angezeigt.',
  'calendar.extras.dayOf': 'Tag {index} von {count}',
};
export default messages;
