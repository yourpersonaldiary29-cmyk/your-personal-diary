/** ru - insights messages. Keys are prefixed 'insights.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Insights page (src/pages/InsightsPage.tsx) ---------------------------------------
  'insights.title': 'Наблюдения',
  'insights.period': 'Период',
  'insights.refresh': 'Обновить',
  'insights.notesTitle': 'Не проверено / недостаточно данных',
  'insights.disclaimer':
    'Наблюдения описывают возможные связи в ваших данных. Они не доказывают причину и следствие и не являются медицинской рекомендацией.',
  'insights.empty.title': 'Для этого периода наблюдений пока нет',
  'insights.empty.text':
    'Чтобы заметить закономерности, в периоде нужно не менее {minDays} дней с данными и не менее {minGroupSize} дней в каждой группе сравнения (например, дни с тренировкой и без неё). Продолжайте вести дневник и отмечать настроение, сон и активность.',
  'insights.newEntry': 'Новая запись',
  // {inPeriod} is 'stats.period.in' ("in the last 30 days"), {start}/{end} are short dates.
  'insights.summary':
    '{count, plural, one {# день} few {# дня} many {# дней} other {# дня}} с данными {inPeriod} ({start} – {end})',
  'insights.found':
    '{count, plural, =0 {Наблюдений не найдено} one {Найдено # наблюдение} few {Найдено # наблюдения} many {Найдено # наблюдений} other {Найдено # наблюдения}}',

  // Section headings (src/pages/insights/insight-groups.ts) --------------------------
  'insights.group.trends': 'Тенденции',
  'insights.group.habits': 'Привычки',
  'insights.group.sleepActivity': 'Сон и активность',
  'insights.group.daysHours': 'Дни и время суток',
  'insights.group.emotionsPeople': 'Эмоции и люди',
  'insights.group.anomalies': 'Необычные дни',
  'insights.group.other': 'Другие наблюдения',

  // Strength and direction badges ---------------------------------------------------
  'insights.strength.strong': 'Сильная закономерность',
  'insights.strength.moderate': 'Умеренная закономерность',
  'insights.strength.weak': 'Слабая закономерность',
  'insights.positive': 'Обнадёживает',
  'insights.attention': 'Стоит обратить внимание',

  // Insight card (src/pages/insights/InsightCard.tsx) --------------------------------
  'insights.card.why': 'Почему я вижу это наблюдение?',
  'insights.card.evidenceCaption': 'Данные, на которых основано наблюдение',
  'insights.card.relatedDays': 'Связанные дни',
  'insights.card.period': 'Период: {start} – {end}',
  'insights.card.detail': 'Показатель',
  'insights.card.value': 'Значение',
  'insights.card.daysExamined': 'Проверено дней',
  'insights.card.metric': 'Метрика',
  'insights.card.correlation': 'Корреляция (r)',
  'insights.card.effectSize': 'Величина различия',
  'insights.card.groupRow': '{count, plural, one {# день} few {# дня} many {# дней} other {# дня}}, в среднем {mean}',
  'insights.card.groupRowNoMean': '{count, plural, one {# день} few {# дня} many {# дней} other {# дня}}',

  // Home page (src/pages/HomePage.tsx, GET /api/home) --------------------------------
  'insights.home.title': 'Главная',
  'insights.home.newEntry': 'Новая запись',
  'insights.home.greetingLabel': 'Приветствие',
  'insights.home.today': 'Сегодня',
  'insights.home.weekAverages': 'Средние за последние 7 дней',
  'insights.home.habitsToday': 'Привычки на сегодня',
  'insights.home.insightOfDay': 'Наблюдение дня',
  'insights.home.lastEntry': 'Последняя запись',
  'insights.home.noData': 'Нет данных',
  'insights.home.noHabits': 'Нет активных привычек.',
  'insights.home.manageHabits': 'Управление привычками',
  'insights.home.allHabits': 'Все привычки',
  'insights.home.allInsights': 'Все наблюдения',
  'insights.home.noInsight':
    'Наблюдений пока нет. Продолжайте вести дневник и отмечать сон, настроение и активность - так со временем проявятся закономерности.',
  'insights.home.noEntriesTitle': 'В дневнике пока нет записей',
  'insights.home.noEntriesText': 'С первой записи начинаются все наблюдения. Достаточно нескольких предложений о вашем дне.',
  'insights.home.firstEntry': 'Написать первую запись',
  'insights.home.untitled': 'Без названия',
  'insights.home.streak': 'Пишете подряд: {count, plural, one {# день} few {# дня} many {# дней} other {# дня}}',
  'insights.home.entriesToday':
    '{count, plural, =0 {Сегодня записей ещё нет} one {Сегодня # запись} few {Сегодня # записи} many {Сегодня # записей} other {Сегодня # записи}}',
  'insights.home.totalEntries':
    '{count, plural, one {Всего в дневнике # запись} few {Всего в дневнике # записи} many {Всего в дневнике # записей} other {Всего в дневнике # записи}}',
  'insights.home.ratingOf10': '{value} из 10',
  'insights.home.sleepHours': '{value} ч',
  'insights.home.lastEntryMood': 'Настроение: {value}',
};
export default messages;
