/** th - calendar messages. Keys are prefixed 'calendar.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Calendar page (src/pages/CalendarPage.tsx) -------------------------------------------
  'calendar.title': 'ปฏิทิน',
  'calendar.nav.previousMonth': 'เดือนก่อนหน้า',
  'calendar.nav.nextMonth': 'เดือนถัดไป',
  'calendar.nav.label': 'การนำทางปฏิทิน',
  'calendar.select.month': 'เดือน',
  'calendar.select.year': 'ปี',
  // The calendar-system select ("Gregorian / Hebrew / Hijri"); it decides the day numbers and the holidays of the grid
  'calendar.select.system': 'ปฏิทิน',
  'calendar.system.gregorian': 'เกรกอเรียน',
  'calendar.system.hebrew': 'ฮีบรู',
  'calendar.system.hijri': 'ฮิจเราะห์ (อิสลาม)',
  // {label} = one of the calendar.system.* names
  'calendar.system.unsupported': '{label} (เบราว์เซอร์นี้ไม่รองรับ)',
  'calendar.system.legend':
    'ปฏิทินที่แสดง: {label} ตัวเลขวันและวันหยุดเป็นไปตามปฏิทินนี้ ส่วนช่วงของเดือนนี้ในปฏิทินอื่นจะแสดงอยู่เหนือตาราง',

  // The month's span in the two calendars that are NOT the selected one: one full sentence each, shown above the table.
  // {month} = the month title ("Tishri 5787", "September 2026"); the "Lead" forms open the line with it.
  // Gregorian span: {from} / {to} = civil dates in the language's numeric form ("12/09/2026"; "12.09.2026" in Hebrew)
  'calendar.span.gregorian': '{month} ตั้งแต่ {from} ถึง {to}',
  // Hebrew span: {from} / {to} = full Hebrew dates ("19 Elul 5786")
  'calendar.span.hebrewLead': '{month} ในปฏิทินฮีบรู: ตั้งแต่ {from} ถึง {to}',
  'calendar.span.hebrew': 'ในปฏิทินฮีบรู: ตั้งแต่ {from} ถึง {to}',
  // Hijri span: {from} / {to} = full Hijri dates ("1 Rabiʻ II 1448")
  'calendar.span.hijriLead': '{month} ในปฏิทินฮิจเราะห์: ตั้งแต่ {from} ถึง {to}',
  'calendar.span.hijri': 'ในปฏิทินฮิจเราะห์: ตั้งแต่ {from} ถึง {to}',

  // Month grid cells ---------------------------------------------------------------------
  // Short metric texts printed in a cell ("Md 7 · En 6"); the legend below explains them
  'calendar.cell.mood': 'อารมณ์ {value}',
  'calendar.cell.energy': 'พลัง {value}',
  'calendar.cell.habits': 'นิสัย {done}/{total}',
  // Visible marker of a day with entries ("● entry" / "● 3 entries")
  'calendar.cell.entryMarker': '● {count, plural, other {# บันทึก}}',
  // Accessible name of a cell: "{weekday} {date}" then ": " then the details
  // {weekday} = "Monday", {date} = "7 September" or the full date in the selected calendar ("1 Tishri 5787")
  'calendar.cell.date': '{weekday} {date}',
  // {details} = comma-separated list: the holidays of the selected calendar, mood, energy, habits, entries
  'calendar.cell.aria': '{date}: {details}',
  'calendar.cell.ariaToday': 'วันนี้ {date}: {details}',
  'calendar.cell.hasEntry': '{count, plural, other {มีบันทึก # รายการ}}',
  'calendar.cell.habitsDone': 'ทำนิสัยสำเร็จ {done} จาก {total} รายการ',
  'calendar.cell.noData': 'ไม่มีข้อมูล',
  'calendar.legend': 'คำอธิบาย: อารมณ์ = อารมณ์เฉลี่ย, พลัง = พลังงานเฉลี่ย, นิสัย = จำนวนที่ทำสำเร็จจากนิสัยทั้งหมด ● หมายถึงวันที่มีบันทึก',
  'calendar.keyboardHint':
    'การนำทางด้วยแป้นพิมพ์: ใช้ปุ่มลูกศรเลื่อนระหว่างวัน Home/End ไปยังต้นและท้ายสัปดาห์ PageUp/PageDown เลื่อนระหว่างเดือน และ Enter เพื่อเปิดสรุปประจำวัน',

  // Holidays and the selected calendar's date (src/pages/entries/CalendarExtras.tsx, DayPage.tsx, EntryPage.tsx)
  // Day page subtitle: {value} = the full date in that calendar
  'calendar.extras.hebrewDateValue': 'วันที่ตามปฏิทินฮีบรู: {value}',
  'calendar.extras.hijriDateValue': 'วันที่ตามปฏิทินฮิจเราะห์ (อิสลาม): {value}',
  'calendar.extras.holidaysHeading': 'วันหยุดและวันสำคัญ',
  // "+N" badge when a cell has more holidays than it can show, and its tooltip
  'calendar.extras.more': '+{count}',
  // {names} = comma-separated holiday names
  'calendar.extras.moreTitle': 'และอีก {count} รายการ: {names}',
  'calendar.extras.legendTitle': 'คำอธิบายวันหยุด',
  'calendar.extras.hijriNote': 'วันที่และวันหยุดทางศาสนาอิสลามเป็นไปตามปฏิทินอุมม์ อัลกุรอ และอาจคลาดเคลื่อนได้หนึ่งวัน',
  // Shown when the remembered calendar is unavailable in this browser (the Gregorian calendar is shown instead)
  'calendar.extras.hebrewUnsupported':
    'เบราว์เซอร์นี้ไม่รองรับปฏิทินฮีบรู จึงไม่แสดงวันที่ตามปฏิทินฮีบรูและวันหยุดของชาวยิว',
  'calendar.extras.hijriUnsupported':
    'เบราว์เซอร์นี้ไม่รองรับปฏิทินฮิจเราะห์ จึงไม่แสดงวันที่ตามปฏิทินฮิจเราะห์และวันหยุดของชาวมุสลิม',
  // Multi-day holidays: "Day 2 of 8"
  'calendar.extras.dayOf': 'วันที่ {index} จาก {count} วัน',
};
export default messages;
