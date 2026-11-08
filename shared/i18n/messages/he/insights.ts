/** he - insights messages. Keys are prefixed 'insights.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Insights page (src/pages/InsightsPage.tsx) ---------------------------------------
  'insights.title': 'תובנות',
  'insights.period': 'תקופה',
  'insights.refresh': 'רענן',
  'insights.notesTitle': 'לא נבדק / אין מספיק נתונים',
  'insights.disclaimer': 'התובנות מתארות קשרים אפשריים בנתונים שלך. הן אינן קובעות סיבה ותוצאה ואינן ייעוץ רפואי.',
  'insights.empty.title': 'עדיין אין תובנות לתקופה זו',
  'insights.empty.text':
    'כדי לזהות דפוסים נדרשים לפחות {minDays} ימים עם נתונים בתקופה, ולפחות {minGroupSize} ימים בכל קבוצת השוואה (למשל ימים עם פעילות גופנית ובלי). המשיכו לכתוב ביומן ולדווח על מצב רוח, שינה ופעילות.',
  'insights.newEntry': 'רשומה חדשה',
  // {inPeriod} is 'stats.period.in' ("ב-30 ימים"), {start}/{end} are short dates.
  'insights.summary': '{count, plural, one {יום אחד} two {שני ימים} other {# ימים}} עם נתונים {inPeriod} ({start} – {end})',
  'insights.found': '{count, plural, =0 {לא נמצאו תובנות} one {נמצאה תובנה אחת} two {נמצאו שתי תובנות} other {נמצאו # תובנות}}',

  // Section headings (src/pages/insights/insight-groups.ts) --------------------------
  'insights.group.trends': 'מגמות',
  'insights.group.habits': 'הרגלים',
  'insights.group.sleepActivity': 'שינה ופעילות',
  'insights.group.daysHours': 'ימים ושעות',
  'insights.group.emotionsPeople': 'רגשות ואנשים',
  'insights.group.anomalies': 'חריגות',
  'insights.group.other': 'תובנות נוספות',

  // Strength and direction badges ---------------------------------------------------
  'insights.strength.strong': 'דפוס חזק',
  'insights.strength.moderate': 'דפוס בינוני',
  'insights.strength.weak': 'דפוס חלש',
  'insights.positive': 'מעודד',
  'insights.attention': 'לתשומת לב',

  // Insight card (src/pages/insights/InsightCard.tsx) --------------------------------
  'insights.card.why': 'למה קיבלתי את התובנה הזאת?',
  'insights.card.evidenceCaption': 'הנתונים מאחורי התובנה',
  'insights.card.relatedDays': 'ימים רלוונטיים',
  'insights.card.period': 'תקופה: {start} – {end}',
  'insights.card.detail': 'פרט',
  'insights.card.value': 'ערך',
  'insights.card.daysExamined': 'ימים שנבדקו',
  'insights.card.metric': 'מדד',
  'insights.card.correlation': 'מתאם (r)',
  'insights.card.effectSize': 'גודל ההבדל',
  'insights.card.groupRow': '{count, plural, one {יום אחד} two {שני ימים} other {# ימים}}, ממוצע {mean}',
  'insights.card.groupRowNoMean': '{count, plural, one {יום אחד} two {שני ימים} other {# ימים}}',

  // Home page (src/pages/HomePage.tsx, GET /api/home) --------------------------------
  'insights.home.title': 'דף הבית',
  'insights.home.newEntry': 'רשומה חדשה',
  'insights.home.greetingLabel': 'ברכה',
  'insights.home.today': 'היום',
  'insights.home.weekAverages': 'ממוצעי 7 הימים האחרונים',
  'insights.home.habitsToday': 'ההרגלים של היום',
  'insights.home.insightOfDay': 'התובנה של היום',
  'insights.home.lastEntry': 'הרשומה האחרונה',
  'insights.home.noData': 'אין נתונים',
  'insights.home.noHabits': 'אין הרגלים פעילים.',
  'insights.home.manageHabits': 'ניהול הרגלים',
  'insights.home.allHabits': 'לכל ההרגלים',
  'insights.home.allInsights': 'לכל התובנות',
  'insights.home.noInsight': 'עדיין אין תובנות. המשיכו לכתוב ביומן ולדווח על שינה, מצב רוח ופעילות כדי לגלות דפוסים.',
  'insights.home.noEntriesTitle': 'עדיין אין רשומות ביומן',
  'insights.home.noEntriesText': 'הרשומה הראשונה היא ההתחלה של כל תובנה. כמה משפטים על היום מספיקים.',
  'insights.home.firstEntry': 'כתיבת הרשומה הראשונה',
  'insights.home.untitled': 'ללא כותרת',
  'insights.home.streak': 'רצף כתיבה: {count, plural, one {יום אחד} two {יומיים} other {# ימים}}',
  'insights.home.entriesToday': '{count, plural, =0 {עדיין לא נכתבה רשומה היום} one {רשומה אחת היום} two {שתי רשומות היום} other {# רשומות היום}}',
  'insights.home.totalEntries': 'סך הכול {count, plural, one {רשומה אחת} two {שתי רשומות} other {# רשומות}} ביומן',
  'insights.home.ratingOf10': '{value} מתוך 10',
  'insights.home.sleepHours': '{value} שעות',
  'insights.home.lastEntryMood': 'מצב רוח: {value}',
};
export default messages;
