/** he - search messages. Keys are prefixed 'search.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Search page (src/pages/SearchPage.tsx) -------------------------------------------
  'search.title': 'חיפוש',
  'search.label': 'שאלו את היומן',
  'search.hint': 'שאלה חופשית, למשל על ימים, מצב רוח, שינה או מילים שכתבתם.',
  'search.submit': 'חפש',
  'search.searching': 'מחפש…',
  'search.examplesTitle': 'דוגמאות לשאלות',
  'search.recentTitle': 'שאלות אחרונות',
  'search.clearRecent': 'נקה',
  'search.resultsTitle': 'תוצאות',
  'search.understood': 'כך הבנתי את השאלה',
  'search.answer': 'תשובה',
  'search.days': 'ימים',
  'search.entries': 'רשומות',
  'search.emptyQuestion': 'יש להקליד שאלה',
  'search.untitled': 'ללא כותרת',
  'search.noRatings': 'ללא דירוגים',
  'search.period': 'תקופה: {label}',
  'search.matches': '{count, plural, one {נמצאה התאמה אחת} two {נמצאו שתי התאמות} other {נמצאו # התאמות}}',

  // Per-day metrics line under a matching day ("מצב רוח 8, אנרגיה 7, שינה 7.5 שעות, רשומה אחת")
  'search.day.mood': 'מצב רוח {value}',
  'search.day.energy': 'אנרגיה {value}',
  'search.day.stress': 'לחץ {value}',
  'search.day.sleep': 'שינה {hours}',
  'search.day.entries': '{count, plural, one {רשומה אחת} two {שתי רשומות} other {# רשומות}}',
  'search.day.separator': ', ',

  // Example questions. The server-side parser must understand these in every language
  // (keys 'search.example.1'..'search.example.6' are the contract with the search module).
  'search.example.1': 'אילו ימים בחודש האחרון הרגשתי הכי טוב?',
  'search.example.2': 'מתי כתבתי שאני עייף?',
  'search.example.3': 'באילו ימים ישנתי פחות מחמש שעות?',
  'search.example.4': 'איך השתנה מצב הרוח שלי בשלושת החודשים האחרונים?',
  'search.example.5': 'באילו ימים הייתי לחוץ?',
  'search.example.6': 'רשומות עם התגית עבודה',
};
export default messages;
