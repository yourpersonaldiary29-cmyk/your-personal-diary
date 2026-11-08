/**
 * th - emotions messages. Keys are prefixed 'emotions.'; see shared/i18n/index.ts for the syntax.
 *
 * 'emotions.<key>.label'   - the label shown in the UI (emotion picker, badges, exports).
 * 'emotions.<key>.aliases' - comma-separated words the search parser also resolves to the
 *                            key (synonyms, other forms, nouns). Lowercase; matching is
 *                            case-insensitive. Keep the list in this language's own words.
 *
 * Thai search cuts a question at every known word found inside it, so aliases avoid short
 * words that also occur inside unrelated words (e.g. สุข in สุขภาพ, หวัง in ผิดหวัง, ท้อ in ท้อง).
 */
const messages: Record<string, string> = {
  'emotions.happy.label': 'มีความสุข',
  'emotions.happy.aliases': 'ความสุข,ดีใจ,สุขใจ,แฮปปี้,เบิกบาน,เบิกบานใจ,ร่าเริง,ปลื้ม',
  'emotions.calm.label': 'สงบ',
  'emotions.calm.aliases': 'ใจสงบ,ความสงบ,สงบใจ,ผ่อนคลาย,สบายใจ,เยือกเย็น,ไม่เครียด',
  'emotions.sad.label': 'เศร้า',
  'emotions.sad.aliases': 'ความเศร้า,เศร้าใจ,เสียใจ,ทุกข์ใจ,หดหู่,ซึมเศร้า,ผิดหวัง,สิ้นหวัง,ห่อเหี่ยว,ใจแป้ว',
  'emotions.angry.label': 'โกรธ',
  'emotions.angry.aliases': 'ความโกรธ,โมโห,หัวเสีย,ฉุนเฉียว,หงุดหงิด,ขุ่นเคือง,รำคาญ,ไม่พอใจ',
  'emotions.stressed.label': 'เครียด',
  'emotions.stressed.aliases': 'ตึงเครียด,เคร่งเครียด,กดดัน,ถูกกดดัน,เครียดมาก',
  'emotions.excited.label': 'ตื่นเต้น',
  'emotions.excited.aliases': 'ความตื่นเต้น,กระตือรือร้น,ใจเต้นแรง,ตื่นเต้นมาก',
  'emotions.tired.label': 'เหนื่อย',
  'emotions.tired.aliases': 'ความเหนื่อย,เหนื่อยล้า,อ่อนเพลีย,เพลีย,หมดแรง,ง่วง,ง่วงนอน,อ่อนล้า,หมดพลัง',
  'emotions.satisfied.label': 'พอใจ',
  'emotions.satisfied.aliases': 'ความพอใจ,พึงพอใจ,อิ่มใจ,สมหวัง,พอใจมาก',
  'emotions.frustrated.label': 'คับข้องใจ',
  'emotions.frustrated.aliases': 'หงุดหงิดใจ,ท้อแท้,อึดอัดใจ,ขัดใจ,ขัดข้องใจ',
  'emotions.anxious.label': 'กังวล',
  'emotions.anxious.aliases': 'วิตกกังวล,ความกังวล,เป็นห่วง,กระวนกระวาย,ประหม่า,หวั่นใจ,กลัว,วิตก,ไม่สบายใจ',
  'emotions.energetic.label': 'กระปรี้กระเปร่า',
  'emotions.energetic.aliases': 'มีพลัง,เต็มไปด้วยพลัง,กระฉับกระเฉง,สดชื่น,ไฟแรง',
  'emotions.grateful.label': 'ซาบซึ้งใจ',
  'emotions.grateful.aliases': 'รู้สึกขอบคุณ,ขอบคุณ,ซาบซึ้ง,สำนึกบุญคุณ,กตัญญู',
  'emotions.lonely.label': 'เหงา',
  'emotions.lonely.aliases': 'ความเหงา,โดดเดี่ยว,อ้างว้าง,เดียวดาย,ว้าเหว่',
  'emotions.hopeful.label': 'มีความหวัง',
  'emotions.hopeful.aliases': 'ความหวัง,มองโลกในแง่ดี,คิดบวก,เปี่ยมความหวัง',
  'emotions.bored.label': 'เบื่อ',
  'emotions.bored.aliases': 'เบื่อหน่าย,ความเบื่อ,น่าเบื่อ,เซ็ง',
  'emotions.proud.label': 'ภูมิใจ',
  'emotions.proud.aliases': 'ความภูมิใจ,ภาคภูมิใจ,ภูมิใจมาก',
  'emotions.focused.label': 'มีสมาธิ',
  'emotions.focused.aliases': 'จดจ่อ,โฟกัส,มีสมาธิดี',
  'emotions.overwhelmed.label': 'รับมือไม่ไหว',
  'emotions.overwhelmed.aliases': 'ท่วมท้น,หนักอึ้ง,งานล้นมือ,ล้นมือ,หนักเกินไป',
};
export default messages;
