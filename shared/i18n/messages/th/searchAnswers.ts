/**
 * th - searchAnswers messages (server/src/search: parser explanations, period labels,
 * executor answers). Keys are prefixed 'searchAnswers.'; see shared/i18n/index.ts for the syntax.
 *
 * `{period}` is a ready phrase ("ในเดือนที่ผ่านมา", "ในไดอารี่ทั้งหมด"). Thai has no plural
 * forms, so plurals use 'other' (plus `=1` where the English sentence changes). The zero-result
 * answers start with the exact text of 'searchAnswers.noResults'.
 */
const messages: Record<string, string> = {
  // Period labels (ParsedQuery.periodLabel and the {period} of every sentence) --------
  'searchAnswers.period.all': 'ตลอดช่วงเวลา',
  'searchAnswers.period.allPhrase': 'ในไดอารี่ทั้งหมด',
  'searchAnswers.period.today': 'วันนี้',
  'searchAnswers.period.yesterday': 'เมื่อวาน',
  'searchAnswers.period.twoDaysAgo': 'เมื่อวานซืน',
  'searchAnswers.period.week': 'ในสัปดาห์ที่ผ่านมา',
  'searchAnswers.period.month': 'ในเดือนที่ผ่านมา',
  'searchAnswers.period.halfYear': 'ในหกเดือนที่ผ่านมา',
  'searchAnswers.period.year': 'ในปีที่ผ่านมา',
  'searchAnswers.period.startYear': 'ตั้งแต่ต้นปี',
  'searchAnswers.period.startMonth': 'ตั้งแต่ต้นเดือน',
  'searchAnswers.period.recent': 'ในช่วงไม่กี่วันที่ผ่านมา',
  'searchAnswers.period.lastDays': '{count, plural, =1 {วันนี้} other {ใน # วันที่ผ่านมา}}',
  'searchAnswers.period.lastWeeks': '{count, plural, =1 {ในสัปดาห์ที่ผ่านมา} other {ใน # สัปดาห์ที่ผ่านมา}}',
  'searchAnswers.period.lastMonths': '{count, plural, =1 {ในเดือนที่ผ่านมา} other {ใน # เดือนที่ผ่านมา}}',
  'searchAnswers.period.lastYears': '{count, plural, =1 {ในปีที่ผ่านมา} other {ใน # ปีที่ผ่านมา}}',
  'searchAnswers.period.agoDays': '{count, plural, =1 {หนึ่งวันก่อน} other {# วันก่อน}}',
  'searchAnswers.period.agoWeeks': '{count, plural, =1 {หนึ่งสัปดาห์ก่อน} other {# สัปดาห์ก่อน}}',
  'searchAnswers.period.agoMonths': '{count, plural, =1 {หนึ่งเดือนก่อน} other {# เดือนก่อน}}',
  'searchAnswers.period.agoYears': '{count, plural, =1 {หนึ่งปีก่อน} other {# ปีก่อน}}',
  'searchAnswers.period.calendarMonth': 'ในเดือน{month} ค.ศ. {year}',
  'searchAnswers.period.onDate': 'วันที่ {date}',
  'searchAnswers.period.between': 'ระหว่าง {from} ถึง {to}',

  // Comparators ("less than 5") ------------------------------------------------------
  'searchAnswers.comparator.lt': 'น้อยกว่า {value}',
  'searchAnswers.comparator.lte': 'ไม่เกิน {value}',
  'searchAnswers.comparator.gt': 'มากกว่า {value}',
  'searchAnswers.comparator.gte': 'อย่างน้อย {value}',
  'searchAnswers.comparator.eq': 'เท่ากับ {value}',

  // Lists and quoting ----------------------------------------------------------------
  'searchAnswers.quoted': '"{term}"',
  'searchAnswers.listSeparator': ', ',
  'searchAnswers.dayWithValues': '{day} ({values})',
  'searchAnswers.value.mood': 'อารมณ์ {value}',
  'searchAnswers.value.energy': 'พลังงาน {value}',
  'searchAnswers.value.stress': 'ความเครียด {value}',
  'searchAnswers.value.sleepHours': 'ชั่วโมงการนอน {value}',
  'searchAnswers.value.sleepQuality': 'คุณภาพการนอน {value}',
  'searchAnswers.value.exerciseMinutes': 'นาทีที่ออกกำลังกาย {value}',
  'searchAnswers.mention.something': 'บางอย่าง',

  // "How I understood the question" (ParsedQuery.explanation) ------------------------
  'searchAnswers.explain.best': 'ฉันเข้าใจว่า: วันที่คุณรู้สึกดีที่สุด {period}',
  'searchAnswers.explain.bestByMetric':
    'ฉันเข้าใจว่า: วันที่ดีที่สุดตาม{metric, select, mood {อารมณ์} energy {ระดับพลังงาน} stress {ระดับความเครียด} sleepHours {ชั่วโมงการนอน} sleepQuality {คุณภาพการนอน} exerciseMinutes {นาทีที่ออกกำลังกาย} other {ค่าที่บันทึก}} {period}',
  'searchAnswers.explain.worst': 'ฉันเข้าใจว่า: วันที่ยากที่สุด {period}',
  'searchAnswers.explain.worstByMetric':
    'ฉันเข้าใจว่า: วันที่ยากที่สุดตาม{metric, select, mood {อารมณ์} energy {ระดับพลังงาน} stress {ระดับความเครียด} sleepHours {ชั่วโมงการนอน} sleepQuality {คุณภาพการนอน} exerciseMinutes {นาทีที่ออกกำลังกาย} other {ค่าที่บันทึก}} {period}',
  'searchAnswers.explain.filter':
    'ฉันเข้าใจว่า: วันที่มี{metric, select, mood {อารมณ์} energy {ระดับพลังงาน} stress {ระดับความเครียด} sleepHours {ชั่วโมงการนอน} sleepQuality {คุณภาพการนอน} exerciseMinutes {นาทีที่ออกกำลังกาย} other {ค่าที่บันทึก}}{comparison} {period}',
  'searchAnswers.explain.trend':
    'ฉันเข้าใจว่า: {metric, select, mood {อารมณ์} energy {ระดับพลังงาน} stress {ระดับความเครียด} sleepHours {ชั่วโมงการนอน} sleepQuality {คุณภาพการนอน} exerciseMinutes {นาทีที่ออกกำลังกาย} other {ค่าต่าง ๆ}}ของคุณเปลี่ยนแปลงอย่างไร {period}',
  'searchAnswers.explain.mention': 'ฉันเข้าใจว่า: บันทึกที่คุณเขียนถึง {terms} {period}',
  'searchAnswers.explain.mentionAny': 'ฉันเข้าใจว่า: บันทึกที่คุณเขียน {period}',
  'searchAnswers.explain.emotion': 'ฉันเข้าใจว่า: วันที่คุณรู้สึก{emotions} {period}',
  'searchAnswers.explain.list': 'ฉันเข้าใจว่า: บันทึกที่มีคำว่า {terms} {period}',
  'searchAnswers.explain.listAll': 'ฉันเข้าใจว่า: บันทึกทั้งหมด {period}',
  'searchAnswers.explain.unknown': 'ฉันไม่เข้าใจคำถามนี้ ลองถามแบบนี้ดู เช่น "เดือนที่แล้ววันไหนที่ฉันรู้สึกดีที่สุด?"',

  // Answers ---------------------------------------------------------------------------
  'searchAnswers.noResults': 'ไม่พบบันทึกที่ตรงกับคำถาม',
  'searchAnswers.noResultsPeriod': 'ไม่พบบันทึกที่ตรงกับคำถาม {period}',
  'searchAnswers.rank.best': 'วันที่คุณรู้สึกดีที่สุด {period}: {days}',
  'searchAnswers.rank.bestByMetric':
    'วันที่ดีที่สุดตาม{metric, select, mood {อารมณ์} energy {ระดับพลังงาน} stress {ระดับความเครียด} sleepHours {ชั่วโมงการนอน} sleepQuality {คุณภาพการนอน} exerciseMinutes {นาทีที่ออกกำลังกาย} other {ค่าที่บันทึก}} {period}: {days}',
  'searchAnswers.rank.worst': 'วันที่ยากที่สุด {period}: {days}',
  'searchAnswers.rank.worstByMetric':
    'วันที่ยากที่สุดตาม{metric, select, mood {อารมณ์} energy {ระดับพลังงาน} stress {ระดับความเครียด} sleepHours {ชั่วโมงการนอน} sleepQuality {คุณภาพการนอน} exerciseMinutes {นาทีที่ออกกำลังกาย} other {ค่าที่บันทึก}} {period}: {days}',
  'searchAnswers.filter.found':
    'พบ {count, plural, other {# วัน}}ที่มี{metric, select, mood {อารมณ์} energy {ระดับพลังงาน} stress {ระดับความเครียด} sleepHours {ชั่วโมงการนอน} sleepQuality {คุณภาพการนอน} exerciseMinutes {นาทีที่ออกกำลังกาย} other {ค่าที่บันทึก}}{comparison} {period}: {days}{more, plural, =0 {} other { และอีก # วัน}}',
  'searchAnswers.emotion.found':
    'คุณรู้สึก{emotions}ใน {count, plural, other {# วัน}} {period}: {days}{more, plural, =0 {} other { และอีก # วัน}}',
  'searchAnswers.mention.found':
    'คุณเขียนถึง {terms} ใน{count, plural, =1 {บันทึก # รายการ {period} เมื่อ {first}} other {บันทึก # รายการ {period} ครั้งแรกเมื่อ {first} และครั้งล่าสุดเมื่อ {last}}}',
  'searchAnswers.list.found': 'พบ {count, plural, other {# บันทึก}} {period} ล่าสุดเมื่อ {last}',
  'searchAnswers.list.foundTerms':
    'พบ {count, plural, other {# บันทึกที่มีคำว่า}} {terms} {period} ล่าสุดเมื่อ {last}',
  'searchAnswers.unknown.fallback':
    'ฉันไม่แน่ใจว่าคำถามหมายถึงอะไร จึงแสดง{count, plural, =1 {บันทึกล่าสุด} other {บันทึกล่าสุด # รายการ}}จากทั้งหมด {total} รายการ {explanation}',
  'searchAnswers.trend.insufficient':
    'ข้อมูลยังไม่เพียงพอสำหรับดูแนวโน้มของ{metric, select, mood {อารมณ์} energy {ระดับพลังงาน} stress {ระดับความเครียด} sleepHours {ชั่วโมงการนอน} sleepQuality {คุณภาพการนอน} exerciseMinutes {นาทีที่ออกกำลังกาย} other {ค่าต่าง ๆ}}ของคุณ {period}',
  'searchAnswers.trend.evidence':
    '(จาก {first, plural, other {# วัน}}ช่วงต้นเทียบกับ {last, plural, other {# วัน}}ช่วงท้ายของช่วงเวลา)',
  'searchAnswers.trend.stable':
    '{metric, select, mood {อารมณ์} energy {ระดับพลังงาน} stress {ระดับความเครียด} sleepHours {ชั่วโมงการนอน} sleepQuality {คุณภาพการนอน} exerciseMinutes {นาทีที่ออกกำลังกาย} other {ค่า}}เฉลี่ยของคุณคงที่ {period}: {from} เทียบกับ {to} {evidence}',
  'searchAnswers.trend.up':
    '{metric, select, mood {อารมณ์} energy {ระดับพลังงาน} stress {ระดับความเครียด} sleepHours {ชั่วโมงการนอน} sleepQuality {คุณภาพการนอน} exerciseMinutes {นาทีที่ออกกำลังกาย} other {ค่า}}เฉลี่ยของคุณเพิ่มขึ้นจาก {from} เป็น {to} {period} {evidence}',
  'searchAnswers.trend.down':
    '{metric, select, mood {อารมณ์} energy {ระดับพลังงาน} stress {ระดับความเครียด} sleepHours {ชั่วโมงการนอน} sleepQuality {คุณภาพการนอน} exerciseMinutes {นาทีที่ออกกำลังกาย} other {ค่า}}เฉลี่ยของคุณลดลงจาก {from} เป็น {to} {period} {evidence}',

  // Request validation (POST /api/search) ----------------------------------------------
  'searchAnswers.validation.body': 'เนื้อหาของคำขอต้องมีคำถาม (query)',
  'searchAnswers.validation.query': 'โปรดพิมพ์คำถาม',
  'searchAnswers.validation.queryTooLong': 'คำถามยาวเกินไป (ไม่เกิน {max} ตัวอักษร)',
  'searchAnswers.validation.limit': 'จำนวนผลลัพธ์ต้องเป็นจำนวนเต็มระหว่าง 1 ถึง {max}',
};
export default messages;
