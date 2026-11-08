/** th - insights messages. Keys are prefixed 'insights.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Insights page (src/pages/InsightsPage.tsx) ---------------------------------------
  'insights.title': 'ข้อสังเกต',
  'insights.period': 'ช่วงเวลา',
  'insights.refresh': 'รีเฟรช',
  'insights.notesTitle': 'ไม่ได้ตรวจสอบ / ข้อมูลไม่เพียงพอ',
  'insights.disclaimer': 'ข้อสังเกตเหล่านี้อธิบายความสัมพันธ์ที่อาจมีอยู่ในข้อมูลของคุณ ไม่ได้ยืนยันว่าสิ่งหนึ่งเป็นสาเหตุของอีกสิ่งหนึ่ง และไม่ใช่คำแนะนำทางการแพทย์',
  'insights.empty.title': 'ยังไม่มีข้อสังเกตสำหรับช่วงเวลานี้',
  'insights.empty.text':
    'การค้นหารูปแบบต้องมีข้อมูลอย่างน้อย {minDays} วันในช่วงเวลานั้น และอย่างน้อย {minGroupSize} วันในแต่ละกลุ่มที่นำมาเปรียบเทียบ (เช่น วันที่ออกกำลังกายกับวันที่ไม่ได้ออกกำลังกาย) เขียนไดอารี่และบันทึกอารมณ์ การนอน และกิจกรรมต่อไปเรื่อย ๆ',
  'insights.newEntry': 'บันทึกใหม่',
  // {inPeriod} is 'stats.period.in' ("in the last 30 days"), {start}/{end} are short dates.
  'insights.summary': 'มีข้อมูล {count, plural, other {# วัน}} {inPeriod} ({start} – {end})',
  'insights.found': '{count, plural, =0 {ไม่พบข้อสังเกต} other {พบข้อสังเกต # รายการ}}',

  // Section headings (src/pages/insights/insight-groups.ts) --------------------------
  'insights.group.trends': 'แนวโน้ม',
  'insights.group.habits': 'นิสัย',
  'insights.group.sleepActivity': 'การนอนและกิจกรรม',
  'insights.group.daysHours': 'วันและช่วงเวลา',
  'insights.group.emotionsPeople': 'ความรู้สึกและผู้คน',
  'insights.group.anomalies': 'ความผิดปกติ',
  'insights.group.other': 'ข้อสังเกตอื่น ๆ',

  // Strength and direction badges ---------------------------------------------------
  'insights.strength.strong': 'รูปแบบชัดเจน',
  'insights.strength.moderate': 'รูปแบบปานกลาง',
  'insights.strength.weak': 'รูปแบบไม่ชัดเจน',
  'insights.positive': 'น่ายินดี',
  'insights.attention': 'ควรใส่ใจ',

  // Insight card (src/pages/insights/InsightCard.tsx) --------------------------------
  'insights.card.why': 'ทำไมฉันจึงได้รับข้อสังเกตนี้?',
  'insights.card.evidenceCaption': 'ข้อมูลเบื้องหลังข้อสังเกตนี้',
  'insights.card.relatedDays': 'วันที่เกี่ยวข้อง',
  'insights.card.period': 'ช่วงเวลา: {start} – {end}',
  'insights.card.detail': 'รายละเอียด',
  'insights.card.value': 'ค่า',
  'insights.card.daysExamined': 'จำนวนวันที่ตรวจสอบ',
  'insights.card.metric': 'ตัวชี้วัด',
  'insights.card.correlation': 'สหสัมพันธ์ (r)',
  'insights.card.effectSize': 'ขนาดของความแตกต่าง',
  'insights.card.groupRow': '{count, plural, other {# วัน}} ค่าเฉลี่ย {mean}',
  'insights.card.groupRowNoMean': '{count, plural, other {# วัน}}',

  // Home page (src/pages/HomePage.tsx, GET /api/home) --------------------------------
  'insights.home.title': 'หน้าแรก',
  'insights.home.newEntry': 'บันทึกใหม่',
  'insights.home.greetingLabel': 'คำทักทาย',
  'insights.home.today': 'วันนี้',
  'insights.home.weekAverages': 'ค่าเฉลี่ย 7 วันล่าสุด',
  'insights.home.habitsToday': 'นิสัยของวันนี้',
  'insights.home.insightOfDay': 'ข้อสังเกตของวันนี้',
  'insights.home.lastEntry': 'บันทึกล่าสุด',
  'insights.home.noData': 'ไม่มีข้อมูล',
  'insights.home.noHabits': 'ไม่มีนิสัยที่ใช้งานอยู่',
  'insights.home.manageHabits': 'จัดการนิสัย',
  'insights.home.allHabits': 'นิสัยทั้งหมด',
  'insights.home.allInsights': 'ข้อสังเกตทั้งหมด',
  'insights.home.noInsight': 'ยังไม่มีข้อสังเกต เขียนไดอารี่และบันทึกการนอน อารมณ์ และกิจกรรมต่อไปเพื่อค้นพบรูปแบบต่าง ๆ',
  'insights.home.noEntriesTitle': 'ยังไม่มีบันทึกไดอารี่',
  'insights.home.noEntriesText': 'ทุกข้อสังเกตเริ่มต้นจากบันทึกแรก แค่ไม่กี่ประโยคเกี่ยวกับวันของคุณก็เพียงพอแล้ว',
  'insights.home.firstEntry': 'เขียนบันทึกแรก',
  'insights.home.untitled': 'ไม่มีชื่อเรื่อง',
  'insights.home.streak': 'เขียนต่อเนื่อง: {count, plural, other {# วัน}}',
  'insights.home.entriesToday': '{count, plural, =0 {วันนี้ยังไม่ได้เขียนบันทึก} other {วันนี้มี # บันทึก}}',
  'insights.home.totalEntries': '{count, plural, other {มีบันทึกในไดอารี่ทั้งหมด # รายการ}}',
  'insights.home.ratingOf10': '{value} จาก 10',
  'insights.home.sleepHours': '{value} ชั่วโมง',
  'insights.home.lastEntryMood': 'อารมณ์: {value}',
};
export default messages;
