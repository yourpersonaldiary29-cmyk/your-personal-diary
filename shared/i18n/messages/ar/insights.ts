/** ar - insights messages. Keys are prefixed 'insights.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Insights page (src/pages/InsightsPage.tsx) ---------------------------------------
  'insights.title': 'الرؤى',
  'insights.period': 'الفترة',
  'insights.refresh': 'تحديث',
  'insights.notesTitle': 'لم يُفحص / لا تكفي البيانات',
  'insights.disclaimer': 'تصف الرؤى علاقات محتملة في بياناتك. وهي لا تثبت علاقة سبب ونتيجة، وليست نصيحة طبية.',
  'insights.empty.title': 'لا توجد رؤى لهذه الفترة بعد',
  'insights.empty.text':
    'لاكتشاف الأنماط يلزم وجود {minDays} يومًا على الأقل من البيانات في الفترة، و{minGroupSize} أيام على الأقل في كل مجموعة مقارنة (مثل الأيام التي فيها نشاط بدني والأيام التي ليس فيها). ومواصلة الكتابة في اليوميات وتسجيل المزاج والنوم والنشاط تساعد على ذلك.',
  'insights.newEntry': 'تدوينة جديدة',
  // {inPeriod} is 'stats.period.in' ("in the last 30 days"), {start}/{end} are short dates.
  'insights.summary':
    '{count, plural, zero {# يوم} one {يوم واحد} two {يومان} few {# أيام} many {# يومًا} other {# يوم}} فيها بيانات {inPeriod} ({start} – {end})',
  'insights.found':
    '{count, plural, =0 {لم يُعثر على رؤى} zero {لم يُعثر على رؤى} one {تم العثور على رؤية واحدة} two {تم العثور على رؤيتين} few {تم العثور على # رؤى} many {تم العثور على # رؤية} other {تم العثور على # رؤية}}',

  // Section headings (src/pages/insights/insight-groups.ts) --------------------------
  'insights.group.trends': 'الاتجاهات',
  'insights.group.habits': 'العادات',
  'insights.group.sleepActivity': 'النوم والنشاط',
  'insights.group.daysHours': 'الأيام والأوقات',
  'insights.group.emotionsPeople': 'المشاعر والأشخاص',
  'insights.group.anomalies': 'أيام غير اعتيادية',
  'insights.group.other': 'رؤى أخرى',

  // Strength and direction badges ---------------------------------------------------
  'insights.strength.strong': 'نمط قوي',
  'insights.strength.moderate': 'نمط متوسط',
  'insights.strength.weak': 'نمط ضعيف',
  'insights.positive': 'مشجّع',
  'insights.attention': 'يستحق الانتباه',

  // Insight card (src/pages/insights/InsightCard.tsx) --------------------------------
  'insights.card.why': 'لماذا حصلت على هذه الرؤية؟',
  'insights.card.evidenceCaption': 'البيانات التي تستند إليها الرؤية',
  'insights.card.relatedDays': 'الأيام المرتبطة',
  'insights.card.period': 'الفترة: {start} – {end}',
  'insights.card.detail': 'التفصيل',
  'insights.card.value': 'القيمة',
  'insights.card.daysExamined': 'الأيام التي فُحصت',
  'insights.card.metric': 'المؤشر',
  'insights.card.correlation': 'معامل الارتباط (r)',
  'insights.card.effectSize': 'حجم الفرق',
  'insights.card.groupRow':
    '{count, plural, zero {# يوم} one {يوم واحد} two {يومان} few {# أيام} many {# يومًا} other {# يوم}}، المتوسط {mean}',
  'insights.card.groupRowNoMean': '{count, plural, zero {# يوم} one {يوم واحد} two {يومان} few {# أيام} many {# يومًا} other {# يوم}}',

  // Home page (src/pages/HomePage.tsx, GET /api/home) --------------------------------
  'insights.home.title': 'الرئيسية',
  'insights.home.newEntry': 'تدوينة جديدة',
  'insights.home.greetingLabel': 'التحية',
  'insights.home.today': 'اليوم',
  'insights.home.weekAverages': 'متوسطات آخر 7 أيام',
  'insights.home.habitsToday': 'عادات اليوم',
  'insights.home.insightOfDay': 'رؤية اليوم',
  'insights.home.lastEntry': 'آخر تدوينة',
  'insights.home.noData': 'لا توجد بيانات',
  'insights.home.noHabits': 'لا توجد عادات نشطة.',
  'insights.home.manageHabits': 'إدارة العادات',
  'insights.home.allHabits': 'كل العادات',
  'insights.home.allInsights': 'كل الرؤى',
  'insights.home.noInsight': 'لا توجد رؤى بعد. مواصلة الكتابة في اليوميات وتسجيل النوم والمزاج والنشاط تساعد على اكتشاف الأنماط.',
  'insights.home.noEntriesTitle': 'لا توجد تدوينات في اليوميات بعد',
  'insights.home.noEntriesText': 'التدوينة الأولى هي بداية كل رؤية. تكفي بضع جمل عن يومك.',
  'insights.home.firstEntry': 'كتابة التدوينة الأولى',
  'insights.home.untitled': 'بلا عنوان',
  'insights.home.streak':
    'سلسلة الكتابة: {count, plural, zero {# يوم} one {يوم واحد} two {يومان} few {# أيام} many {# يومًا} other {# يوم}}',
  'insights.home.entriesToday':
    '{count, plural, =0 {لم تُكتب أي تدوينة اليوم بعد} zero {لم تُكتب أي تدوينة اليوم بعد} one {تدوينة واحدة اليوم} two {تدوينتان اليوم} few {# تدوينات اليوم} many {# تدوينة اليوم} other {# تدوينة اليوم}}',
  'insights.home.totalEntries':
    '{count, plural, zero {لا توجد تدوينات في اليوميات} one {تدوينة واحدة في اليوميات إجمالًا} two {تدوينتان في اليوميات إجمالًا} few {# تدوينات في اليوميات إجمالًا} many {# تدوينة في اليوميات إجمالًا} other {# تدوينة في اليوميات إجمالًا}}',
  'insights.home.ratingOf10': '{value} من 10',
  'insights.home.sleepHours': '{value} ساعة',
  'insights.home.lastEntryMood': 'المزاج: {value}',
};
export default messages;
