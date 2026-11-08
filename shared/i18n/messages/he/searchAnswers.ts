/**
 * he - searchAnswers messages (server/src/search: parser explanations, period labels,
 * executor answers). Keys are prefixed 'searchAnswers.'; see shared/i18n/index.ts for the syntax.
 *
 * Every sentence that names a metric receives it as `{metric, select, ...}` with the
 * metric key (mood, energy, stress, sleepHours, sleepQuality, exerciseMinutes) so the
 * wording can agree in gender/case per metric. `{period}` is a ready phrase ("בחודש
 * האחרון", "בכל התקופה"), `{days}` / `{terms}` / `{emotions}` are ready lists.
 */
const messages: Record<string, string> = {
  // Period labels (ParsedQuery.periodLabel and the {period} of every sentence) --------
  'searchAnswers.period.all': 'כל התקופה',
  'searchAnswers.period.allPhrase': 'בכל התקופה',
  'searchAnswers.period.today': 'היום',
  'searchAnswers.period.yesterday': 'אתמול',
  'searchAnswers.period.twoDaysAgo': 'שלשום',
  'searchAnswers.period.week': 'בשבוע האחרון',
  'searchAnswers.period.month': 'בחודש האחרון',
  'searchAnswers.period.halfYear': 'בחצי השנה האחרונה',
  'searchAnswers.period.year': 'בשנה האחרונה',
  'searchAnswers.period.startYear': 'מתחילת השנה',
  'searchAnswers.period.startMonth': 'מתחילת החודש',
  'searchAnswers.period.recent': 'בימים האחרונים',
  'searchAnswers.period.lastDays': '{count, plural, one {היום} two {ביומיים האחרונים} other {ב-# הימים האחרונים}}',
  'searchAnswers.period.lastWeeks': '{count, plural, one {בשבוע האחרון} two {בשבועיים האחרונים} other {ב-# השבועות האחרונים}}',
  'searchAnswers.period.lastMonths': '{count, plural, one {בחודש האחרון} two {בחודשיים האחרונים} other {ב-# החודשים האחרונים}}',
  'searchAnswers.period.lastYears': '{count, plural, one {בשנה האחרונה} two {בשנתיים האחרונות} other {ב-# השנים האחרונות}}',
  'searchAnswers.period.agoDays': '{count, plural, one {לפני יום} two {לפני יומיים} other {לפני # ימים}}',
  'searchAnswers.period.agoWeeks': '{count, plural, one {לפני שבוע} two {לפני שבועיים} other {לפני # שבועות}}',
  'searchAnswers.period.agoMonths': '{count, plural, one {לפני חודש} two {לפני חודשיים} other {לפני # חודשים}}',
  'searchAnswers.period.agoYears': '{count, plural, one {לפני שנה} two {לפני שנתיים} other {לפני # שנים}}',
  'searchAnswers.period.calendarMonth': 'ב{month} {year}',
  'searchAnswers.period.onDate': 'ב-{date}',
  'searchAnswers.period.between': 'בין {from} ל-{to}',

  // Comparators ("less than 5") ------------------------------------------------------
  'searchAnswers.comparator.lt': 'פחות מ-{value}',
  'searchAnswers.comparator.lte': 'עד {value}',
  'searchAnswers.comparator.gt': 'יותר מ-{value}',
  'searchAnswers.comparator.gte': 'לפחות {value}',
  'searchAnswers.comparator.eq': 'בדיוק {value}',

  // Lists and quoting ----------------------------------------------------------------
  'searchAnswers.quoted': '"{term}"',
  'searchAnswers.listSeparator': ', ',
  'searchAnswers.dayWithValues': '{day} ({values})',
  'searchAnswers.value.mood': 'מצב רוח {value}',
  'searchAnswers.value.energy': 'אנרגיה {value}',
  'searchAnswers.value.stress': 'לחץ {value}',
  'searchAnswers.value.sleepHours': 'שעות שינה {value}',
  'searchAnswers.value.sleepQuality': 'איכות שינה {value}',
  'searchAnswers.value.exerciseMinutes': 'דקות פעילות {value}',
  'searchAnswers.mention.something': 'משהו',

  // "How I understood the question" (ParsedQuery.explanation) ------------------------
  'searchAnswers.explain.best': 'הבנתי: הימים שבהם הרגשת הכי טוב, {period}.',
  'searchAnswers.explain.bestByMetric':
    'הבנתי: הימים שבהם הרגשת הכי טוב לפי {metric, select, mood {מצב רוח} energy {רמת אנרגיה} stress {רמת לחץ} sleepHours {שעות שינה} sleepQuality {איכות שינה} exerciseMinutes {דקות פעילות גופנית} other {הערך}}, {period}.',
  'searchAnswers.explain.worst': 'הבנתי: הימים הקשים ביותר, {period}.',
  'searchAnswers.explain.worstByMetric':
    'הבנתי: הימים הקשים ביותר לפי {metric, select, mood {מצב רוח} energy {רמת אנרגיה} stress {רמת לחץ} sleepHours {שעות שינה} sleepQuality {איכות שינה} exerciseMinutes {דקות פעילות גופנית} other {הערך}}, {period}.',
  'searchAnswers.explain.filter':
    'הבנתי: ימים עם {metric, select, mood {מצב רוח} energy {רמת אנרגיה} stress {רמת לחץ} sleepHours {שעות שינה} sleepQuality {איכות שינה} exerciseMinutes {דקות פעילות גופנית} other {ערך}} {comparison}, {period}.',
  'searchAnswers.explain.trend':
    'הבנתי: איך {metric, select, mood {השתנה מצב הרוח} energy {השתנתה רמת האנרגיה} stress {השתנתה רמת הלחץ} sleepHours {השתנו שעות השינה} sleepQuality {השתנתה איכות השינה} exerciseMinutes {השתנו דקות הפעילות הגופנית} other {השתנה הערך}}, {period}.',
  'searchAnswers.explain.mention': 'הבנתי: רשומות שבהן כתבת {terms}, {period}.',
  'searchAnswers.explain.mentionAny': 'הבנתי: רשומות שכתבת, {period}.',
  'searchAnswers.explain.emotion': 'הבנתי: ימים שבהם סימנת את הרגש {emotions}, {period}.',
  'searchAnswers.explain.list': 'הבנתי: רשומות שמכילות {terms}, {period}.',
  'searchAnswers.explain.listAll': 'הבנתי: כל הרשומות, {period}.',
  'searchAnswers.explain.unknown': 'לא הצלחתי להבין את השאלה. אפשר לשאול למשל: "באילו ימים הרגשתי הכי טוב בחודש האחרון?"',

  // Answers ---------------------------------------------------------------------------
  'searchAnswers.noResults': 'לא מצאתי רשומות שמתאימות לשאלה.',
  'searchAnswers.noResultsPeriod': 'לא מצאתי רשומות שמתאימות לשאלה {period}.',
  'searchAnswers.rank.best': 'הימים שבהם הרגשת הכי טוב {period}: {days}.',
  'searchAnswers.rank.bestByMetric':
    'הימים שבהם הרגשת הכי טוב לפי {metric, select, mood {מצב רוח} energy {רמת אנרגיה} stress {רמת לחץ} sleepHours {שעות שינה} sleepQuality {איכות שינה} exerciseMinutes {דקות פעילות גופנית} other {הערך}} {period}: {days}.',
  'searchAnswers.rank.worst': 'הימים הקשים ביותר {period}: {days}.',
  'searchAnswers.rank.worstByMetric':
    'הימים הקשים ביותר לפי {metric, select, mood {מצב רוח} energy {רמת אנרגיה} stress {רמת לחץ} sleepHours {שעות שינה} sleepQuality {איכות שינה} exerciseMinutes {דקות פעילות גופנית} other {הערך}} {period}: {days}.',
  'searchAnswers.filter.found':
    'מצאתי {count, plural, one {יום אחד} two {יומיים} other {# ימים}} עם {metric, select, mood {מצב רוח} energy {רמת אנרגיה} stress {רמת לחץ} sleepHours {שעות שינה} sleepQuality {איכות שינה} exerciseMinutes {דקות פעילות גופנית} other {ערך}} {comparison} {period}: {days}{more, plural, =0 {} one { ועוד יום אחד} two { ועוד יומיים} other { ועוד # ימים}}.',
  'searchAnswers.emotion.found':
    'סימנת את הרגש {emotions} {count, plural, one {ביום אחד} two {ביומיים} other {ב-# ימים}} {period}: {days}{more, plural, =0 {} one { ועוד יום אחד} two { ועוד יומיים} other { ועוד # ימים}}.',
  'searchAnswers.mention.found':
    'כתבת {terms} {count, plural, one {ברשומה אחת {period}; הראשונה ב{first}} two {בשתי רשומות {period}; הראשונה ב{first} והאחרונה ב{last}} other {ב-# רשומות {period}; הראשונה ב{first} והאחרונה ב{last}}}.',
  'searchAnswers.list.found': 'מצאתי {count, plural, one {רשומה אחת} two {שתי רשומות} other {# רשומות}} {period}; האחרונה ב{last}.',
  'searchAnswers.list.foundTerms':
    'מצאתי {count, plural, one {רשומה אחת שמכילה} two {שתי רשומות שמכילות} other {# רשומות שמכילות}} {terms} {period}; האחרונה ב{last}.',
  'searchAnswers.unknown.fallback':
    'לא הייתי בטוח מה השאלה, אז הנה {count, plural, one {רשומה אחת אחרונה} two {שתי רשומות אחרונות} other {# רשומות אחרונות}} מתוך {total}. {explanation}',
  'searchAnswers.trend.insufficient':
    'אין מספיק נתונים כדי לזהות מגמה {metric, select, mood {במצב הרוח} energy {ברמת האנרגיה} stress {ברמת הלחץ} sleepHours {בשעות השינה} sleepQuality {באיכות השינה} exerciseMinutes {בדקות הפעילות הגופנית} other {בערך}} {period}.',
  'searchAnswers.trend.evidence':
    '(על סמך {first, plural, one {יום אחד} two {יומיים} other {# ימים}} בתחילת התקופה לעומת {last, plural, one {יום אחד} two {יומיים} other {# ימים}} בסופה)',
  'searchAnswers.trend.stable':
    '{metric, select, mood {מצב הרוח הממוצע נשאר יציב} energy {רמת האנרגיה הממוצעת נשארה יציבה} stress {רמת הלחץ הממוצעת נשארה יציבה} sleepHours {שעות השינה הממוצעות נשארו יציבות} sleepQuality {איכות השינה הממוצעת נשארה יציבה} exerciseMinutes {דקות הפעילות הגופנית הממוצעות נשארו יציבות} other {הערך הממוצע נשאר יציב}} {period}: {from} לעומת {to} {evidence}.',
  'searchAnswers.trend.up':
    '{metric, select, mood {מצב הרוח הממוצע עלה} energy {רמת האנרגיה הממוצעת עלתה} stress {רמת הלחץ הממוצעת עלתה} sleepHours {שעות השינה הממוצעות עלו} sleepQuality {איכות השינה הממוצעת עלתה} exerciseMinutes {דקות הפעילות הגופנית הממוצעות עלו} other {הערך הממוצע עלה}} מ-{from} ל-{to} {period} {evidence}.',
  'searchAnswers.trend.down':
    '{metric, select, mood {מצב הרוח הממוצע ירד} energy {רמת האנרגיה הממוצעת ירדה} stress {רמת הלחץ הממוצעת ירדה} sleepHours {שעות השינה הממוצעות ירדו} sleepQuality {איכות השינה הממוצעת ירדה} exerciseMinutes {דקות הפעילות הגופנית הממוצעות ירדו} other {הערך הממוצע ירד}} מ-{from} ל-{to} {period} {evidence}.',

  // Request validation (POST /api/search) ----------------------------------------------
  'searchAnswers.validation.body': 'גוף הבקשה חייב להכיל שאלה (query)',
  'searchAnswers.validation.query': 'יש להזין שאלה',
  'searchAnswers.validation.queryTooLong': 'השאלה ארוכה מדי (עד {max} תווים)',
  'searchAnswers.validation.limit': 'מספר התוצאות חייב להיות מספר שלם בין 1 ל-{max}',
};
export default messages;
