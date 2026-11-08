/**
 * th - Thai keyword table of the smart-search parser (schema: ./index.ts).
 *
 * Thai is written without spaces, so the table uses the 'segmenter' tokenizer: the question is
 * first cut at every phrase of this table found as a substring (longest first at each position),
 * and the rest is split with Intl.Segmenter. Consequences for the lists below:
 *  - Every word here is a cutting point. Short words that start longer everyday words are
 *    avoided (หา, ดู, ขอ, นะ, แต่, มา, เรา, เพื่อ, หนัก, เดิน ...), and the longer words are listed whole where a
 *    cut would change the meaning (อยาก is a stopword so ยาก is not read as "hard"; ว่ายน้ำ is an
 *    exercise word so ว่า is not cut out of it; มีพลังงาน is a metric so มีพลัง is not read).
 *  - The words under `thresholdUnits` with a null value after 'แต้ม' are ordinary nouns that begin
 *    with a number word or a month abbreviation (สามี, ห้าง, เก้าอี้, พยาบาล ...). They are listed
 *    only so the segmenter keeps them whole; they have an effect only right after a threshold
 *    number, which never happens in practice.
 *  - "last week / month / year" are single phrases (สัปดาห์ที่แล้ว, เดือนก่อน ...), while
 *    "the last N units" is read as number + unit + ที่ผ่านมา (ใน 3 เดือนที่ผ่านมา) and "N days ago"
 *    as number + วัน + ที่แล้ว / ก่อน. For weeks, months and years "N ... ที่แล้ว" falls back to the
 *    fixed "last week / month / year" period.
 *  - Comparators stand before the number (น้อยกว่า 5, อย่างน้อย 8), as Thai writes them.
 *  - Thai numerals (๐-๙) are listed as number words so "๕ ชั่วโมง" works like "5 ชั่วโมง".
 */
import type { SearchLanguageTable } from './index';

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';

/** Thai numerals 0..max -> value ('๕' -> 5, '๓๐' -> 30). */
function thaiNumerals(max: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (let n = 0; n <= max; n++) out[String(n).replace(/\d/g, (d) => THAI_DIGITS[Number(d)])] = n;
  return out;
}

