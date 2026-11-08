/** ar - stats messages. Keys are prefixed 'stats.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Statistics page (src/pages/StatsPage.tsx) ----------------------------------------
  'stats.title': 'الإحصاءات',
  'stats.period': 'الفترة',
  'stats.movingAvg': 'المتوسط المتحرك (7 أيام)',
  'stats.overTime': '{label} مع مرور الوقت',
  'stats.weekday.section': 'حسب أيام الأسبوع',
  'stats.weekday.chart': 'المتوسطات حسب أيام الأسبوع',
  'stats.weekday.axis': 'يوم الأسبوع',
  'stats.habits.section': 'العادات',
  'stats.habits.chart': '{name} - القيم اليومية',
  'stats.habits.empty': 'لا توجد عادات لها تسجيلات في هذه الفترة.',
  // {frequency} is 'daily' | 'weekly'; {current}/{best} are formatted streaks ("5 days").
  'stats.habits.summary':
    'الإنجاز: {percent} ({completed} من {frequency, select, weekly {{total, plural, zero {# أسبوع} one {أسبوع واحد} two {أسبوعين} few {# أسابيع} many {# أسبوعًا} other {# أسبوع}}} other {{total, plural, zero {# يوم} one {يوم واحد} two {يومين} few {# أيام} many {# يومًا} other {# يوم}}}})، السلسلة الحالية: {current}، الأفضل: {best}',
  'stats.empty.title': 'لا توجد بيانات لهذه الفترة بعد',
  'stats.empty.text': 'ستظهر هنا الرسوم البيانية والاتجاهات بعد كتابة التدوينات وتسجيل العادات.',
  'stats.newEntry': 'تدوينة جديدة',
  'stats.noValues': 'لا توجد بيانات في هذه الفترة.',
  'stats.overview':
    '{entries, plural, zero {# تدوينة} one {تدوينة واحدة} two {تدوينتان} few {# تدوينات} many {# تدوينة} other {# تدوينة}} في {days, plural, zero {# يوم} one {يوم واحد} two {يومين} few {# أيام} many {# يومًا} other {# يوم}} ({from} – {to})',

  // Series summary under every chart -------------------------------------------------
  'stats.summary.base': 'المتوسط {mean} ({sample}، الحد الأدنى {min}، الحد الأقصى {max}).',
  'stats.summary.sampleDays': '{count, plural, zero {# يوم} one {يوم واحد} two {يومان} few {# أيام} many {# يومًا} other {# يوم}}',
  'stats.summary.sampleValues': '{count, plural, zero {# قيمة} one {قيمة واحدة} two {قيمتان} few {# قيم} many {# قيمة} other {# قيمة}}',
  'stats.summary.noChange': 'لا تغيير مقارنة بالفترة السابقة ({previous}).',
  'stats.summary.change': 'مقارنة بـ{previous} في الفترة السابقة ({diff}).',
  'stats.summary.sentences': '{summary} {comparison}',
  'stats.summary.entriesPerDay': 'تدوينات في اليوم',

  // Metric titles (chart sections; also the home page tiles) -------------------------
  'stats.metric.mood': 'المزاج',
  'stats.metric.energy': 'مستوى الطاقة',
  'stats.metric.stress': 'مستوى التوتر',
  'stats.metric.sleepHours': 'ساعات النوم',
  'stats.metric.sleepQuality': 'جودة النوم',
  'stats.metric.exerciseMinutes': 'النشاط البدني',
  'stats.metric.entriesPerDay': 'تدوينات اليوميات',

  // Periods (pickers on the statistics and insights pages) ---------------------------
  'stats.period.7d': '7 أيام',
  'stats.period.30d': '30 يومًا',
  'stats.period.3m': '3 أشهر',
  'stats.period.6m': '6 أشهر',
  'stats.period.1y': 'سنة واحدة',
  'stats.period.all': 'طوال الفترة',
  'stats.period.in':
    '{period, select, 7d {في آخر 7 أيام} 30d {في آخر 30 يومًا} 3m {في آخر 3 أشهر} 6m {في آخر 6 أشهر} 1y {في السنة الأخيرة} all {طوال الفترة كلها} other {خلال الفترة}}',

  // Charts (src/components/charts/chart-utils.ts) ------------------------------------
  'stats.chart.noData': 'لا توجد بيانات للعرض',
  'stats.chart.xAxisDate': 'التاريخ',
  'stats.chart.valueWithUnit': '{value} {unit}',
  // Tooltip of one bar / marker: series label, x label (a date or a weekday), value with unit.
  'stats.chart.pointTooltip': '{label}، {x}: {value}',
  'stats.chart.summary':
    '{label}: {count, plural, zero {# قيمة} one {قيمة واحدة} two {قيمتان} few {# قيم} many {# قيمة} other {# قيمة}}، الحد الأدنى {min}، الحد الأقصى {max}، المتوسط {mean}.',
  'stats.chart.summaryEmpty': '{label}: لا توجد بيانات.',
  'stats.chart.range':
    '{count, plural, one {نقطة زمنية واحدة: {from}.} two {نقطتان زمنيتان، من {from} إلى {to}.} few {# نقاط زمنية، من {from} إلى {to}.} many {# نقطة زمنية، من {from} إلى {to}.} other {# نقطة زمنية، من {from} إلى {to}.}}',
};
export default messages;
