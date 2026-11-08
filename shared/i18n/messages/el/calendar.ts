/** el - calendar messages. Keys are prefixed 'calendar.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Calendar page (src/pages/CalendarPage.tsx) -------------------------------------------
  'calendar.title': 'Μηνιαίο ημερολόγιο',
  'calendar.nav.previousMonth': 'Προηγούμενος μήνας',
  'calendar.nav.nextMonth': 'Επόμενος μήνας',
  'calendar.nav.label': 'Πλοήγηση ημερολογίου',
  'calendar.select.month': 'Μήνας',
  'calendar.select.year': 'Έτος',
  // The calendar-system select ("Gregorian / Hebrew / Hijri"); it decides the day numbers and the holidays of the grid
  'calendar.select.system': 'Ημερολόγιο',
  'calendar.system.gregorian': 'Γρηγοριανό',
  'calendar.system.hebrew': 'Εβραϊκό',
  'calendar.system.hijri': 'Ισλαμικό (Εγίρας)',
  // {label} = one of the calendar.system.* names
  'calendar.system.unsupported': '{label} (δεν υποστηρίζεται σε αυτό το πρόγραμμα περιήγησης)',
  'calendar.system.legend':
    'Εμφανιζόμενο ημερολόγιο: {label}. Οι αριθμοί των ημερών και οι γιορτές ακολουθούν αυτό το ημερολόγιο· η διάρκεια του μήνα στα άλλα ημερολόγια εμφανίζεται πάνω από τον πίνακα.',

  // The month's span in the two calendars that are NOT the selected one: one full sentence each, shown above the table.
  // {month} = the month title ("Tishri 5787", "September 2026"); the "Lead" forms open the line with it.
  'calendar.span.gregorian': '{month}: από {from} έως {to}',
  'calendar.span.hebrewLead': '{month} στο εβραϊκό ημερολόγιο: από {from} έως {to}',
  'calendar.span.hebrew': 'Στο εβραϊκό ημερολόγιο: από {from} έως {to}',
  'calendar.span.hijriLead': '{month} στο ισλαμικό ημερολόγιο: από {from} έως {to}',
  'calendar.span.hijri': 'Στο ισλαμικό ημερολόγιο: από {from} έως {to}',

  // Month grid cells ---------------------------------------------------------------------
  // Short metric texts printed in a cell ("Δι 7 · Εν 6"); the legend below explains them
  'calendar.cell.mood': 'Δι {value}',
  'calendar.cell.energy': 'Εν {value}',
  'calendar.cell.habits': 'Συνήθειες {done}/{total}',
  'calendar.cell.entryMarker': '● {count, plural, one {# καταχώριση} other {# καταχωρίσεις}}',
  'calendar.cell.date': '{weekday}, {date}',
  'calendar.cell.aria': '{date}: {details}',
  'calendar.cell.ariaToday': 'Σήμερα, {date}: {details}',
  'calendar.cell.hasEntry': '{count, plural, one {υπάρχει καταχώριση} other {# καταχωρίσεις}}',
  'calendar.cell.habitsDone': 'ολοκληρώθηκαν {done} από {total} συνήθειες',
  'calendar.cell.noData': 'χωρίς δεδομένα',
  'calendar.legend':
    'Υπόμνημα: Δι = μέση διάθεση, Εν = μέση ενέργεια, Συνήθειες = ολοκληρωμένες από το σύνολο των συνηθειών. Το ● σημειώνει ημέρα με καταχώριση.',
  'calendar.keyboardHint':
    'Πλοήγηση με το πληκτρολόγιο: τα βέλη μετακινούν ανάμεσα στις ημέρες, τα Home/End στην αρχή και στο τέλος της εβδομάδας, τα PageUp/PageDown ανάμεσα στους μήνες και το Enter ανοίγει τη σύνοψη της ημέρας.',

  // Holidays and the selected calendar's date (src/pages/entries/CalendarExtras.tsx, DayPage.tsx, EntryPage.tsx)
  'calendar.extras.hebrewDateValue': 'Εβραϊκή ημερομηνία: {value}',
  'calendar.extras.hijriDateValue': 'Ισλαμική ημερομηνία (Εγίρας): {value}',
  'calendar.extras.holidaysHeading': 'Γιορτές και επέτειοι',
  'calendar.extras.more': '+{count}',
  'calendar.extras.moreTitle': 'Και {count} ακόμη: {names}',
  'calendar.extras.legendTitle': 'Υπόμνημα γιορτών',
  'calendar.extras.hijriNote':
    'Οι ισλαμικές ημερομηνίες και γιορτές ακολουθούν το ημερολόγιο Umm al-Qura και μπορεί να μετατοπιστούν κατά μία ημέρα.',
  'calendar.extras.hebrewUnsupported':
    'Αυτό το πρόγραμμα περιήγησης δεν υποστηρίζει το εβραϊκό ημερολόγιο, γι’ αυτό η εβραϊκή ημερομηνία και οι εβραϊκές γιορτές δεν εμφανίζονται.',
  'calendar.extras.hijriUnsupported':
    'Αυτό το πρόγραμμα περιήγησης δεν υποστηρίζει το ισλαμικό ημερολόγιο, γι’ αυτό η ισλαμική ημερομηνία και οι μουσουλμανικές γιορτές δεν εμφανίζονται.',
  // Multi-day holidays: "Day 2 of 8"
  'calendar.extras.dayOf': 'Ημέρα {index} από {count}',
};
export default messages;
