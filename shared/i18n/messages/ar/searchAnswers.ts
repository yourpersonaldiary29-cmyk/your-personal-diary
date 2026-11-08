/**
 * ar - searchAnswers messages (server/src/search: parser explanations, period labels,
 * executor answers). Keys are prefixed 'searchAnswers.'; see shared/i18n/index.ts for the syntax.
 *
 * Sentences that name a metric receive it as `{metric, select, ...}`; where the verb has to
 * agree with the metric noun (جودة النوم is feminine) the verb is written inside each branch.
 * `{period}` is a ready phrase ("خلال الشهر الأخير", "في اليوميات كلها").
 */
const messages: Record<string, string> = {
  // Period labels (ParsedQuery.periodLabel and the {period} of every sentence) --------
  'searchAnswers.period.all': 'كامل الفترة',
  'searchAnswers.period.allPhrase': 'في اليوميات كلها',
  'searchAnswers.period.today': 'اليوم',
  'searchAnswers.period.yesterday': 'أمس',
  'searchAnswers.period.twoDaysAgo': 'أول أمس',
  'searchAnswers.period.week': 'خلال الأسبوع الأخير',
  'searchAnswers.period.month': 'خلال الشهر الأخير',
  'searchAnswers.period.halfYear': 'خلال الأشهر الستة الأخيرة',
  'searchAnswers.period.year': 'خلال السنة الأخيرة',
  'searchAnswers.period.startYear': 'منذ بداية السنة',
  'searchAnswers.period.startMonth': 'منذ بداية الشهر',
  'searchAnswers.period.recent': 'في الأيام الأخيرة',
  'searchAnswers.period.lastDays':
    '{count, plural, one {اليوم} two {خلال اليومين الأخيرين} few {خلال آخر # أيام} many {خلال آخر # يومًا} other {خلال آخر # يوم}}',
  'searchAnswers.period.lastWeeks':
    '{count, plural, one {خلال الأسبوع الأخير} two {خلال الأسبوعين الأخيرين} few {خلال آخر # أسابيع} many {خلال آخر # أسبوعًا} other {خلال آخر # أسبوع}}',
  'searchAnswers.period.lastMonths':
    '{count, plural, one {خلال الشهر الأخير} two {خلال الشهرين الأخيرين} few {خلال آخر # أشهر} many {خلال آخر # شهرًا} other {خلال آخر # شهر}}',
  'searchAnswers.period.lastYears':
    '{count, plural, one {خلال السنة الأخيرة} two {خلال السنتين الأخيرتين} few {خلال آخر # سنوات} many {خلال آخر # سنة} other {خلال آخر # سنة}}',
  'searchAnswers.period.agoDays': '{count, plural, one {قبل يوم} two {قبل يومين} few {قبل # أيام} many {قبل # يومًا} other {قبل # يوم}}',
  'searchAnswers.period.agoWeeks':
    '{count, plural, one {قبل أسبوع} two {قبل أسبوعين} few {قبل # أسابيع} many {قبل # أسبوعًا} other {قبل # أسبوع}}',
  'searchAnswers.period.agoMonths': '{count, plural, one {قبل شهر} two {قبل شهرين} few {قبل # أشهر} many {قبل # شهرًا} other {قبل # شهر}}',
  'searchAnswers.period.agoYears': '{count, plural, one {قبل سنة} two {قبل سنتين} few {قبل # سنوات} many {قبل # سنة} other {قبل # سنة}}',
  'searchAnswers.period.calendarMonth': 'في {month} {year}',
  'searchAnswers.period.onDate': 'في {date}',
  'searchAnswers.period.between': 'بين {from} و{to}',

  // Comparators ("less than 5") ------------------------------------------------------
  'searchAnswers.comparator.lt': 'أقل من {value}',
  'searchAnswers.comparator.lte': 'بحد أقصى {value}',
  'searchAnswers.comparator.gt': 'أكثر من {value}',
  'searchAnswers.comparator.gte': '{value} على الأقل',
  'searchAnswers.comparator.eq': '{value} بالضبط',

  // Lists and quoting ----------------------------------------------------------------
  'searchAnswers.quoted': '«{term}»',
  'searchAnswers.listSeparator': '، ',
  'searchAnswers.dayWithValues': '{day} ({values})',
  'searchAnswers.value.mood': 'المزاج {value}',
  'searchAnswers.value.energy': 'الطاقة {value}',
  'searchAnswers.value.stress': 'التوتر {value}',
  'searchAnswers.value.sleepHours': 'ساعات النوم {value}',
  'searchAnswers.value.sleepQuality': 'جودة النوم {value}',
  'searchAnswers.value.exerciseMinutes': 'دقائق النشاط البدني {value}',
  'searchAnswers.mention.something': 'شيئًا ما',

  // "How I understood the question" (ParsedQuery.explanation) ------------------------
  'searchAnswers.explain.best': 'فهمتُ: الأيام التي شعرت فيها بأفضل حال، {period}.',
  'searchAnswers.explain.bestByMetric':
    'فهمتُ: أفضل الأيام من حيث {metric, select, mood {المزاج} energy {مستوى الطاقة} stress {مستوى التوتر} sleepHours {ساعات النوم} sleepQuality {جودة النوم} exerciseMinutes {دقائق النشاط البدني} other {القيمة}}، {period}.',
  'searchAnswers.explain.worst': 'فهمتُ: أصعب الأيام، {period}.',
  'searchAnswers.explain.worstByMetric':
    'فهمتُ: أصعب الأيام من حيث {metric, select, mood {المزاج} energy {مستوى الطاقة} stress {مستوى التوتر} sleepHours {ساعات النوم} sleepQuality {جودة النوم} exerciseMinutes {دقائق النشاط البدني} other {القيمة}}، {period}.',
  'searchAnswers.explain.filter':
    'فهمتُ: الأيام التي {metric, select, mood {كان فيها المزاج} energy {كان فيها مستوى الطاقة} stress {كان فيها مستوى التوتر} sleepHours {كان فيها عدد ساعات النوم} sleepQuality {كانت فيها جودة النوم} exerciseMinutes {كان فيها عدد دقائق النشاط البدني} other {كانت فيها القيمة}} {comparison}، {period}.',
  'searchAnswers.explain.trend':
    'فهمتُ: كيف {metric, select, mood {تغيّر مزاجك} energy {تغيّر مستوى طاقتك} stress {تغيّر مستوى توترك} sleepHours {تغيّر عدد ساعات نومك} sleepQuality {تغيّرت جودة نومك} exerciseMinutes {تغيّر عدد دقائق نشاطك البدني} other {تغيّرت القيم}}، {period}.',
  'searchAnswers.explain.mention': 'فهمتُ: التدوينات التي كتبت فيها {terms}، {period}.',
  'searchAnswers.explain.mentionAny': 'فهمتُ: التدوينات التي كتبتها، {period}.',
  'searchAnswers.explain.emotion': 'فهمتُ: الأيام التي شعرت فيها بـ«{emotions}»، {period}.',
  'searchAnswers.explain.list': 'فهمتُ: التدوينات التي تحتوي على {terms}، {period}.',
  'searchAnswers.explain.listAll': 'فهمتُ: جميع التدوينات، {period}.',
  'searchAnswers.explain.unknown': 'لم أتمكن من فهم السؤال. يمكنك أن تسأل مثلًا: «ما الأيام التي شعرت فيها بأفضل حال خلال الشهر الأخير؟»',

  // Answers ---------------------------------------------------------------------------
  'searchAnswers.noResults': 'لم أجد تدوينات تطابق السؤال.',
  'searchAnswers.noResultsPeriod': 'لم أجد تدوينات تطابق السؤال {period}.',
  'searchAnswers.rank.best': 'الأيام التي شعرت فيها بأفضل حال {period}: {days}.',
  'searchAnswers.rank.bestByMetric':
    'أفضل الأيام من حيث {metric, select, mood {المزاج} energy {مستوى الطاقة} stress {مستوى التوتر} sleepHours {ساعات النوم} sleepQuality {جودة النوم} exerciseMinutes {دقائق النشاط البدني} other {القيمة}} {period}: {days}.',
  'searchAnswers.rank.worst': 'أصعب الأيام {period}: {days}.',
  'searchAnswers.rank.worstByMetric':
    'أصعب الأيام من حيث {metric, select, mood {المزاج} energy {مستوى الطاقة} stress {مستوى التوتر} sleepHours {ساعات النوم} sleepQuality {جودة النوم} exerciseMinutes {دقائق النشاط البدني} other {القيمة}} {period}: {days}.',
  'searchAnswers.filter.found':
    'وجدتُ {count, plural, zero {# يوم} one {يومًا واحدًا} two {يومين} few {# أيام} many {# يومًا} other {# يوم}} {metric, select, mood {بمزاج} energy {بمستوى طاقة} stress {بمستوى توتر} sleepHours {بعدد ساعات نوم} sleepQuality {بجودة نوم} exerciseMinutes {بعدد دقائق نشاط بدني} other {بقيمة}} {comparison} {period}: {days}{more, plural, =0 {} one { ويومًا آخر} two { ويومين آخرين} few { و# أيام أخرى} many { و# يومًا آخر} other { و# يوم آخر}}.',
  'searchAnswers.emotion.found':
    'شعرت بـ«{emotions}» في {count, plural, zero {# يوم} one {يوم واحد} two {يومين} few {# أيام} many {# يومًا} other {# يوم}} {period}: {days}{more, plural, =0 {} one { ويوم آخر} two { ويومين آخرين} few { و# أيام أخرى} many { و# يومًا آخر} other { و# يوم آخر}}.',
  'searchAnswers.mention.found':
    'كتبت {terms} في {count, plural, zero {# تدوينة {period}} one {تدوينة واحدة {period}، في {first}} two {تدوينتين {period}؛ الأولى في {first} والأخيرة في {last}} few {# تدوينات {period}؛ الأولى في {first} والأخيرة في {last}} many {# تدوينة {period}؛ الأولى في {first} والأخيرة في {last}} other {# تدوينة {period}؛ الأولى في {first} والأخيرة في {last}}}.',
  'searchAnswers.list.found':
    'وجدتُ {count, plural, zero {# تدوينة} one {تدوينة واحدة} two {تدوينتين} few {# تدوينات} many {# تدوينة} other {# تدوينة}} {period}؛ أحدثها في {last}.',
  'searchAnswers.list.foundTerms':
    'وجدتُ {count, plural, zero {# تدوينة تحتوي على} one {تدوينة واحدة تحتوي على} two {تدوينتين تحتويان على} few {# تدوينات تحتوي على} many {# تدوينة تحتوي على} other {# تدوينة تحتوي على}} {terms} {period}؛ أحدثها في {last}.',
  'searchAnswers.unknown.fallback':
    'لم يتضح لي المقصود بالسؤال، لذلك إليك {count, plural, one {أحدث تدوينة} two {أحدث تدوينتين} few {أحدث # تدوينات} many {أحدث # تدوينة} other {أحدث # تدوينة}} من أصل {total}. {explanation}',
  'searchAnswers.trend.insufficient':
    'لا تكفي البيانات لرصد اتجاه في {metric, select, mood {مزاجك} energy {مستوى طاقتك} stress {مستوى توترك} sleepHours {ساعات نومك} sleepQuality {جودة نومك} exerciseMinutes {دقائق نشاطك البدني} other {القيم}} {period}.',
  'searchAnswers.trend.evidence':
    '(استنادًا إلى {first, plural, zero {# يوم} one {يوم واحد} two {يومين} few {# أيام} many {# يومًا} other {# يوم}} في بداية الفترة مقابل {last, plural, zero {# يوم} one {يوم واحد} two {يومين} few {# أيام} many {# يومًا} other {# يوم}} في نهايتها)',
  'searchAnswers.trend.stable':
    'بقي متوسط {metric, select, mood {مزاجك} energy {مستوى طاقتك} stress {مستوى توترك} sleepHours {ساعات نومك} sleepQuality {جودة نومك} exerciseMinutes {دقائق نشاطك البدني} other {القيمة}} مستقرًا {period}: {from} مقابل {to} {evidence}.',
  'searchAnswers.trend.up':
    'ارتفع متوسط {metric, select, mood {مزاجك} energy {مستوى طاقتك} stress {مستوى توترك} sleepHours {ساعات نومك} sleepQuality {جودة نومك} exerciseMinutes {دقائق نشاطك البدني} other {القيمة}} من {from} إلى {to} {period} {evidence}.',
  'searchAnswers.trend.down':
    'انخفض متوسط {metric, select, mood {مزاجك} energy {مستوى طاقتك} stress {مستوى توترك} sleepHours {ساعات نومك} sleepQuality {جودة نومك} exerciseMinutes {دقائق نشاطك البدني} other {القيمة}} من {from} إلى {to} {period} {evidence}.',

  // Request validation (POST /api/search) ----------------------------------------------
  'searchAnswers.validation.body': 'يجب أن يتضمن نص الطلب سؤالًا (query)',
  'searchAnswers.validation.query': 'يُرجى إدخال سؤال',
  'searchAnswers.validation.queryTooLong': 'السؤال طويل جدًا (الحد الأقصى {max} حرف)',
  'searchAnswers.validation.limit': 'يجب أن يكون عدد النتائج عددًا صحيحًا بين 1 و{max}',
};
export default messages;
