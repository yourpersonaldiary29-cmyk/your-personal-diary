/** he - calendar messages. Keys are prefixed 'calendar.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Calendar page (src/pages/CalendarPage.tsx) -------------------------------------------
  'calendar.title': 'לוח שנה',
  'calendar.nav.previousMonth': 'חודש קודם',
  'calendar.nav.nextMonth': 'חודש הבא',
  'calendar.nav.label': 'ניווט בלוח השנה',
  'calendar.select.month': 'חודש',
  'calendar.select.year': 'שנה',
  'calendar.select.system': 'לוח',
  'calendar.system.gregorian': 'לועזי',
  'calendar.system.hebrew': 'עברי',
  'calendar.system.hijri': 'הג׳רי-מוסלמי',
  'calendar.system.unsupported': '{label} (לא נתמך בדפדפן זה)',
  'calendar.system.legend': 'הלוח המוצג: {label}. מספרי הימים והחגים הם לפי לוח זה; טווח החודש בלוחות האחרים מופיע מעל הטבלה.',

  // The month's span in the two calendars that are NOT the selected one (one full sentence each)
  'calendar.span.gregorian': 'חודש {month}: מ-{from} עד {to}',
  'calendar.span.hebrewLead': 'חודש {month} בלוח העברי: מ-{from} עד {to}',
  'calendar.span.hebrew': 'בלוח העברי: מ-{from} עד {to}',
  'calendar.span.hijriLead': 'חודש {month} בלוח המוסלמי: מ-{from} עד {to}',
  'calendar.span.hijri': 'בלוח המוסלמי: מ-{from} עד {to}',

  // Month grid cells ---------------------------------------------------------------------
  'calendar.cell.mood': 'מ"ר {value}',
  'calendar.cell.energy': 'אנ {value}',
  'calendar.cell.habits': 'הרגלים {done}/{total}',
  'calendar.cell.entryMarker': '● {count, plural, one {רשומה} other {# רשומות}}',
  'calendar.cell.date': '{weekday} {date}',
  'calendar.cell.aria': '{date}: {details}',
  'calendar.cell.ariaToday': 'היום, {date}: {details}',
  'calendar.cell.hasEntry': '{count, plural, one {יש רשומה} other {# רשומות}}',
  'calendar.cell.habitsDone': '{done} מתוך {total} הרגלים הושלמו',
  'calendar.cell.noData': 'אין נתונים',
  'calendar.legend': 'מקרא: מ"ר = מצב רוח ממוצע, אנ = אנרגיה ממוצעת, הרגלים = הושלמו מתוך סך ההרגלים. ● מסמן יום עם רשומה.',
  'calendar.keyboardHint': 'ניווט במקלדת: חיצים בין ימים, Home/End לתחילת השבוע ולסופו, PageUp/PageDown בין חודשים, Enter לפתיחת סיכום היום.',

  // Holidays and the selected calendar's date (src/pages/entries/CalendarExtras.tsx, DayPage.tsx, EntryPage.tsx)
  'calendar.extras.hebrewDateValue': 'תאריך עברי: {value}',
  'calendar.extras.hijriDateValue': 'תאריך הג׳רי (מוסלמי): {value}',
  'calendar.extras.holidaysHeading': 'חגים ומועדים',
  'calendar.extras.more': '+{count}',
  'calendar.extras.moreTitle': 'ועוד {count}: {names}',
  'calendar.extras.legendTitle': 'מקרא חגים ומועדים',
  'calendar.extras.hijriNote': 'תאריכים וחגים מוסלמיים: לפי לוח אום אל-קורא; עשוי לזוז ביום אחד.',
  'calendar.extras.hebrewUnsupported': 'הדפדפן אינו תומך בלוח העברי, ולכן התאריך העברי והחגים היהודיים אינם מוצגים.',
  'calendar.extras.hijriUnsupported': 'הדפדפן אינו תומך בלוח ההג׳רי, ולכן התאריך ההג׳רי והחגים המוסלמיים אינם מוצגים.',
  'calendar.extras.dayOf': 'יום {index} מתוך {count}',
};
export default messages;