const table: SearchLanguageTable = {
  locale: 'th',
  script: 'thai',
  tokenizer: 'segmenter',
  dateOrder: 'dmy',
  prefixes: [],
  articlePrefixes: [],
  numberPrefixLetters: '',
  barePrefixTokens: [],
  articles: [],
  stopwords: [
    // question words
    'วันไหน', 'วันไหนบ้าง', 'ไหน', 'บ้าง', 'อะไร', 'อย่างไร', 'ยังไง', 'เมื่อไหร่', 'เมื่อไร', 'ตอนไหน', 'ช่วงไหน', 'แค่ไหน',
    'เท่าไหร่', 'เท่าไร', 'ทำไม', 'ใคร', 'หรือเปล่า', 'หรือไม่', 'ไหม', 'มั้ย', 'ใช่ไหม', 'กี่',
    // pronouns
    'ฉัน', 'ผม', 'ดิฉัน', 'ตัวเอง', 'ของฉัน', 'ของผม', 'ของเรา', 'ของตัวเอง', 'เธอ',
    // particles, prepositions, conjunctions
    'ครับ', 'ค่ะ', 'คะ', 'จ้ะ', 'จ๊ะ', 'ล่ะ', 'หน่อย', 'ด้วย', 'เลย', 'แล้ว', 'อยู่', 'ได้', 'ไป', 'ก็', 'จะ', 'ที่',
    'ซึ่ง', 'ว่า', 'และ', 'กับ', 'หรือ', 'ของ', 'ใน', 'จาก', 'ถึง', 'ตอน', 'เมื่อ', 'เป็น', 'คือ', 'มี', 'ให้', 'โดย',
    'นี้', 'นั้น', 'นี่', 'นั่น', 'ทุก', 'บาง', 'หลาย', 'ช่วง', 'ช่วงเวลา', 'ระหว่าง', 'เกี่ยวกับ', 'เรื่อง', 'สำหรับ',
    'ตลอด', 'ทั้งหมด', 'ทั้ง', 'แค่', 'เพียง', 'ตั้งแต่', 'จนถึง', 'เคย', 'กำลัง', 'ยัง',
    // degree and filler words
    'มาก', 'มากมาย', 'จริงๆ', 'ค่อนข้าง', 'นิดหน่อย', 'เกินไป', 'ครั้ง', 'เวลา', 'ตอนนี้', 'สามารถ', 'ประมาณ',
    // diary vocabulary and request words
    'วัน', 'บันทึก', 'ไดอารี่', 'ไดอารี', 'รายการ', 'แท็ก', 'ติดแท็ก', 'ป้ายกำกับ', 'ข้อความ', 'รู้สึก', 'รู้สึกว่า', 'แสดง',
    'ค้นหา', 'บอก', 'อยาก', 'อยากรู้', 'อยากเห็น', 'ต้องการ', 'สวัสดี', 'ว่าง', 'พยายาม', 'ห้าม', 'วันอาทิตย์', 'วันจันทร์',
    'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันพฤหัส', 'วันศุกร์', 'วันเสาร์', 'ครึ่ง',
  ],
  numberWords: {
    หนึ่ง: 1, สอง: 2, สาม: 3, สี่: 4, ห้า: 5, หก: 6, เจ็ด: 7, แปด: 8, เก้า: 9, สิบ: 10,
    สิบเอ็ด: 11, สิบสอง: 12, สิบห้า: 15, ยี่สิบ: 20, สามสิบ: 30, สี่สิบ: 40, สี่สิบห้า: 45, ห้าสิบ: 50, หกสิบ: 60,
    เก้าสิบ: 90, หนึ่งร้อย: 100, ร้อย: 100,
    ...thaiNumerals(100),
  },
  // "เจ็ดครึ่ง" = 7.5 (for hours Thai says "ห้าชั่วโมงครึ่ง", with the half after the unit, which the parser does not read)
  halfPhrases: ['ครึ่ง'],
  periods: {
    phrases: {
      'วันนี้': 'today',
      'เมื่อวาน': 'yesterday',
      'เมื่อวานนี้': 'yesterday',
      'เมื่อวานซืน': 'twoDaysAgo',
      'สัปดาห์นี้': 'week',
      'อาทิตย์นี้': 'week',
      'สัปดาห์ที่แล้ว': 'week',
      'อาทิตย์ที่แล้ว': 'week',
      'สัปดาห์ก่อน': 'week',
      'อาทิตย์ก่อน': 'week',
      'สัปดาห์ ที่ผ่านมา': 'week',
      'อาทิตย์ ที่ผ่านมา': 'week',
      'สัปดาห์ ล่าสุด': 'week',
      'เดือนนี้': 'month',
      'เดือนที่แล้ว': 'month',
      'เดือนก่อน': 'month',
      'เดือน ที่ผ่านมา': 'month',
      'เดือน ล่าสุด': 'month',
      'ครึ่งปี': 'halfYear',
      'ครึ่งปี ที่ผ่านมา': 'halfYear',
      'ปีนี้': 'year',
      'ปีที่แล้ว': 'year',
      'ปีก่อน': 'year',
      'ปี ที่ผ่านมา': 'year',
      'รอบปี ที่ผ่านมา': 'year',
      'ตั้งแต่ต้นปี': 'startYear',
      'ตั้งแต่ต้นปีนี้': 'startYear',
      'ตั้งแต่ต้นเดือน': 'startMonth',
      'ตั้งแต่ต้นเดือนนี้': 'startMonth',
      'ช่วงนี้': 'recent',
      'ระยะนี้': 'recent',
      'ช่วงหลังๆ': 'recent',
      'ช่วงหลังๆนี้': 'recent',
      'หลังๆนี้': 'recent',
      'เมื่อเร็วๆนี้': 'recent',
      'ไม่กี่วันที่ผ่านมา': 'recent',
      'ไม่กี่วันมานี้': 'recent',
      'หลายวันที่ผ่านมา': 'recent',
      'สองสามวันที่ผ่านมา': 'recent',
    },
    units: {
      'วัน': 'day',
      'สัปดาห์': 'week', 'อาทิตย์': 'week',
      'เดือน': 'month',
      'ปี': 'year',
    },
    lastWords: ['ที่ผ่านมา', 'ล่าสุด', 'หลังสุด', 'สุดท้าย', 'ย้อนหลัง'],
    dualWords: {},
    ago: { words: ['ที่แล้ว', 'ก่อน'], position: 'after' },
    monthAliases: {},
    monthNeedsContext: [],
    monthLeadWords: ['เดือน'],
    rangeConnectors: ['ระหว่าง', 'ถึง', 'จนถึง', 'ตั้งแต่', 'จาก', 'และ', 'กับ', 'วัน', 'ที่', 'ใน', 'เมื่อ'],
  },
  metrics: {
    'อารมณ์': 'mood', 'ระดับอารมณ์': 'mood', 'คะแนนอารมณ์': 'mood', 'มู้ด': 'mood',
    'พลังงาน': 'energy', 'พลัง': 'energy', 'ระดับพลังงาน': 'energy', 'มีพลังงาน': 'energy',
    'ความเครียด': 'stress', 'เครียด': 'stress', 'ระดับความเครียด': 'stress', 'ความกดดัน': 'stress', 'สเตรส': 'stress',
    'การนอน': 'sleepHours', 'นอน': 'sleepHours', 'นอนหลับ': 'sleepHours', 'การนอนหลับ': 'sleepHours', 'หลับ': 'sleepHours',
    'ชั่วโมงการนอน': 'sleepHours', 'ชั่วโมงนอน': 'sleepHours', 'เวลานอน': 'sleepHours',
    'คุณภาพการนอน': 'sleepQuality', 'คุณภาพการนอนหลับ': 'sleepQuality', 'คุณภาพของการนอน': 'sleepQuality',
    'ออกกำลังกาย': 'exerciseMinutes', 'การออกกำลังกาย': 'exerciseMinutes', 'ออกกำลัง': 'exerciseMinutes',
    'เล่นกีฬา': 'exerciseMinutes', 'กีฬา': 'exerciseMinutes', 'วิ่ง': 'exerciseMinutes', 'ว่ายน้ำ': 'exerciseMinutes',
    'ยิม': 'exerciseMinutes', 'ฟิตเนส': 'exerciseMinutes', 'โยคะ': 'exerciseMinutes', 'ปั่นจักรยาน': 'exerciseMinutes',
    'ปีนเขา': 'exerciseMinutes', 'เวิร์กเอาต์': 'exerciseMinutes', 'เดินเล่น': 'exerciseMinutes',
    'นาทีออกกำลังกาย': 'exerciseMinutes', 'กิจกรรมทางกาย': 'exerciseMinutes',
  },
  thresholdUnits: {
    'ชั่วโมง': 'sleepHours',
    'นาที': 'exerciseMinutes',
    'คะแนน': null, 'แต้ม': null,
    // Ordinary words kept whole (see the header): husband, mall, department store, chair, nurse,
    // climb, weekend, customer, abacus, film, witness, consonant, forecast, debt, trip, noon,
    // laugh, concentration - each begins with, or hides, a number word, a month abbreviation
    // (กค, พย) or a short stopword (นี้, ที่, เรา, มา).
    'สามี': null, 'ห้าง': null, 'ห้างสรรพสินค้า': null, 'เก้าอี้': null, 'พยาบาล': null, 'ปีน': null,
    'สุดสัปดาห์': null, 'ลูกค้า': null, 'ลูกคิด': null, 'ภาพยนตร์': null, 'พยาน': null, 'พยัญชนะ': null,
    'พยากรณ์': null, 'หนี้': null, 'เที่ยว': null, 'เที่ยง': null, 'หัวเราะ': null, 'สมาธิ': null,
  },
  comparators: [
    { words: ['น้อยกว่า'], comparator: 'lt' },
    { words: ['ต่ำกว่า'], comparator: 'lt' },
    { words: ['ไม่ถึง'], comparator: 'lt' },
    { words: ['ไม่เกิน'], comparator: 'lte' },
    { words: ['ไม่เกินกว่า'], comparator: 'lte' },
    { words: ['ไม่มากกว่า'], comparator: 'lte' },
    { words: ['ไม่สูงกว่า'], comparator: 'lte' },
    { words: ['อย่างมาก'], comparator: 'lte' },
    { words: ['สูงสุด'], comparator: 'lte' },
    { words: ['มากกว่า'], comparator: 'gt' },
    { words: ['สูงกว่า'], comparator: 'gt' },
    { words: ['เกินกว่า'], comparator: 'gt' },
    { words: ['เกิน'], comparator: 'gt' },
    { words: ['อย่างน้อย'], comparator: 'gte' },
    { words: ['ไม่น้อยกว่า'], comparator: 'gte' },
    { words: ['ไม่ต่ำกว่า'], comparator: 'gte' },
    { words: ['ขั้นต่ำ'], comparator: 'gte' },
    { words: ['ตั้งแต่'], comparator: 'gte' },
    { words: ['เท่ากับ'], comparator: 'eq' },
    { words: ['<'], comparator: 'lt' },
    { words: ['<='], comparator: 'lte' },
    { words: ['>'], comparator: 'gt' },
    { words: ['>='], comparator: 'gte' },
    { words: ['='], comparator: 'eq' },
  ],
  negations: ['ไม่ได้', 'ไม่', 'ไม่มี', 'งด', 'ขาด'],
  rank: {
    good: ['ดี', 'ดีมาก', 'ดีๆ', 'สดใส', 'สนุก', 'ยอดเยี่ยม'],
    bad: ['แย่', 'แย่มาก', 'แย่ๆ', 'ยาก', 'ลำบาก', 'เลวร้าย', 'ทรมาน', 'หนักหนา'],
    high: ['สูง', 'มาก'],
    low: ['ต่ำ', 'น้อย'],
    markersBefore: [],
    markersAfter: ['ที่สุด'],
    dayWords: ['วัน'],
    bare: {
      best: ['ดีที่สุด', 'ดีมาก', 'ดี', 'มีความสุขที่สุด', 'สุขที่สุด'],
      worst: ['แย่ที่สุด', 'แย่มาก', 'แย่', 'ยากที่สุด', 'หนักที่สุด', 'เลวร้ายที่สุด'],
      high: ['สูงที่สุด', 'สูงสุด', 'มากที่สุด'],
      low: ['ต่ำที่สุด', 'ต่ำสุด', 'น้อยที่สุด'],
    },
  },
  trend: {
    words: [
      'เปลี่ยนแปลง', 'ความเปลี่ยนแปลง', 'เปลี่ยนไป', 'แนวโน้ม', 'ดีขึ้น', 'แย่ลง', 'เพิ่มขึ้น', 'ลดลง', 'ค่าเฉลี่ย',
      'เฉลี่ย', 'พัฒนาการ', 'พัฒนา', 'ขึ้นลง', 'ผันผวน',
    ],
    leadWords: ['อย่างไร', 'ยังไง'],
  },
  trigger: {
    words: ['เขียน', 'เขียนว่า', 'เขียนถึง', 'เขียนไว้', 'จดไว้', 'บันทึกว่า', 'บันทึกไว้ว่า', 'พูดถึง', 'กล่าวถึง', 'เล่าว่า', 'เล่าถึง'],
    leadWords: ['ฉัน', 'ผม', 'เคย', 'ได้'],
    conjunctions: ['ว่า', 'ถึง', 'เกี่ยวกับ', 'เรื่อง'],
    conjunctionPrefix: null,
  },
  // Label first, then aliases (the catalogue's label and aliases are merged in as well).
  emotions: {
    happy: ['มีความสุข', 'ความสุข', 'ดีใจ', 'สุขใจ', 'แฮปปี้', 'ร่าเริง', 'ยินดี', 'ปลื้ม', 'เบิกบาน'],
    calm: ['สงบ', 'ใจสงบ', 'ผ่อนคลาย', 'สบายใจ', 'ไม่เครียด'],
    sad: ['เศร้า', 'เสียใจ', 'ทุกข์', 'ทุกข์ใจ', 'หดหู่', 'ซึมเศร้า', 'ผิดหวัง', 'สิ้นหวัง', 'น้อยใจ', 'ห่อเหี่ยว'],
    angry: ['โกรธ', 'โมโห', 'หัวเสีย', 'หงุดหงิด', 'ไม่พอใจ', 'รำคาญ', 'ฉุนเฉียว', 'อารมณ์เสีย'],
    stressed: ['เครียด', 'ความเครียด', 'ตึงเครียด', 'เคร่งเครียด', 'กดดัน'],
    excited: ['ตื่นเต้น', 'กระตือรือร้น'],
    tired: ['เหนื่อย', 'เหนื่อยล้า', 'อ่อนเพลีย', 'เพลีย', 'หมดแรง', 'ง่วง', 'ง่วงนอน', 'อ่อนล้า', 'หมดพลัง'],
    satisfied: ['พอใจ', 'พึงพอใจ', 'อิ่มใจ'],
    frustrated: ['คับข้องใจ', 'หงุดหงิดใจ', 'ท้อแท้', 'อึดอัดใจ'],
    anxious: ['กังวล', 'วิตกกังวล', 'เป็นห่วง', 'กระวนกระวาย', 'ประหม่า', 'กลัว', 'ไม่สบายใจ'],
    energetic: ['กระปรี้กระเปร่า', 'มีพลัง', 'กระฉับกระเฉง', 'สดชื่น'],
    grateful: ['ซาบซึ้งใจ', 'ซาบซึ้ง', 'ขอบคุณ', 'รู้สึกขอบคุณ'],
    lonely: ['เหงา', 'โดดเดี่ยว', 'อ้างว้าง', 'ว้าเหว่'],
    hopeful: ['มีความหวัง', 'ความหวัง', 'มองโลกในแง่ดี', 'คิดบวก'],
    bored: ['เบื่อ', 'เบื่อหน่าย', 'เซ็ง'],
    proud: ['ภูมิใจ', 'ภาคภูมิใจ'],
    focused: ['มีสมาธิ', 'จดจ่อ', 'โฟกัส'],
    overwhelmed: ['รับมือไม่ไหว', 'ท่วมท้น', 'งานล้นมือ', 'หนักอึ้ง'],
  },
  // The ten reference questions, in the order of en.ts.
  examples: [
    'เดือนที่แล้ววันไหนที่ฉันรู้สึกดีที่สุด?',
    'ฉันเขียนว่าฉันเหนื่อยเมื่อไหร่?',
    'วันไหนที่ฉันนอนน้อยกว่าห้าชั่วโมง?',
    'อารมณ์ของฉันเปลี่ยนไปอย่างไรในสามเดือนที่ผ่านมา?',
    'วันไหนที่ฉันเครียด?',
    'สัปดาห์นี้ฉันมีความสุขตอนไหน',
    'วันที่มีพลังงานมากกว่า 8 ในปีที่ผ่านมา',
    'บันทึกเกี่ยวกับงาน',
    'ในเดือนกรกฎาคม',
    'ระหว่าง 01/08/2026 ถึง 15/08/2026',
  ],
};

export default table;
