/**
 * he - emotions messages. Keys are prefixed 'emotions.'; see shared/i18n/index.ts for the syntax.
 *
 * 'emotions.<key>.label'   - the label shown in the UI (emotion picker, badges, exports).
 * 'emotions.<key>.aliases' - comma-separated words the search parser also resolves to the
 *                            key (feminine forms, nouns, synonyms).
 */
const messages: Record<string, string> = {
  'emotions.happy.label': 'שמח',
  'emotions.happy.aliases': 'שמחה,שמחתי,מאושר,מאושרת',
  'emotions.calm.label': 'רגוע',
  'emotions.calm.aliases': 'רגועה,שלווה,שלו,נינוח,נינוחה',
  'emotions.sad.label': 'עצוב',
  'emotions.sad.aliases': 'עצובה,עצבות',
  'emotions.angry.label': 'כועס',
  'emotions.angry.aliases': 'כועסת,כעס,עצבני,עצבנית',
  'emotions.stressed.label': 'לחוץ',
  'emotions.stressed.aliases': 'לחוצה,לחץ,מתוח,מתוחה',
  'emotions.excited.label': 'נרגש',
  'emotions.excited.aliases': 'נרגשת,התרגשות',
  'emotions.tired.label': 'עייף',
  'emotions.tired.aliases': 'עייפה,עייפות,מותש,מותשת,תשוש,תשושה',
  'emotions.satisfied.label': 'מרוצה',
  'emotions.satisfied.aliases': 'שביעות רצון,מסופק,מסופקת',
  'emotions.frustrated.label': 'מתוסכל',
  'emotions.frustrated.aliases': 'מתוסכלת,תסכול',
  'emotions.anxious.label': 'חרד',
  'emotions.anxious.aliases': 'חרדה,חרדות,מודאג,מודאגת,דאגה',
  'emotions.energetic.label': 'מלא אנרגיה',
  'emotions.energetic.aliases': 'אנרגטי,אנרגטית,מלאת אנרגיה',
  'emotions.grateful.label': 'אסיר תודה',
  'emotions.grateful.aliases': 'אסירת תודה,הכרת תודה,מודה',
  'emotions.lonely.label': 'בודד',
  'emotions.lonely.aliases': 'בודדה,בדידות',
  'emotions.hopeful.label': 'מלא תקווה',
  'emotions.hopeful.aliases': 'מלאת תקווה,אופטימי,אופטימית,תקווה',
  'emotions.bored.label': 'משועמם',
  'emotions.bored.aliases': 'משועממת,שעמום',
  'emotions.proud.label': 'גאה',
  'emotions.proud.aliases': 'גאווה',
  'emotions.focused.label': 'מרוכז',
  'emotions.focused.aliases': 'מרוכזת,ריכוז',
  'emotions.overwhelmed.label': 'מוצף',
  'emotions.overwhelmed.aliases': 'מוצפת,הצפה',
};
export default messages;
