/**
 * ar - analysis messages (server-side insight templates, notes and labels).
 * Keys are prefixed 'analysis.'; see shared/i18n/index.ts for the template syntax.
 *
 * Conventions shared with the English reference (shared/i18n/messages/en/analysis.ts):
 *  - Every sentence is hedged ("يبدو من بياناتك…"، "صلة محتملة") and never causal: no
 *    "يسبب"، "بسبب"، "يؤدي إلى".
 *  - `gender` is the grammatical gender of the metric noun in Arabic, from
 *    'analysis.metric.<metric>.gender' below: every metric is masculine (المزاج، مستوى…،
 *    عدد…) except جودة النوم ('f'). Templates select on it for كان/كانت and adjective
 *    agreement; titles use verbal nouns (ارتفاع / انخفاض) that need no agreement.
 *  - The app speaks in the first person with a damma (فحصتُ، وجدتُ) so it is not read as
 *    "you checked"; the user is addressed with unvocalized past forms (نمت، كتبت) that fit
 *    both genders. Counts use all six Arabic plural categories with the case each
 *    position needs (يومين after a preposition, يومًا for 11-99).
 */
const messages: Record<string, string> = {
  // Engine / provider -----------------------------------------------------------------
  'analysis.engine.providerFailed': 'لم يكتمل تحليل الأنماط (خطأ داخلي). يُرجى المحاولة لاحقًا.',
  'analysis.engine.detectorFailed': 'لم يكتمل فحص «{label}» (خطأ داخلي)؛ أما بقية الرؤى فسليمة.',

  // Strength --------------------------------------------------------------------------
  'analysis.strength.weak': 'ضعيفة',
  'analysis.strength.moderate': 'متوسطة',
  'analysis.strength.strong': 'قوية',

  // Metrics: label (short, standalone), defined (subject inside a sentence), gender -----
  'analysis.metric.mood.label': 'المزاج',
  'analysis.metric.mood.defined': 'المزاج',
  'analysis.metric.mood.gender': 'm',
  'analysis.metric.energy.label': 'مستوى الطاقة',
  'analysis.metric.energy.defined': 'مستوى الطاقة',
  'analysis.metric.energy.gender': 'm',
  'analysis.metric.stress.label': 'مستوى التوتر',
  'analysis.metric.stress.defined': 'مستوى التوتر',
  'analysis.metric.stress.gender': 'm',
  'analysis.metric.sleepHours.label': 'ساعات النوم',
  'analysis.metric.sleepHours.defined': 'عدد ساعات النوم',
  'analysis.metric.sleepHours.gender': 'm',
  'analysis.metric.sleepQuality.label': 'جودة النوم',
  'analysis.metric.sleepQuality.defined': 'جودة النوم',
  'analysis.metric.sleepQuality.gender': 'f',
  'analysis.metric.exerciseMinutes.label': 'دقائق النشاط البدني',
  'analysis.metric.exerciseMinutes.defined': 'عدد دقائق النشاط البدني',
  'analysis.metric.exerciseMinutes.gender': 'm',
  'analysis.metric.entries.label': 'تدوينات اليوميات',
  'analysis.metric.entries.defined': 'عدد التدوينات',
  'analysis.metric.entries.gender': 'm',

  // Counts and dates ------------------------------------------------------------------
  'analysis.count.days': '{count, plural, zero {# يوم} one {يوم واحد} two {يومان} few {# أيام} many {# يومًا} other {# يوم}}',
  'analysis.count.weeks': '{count, plural, zero {# أسبوع} one {أسبوع واحد} two {أسبوعان} few {# أسابيع} many {# أسبوعًا} other {# أسبوع}}',
  'analysis.date.dayWithDate': '{weekday}، {date}',

  // Weekdays (index 0 = Sunday) --------------------------------------------------------
  'analysis.weekday.plural.0': 'أيام الأحد',
  'analysis.weekday.plural.1': 'أيام الاثنين',
  'analysis.weekday.plural.2': 'أيام الثلاثاء',
  'analysis.weekday.plural.3': 'أيام الأربعاء',
  'analysis.weekday.plural.4': 'أيام الخميس',
  'analysis.weekday.plural.5': 'أيام الجمعة',
  'analysis.weekday.plural.6': 'أيام السبت',
  'analysis.weekday.on.0': 'في أيام الأحد',
  'analysis.weekday.on.1': 'في أيام الاثنين',
  'analysis.weekday.on.2': 'في أيام الثلاثاء',
  'analysis.weekday.on.3': 'في أيام الأربعاء',
  'analysis.weekday.on.4': 'في أيام الخميس',
  'analysis.weekday.on.5': 'في أيام الجمعة',
  'analysis.weekday.on.6': 'في أيام السبت',

  // Notes shared by the detectors -------------------------------------------------------
  'analysis.note.insufficient': 'لا تكفي البيانات لفحص {what} (يلزم على الأقل {required}؛ ولديك {have}).',
  'analysis.note.insufficientWhether': 'لا تكفي البيانات للتحقق مما إذا {what} (يلزم على الأقل {required}؛ ولديك {have}).',
  'analysis.note.nothingNotable':
    'فحصتُ {what} على مدى {count, plural, zero {# يوم} one {يوم واحد} two {يومين} few {# أيام} many {# يومًا} other {# يوم}} ولم أجد فرقًا لافتًا.',

  // Requirement / availability phrases used inside the notes above ----------------------
  'analysis.req.daysBothValues':
    '{count, plural, zero {# يوم تتوفر فيه القيمتان} one {يوم واحد تتوفر فيه القيمتان} two {يومان تتوفر فيهما القيمتان} few {# أيام تتوفر فيها القيمتان} many {# يومًا تتوفر فيها القيمتان} other {# يوم تتوفر فيها القيمتان}}',
  'analysis.req.daysPerGroup':
    '{count, plural, zero {# يوم في كل مجموعة} one {يوم واحد في كل مجموعة} two {يومان في كل مجموعة} few {# أيام في كل مجموعة} many {# يومًا في كل مجموعة} other {# يوم في كل مجموعة}}',
  'analysis.req.daysWithReport':
    '{count, plural, zero {# يوم فيه تسجيل} one {يوم واحد فيه تسجيل} two {يومان فيهما تسجيل} few {# أيام فيها تسجيلات} many {# يومًا فيها تسجيلات} other {# يوم فيها تسجيلات}}',
  'analysis.req.daysWithRatings':
    '{count, plural, zero {# يوم فيه تقييمات} one {يوم واحد فيه تقييمات} two {يومان فيهما تقييمات} few {# أيام فيها تقييمات} many {# يومًا فيها تقييمات} other {# يوم فيها تقييمات}}',
  'analysis.req.daysPerMonth':
    '{count, plural, zero {# يوم فيه تسجيل في كل شهر} one {يوم واحد فيه تسجيل في كل شهر} two {يومان فيهما تسجيل في كل شهر} few {# أيام فيها تسجيلات في كل شهر} many {# يومًا فيها تسجيلات في كل شهر} other {# يوم فيها تسجيلات في كل شهر}}',
  'analysis.req.recentDays':
    '{count, plural, zero {# يوم فيه تسجيل في الأسبوعين الأخيرين} one {يوم واحد فيه تسجيل في الأسبوعين الأخيرين} two {يومان فيهما تسجيل في الأسبوعين الأخيرين} few {# أيام فيها تسجيلات في الأسبوعين الأخيرين} many {# يومًا فيها تسجيلات في الأسبوعين الأخيرين} other {# يوم فيها تسجيلات في الأسبوعين الأخيرين}}',
  'analysis.req.fullWeeks':
    '{count, plural, zero {# أسبوع كامل فيه تسجيلات} one {أسبوع كامل واحد فيه تسجيلات} two {أسبوعان كاملان فيهما تسجيلات} few {# أسابيع كاملة فيها تسجيلات} many {# أسبوعًا كاملًا فيها تسجيلات} other {# أسبوع كامل فيها تسجيلات}}',
  'analysis.req.weeksOfLogs':
    '{count, plural, zero {# أسبوع من التسجيلات} one {أسبوع واحد من التسجيلات} two {أسبوعان من التسجيلات} few {# أسابيع من التسجيلات} many {# أسبوعًا من التسجيلات} other {# أسبوع من التسجيلات}}',
  'analysis.req.weekPerGroup':
    'أسبوع واحد في كل مجموعة، و{count, plural, zero {# يوم} one {يوم واحد} two {يومان} few {# أيام} many {# يومًا} other {# يوم}} فيها تسجيل في كل مجموعة',
  'analysis.req.moodReports':
    '{count, plural, zero {# تسجيل للمزاج} one {تسجيل واحد للمزاج} two {تسجيلان للمزاج} few {# تسجيلات للمزاج} many {# تسجيلًا للمزاج} other {# تسجيل للمزاج}}',
  'analysis.req.reportsInWindow':
    '{count, plural, zero {# تسجيل في نافذة زمنية واحدة} one {تسجيل واحد في نافذة زمنية واحدة} two {تسجيلان في نافذة زمنية واحدة} few {# تسجيلات في نافذة زمنية واحدة} many {# تسجيلًا في نافذة زمنية واحدة} other {# تسجيل في نافذة زمنية واحدة}}',
  'analysis.req.emotionRepeated':
    'شعور واحد سُجّل في {count, plural, zero {# يوم} one {يوم واحد} two {يومين} few {# أيام} many {# يومًا} other {# يوم}}',
  'analysis.have.twoGroups':
    '{groupA}: {countA, plural, zero {# يوم} one {يوم واحد} two {يومان} few {# أيام} many {# يومًا} other {# يوم}}؛ {groupB}: {countB, plural, zero {# يوم} one {يوم واحد} two {يومان} few {# أيام} many {# يومًا} other {# يوم}}',
  'analysis.have.weeksTwoGroups':
    'أسابيع بلغت الهدف: {metWeeks, plural, zero {# أسبوع} one {أسبوع واحد} two {أسبوعان} few {# أسابيع} many {# أسبوعًا} other {# أسبوع}} ({metDays, plural, zero {# يوم} one {يوم واحد} two {يومان} few {# أيام} many {# يومًا} other {# يوم}})؛ أسابيع دون الهدف: {belowWeeks, plural, zero {# أسبوع} one {أسبوع واحد} two {أسبوعان} few {# أسابيع} many {# أسبوعًا} other {# أسبوع}} ({belowDays, plural, zero {# يوم} one {يوم واحد} two {يومان} few {# أيام} many {# يومًا} other {# يوم}})',
  'analysis.have.twoMonths':
    '{countA, plural, zero {# يوم} one {يوم واحد} two {يومان} few {# أيام} many {# يومًا} other {# يوم}} في {cur} و{countB, plural, zero {# يوم} one {يوم واحد} two {يومان} few {# أيام} many {# يومًا} other {# يوم}} في {prev}',
  'analysis.have.noData': 'لا توجد بيانات',
  'analysis.have.noSuchEmotion': 'لا يوجد بعد',
  'analysis.have.fewerInEveryWindow': 'أقل من ذلك في كل نافذة',

  // Sentences shared by the group-comparison detectors ----------------------------------
  'analysis.relation.text':
    'يبدو من بياناتك أنه {condition} {gender, select, f {كانت} other {كان}} {metricDefined} لديك {direction, select, higher {أعلى في المتوسط} other {أدنى في المتوسط}} ({meanA} مقابل {meanB}).',
  'analysis.correlation.text':
    'يبدو أن هناك صلة محتملة في بياناتك بين {x} و{y}: {xGender, select, f {كلما كانت {x} أعلى} other {كلما كان {x} أعلى}}، {yGender, select, f {مالت {y} إلى أن تكون {direction, select, higher {أعلى} other {أدنى}}} other {مال {y} إلى أن يكون {direction, select, higher {أعلى} other {أدنى}}}} (معامل الارتباط {r}).',
  'analysis.explain.checkedDays':
    'فحصتُ {count, plural, zero {# يوم} one {يومًا واحدًا} two {يومين} few {# أيام} many {# يومًا} other {# يوم}}.',
  'analysis.explain.onDaysCondition':
    '{conditionPast} في {count, plural, zero {# يوم} one {يوم واحد} two {يومين} few {# أيام} many {# يومًا} other {# يوم}}.',
  'analysis.explain.groupMeans':
    'بلغ متوسط {metricDefined} لديك في تلك الأيام {gender, select, other {{meanA}}}، مقابل {meanB} في الأيام الأخرى.',
  'analysis.explain.correlation': 'معامل الارتباط: {r}.',
  'analysis.explain.correlationBetween': 'معامل الارتباط ({predictor} مقابل {outcome}): {r}.',
  'analysis.explain.diffAndStrength': 'الفرق بين المتوسطين: {diff} نقطة. قوة النمط: {strength}.',
  'analysis.explain.diffStrength': 'الفرق: {diff} نقطة. قوة النمط: {strength}.',
  'analysis.split.corrExplainChecked':
    'فحصتُ {count, plural, zero {# يوم} one {يومًا واحدًا} two {يومين} few {# أيام} many {# يومًا} other {# يوم}} سُجّل فيها كلٌّ من {x} و{y}.',
  'analysis.split.corrExplainPearson': 'معامل ارتباط بيرسون: {r} (القوة: {strength}).',
  'analysis.split.corrExplainGroups':
    'لم تكن هناك أيام كافية في كل مجموعة لمقارنة المتوسطات ({groupA}: {countA, plural, zero {# يوم} one {يوم واحد} two {يومان} few {# أيام} many {# يومًا} other {# يوم}}؛ {groupB}: {countB, plural, zero {# يوم} one {يوم واحد} two {يومان} few {# أيام} many {# يومًا} other {# يوم}}؛ ويلزم {min} على الأقل في كل مجموعة).',

  // Evidence table keys ---------------------------------------------------------------
  'analysis.extra.predictor': 'المتغير المُنبِئ',
  'analysis.extra.strength': 'القوة',
  'analysis.extra.meanDiff': 'فرق المتوسطات (أ ناقص ب)',
  'analysis.extra.cohenD': 'حجم الأثر (Cohen’s d)',
  'analysis.extra.weeksChecked': 'الأسابيع التي فُحصت',
  'analysis.extra.weeklyTarget': 'الهدف الأسبوعي',
  'analysis.extra.target': 'الهدف',
  'analysis.extra.frequency': 'التكرار',
  'analysis.extra.periodMean': 'متوسط الفترة',
  'analysis.extra.overallMean': 'المتوسط العام',
  'analysis.extra.stddev': 'الانحراف المعياري',
  'analysis.extra.slopePerDay': 'الميل لكل يوم',
  'analysis.extra.daysInWindow': 'الأيام في النافذة',
  'analysis.extra.movingWindow': 'نافذة المتوسط المتحرك',
  'analysis.extra.relativeChange': 'التغيّر النسبي',
  'analysis.extra.longestStreak': 'أطول سلسلة في الفترة',
  'analysis.extra.shareOfEmotionDays': 'النسبة من أيام الشعور',
  'analysis.frequency.daily': 'يومي',
  'analysis.frequency.weekly': 'أسبوعي',
  'analysis.groupB.otherDays': 'الأيام الأخرى',

  // Sleep detectors -------------------------------------------------------------------
  'analysis.sleep.groupA': 'أيام نمت فيها أقل من {hours} ساعات',
  'analysis.sleep.groupB': 'أيام نمت فيها {hours} ساعات أو أكثر',
  'analysis.sleep.condition': 'في الأيام التي نمت فيها أقل من {hours} ساعات',
  'analysis.sleep.conditionPast': 'نمت أقل من {hours} ساعات',
  'analysis.sleepMood.label': 'الصلة بين النوم والمزاج',
  'analysis.sleepMood.title': '{direction, select, lower {قلة النوم وانخفاض المزاج} other {قلة النوم وارتفاع المزاج}}',
  'analysis.sleepMood.corrTitle': 'صلة محتملة بين ساعات النوم والمزاج',
  'analysis.sleepEnergy.label': 'الصلة بين النوم ومستوى الطاقة',
  'analysis.sleepEnergy.title': '{direction, select, lower {قلة النوم وانخفاض الطاقة} other {قلة النوم وارتفاع الطاقة}}',
  'analysis.sleepEnergy.corrTitle': 'صلة محتملة بين ساعات النوم ومستوى الطاقة',

  // Exercise detectors ----------------------------------------------------------------
  'analysis.exercise.groupA': 'أيام فيها نشاط بدني',
  'analysis.exercise.groupB': 'أيام بلا نشاط بدني',
  'analysis.exercise.condition': 'في الأيام التي مارست فيها نشاطًا بدنيًا',
  'analysis.exercise.conditionPast': 'مارست نشاطًا بدنيًا',
  'analysis.exerciseMood.label': 'الصلة بين النشاط البدني والمزاج',
  'analysis.exerciseMood.title': '{direction, select, higher {النشاط البدني وارتفاع المزاج} other {النشاط البدني وانخفاض المزاج}}',
  'analysis.exerciseMood.corrTitle': 'صلة محتملة بين دقائق النشاط البدني والمزاج',
  'analysis.exerciseEnergy.label': 'الصلة بين النشاط البدني ومستوى الطاقة',
  'analysis.exerciseEnergy.title': '{direction, select, higher {النشاط البدني وارتفاع الطاقة} other {النشاط البدني وانخفاض الطاقة}}',
  'analysis.exerciseEnergy.corrTitle': 'صلة محتملة بين دقائق النشاط البدني ومستوى الطاقة',

  // Habit - mood / energy / stress ------------------------------------------------------
  'analysis.habit.detectorLabel': 'الصلة بين العادات والمزاج',
  'analysis.habit.noHabits': 'لا توجد عادات نشطة، لذلك لم أفحص وجود صلة بين العادات والمزاج.',
  'analysis.habit.noLogs': 'لا توجد تسجيلات للعادة «{habit}» في هذه الفترة بعد، لذلك لم أفحص وجود صلة بينها وبين المزاج.',
  'analysis.habit.noFullWeeks': 'لا توجد للعادة «{habit}» أسابيع كاملة من التسجيلات بعد، لذلك لم أفحص وجود صلة بينها وبين المزاج.',
  'analysis.habit.label': 'الصلة بين العادة «{habit}» و{metric}',
  'analysis.habit.groupA': 'أيام أُنجزت فيها العادة «{habit}»',
  'analysis.habit.groupB': 'أيام لم تُنجَز فيها العادة «{habit}»',
  'analysis.habit.condition': 'في الأيام التي أنجزت فيها العادة «{habit}»',
  'analysis.habit.conditionPast': 'أنجزت العادة «{habit}»',
  'analysis.habit.title':
    'العادة «{habit}» و{gender, select, other {{direction, select, higher {ارتفاع {metric}} other {انخفاض {metric}}}}}',
  'analysis.habit.corrTitle': 'صلة محتملة بين العادة «{habit}» و{metric}',
  'analysis.habit.weeklyCondition': 'في الأسابيع التي بلغت فيها هدف العادة «{habit}»',
  'analysis.habit.weeklyTarget': '{target} {unit} في الأسبوع',
  'analysis.habit.targetValue': '{target} {unit}',
  'analysis.habit.weeklyExplainChecked':
    'فحصتُ {weeks, plural, zero {# أسبوع كامل} one {أسبوعًا كاملًا واحدًا} two {أسبوعين كاملين} few {# أسابيع كاملة} many {# أسبوعًا كاملًا} other {# أسبوع كامل}} ({days, plural, zero {# يوم} one {يوم واحد} two {يومان} few {# أيام} many {# يومًا} other {# يوم}} فيها تسجيل {metric}).',
  'analysis.habit.weeklyExplainMet':
    'في {count, plural, zero {# أسبوع} one {أسبوع واحد} two {أسبوعين} few {# أسابيع} many {# أسبوعًا} other {# أسبوع}} بلغت هدف العادة ({target}).',
  'analysis.habit.weeklyExplainMeans':
    'بلغ متوسط {metricDefined} لديك في أيام تلك الأسابيع {gender, select, other {{meanA}}}، مقابل {meanB} في أيام الأسابيع التي كانت دون الهدف ({count, plural, zero {# أسبوع} one {أسبوع واحد} two {أسبوعان} few {# أسابيع} many {# أسبوعًا} other {# أسبوع}}).',
  'analysis.habit.groupAWeeks':
    'أيام في أسابيع بلغت الهدف ({count, plural, zero {# أسبوع} one {أسبوع واحد} two {أسبوعان} few {# أسابيع} many {# أسبوعًا} other {# أسبوع}})',
  'analysis.habit.groupBWeeks':
    'أيام في أسابيع دون الهدف ({count, plural, zero {# أسبوع} one {أسبوع واحد} two {أسبوعان} few {# أسابيع} many {# أسبوعًا} other {# أسبوع}})',

  // Weekday differences -----------------------------------------------------------------
  'analysis.weekday.label': 'الفروق بين أيام الأسبوع',
  'analysis.weekday.text':
    'يبدو من بياناتك أنه {onWeekday} {gender, select, f {كانت} other {كان}} {metricDefined} لديك {direction, select, higher {أعلى في المتوسط} other {أدنى في المتوسط}} مقارنة ببقية أيام الأسبوع ({meanA} مقابل {meanB}).',
  'analysis.weekday.explainChecked':
    'فحصتُ {count, plural, zero {# يوم} one {يومًا واحدًا} two {يومين} few {# أيام} many {# يومًا} other {# يوم}} فيها تسجيل {metric}، منها {countA} من {weekdays}.',
  'analysis.weekday.explainMeans':
    'بلغ متوسط {metricDefined} لديك {onWeekday} {gender, select, other {{meanA}}}، مقابل {meanB} في الأيام الأخرى.',
  'analysis.weekday.title':
    '{weekdays}: {gender, select, other {{direction, select, higher {ارتفاع {metric}} other {انخفاض {metric}}}}}',
  'analysis.weekday.groupB': 'بقية أيام الأسبوع',
  'analysis.weekday.tableValue': '{mean} ({count, plural, zero {# يوم} one {يوم واحد} two {يومان} few {# أيام} many {# يومًا} other {# يوم}})',
  'analysis.weekday.nothing':
    'فحصتُ الفروق بين أيام الأسبوع على مدى {count, plural, zero {# يوم} one {يوم واحد} two {يومين} few {# أيام} many {# يومًا} other {# يوم}} ولم أجد فرقًا لافتًا.',

  // Time of day -------------------------------------------------------------------------
  'analysis.timeOfDay.label': 'الصلة بين وقت الكتابة والمزاج',
  'analysis.timeOfDay.morning.label': 'الصباح',
  'analysis.timeOfDay.morning.phrase': 'في الصباح',
  'analysis.timeOfDay.late_morning.label': 'الضحى',
  'analysis.timeOfDay.late_morning.phrase': 'في الضحى',
  'analysis.timeOfDay.afternoon.label': 'بعد الظهر',
  'analysis.timeOfDay.afternoon.phrase': 'بعد الظهر',
  'analysis.timeOfDay.evening.label': 'المساء',
  'analysis.timeOfDay.evening.phrase': 'في المساء',
  'analysis.timeOfDay.night.label': 'الليل',
  'analysis.timeOfDay.night.phrase': 'في الليل',
  'analysis.timeOfDay.tableKey': '{label} ({hours})',
  'analysis.timeOfDay.tableValue':
    'المتوسط {mean}، {count, plural, zero {# تسجيل} one {تسجيل واحد} two {تسجيلان} few {# تسجيلات} many {# تسجيلًا} other {# تسجيل}}',
  'analysis.timeOfDay.tableRow': '{key}: {value}',
  'analysis.timeOfDay.nothing':
    'فحصتُ {label} عبر {count, plural, zero {# تسجيل} one {تسجيل واحد} two {تسجيلين} few {# تسجيلات} many {# تسجيلًا} other {# تسجيل}} ولم أجد نافذة زمنية تبرز فوق المتوسط.',
  'analysis.timeOfDay.text':
    'يبدو من بياناتك أن المزاج الذي سجّلته {phrase} ({hours}) كان الأعلى: {mean} في المتوسط، مقابل {overall} في جميع التسجيلات.',
  'analysis.timeOfDay.explainChecked':
    'فحصتُ {count, plural, zero {# تسجيل للمزاج} one {تسجيلًا واحدًا للمزاج} two {تسجيلين للمزاج} few {# تسجيلات للمزاج} many {# تسجيلًا للمزاج} other {# تسجيل للمزاج}} من {days, plural, zero {# يوم} one {يوم واحد} two {يومين} few {# أيام} many {# يومًا} other {# يوم}}، حسب وقت كتابة التدوينة.',
  'analysis.timeOfDay.explainTable': '{table}. المتوسط العام: {overall}.',
  'analysis.timeOfDay.explainDiff': 'الفرق بين النافذة الزمنية الأعلى والمتوسط العام: {diff} نقطة. قوة النمط: {strength}.',
  'analysis.timeOfDay.title': 'مزاج أعلى {phrase}',
  'analysis.timeOfDay.groupA': 'التسجيلات {phrase} ({hours})',
  'analysis.timeOfDay.groupB': 'التسجيلات الأخرى',

  // Trends ------------------------------------------------------------------------------
  'analysis.trends.label': 'الاتجاهات في المزاج والتوتر والنوم',
  'analysis.trends.text':
    'يبدو من بياناتك أن {metricDefined} لديك {gender, select, f {تتجه {direction, select, up {نحو الارتفاع} other {نحو الانخفاض}}} other {يتجه {direction, select, up {نحو الارتفاع} other {نحو الانخفاض}}}} {horizon, select, period {على مدى الفترة} monthly {خلال الشهر الأخير} other {خلال الأسبوعين الأخيرين}}: {direction, select, up {ارتفع خط اتجاه المتوسط المتحرك من} other {انخفض خط اتجاه المتوسط المتحرك من}} {fromValue} إلى {toValue}.',
  'analysis.trends.explainChecked':
    'فحصتُ {count, plural, zero {# يوم} one {يومًا واحدًا} two {يومين} few {# أيام} many {# يومًا} other {# يوم}} فيها تسجيل {metric} من أصل {len} {horizon, select, period {من أيام الفترة} other {من الأيام الأخيرة}} ({from}-{to}).',
  'analysis.trends.explainFit':
    'حسبتُ متوسطًا متحركًا لمدة {window} أيام وخط اتجاه (انحدار خطي) عبره: {direction, select, up {ميل صاعد} other {ميل هابط}} بمقدار {unit, select, hours {{slope} ساعة} other {{slope} نقطة}} في اليوم، أي تغيّر بنحو {unit, select, hours {{change} ساعة} other {{change} نقطة}} على امتداد النافذة (من {fromValue} إلى {toValue} على خط الاتجاه). قوة الاتجاه: {strength}.',
  'analysis.trends.title':
    '{direction, select, up {اتجاه صاعد} other {اتجاه هابط}} في {metric, select, mood {مزاجك} energy {مستوى طاقتك} stress {مستوى توترك} sleepHours {ساعات نومك} sleepQuality {جودة نومك} exerciseMinutes {دقائق نشاطك البدني} other {عدد التدوينات}} {horizon, select, period {على مدى الفترة} monthly {خلال الشهر الأخير} other {خلال الأسبوعين الأخيرين}}',
  'analysis.trends.groupA': 'بداية النافذة (خط الاتجاه)',
  'analysis.trends.groupB': 'نهاية النافذة (خط الاتجاه)',
  'analysis.trends.slopeValue': '{unit, select, hours {{slope} ساعة} other {{slope} نقطة}}',
  'analysis.trends.nothingSince': 'فحصتُ الاتجاهات في المزاج والتوتر والنوم منذ {from} ولم أجد اتجاهًا لافتًا.',
  'analysis.trends.nothingAll': 'فحصتُ الاتجاهات في المزاج والتوتر والنوم على مدى الفترة كلها ولم أجد اتجاهًا لافتًا.',

  // Month comparison --------------------------------------------------------------------
  'analysis.periodCompare.label': 'المقارنة بين الشهر الحالي والشهر السابق',
  'analysis.periodCompare.text':
    'يبدو من بياناتك أن {metricDefined} لديك في شهر {cur} {gender, select, f {كانت {direction, select, higher {أعلى في المتوسط} other {أدنى في المتوسط}}} other {كان {direction, select, higher {أعلى في المتوسط} other {أدنى في المتوسط}}}} مقارنة بشهر {prev} ({meanA} مقابل {meanB}).',
  'analysis.periodCompare.explain':
    'قارنتُ الأيام التي فيها تسجيل {metric} في شهر {cur} ({countA, plural, zero {# يوم} one {يوم واحد} two {يومان} few {# أيام} many {# يومًا} other {# يوم}}، حتى اليوم) بالأيام في شهر {prev} ({countB, plural, zero {# يوم} one {يوم واحد} two {يومان} few {# أيام} many {# يومًا} other {# يوم}}). المتوسط في {cur}: {meanA}؛ وفي {prev}: {meanB}. الفرق: {unit, select, hours {{diff} ساعة} other {{diff} نقطة}}. قوة الفرق: {strength}.',
  'analysis.periodCompare.title':
    'في {cur}: {gender, select, other {{direction, select, higher {ارتفاع {metric}} other {انخفاض {metric}}}}} مقارنة بشهر {prev}',
  'analysis.periodCompare.entriesText':
    'يبدو أنك {direction, select, more {كتبت أكثر} other {كتبت أقل}} في الأيام الـ{window} الأولى من شهر {cur} ({countA, plural, zero {# تدوينة} one {تدوينة واحدة} two {تدوينتان} few {# تدوينات} many {# تدوينة} other {# تدوينة}}) مقارنة بالأيام الـ{window} الأولى من شهر {prev} ({countB, plural, zero {# تدوينة} one {تدوينة واحدة} two {تدوينتان} few {# تدوينات} many {# تدوينة} other {# تدوينة}}).',
  'analysis.periodCompare.entriesExplain':
    'عددتُ التدوينات في الأيام الـ{window} الأولى من كل شهر، لمقارنة فترتين متساويتين: {cur} - {countA, plural, zero {# تدوينة} one {تدوينة واحدة} two {تدوينتان} few {# تدوينات} many {# تدوينة} other {# تدوينة}}، {prev} - {countB, plural, zero {# تدوينة} one {تدوينة واحدة} two {تدوينتان} few {# تدوينات} many {# تدوينة} other {# تدوينة}}. الفرق: {diff, plural, zero {# تدوينة} one {تدوينة واحدة} two {تدوينتان} few {# تدوينات} many {# تدوينة} other {# تدوينة}} ({percent}). قوة الفرق: {strength}.',
  'analysis.periodCompare.entriesTitle': '{direction, select, more {تدوينات أكثر} other {تدوينات أقل}} في {cur} مقارنة بشهر {prev}',
  'analysis.periodCompare.monthWindow': '{month} (الأيام الـ{window} الأولى)',
  'analysis.periodCompare.insufficientWhat': 'المقارنة بين {cur} و{prev}',
  'analysis.periodCompare.nothing':
    'قارنتُ شهر {cur} بشهر {prev} ولم أجد فرقًا لافتًا في المزاج أو التوتر أو النوم أو عدد التدوينات.',

  // Habit trend (improved / declined) -----------------------------------------------------
  'analysis.habitsTrend.label': 'العادات التي تحسّنت أو تراجعت',
  'analysis.habitsTrend.whether': 'كانت العادة «{habit}» قد تحسّنت أم تراجعت',
  'analysis.habitsTrend.textDaily':
    'يبدو أن العادة «{habit}» {direction, select, improved {قد تحسّنت} other {قد تراجعت}}: في الأسبوعين الأخيرين أنجزتها في {recent} من أصل {window} يومًا، مقابل {previous} من أصل {window} في الأسبوعين السابقين.',
  'analysis.habitsTrend.textWeekly':
    'يبدو أن العادة «{habit}» {direction, select, improved {قد تحسّنت} other {قد تراجعت}}: في الأسبوعين الأخيرين سجّلت {recent} {unit}، مقابل {previous} في الأسبوعين السابقين (الهدف: {target} {unit} في الأسبوع).',
  'analysis.habitsTrend.explain':
    'قارنتُ نسبة إنجاز العادة في الأسبوعين الأخيرين ({recentFrom}-{recentTo}) بالأسبوعين السابقين ({previousFrom}-{previousTo}): {recentRate} مقابل {previousRate}. الفرق: {diff} نقطة مئوية. قوة التغيّر: {strength}.',
  'analysis.habitsTrend.title':
    'العادة «{habit}» {direction, select, improved {تحسّنت} other {تراجعت}} في الأسبوعين الأخيرين',
  'analysis.habitsTrend.metric': 'نسبة الإنجاز - {habit}',
  'analysis.habitsTrend.groupA': 'الأسبوعان الأخيران',
  'analysis.habitsTrend.groupB': 'الأسبوعان السابقان',

  // Best / hardest days ------------------------------------------------------------------
  'analysis.bestWorst.label': 'أفضل الأيام وأصعبها',
  'analysis.bestWorst.describedDay': '{day} («{title}»)',
  'analysis.bestWorst.noTitle': 'بلا عنوان',
  'analysis.bestWorst.extraValue': '{titles} - الدرجة {score}',
  'analysis.bestWorst.text':
    '{kind, select, best {أفضل الأيام} other {أصعب الأيام}} في الفترة، وفق درجة مركّبة من المزاج والطاقة والتوتر: {days}.',
  'analysis.bestWorst.explainScore':
    'حسبتُ لكل يوم من {count, plural, zero {الأيام الـ#} one {اليوم الوحيد} two {اليومين} few {الأيام الـ#} many {الأيام الـ#} other {الأيام الـ#}} درجة مركّبة: متوسط المزاج ومستوى الطاقة و(11 ناقص مستوى التوتر)، من القيم المسجّلة في ذلك اليوم.',
  'analysis.bestWorst.explainMeans':
    'متوسط الدرجة في الفترة: {overall}. {kind, select, best {{count, plural, one {حصل أفضل يوم على} =3 {حصلت الأيام الثلاثة الأفضل على} other {حصلت أفضل الأيام على}}} other {{count, plural, one {حصل أصعب يوم على} =3 {حصلت الأيام الثلاثة الأصعب على} other {حصلت أصعب الأيام على}}}} {mean} في المتوسط.',
  'analysis.bestWorst.explainDiff': 'الفرق عن المتوسط: {diff} نقطة. قوة الفرق: {strength}.',
  'analysis.bestWorst.title': '{kind, select, best {أفضل الأيام في الفترة} other {أصعب الأيام في الفترة}}',
  'analysis.bestWorst.metric': 'الدرجة المركّبة (المزاج + الطاقة + التوتر المعكوس)',
  'analysis.bestWorst.groupA': '{kind, select, best {أفضل الأيام} other {أصعب الأيام}}',
  'analysis.bestWorst.nothing':
    'فحصتُ {label} على مدى {count, plural, zero {# يوم} one {يوم واحد} two {يومين} few {# أيام} many {# يومًا} other {# يوم}}؛ وكانت الدرجات متقاربة ولم يبرز أي يوم بعينه.',

  // Streaks -------------------------------------------------------------------------------
  'analysis.streaks.label': 'سلاسل الكتابة والعادات',
  'analysis.streaks.entriesTitle':
    'سلسلة كتابة من {count, plural, zero {# يوم} one {يوم واحد} two {يومين} few {# أيام} many {# يومًا} other {# يوم}}',
  'analysis.streaks.entriesText':
    'أحسنت! كتبت في يومياتك {count, plural, zero {# يوم} one {يومًا واحدًا} two {يومين متتاليين} few {# أيام متتالية} many {# يومًا متتاليًا} other {# يوم متتالٍ}} ({from}-{to}).',
  'analysis.streaks.entriesExplain':
    'عددتُ الأيام المتتالية التي فيها تدوينة واحدة على الأقل، حتى اليوم أو أمس. السلسلة الحالية: {count, plural, zero {# يوم} one {يوم واحد} two {يومان} few {# أيام} many {# يومًا} other {# يوم}}، من {from} إلى {to}. أطول سلسلة في الفترة: {best, plural, zero {# يوم} one {يوم واحد} two {يومان} few {# أيام} many {# يومًا} other {# يوم}}.',
  'analysis.streaks.entriesMetric': 'أيام الكتابة',
  'analysis.streaks.currentDays': 'الأيام في السلسلة الحالية',
  'analysis.streaks.daysWithEntry': 'الأيام التي فيها تدوينة خلال الفترة',
  'analysis.streaks.habitTitle':
    'سلسلة من {count, plural, zero {# يوم} one {يوم واحد} two {يومين} few {# أيام} many {# يومًا} other {# يوم}} للعادة «{habit}»',
  'analysis.streaks.habitText':
    'أنجزت العادة «{habit}» {count, plural, zero {# يوم} one {يومًا واحدًا} two {يومين متتاليين} few {# أيام متتالية} many {# يومًا متتاليًا} other {# يوم متتالٍ}} ({from}-{to}).',
  'analysis.streaks.habitExplain':
    'عددتُ الأيام المتتالية التي سُجّلت فيها العادة «{habit}» كمنجزة، حتى اليوم أو أمس. السلسلة الحالية: {count, plural, zero {# يوم} one {يوم واحد} two {يومان} few {# أيام} many {# يومًا} other {# يوم}}. أطول سلسلة في الفترة: {best, plural, zero {# يوم} one {يوم واحد} two {يومان} few {# أيام} many {# يومًا} other {# يوم}}.',
  'analysis.streaks.habitMetric': 'إنجاز العادة «{habit}»',
  'analysis.streaks.daysCompleted': 'الأيام التي أُنجزت فيها العادة خلال الفترة',
  'analysis.streaks.weeklyTitle':
    'سلسلة من {count, plural, zero {# أسبوع} one {أسبوع واحد} two {أسبوعين} few {# أسابيع} many {# أسبوعًا} other {# أسبوع}} للعادة «{habit}»',
  'analysis.streaks.weeklyText':
    'بلغت هدف العادة «{habit}» {count, plural, zero {# أسبوع} one {أسبوعًا واحدًا} two {أسبوعين متتاليين} few {# أسابيع متتالية} many {# أسبوعًا متتاليًا} other {# أسبوع متتالٍ}} ({from}-{to}).',
  'analysis.streaks.weeklyExplain':
    'جمعتُ الكمية المسجّلة للعادة «{habit}» في كل أسبوع وقارنتها بالهدف الأسبوعي ({target}). السلسلة الحالية من الأسابيع التي بلغت الهدف: {count, plural, zero {# أسبوع} one {أسبوع واحد} two {أسبوعان} few {# أسابيع} many {# أسبوعًا} other {# أسبوع}}.',
  'analysis.streaks.weeklyMetric': 'بلوغ الهدف الأسبوعي - {habit}',
  'analysis.streaks.currentWeeks': 'الأسابيع في السلسلة الحالية',
  'analysis.streaks.weeksWithLogs': 'الأسابيع التي فيها تسجيلات خلال الفترة',
  'analysis.streaks.none':
    'لم يُعثر على سلاسل نشطة (سلسلة كتابة من {entryMin} أيام أو أكثر، أو سلسلة عادة من {habitMin} أيام أو أسابيع أو أكثر).',

  // Anomalies -----------------------------------------------------------------------------
  'analysis.anomalies.label': 'أيام غير اعتيادية في المزاج أو التوتر',
  'analysis.anomalies.textOne':
    'يبدو أنه يوم {day} {gender, select, f {كانت {metricDefined} لديك {side, select, high {مرتفعة على نحو غير معتاد} other {منخفضة على نحو غير معتاد}}} other {كان {metricDefined} لديك {side, select, high {مرتفعًا على نحو غير معتاد} other {منخفضًا على نحو غير معتاد}}}} مقارنة ببقية الفترة ({value}، مقابل متوسط قدره {mean}).',
  'analysis.anomalies.textMany':
    'يبدو أنه في {count, plural, zero {# يوم} one {يوم واحد} two {يومين} few {# أيام} many {# يومًا} other {# يوم}} {gender, select, f {كانت {metricDefined} لديك {side, select, high {مرتفعة على نحو غير معتاد} other {منخفضة على نحو غير معتاد}}} other {كان {metricDefined} لديك {side, select, high {مرتفعًا على نحو غير معتاد} other {منخفضًا على نحو غير معتاد}}}} مقارنة ببقية الفترة: {days}؛ ومتوسط الفترة: {mean}.',
  'analysis.anomalies.textManyMore':
    'يبدو أنه في {count, plural, zero {# يوم} one {يوم واحد} two {يومين} few {# أيام} many {# يومًا} other {# يوم}} {gender, select, f {كانت {metricDefined} لديك {side, select, high {مرتفعة على نحو غير معتاد} other {منخفضة على نحو غير معتاد}}} other {كان {metricDefined} لديك {side, select, high {مرتفعًا على نحو غير معتاد} other {منخفضًا على نحو غير معتاد}}}} مقارنة ببقية الفترة: {days} وأيام أخرى؛ ومتوسط الفترة: {mean}.',
  'analysis.anomalies.dayItem': '{day} ({value})',
  'analysis.anomalies.detail': '{date}: {value} ({z} انحراف معياري {side, select, above {فوق المتوسط} other {تحت المتوسط}})',
  'analysis.anomalies.explain':
    'فحصتُ {count, plural, zero {# يوم} one {يومًا واحدًا} two {يومين} few {# أيام} many {# يومًا} other {# يوم}} فيها تسجيل {metric}. المتوسط: {mean}، الانحراف المعياري: {sd}. يُعدّ اليوم غير اعتيادي عندما تبتعد قيمته عن المتوسط بمقدار {z} انحراف معياري أو أكثر. {details}. قوة الانحراف: {strength}.',
  'analysis.anomalies.title':
    '{count, plural, one {يوم شهد} two {يومان شهدا} other {أيام شهدت}} {gender, select, other {{side, select, high {ارتفاعًا غير معتاد في {metric}} other {انخفاضًا غير معتاد في {metric}}}}}',
  'analysis.anomalies.groupA': 'أيام غير اعتيادية',
  'analysis.anomalies.zValue': '{value} (z {z})',
  'analysis.anomalies.nothing':
    'فحصتُ الأيام غير الاعتيادية على مدى {count, plural, zero {# يوم} one {يوم واحد} two {يومين} few {# أيام} many {# يومًا} other {# يوم}} ولم أجد يومًا تبتعد قيمته عن المتوسط بمقدار {z} انحراف معياري أو أكثر.',

  // Emotion patterns ----------------------------------------------------------------------
  'analysis.emotion.label': 'أنماط المشاعر حسب الأيام والأشخاص والأماكن',
  'analysis.emotion.metric': 'شعور «{emotion}»',
  'analysis.emotion.groupA': 'أيام فيها شعور «{emotion}»',
  'analysis.emotion.weekdayTitle': 'شعور «{emotion}» يظهر غالبًا {onWeekday}',
  'analysis.emotion.weekdayText': 'يبدو من بياناتك أن شعور «{emotion}» ظهر غالبًا {onWeekday} ({top} من أصل {total}).',
  'analysis.emotion.weekdayExplain':
    'فحصتُ {count, plural, zero {# يوم} one {يومًا واحدًا} two {يومين} few {# أيام} many {# يومًا} other {# يوم}}. سُجّل شعور «{emotion}» في {total, plural, zero {# يوم} one {يوم واحد} two {يومين} few {# أيام} many {# يومًا} other {# يوم}}؛ كان {top} منها من {weekdays} ({share})، في حين تشكّل {weekdays} {baseline} من مجموع الأيام التي فُحصت. قوة النمط: {strength}.',
  'analysis.emotion.groupBWeekday': 'منها {weekdays}',
  'analysis.emotion.weekdayShareKey': 'نسبة {weekdays} من مجموع الأيام',
  'analysis.emotion.personTitle': 'شعور «{emotion}» و{name}',
  'analysis.emotion.placeTitle': 'شعور «{emotion}» و«{place}»',
  'analysis.emotion.personText':
    'يبدو من بياناتك أن شعور «{emotion}» ظهر كثيرًا في الأيام التي قابلت فيها {name} ({with} من أصل {total}).',
  'analysis.emotion.placeText':
    'يبدو من بياناتك أن شعور «{emotion}» ظهر كثيرًا في الأيام التي كان المكان فيها «{place}» ({with} من أصل {total}).',
  'analysis.emotion.personExplain':
    'فحصتُ {count, plural, zero {# يوم} one {يومًا واحدًا} two {يومين} few {# أيام} many {# يومًا} other {# يوم}}. سُجّل شعور «{emotion}» في {total} من الأيام؛ وفي {with} منها ({share}) ورد اسم {name} أيضًا في التدوينة. يرد اسم {name} في {baselineCount} من أصل {count} يومًا إجمالًا ({baseline}). قوة النمط: {strength}.',
  'analysis.emotion.placeExplain':
    'فحصتُ {count, plural, zero {# يوم} one {يومًا واحدًا} two {يومين} few {# أيام} many {# يومًا} other {# يوم}}. سُجّل شعور «{emotion}» في {total} من الأيام؛ وفي {with} منها ({share}) ورد المكان «{place}» أيضًا في التدوينة. يرد المكان «{place}» في {baselineCount} من أصل {count} يومًا إجمالًا ({baseline}). قوة النمط: {strength}.',
  'analysis.emotion.groupBPerson': 'منها مع {name}',
  'analysis.emotion.groupBPlace': 'منها في «{place}»',
  'analysis.emotion.personShareKey': 'نسبة الأيام التي يرد فيها {name} من مجموع الأيام',
  'analysis.emotion.placeShareKey': 'نسبة الأيام التي يرد فيها المكان «{place}» من مجموع الأيام',
  'analysis.emotion.nothing':
    'فحصتُ {count, plural, zero {# شعور} one {شعورًا واحدًا} two {شعورين} few {# مشاعر} many {# شعورًا} other {# شعور}} تكرر كلٌّ منها {min} مرات على الأقل، ولم أجد تركّزًا لافتًا في أيام أو أشخاص أو أماكن بعينها.',
};
export default messages;
