/** bg - insights messages. Keys are prefixed 'insights.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Insights page (src/pages/InsightsPage.tsx) ---------------------------------------
  'insights.title': 'Наблюдения',
  'insights.period': 'Период',
  'insights.refresh': 'Обнови',
  'insights.notesTitle': 'Непроверено / недостатъчно данни',
  'insights.disclaimer':
    'Наблюденията описват възможни връзки в данните ви. Те не доказват причина и следствие и не са медицински съвет.',
  'insights.empty.title': 'Все още няма наблюдения за този период',
  'insights.empty.text':
    'За да се открият закономерности, в периода са нужни поне {minDays} дни с данни и поне {minGroupSize} дни във всяка група за сравнение (например дни със и без тренировка). Продължавайте да пишете в дневника и да отбелязвате настроението, съня и активността си.',
  'insights.newEntry': 'Нов запис',
  // {inPeriod} is 'stats.period.in' ("in the last 30 days"), {start}/{end} are short dates.
  'insights.summary': '{count, plural, one {# ден} other {# дни}} с данни {inPeriod} ({start} – {end})',
  'insights.found':
    '{count, plural, =0 {Няма открити наблюдения} one {Открито е # наблюдение} other {Открити са # наблюдения}}',

  // Section headings (src/pages/insights/insight-groups.ts) --------------------------
  'insights.group.trends': 'Тенденции',
  'insights.group.habits': 'Навици',
  'insights.group.sleepActivity': 'Сън и активност',
  'insights.group.daysHours': 'Дни и часове',
  'insights.group.emotionsPeople': 'Емоции и хора',
  'insights.group.anomalies': 'Необичайни дни',
  'insights.group.other': 'Други наблюдения',

  // Strength and direction badges ---------------------------------------------------
  'insights.strength.strong': 'Силна закономерност',
  'insights.strength.moderate': 'Умерена закономерност',
  'insights.strength.weak': 'Слаба закономерност',
  'insights.positive': 'Окуражаващо',
  'insights.attention': 'Заслужава внимание',

  // Insight card (src/pages/insights/InsightCard.tsx) --------------------------------
  'insights.card.why': 'Защо виждам това наблюдение?',
  'insights.card.evidenceCaption': 'Данните зад наблюдението',
  'insights.card.relatedDays': 'Свързани дни',
  'insights.card.period': 'Период: {start} – {end}',
  'insights.card.detail': 'Показател',
  'insights.card.value': 'Стойност',
  'insights.card.daysExamined': 'Проверени дни',
  'insights.card.metric': 'Метрика',
  'insights.card.correlation': 'Корелация (r)',
  'insights.card.effectSize': 'Големина на разликата',
  'insights.card.groupRow': '{count, plural, one {# ден} other {# дни}}, средно {mean}',
  'insights.card.groupRowNoMean': '{count, plural, one {# ден} other {# дни}}',

  // Home page (src/pages/HomePage.tsx, GET /api/home) --------------------------------
  'insights.home.title': 'Начало',
  'insights.home.newEntry': 'Нов запис',
  'insights.home.greetingLabel': 'Поздрав',
  'insights.home.today': 'Днес',
  'insights.home.weekAverages': 'Средни стойности за последните 7 дни',
  'insights.home.habitsToday': 'Навици за днес',
  'insights.home.insightOfDay': 'Наблюдение на деня',
  'insights.home.lastEntry': 'Последен запис',
  'insights.home.noData': 'Няма данни',
  'insights.home.noHabits': 'Няма активни навици.',
  'insights.home.manageHabits': 'Управление на навиците',
  'insights.home.allHabits': 'Всички навици',
  'insights.home.allInsights': 'Всички наблюдения',
  'insights.home.noInsight':
    'Все още няма наблюдения. Продължавайте да пишете в дневника и да отбелязвате съня, настроението и активността си, за да се откроят закономерности.',
  'insights.home.noEntriesTitle': 'Все още няма записи в дневника',
  'insights.home.noEntriesText': 'Всяко наблюдение започва с първия запис. Достатъчни са няколко изречения за деня ви.',
  'insights.home.firstEntry': 'Напишете първия запис',
  'insights.home.untitled': 'Без заглавие',
  'insights.home.streak': 'Поредни дни с писане: {count, plural, one {# ден} other {# дни}}',
  'insights.home.entriesToday':
    '{count, plural, =0 {Днес все още няма запис} one {# запис днес} other {# записа днес}}',
  'insights.home.totalEntries':
    '{count, plural, one {Общо # запис в дневника} other {Общо # записа в дневника}}',
  'insights.home.ratingOf10': '{value} от 10',
  'insights.home.sleepHours': '{value} ч',
  'insights.home.lastEntryMood': 'Настроение: {value}',
};
export default messages;
