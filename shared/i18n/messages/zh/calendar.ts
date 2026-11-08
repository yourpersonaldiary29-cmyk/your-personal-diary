/** zh - calendar messages. Keys are prefixed 'calendar.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Calendar page (src/pages/CalendarPage.tsx) -------------------------------------------
  'calendar.title': '日历',
  'calendar.nav.previousMonth': '上个月',
  'calendar.nav.nextMonth': '下个月',
  'calendar.nav.label': '日历导航',
  'calendar.select.month': '月',
  'calendar.select.year': '年',
  // The calendar-system select ("Gregorian / Hebrew / Hijri"); it decides the day numbers and the holidays of the grid
  'calendar.select.system': '历法',
  'calendar.system.gregorian': '公历',
  'calendar.system.hebrew': '希伯来历',
  'calendar.system.hijri': '伊斯兰历（希吉来历）',
  // {label} = one of the calendar.system.* names
  'calendar.system.unsupported': '{label}（此浏览器不支持）',
  'calendar.system.legend':
    '当前显示的历法：{label}。日期数字和节日均按此历法显示；本月在其他历法中对应的时间范围显示在表格上方。',

  // The month's span in the two calendars that are NOT the selected one: one full sentence each, shown above the table.
  // {month} = the month title ("Tishri 5787", "September 2026"); the "Lead" forms open the line with it.
  // Gregorian span: {from} / {to} = civil dates in the language's numeric form ("12/09/2026"; "12.09.2026" in Hebrew)
  'calendar.span.gregorian': '{month}的时间范围为 {from} 至 {to}',
  // Hebrew span: {from} / {to} = full Hebrew dates ("19 Elul 5786")
  'calendar.span.hebrewLead': '{month}在希伯来历中：从 {from} 到 {to}',
  'calendar.span.hebrew': '在希伯来历中：从 {from} 到 {to}',
  // Hijri span: {from} / {to} = full Hijri dates ("1 Rabiʻ II 1448")
  'calendar.span.hijriLead': '{month}在伊斯兰历中：从 {from} 到 {to}',
  'calendar.span.hijri': '在伊斯兰历中：从 {from} 到 {to}',

  // Month grid cells ---------------------------------------------------------------------
  // Short metric texts printed in a cell ("Md 7 · En 6"); the legend below explains them
  'calendar.cell.mood': '心情 {value}',
  'calendar.cell.energy': '精力 {value}',
  'calendar.cell.habits': '习惯 {done}/{total}',
  // Visible marker of a day with entries ("● entry" / "● 3 entries")
  'calendar.cell.entryMarker': '● {count, plural, other {# 条记录}}',
  // Accessible name of a cell: "{weekday} {date}" then ": " then the details
  // {weekday} = "Monday", {date} = "7 September" or the full date in the selected calendar ("1 Tishri 5787")
  'calendar.cell.date': '{date} {weekday}',
  // {details} = comma-separated list: the holidays of the selected calendar, mood, energy, habits, entries
  'calendar.cell.aria': '{date}：{details}',
  'calendar.cell.ariaToday': '今天，{date}：{details}',
  'calendar.cell.hasEntry': '{count, plural, other {有 # 条记录}}',
  'calendar.cell.habitsDone': '已完成 {done}/{total} 个习惯',
  'calendar.cell.noData': '无数据',
  'calendar.legend': '图例：心情 = 平均心情，精力 = 平均精力，习惯 = 已完成数/习惯总数。● 表示当天有记录。',
  'calendar.keyboardHint':
    '键盘导航：方向键在日期之间移动，Home/End 跳到本周的第一天和最后一天，PageUp/PageDown 切换月份，Enter 打开当日概览。',

  // Holidays and the selected calendar's date (src/pages/entries/CalendarExtras.tsx, DayPage.tsx, EntryPage.tsx)
  // Day page subtitle: {value} = the full date in that calendar
  'calendar.extras.hebrewDateValue': '希伯来历日期：{value}',
  'calendar.extras.hijriDateValue': '伊斯兰历日期：{value}',
  'calendar.extras.holidaysHeading': '节日与纪念日',
  // "+N" badge when a cell has more holidays than it can show, and its tooltip
  'calendar.extras.more': '+{count}',
  // {names} = comma-separated holiday names
  'calendar.extras.moreTitle': '另外还有 {count} 个：{names}',
  'calendar.extras.legendTitle': '节日图例',
  'calendar.extras.hijriNote': '伊斯兰历日期和节日依据乌姆古拉历（Umm al-Qura），可能相差一天。',
  // Shown when the remembered calendar is unavailable in this browser (the Gregorian calendar is shown instead)
  'calendar.extras.hebrewUnsupported':
    '此浏览器不支持希伯来历，因此不显示希伯来历日期和犹太节日。',
  'calendar.extras.hijriUnsupported':
    '此浏览器不支持伊斯兰历，因此不显示伊斯兰历日期和穆斯林节日。',
  // Multi-day holidays: "Day 2 of 8"
  'calendar.extras.dayOf': '第 {index} 天（共 {count} 天）',
};
export default messages;
