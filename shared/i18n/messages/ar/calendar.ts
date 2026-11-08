/** ar - calendar messages. Keys are prefixed 'calendar.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Calendar page (src/pages/CalendarPage.tsx) -------------------------------------------
  'calendar.title': 'التقويم',
  'calendar.nav.previousMonth': 'الشهر السابق',
  'calendar.nav.nextMonth': 'الشهر التالي',
  'calendar.nav.label': 'التنقل في التقويم',
  'calendar.select.month': 'الشهر',
  'calendar.select.year': 'السنة',
  // The calendar-system select ("Gregorian / Hebrew / Hijri"); it decides the day numbers and the holidays of the grid
  'calendar.select.system': 'التقويم',
  'calendar.system.gregorian': 'الميلادي',
  'calendar.system.hebrew': 'العبري',
  'calendar.system.hijri': 'الهجري',
  // {label} = one of the calendar.system.* names
  'calendar.system.unsupported': '{label} (غير مدعوم في هذا المتصفح)',
  'calendar.system.legend':
    'التقويم المعروض: {label}. أرقام الأيام والأعياد تتبع هذا التقويم؛ ويظهر امتداد الشهر في التقويمين الآخرين فوق الجدول.',

  // The month's span in the two calendars that are NOT the selected one: one full sentence each, shown above the table.
  // {month} = the month title ("Tishri 5787", "September 2026"); the "Lead" forms open the line with it.
  // Gregorian span: {from} / {to} = civil dates in the language's numeric form ("12/09/2026"; "12.09.2026" in Hebrew)
  'calendar.span.gregorian': 'يمتد {month} من {from} إلى {to}',
  // Hebrew span: {from} / {to} = full Hebrew dates ("19 Elul 5786")
  'calendar.span.hebrewLead': '{month} في التقويم العبري: من {from} إلى {to}',
  'calendar.span.hebrew': 'في التقويم العبري: من {from} إلى {to}',
  // Hijri span: {from} / {to} = full Hijri dates ("1 Rabiʻ II 1448")
  'calendar.span.hijriLead': '{month} في التقويم الهجري: من {from} إلى {to}',
  'calendar.span.hijri': 'في التقويم الهجري: من {from} إلى {to}',

  // Month grid cells ---------------------------------------------------------------------
  // Short metric texts printed in a cell ("Md 7 · En 6"); the legend below explains them
  'calendar.cell.mood': 'م {value}',
  'calendar.cell.energy': 'ط {value}',
  'calendar.cell.habits': 'عادات {done}/{total}',
  // Visible marker of a day with entries ("● entry" / "● 3 entries")
  'calendar.cell.entryMarker':
    '● {count, plural, zero {# تدوينة} one {تدوينة} two {تدوينتان} few {# تدوينات} many {# تدوينة} other {# تدوينة}}',
  // Accessible name of a cell: "{weekday} {date}" then ": " then the details
  // {weekday} = "Monday", {date} = "7 September" or the full date in the selected calendar ("1 Tishri 5787")
  'calendar.cell.date': '{weekday} {date}',
  // {details} = comma-separated list: the holidays of the selected calendar, mood, energy, habits, entries
  'calendar.cell.aria': '{date}: {details}',
  'calendar.cell.ariaToday': 'اليوم، {date}: {details}',
  'calendar.cell.hasEntry':
    '{count, plural, zero {لا توجد تدوينات} one {توجد تدوينة} two {تدوينتان} few {# تدوينات} many {# تدوينة} other {# تدوينة}}',
  'calendar.cell.habitsDone': 'اكتمل {done} من أصل {total} من العادات',
  'calendar.cell.noData': 'لا توجد بيانات',
  'calendar.legend': 'مفتاح الرموز: م = متوسط المزاج، ط = متوسط الطاقة، عادات = المكتملة من إجمالي العادات. ● يشير إلى يوم فيه تدوينة.',
  'calendar.keyboardHint':
    'التنقل بلوحة المفاتيح: مفاتيح الأسهم للتنقل بين الأيام، وHome/End لبداية الأسبوع ونهايته، وPageUp/PageDown للتنقل بين الأشهر، وEnter لفتح ملخص اليوم.',

  // Holidays and the selected calendar's date (src/pages/entries/CalendarExtras.tsx, DayPage.tsx, EntryPage.tsx)
  // Day page subtitle: {value} = the full date in that calendar
  'calendar.extras.hebrewDateValue': 'التاريخ العبري: {value}',
  'calendar.extras.hijriDateValue': 'التاريخ الهجري: {value}',
  'calendar.extras.holidaysHeading': 'الأعياد والمناسبات',
  // "+N" badge when a cell has more holidays than it can show, and its tooltip
  'calendar.extras.more': '+{count}',
  // {names} = comma-separated holiday names
  'calendar.extras.moreTitle': 'و{count} غيرها: {names}',
  'calendar.extras.legendTitle': 'مفتاح الأعياد',
  'calendar.extras.hijriNote': 'تتبع التواريخ والأعياد الإسلامية تقويم أم القرى، وقد تختلف بيوم واحد.',
  // Shown when the remembered calendar is unavailable in this browser (the Gregorian calendar is shown instead)
  'calendar.extras.hebrewUnsupported': 'لا يدعم هذا المتصفح التقويم العبري، لذلك لا يُعرض التاريخ العبري ولا الأعياد اليهودية.',
  'calendar.extras.hijriUnsupported': 'لا يدعم هذا المتصفح التقويم الهجري، لذلك لا يُعرض التاريخ الهجري ولا الأعياد الإسلامية.',
  // Multi-day holidays: "Day 2 of 8"
  'calendar.extras.dayOf': 'اليوم {index} من {count}',
};
export default messages;
