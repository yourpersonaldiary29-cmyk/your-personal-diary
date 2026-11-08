/** th - search messages. Keys are prefixed 'search.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Search page (src/pages/SearchPage.tsx) -------------------------------------------
  'search.title': 'ค้นหา',
  'search.label': 'ถามไดอารี่ของคุณ',
  'search.hint': 'ถามได้อย่างอิสระ เช่น เกี่ยวกับวัน อารมณ์ การนอน หรือคำที่คุณเคยเขียน',
  'search.submit': 'ค้นหา',
  'search.searching': 'กำลังค้นหา…',
  'search.examplesTitle': 'ตัวอย่างคำถาม',
  'search.recentTitle': 'คำถามล่าสุด',
  'search.clearRecent': 'ล้าง',
  'search.resultsTitle': 'ผลลัพธ์',
  'search.understood': 'ฉันเข้าใจคำถามแบบนี้',
  'search.answer': 'คำตอบ',
  'search.days': 'วัน',
  'search.entries': 'บันทึก',
  'search.emptyQuestion': 'โปรดพิมพ์คำถาม',
  'search.untitled': 'ไม่มีชื่อเรื่อง',
  'search.noRatings': 'ไม่มีคะแนน',
  'search.period': 'ช่วงเวลา: {label}',
  'search.matches': '{count, plural, other {พบ # รายการที่ตรงกัน}}',

  // Per-day metrics line under a matching day ("mood 8, energy 7, sleep 7.5 hours, 1 entry")
  'search.day.mood': 'อารมณ์ {value}',
  'search.day.energy': 'พลังงาน {value}',
  'search.day.stress': 'ความเครียด {value}',
  'search.day.sleep': 'การนอน {hours}',
  'search.day.entries': '{count, plural, other {# บันทึก}}',
  'search.day.separator': ', ',

  // Example questions. The server-side parser must understand these in every language
  // (keys 'search.example.1'..'search.example.6' are the contract with the search module).
  'search.example.1': 'เดือนที่แล้ววันไหนที่ฉันรู้สึกดีที่สุด?',
  'search.example.2': 'ฉันเขียนว่าฉันเหนื่อยเมื่อไหร่?',
  'search.example.3': 'วันไหนที่ฉันนอนน้อยกว่าห้าชั่วโมง?',
  'search.example.4': 'อารมณ์ของฉันเปลี่ยนไปอย่างไรในสามเดือนที่ผ่านมา?',
  'search.example.5': 'วันไหนที่ฉันเครียด?',
  'search.example.6': 'บันทึกที่มีแท็กงาน',
};
export default messages;
