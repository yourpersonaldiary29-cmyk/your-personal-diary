/** he - stats messages. Keys are prefixed 'stats.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Statistics page (src/pages/StatsPage.tsx) ----------------------------------------
  'stats.title': 'סטטיסטיקות',
  'stats.period': 'תקופה',
  'stats.movingAvg': 'ממוצע נע (7 ימים)',
  'stats.overTime': '{label} לאורך זמן',
  'stats.weekday.section': 'לפי יום בשבוע',
  'stats.weekday.chart': 'ממוצעים לפי יום בשבוע',
  'stats.weekday.axis': 'יום בשבוע',
  'stats.habits.section': 'הרגלים',
  'stats.habits.chart': '{name} - ערכים יומיים',
  'stats.habits.empty': 'אין הרגלים עם דיווחים בתקופה זו.',
  // {frequency} is 'daily' | 'weekly'; {current}/{best} are formatted streaks ("5 ימים").
  'stats.habits.summary': 'השלמה: {percent} ({completed} מתוך {total} {frequency, select, weekly {שבועות} other {ימים}}), רצף נוכחי: {current}, שיא: {best}',
  'stats.empty.title': 'אין עדיין נתונים לתקופה זו',
  'stats.empty.text': 'כתבו רשומות ודווחו על הרגלים כדי לראות כאן גרפים ומגמות.',
  'stats.newEntry': 'רשומה חדשה',
  'stats.noValues': 'אין נתונים בתקופה זו.',
  'stats.overview': '{entries, plural, one {רשומה אחת} two {שתי רשומות} other {# רשומות}} {days, plural, one {ביום אחד} two {בשני ימים} other {ב-# ימים}} ({from} – {to})',

  // Series summary under every chart -------------------------------------------------
  'stats.summary.base': 'ממוצע {mean} ({sample}, מינימום {min}, מקסימום {max}).',
  'stats.summary.sampleDays': '{count, plural, one {יום אחד} two {שני ימים} other {# ימים}}',
  'stats.summary.sampleValues': '{count, plural, one {ערך אחד} two {שני ערכים} other {# ערכים}}',
  'stats.summary.noChange': 'ללא שינוי לעומת התקופה הקודמת ({previous}).',
  'stats.summary.change': 'לעומת {previous} בתקופה הקודמת ({diff}).',
  'stats.summary.sentences': '{summary} {comparison}',
  'stats.summary.entriesPerDay': 'רשומות ביום',

  // Metric titles (chart sections; also the home page tiles) -------------------------
  'stats.metric.mood': 'מצב רוח',
  'stats.metric.energy': 'רמת אנרגיה',
  'stats.metric.stress': 'רמת לחץ',
  'stats.metric.sleepHours': 'שעות שינה',
  'stats.metric.sleepQuality': 'איכות שינה',
  'stats.metric.exerciseMinutes': 'פעילות גופנית',
  'stats.metric.entriesPerDay': 'רשומות ביומן',

  // Periods (pickers on the statistics and insights pages) ---------------------------
  'stats.period.7d': '7 ימים',
  'stats.period.30d': '30 ימים',
  'stats.period.3m': '3 חודשים',
  'stats.period.6m': '6 חודשים',
  'stats.period.1y': 'שנה',
  'stats.period.all': 'כל התקופה',
  'stats.period.in': '{period, select, 7d {ב-7 ימים} 30d {ב-30 ימים} 3m {ב-3 חודשים} 6m {ב-6 חודשים} 1y {בשנה} all {בכל התקופה} other {בתקופה}}',

  // Charts (src/components/charts/chart-utils.ts) ------------------------------------
  'stats.chart.noData': 'אין נתונים להצגה',
  'stats.chart.xAxisDate': 'תאריך',
  'stats.chart.valueWithUnit': '{value} {unit}',
  // Tooltip of one bar / marker: series label, x label (a date or a weekday), value with unit.
  'stats.chart.pointTooltip': '{label}, {x}: {value}',
  'stats.chart.summary': '{label}: {count, plural, one {ערך אחד} two {שני ערכים} other {# ערכים}}, מינימום {min}, מקסימום {max}, ממוצע {mean}.',
  'stats.chart.summaryEmpty': '{label}: אין נתונים.',
  'stats.chart.range': '{count, plural, one {נקודת זמן אחת: {from}.} other {# נקודות זמן, מ-{from} עד {to}.}}',
};
export default messages;
