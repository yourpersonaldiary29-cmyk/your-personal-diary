/** hu - calendar messages. Keys are prefixed 'calendar.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Calendar page (src/pages/CalendarPage.tsx) -------------------------------------------
  'calendar.title': 'Naptár',
  'calendar.nav.previousMonth': 'Előző hónap',
  'calendar.nav.nextMonth': 'Következő hónap',
  'calendar.nav.label': 'Navigálás a naptárban',
  'calendar.select.month': 'Hónap',
  'calendar.select.year': 'Év',
  'calendar.select.system': 'Naptár',
  'calendar.system.gregorian': 'Gergely-naptár',
  'calendar.system.hebrew': 'Zsidó naptár',
  'calendar.system.hijri': 'Hidzsra (iszlám naptár)',
  'calendar.system.unsupported': '{label} (ebben a böngészőben nem támogatott)',
  'calendar.system.legend':
    'Megjelenített naptár: {label}. A napok számozása és az ünnepek ezt a naptárt követik; a hónap időtartama a másik két naptárban a táblázat fölött látható.',

  // The month's span in the two calendars that are NOT the selected one
  'calendar.span.gregorian': '{month} időtartama: {from} – {to}',
  'calendar.span.hebrewLead': '{month} a zsidó naptárban: {from} – {to}',
  'calendar.span.hebrew': 'A zsidó naptárban: {from} – {to}',
  'calendar.span.hijriLead': '{month} a hidzsra naptárban: {from} – {to}',
  'calendar.span.hijri': 'A hidzsra naptárban: {from} – {to}',

  // Month grid cells ---------------------------------------------------------------------
  'calendar.cell.mood': 'Hang {value}',
  'calendar.cell.energy': 'En {value}',
  'calendar.cell.habits': 'Szokás {done}/{total}',
  'calendar.cell.entryMarker': '● {count, plural, one {# bejegyzés} other {# bejegyzés}}',
  'calendar.cell.date': '{date}, {weekday}',
  'calendar.cell.aria': '{date}: {details}',
  'calendar.cell.ariaToday': 'Ma, {date}: {details}',
  'calendar.cell.hasEntry': '{count, plural, one {van bejegyzés} other {# bejegyzés}}',
  'calendar.cell.habitsDone': 'szokások: {done}/{total} teljesítve',
  'calendar.cell.noData': 'nincs adat',
  'calendar.legend':
    'Jelmagyarázat: Hang = átlagos hangulat, En = átlagos energia, Szokás = teljesített / összes szokás. A ● bejegyzéssel rendelkező napot jelöl.',
  'calendar.keyboardHint':
    'Billentyűzetes navigáció: a nyilak a napok között mozognak, a Home/End a hét elejére és végére ugrik, a PageUp/PageDown hónapot vált, az Enter megnyitja a napi összefoglalót.',

  // Holidays and the selected calendar's date (src/pages/entries/CalendarExtras.tsx, DayPage.tsx, EntryPage.tsx)
  'calendar.extras.hebrewDateValue': 'Zsidó naptár szerinti dátum: {value}',
  'calendar.extras.hijriDateValue': 'Hidzsra (iszlám) dátum: {value}',
  'calendar.extras.holidaysHeading': 'Ünnepek és emléknapok',
  'calendar.extras.more': '+{count}',
  'calendar.extras.moreTitle': 'És még {count}: {names}',
  'calendar.extras.legendTitle': 'Az ünnepek jelmagyarázata',
  'calendar.extras.hijriNote': 'Az iszlám dátumok és ünnepek az Umm al-Kura naptárt követik, és egy nappal eltolódhatnak.',
  'calendar.extras.hebrewUnsupported':
    'Ez a böngésző nem támogatja a zsidó naptárt, ezért a zsidó naptár szerinti dátum és a zsidó ünnepek nem jelennek meg.',
  'calendar.extras.hijriUnsupported':
    'Ez a böngésző nem támogatja a hidzsra naptárt, ezért a hidzsra dátum és a muszlim ünnepek nem jelennek meg.',
  'calendar.extras.dayOf': '{index}. nap ({count} napból)',
};
export default messages;
