/** th - stats messages. Keys are prefixed 'stats.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Statistics page (src/pages/StatsPage.tsx) ----------------------------------------
  'stats.title': 'สถิติ',
  'stats.period': 'ช่วงเวลา',
  'stats.movingAvg': 'ค่าเฉลี่ยเคลื่อนที่ (7 วัน)',
  'stats.overTime': '{label}ตามช่วงเวลา',
  'stats.weekday.section': 'ตามวันในสัปดาห์',
  'stats.weekday.chart': 'ค่าเฉลี่ยตามวันในสัปดาห์',
  'stats.weekday.axis': 'วันในสัปดาห์',
  'stats.habits.section': 'นิสัย',
  'stats.habits.chart': '{name} - ค่ารายวัน',
  'stats.habits.empty': 'ไม่มีนิสัยที่มีการบันทึกในช่วงเวลานี้',
  // {frequency} is 'daily' | 'weekly'; {current}/{best} are formatted streaks ("5 days").
  'stats.habits.summary':
    'การทำสำเร็จ: {percent} ({completed} จาก {frequency, select, weekly {{total, plural, other {# สัปดาห์}}} other {{total, plural, other {# วัน}}}}) ความต่อเนื่องปัจจุบัน: {current} ดีที่สุด: {best}',
  'stats.empty.title': 'ยังไม่มีข้อมูลสำหรับช่วงเวลานี้',
  'stats.empty.text': 'เขียนบันทึกและบันทึกนิสัย เพื่อดูกราฟและแนวโน้มที่นี่',
  'stats.newEntry': 'บันทึกใหม่',
  'stats.noValues': 'ไม่มีข้อมูลในช่วงเวลานี้',
  'stats.overview': '{entries, plural, other {# บันทึก}} ใน {days, plural, other {# วัน}} ({from} – {to})',

  // Series summary under every chart -------------------------------------------------
  'stats.summary.base': 'ค่าเฉลี่ย {mean} ({sample} ต่ำสุด {min} สูงสุด {max})',
  'stats.summary.sampleDays': '{count, plural, other {# วัน}}',
  'stats.summary.sampleValues': '{count, plural, other {# ค่า}}',
  'stats.summary.noChange': 'ไม่เปลี่ยนแปลงจากช่วงก่อนหน้า ({previous})',
  'stats.summary.change': 'เทียบกับ {previous} ในช่วงก่อนหน้า ({diff})',
  'stats.summary.sentences': '{summary} {comparison}',
  'stats.summary.entriesPerDay': 'บันทึกต่อวัน',

  // Metric titles (chart sections; also the home page tiles) -------------------------
  'stats.metric.mood': 'อารมณ์',
  'stats.metric.energy': 'ระดับพลังงาน',
  'stats.metric.stress': 'ระดับความเครียด',
  'stats.metric.sleepHours': 'ชั่วโมงการนอน',
  'stats.metric.sleepQuality': 'คุณภาพการนอน',
  'stats.metric.exerciseMinutes': 'การออกกำลังกาย',
  'stats.metric.entriesPerDay': 'บันทึกไดอารี่',

  // Periods (pickers on the statistics and insights pages) ---------------------------
  'stats.period.7d': '7 วัน',
  'stats.period.30d': '30 วัน',
  'stats.period.3m': '3 เดือน',
  'stats.period.6m': '6 เดือน',
  'stats.period.1y': '1 ปี',
  'stats.period.all': 'ทั้งหมด',
  'stats.period.in':
    '{period, select, 7d {ใน 7 วันที่ผ่านมา} 30d {ใน 30 วันที่ผ่านมา} 3m {ใน 3 เดือนที่ผ่านมา} 6m {ใน 6 เดือนที่ผ่านมา} 1y {ในปีที่ผ่านมา} all {ตลอดช่วงเวลาทั้งหมด} other {ในช่วงเวลานี้}}',

  // Charts (src/components/charts/chart-utils.ts) ------------------------------------
  'stats.chart.noData': 'ไม่มีข้อมูลที่จะแสดง',
  'stats.chart.xAxisDate': 'วันที่',
  'stats.chart.valueWithUnit': '{value} {unit}',
  // Tooltip of one bar / marker: series label, x label (a date or a weekday), value with unit.
  'stats.chart.pointTooltip': '{label}, {x}: {value}',
  'stats.chart.summary': '{label}: {count, plural, other {# ค่า}} ต่ำสุด {min} สูงสุด {max} ค่าเฉลี่ย {mean}',
  'stats.chart.summaryEmpty': '{label}: ไม่มีข้อมูล',
  'stats.chart.range': '{count, plural, =1 {มีจุดเวลาเดียว: {from}} other {# จุดเวลา ตั้งแต่ {from} ถึง {to}}}',
};
export default messages;
