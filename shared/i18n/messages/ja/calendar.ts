/** ja - calendar messages. Keys are prefixed 'calendar.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Calendar page (src/pages/CalendarPage.tsx) -------------------------------------------
  'calendar.title': 'カレンダー',
  'calendar.nav.previousMonth': '前の月',
  'calendar.nav.nextMonth': '次の月',
  'calendar.nav.label': 'カレンダーのナビゲーション',
  'calendar.select.month': '月',
  'calendar.select.year': '年',
  // The calendar-system select ("Gregorian / Hebrew / Hijri"); it decides the day numbers and the holidays of the grid
  'calendar.select.system': '暦',
  'calendar.system.gregorian': 'グレゴリオ暦',
  'calendar.system.hebrew': 'ユダヤ暦',
  'calendar.system.hijri': 'ヒジュラ暦（イスラム暦）',
  // {label} = one of the calendar.system.* names
  'calendar.system.unsupported': '{label}（このブラウザーでは非対応）',
  'calendar.system.legend':
    '表示中の暦：{label}。日付の数字と祝祭日はこの暦に従います。ほかの暦でのこの月の期間は表の上に表示されます。',

  // The month's span in the two calendars that are NOT the selected one: one full sentence each, shown above the table.
  // {month} = the month title ("Tishri 5787", "September 2026"); the "Lead" forms open the line with it.
  // Gregorian span: {from} / {to} = civil dates in the language's numeric form ("12/09/2026"; "12.09.2026" in Hebrew)
  'calendar.span.gregorian': '{month}の期間は{from}から{to}までです',
  // Hebrew span: {from} / {to} = full Hebrew dates ("19 Elul 5786")
  'calendar.span.hebrewLead': 'ユダヤ暦での{month}：{from}から{to}まで',
  'calendar.span.hebrew': 'ユダヤ暦では：{from}から{to}まで',
  // Hijri span: {from} / {to} = full Hijri dates ("1 Rabiʻ II 1448")
  'calendar.span.hijriLead': 'ヒジュラ暦での{month}：{from}から{to}まで',
  'calendar.span.hijri': 'ヒジュラ暦では：{from}から{to}まで',

  // Month grid cells ---------------------------------------------------------------------
  // Short metric texts printed in a cell ("Md 7 · En 6"); the legend below explains them
  'calendar.cell.mood': '気分 {value}',
  'calendar.cell.energy': 'エネ {value}',
  'calendar.cell.habits': '習慣 {done}/{total}',
  // Visible marker of a day with entries ("● entry" / "● 3 entries")
  'calendar.cell.entryMarker': '● {count, plural, other {#件}}',
  // Accessible name of a cell: "{weekday} {date}" then ": " then the details
  // {weekday} = "Monday", {date} = "7 September" or the full date in the selected calendar ("1 Tishri 5787")
  'calendar.cell.date': '{date} {weekday}',
  // {details} = comma-separated list: the holidays of the selected calendar, mood, energy, habits, entries
  'calendar.cell.aria': '{date}：{details}',
  'calendar.cell.ariaToday': '今日、{date}：{details}',
  'calendar.cell.hasEntry': '{count, plural, other {記録#件}}',
  'calendar.cell.habitsDone': '習慣{total}件中{done}件を達成',
  'calendar.cell.noData': 'データなし',
  'calendar.legend': '凡例：気分＝気分の平均、エネ＝エネルギーの平均、習慣＝達成した数/習慣の総数。●は記録がある日を示します。',
  'calendar.keyboardHint':
    'キーボード操作：矢印キーで日付を移動、Home/Endで週の最初と最後へ、PageUp/PageDownで月を切り替え、Enterで1日のまとめを開きます。',

  // Holidays and the selected calendar's date (src/pages/entries/CalendarExtras.tsx, DayPage.tsx, EntryPage.tsx)
  // Day page subtitle: {value} = the full date in that calendar
  'calendar.extras.hebrewDateValue': 'ユダヤ暦の日付：{value}',
  'calendar.extras.hijriDateValue': 'ヒジュラ暦（イスラム暦）の日付：{value}',
  'calendar.extras.holidaysHeading': '祝祭日と記念日',
  // "+N" badge when a cell has more holidays than it can show, and its tooltip
  'calendar.extras.more': '+{count}',
  // {names} = comma-separated holiday names
  'calendar.extras.moreTitle': 'ほかに{count}件：{names}',
  'calendar.extras.legendTitle': '祝祭日の凡例',
  'calendar.extras.hijriNote': 'イスラム暦の日付と祝祭日はウンム・アル＝クラー暦に基づいており、1日ずれることがあります。',
  // Shown when the remembered calendar is unavailable in this browser (the Gregorian calendar is shown instead)
  'calendar.extras.hebrewUnsupported':
    'このブラウザーはユダヤ暦に対応していないため、ユダヤ暦の日付とユダヤ教の祝祭日は表示されません。',
  'calendar.extras.hijriUnsupported':
    'このブラウザーはヒジュラ暦に対応していないため、ヒジュラ暦の日付とイスラム教の祝祭日は表示されません。',
  // Multi-day holidays: "Day 2 of 8"
  'calendar.extras.dayOf': '{count}日間のうち{index}日目',
};
export default messages;
