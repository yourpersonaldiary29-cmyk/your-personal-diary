/**
 * ru - searchAnswers messages (server/src/search: parser explanations, period labels,
 * executor answers). Keys are prefixed 'searchAnswers.'; see shared/i18n/index.ts for the syntax.
 *
 * Every sentence that names a metric receives it as `{metric, select, ...}`: each branch
 * carries the case (dative after "по", instrumental after "с", genitive after "тенденцию")
 * and, where needed, the verb that agrees with it. `{period}` is a ready phrase
 * ("за последний месяц", "во всём дневнике"). Emotion labels are nouns and are shown in
 * apposition ("с эмоцией: Усталость"), so they never need another case.
 * Note: Russian "one" also covers 21, 31...; exact "=1" branches hold the singular-only wording.
 */
const messages: Record<string, string> = {
  // Period labels (ParsedQuery.periodLabel and the {period} of every sentence) --------
  'searchAnswers.period.all': 'за всё время',
  'searchAnswers.period.allPhrase': 'во всём дневнике',
  'searchAnswers.period.today': 'сегодня',
  'searchAnswers.period.yesterday': 'вчера',
  'searchAnswers.period.twoDaysAgo': 'позавчера',
  'searchAnswers.period.week': 'за последнюю неделю',
  'searchAnswers.period.month': 'за последний месяц',
  'searchAnswers.period.halfYear': 'за последние полгода',
  'searchAnswers.period.year': 'за последний год',
  'searchAnswers.period.startYear': 'с начала года',
  'searchAnswers.period.startMonth': 'с начала месяца',
  'searchAnswers.period.recent': 'за последние дни',
  'searchAnswers.period.lastDays':
    '{count, plural, =1 {сегодня} one {за последний # день} few {за последние # дня} many {за последние # дней} other {за последние # дня}}',
  'searchAnswers.period.lastWeeks':
    '{count, plural, =1 {за последнюю неделю} one {за последнюю # неделю} few {за последние # недели} many {за последние # недель} other {за последние # недели}}',
  'searchAnswers.period.lastMonths':
    '{count, plural, =1 {за последний месяц} one {за последний # месяц} few {за последние # месяца} many {за последние # месяцев} other {за последние # месяца}}',
  'searchAnswers.period.lastYears':
    '{count, plural, =1 {за последний год} one {за последний # год} few {за последние # года} many {за последние # лет} other {за последние # года}}',
  'searchAnswers.period.agoDays':
    '{count, plural, =1 {день назад} one {# день назад} few {# дня назад} many {# дней назад} other {# дня назад}}',
  'searchAnswers.period.agoWeeks':
    '{count, plural, =1 {неделю назад} one {# неделю назад} few {# недели назад} many {# недель назад} other {# недели назад}}',
  'searchAnswers.period.agoMonths':
    '{count, plural, =1 {месяц назад} one {# месяц назад} few {# месяца назад} many {# месяцев назад} other {# месяца назад}}',
  'searchAnswers.period.agoYears':
    '{count, plural, =1 {год назад} one {# год назад} few {# года назад} many {# лет назад} other {# года назад}}',
  // {month} is the nominative month name ("июль"); "за" + accusative keeps it unchanged.
  'searchAnswers.period.calendarMonth': 'за {month} {year}',
  'searchAnswers.period.onDate': '{date}',
  'searchAnswers.period.between': 'с {from} по {to}',

  // Comparators ("less than 5") ------------------------------------------------------
  'searchAnswers.comparator.lt': 'меньше {value}',
  'searchAnswers.comparator.lte': 'не больше {value}',
  'searchAnswers.comparator.gt': 'больше {value}',
  'searchAnswers.comparator.gte': 'не меньше {value}',
  'searchAnswers.comparator.eq': 'ровно {value}',

  // Lists and quoting ----------------------------------------------------------------
  'searchAnswers.quoted': '«{term}»',
  'searchAnswers.listSeparator': ', ',
  'searchAnswers.dayWithValues': '{day} ({values})',
  'searchAnswers.value.mood': 'настроение {value}',
  'searchAnswers.value.energy': 'энергия {value}',
  'searchAnswers.value.stress': 'стресс {value}',
  'searchAnswers.value.sleepHours': 'часы сна {value}',
  'searchAnswers.value.sleepQuality': 'качество сна {value}',
  'searchAnswers.value.exerciseMinutes': 'минуты активности {value}',
  'searchAnswers.mention.something': 'что-нибудь',

  // "How I understood the question" (ParsedQuery.explanation) ------------------------
  'searchAnswers.explain.best': 'Вопрос понят так: дни, когда вам было лучше всего, {period}.',
  'searchAnswers.explain.bestByMetric':
    'Вопрос понят так: лучшие дни по {metric, select, mood {настроению} energy {уровню энергии} stress {уровню стресса} sleepHours {продолжительности сна} sleepQuality {качеству сна} exerciseMinutes {физической активности} other {показателю}}, {period}.',
  'searchAnswers.explain.worst': 'Вопрос понят так: самые трудные дни, {period}.',
  'searchAnswers.explain.worstByMetric':
    'Вопрос понят так: самые трудные дни по {metric, select, mood {настроению} energy {уровню энергии} stress {уровню стресса} sleepHours {продолжительности сна} sleepQuality {качеству сна} exerciseMinutes {физической активности} other {показателю}}, {period}.',
  'searchAnswers.explain.filter':
    'Вопрос понят так: дни {metric, select, mood {с настроением} energy {с уровнем энергии} stress {с уровнем стресса} sleepHours {с продолжительностью сна} sleepQuality {с качеством сна} exerciseMinutes {с физической активностью} other {со значением}} {comparison}, {period}.',
  'searchAnswers.explain.trend':
    'Вопрос понят так: как {metric, select, mood {менялось ваше настроение} energy {менялся ваш уровень энергии} stress {менялся ваш уровень стресса} sleepHours {менялась продолжительность вашего сна} sleepQuality {менялось качество вашего сна} exerciseMinutes {менялась ваша физическая активность} other {менялись ваши показатели}}, {period}.',
  'searchAnswers.explain.mention': 'Вопрос понят так: записи, в которых вы упоминали {terms}, {period}.',
  'searchAnswers.explain.mentionAny': 'Вопрос понят так: ваши записи, {period}.',
  'searchAnswers.explain.emotion': 'Вопрос понят так: дни с эмоцией: {emotions}, {period}.',
  'searchAnswers.explain.list': 'Вопрос понят так: записи, содержащие {terms}, {period}.',
  'searchAnswers.explain.listAll': 'Вопрос понят так: все записи, {period}.',
  'searchAnswers.explain.unknown':
    'Не удалось понять вопрос. Можно спросить, например: «В какие дни за последний месяц мне было лучше всего?»',

  // Answers ---------------------------------------------------------------------------
  'searchAnswers.noResults': 'Записей, подходящих под вопрос, не найдено.',
  'searchAnswers.noResultsPeriod': 'Записей, подходящих под вопрос, {period} не найдено.',
  // Russian long dates end in "г." ("7 сентября 2025 г."): sentences that end with {days} carry no
  // final period, and a trailing {first}/{last} date sits in parentheses, so no "г.." appears.
  'searchAnswers.rank.best': 'Дни, когда вам было лучше всего, {period}: {days}',
  'searchAnswers.rank.bestByMetric':
    'Лучшие дни по {metric, select, mood {настроению} energy {уровню энергии} stress {уровню стресса} sleepHours {продолжительности сна} sleepQuality {качеству сна} exerciseMinutes {физической активности} other {показателю}} {period}: {days}',
  'searchAnswers.rank.worst': 'Самые трудные дни {period}: {days}',
  'searchAnswers.rank.worstByMetric':
    'Самые трудные дни по {metric, select, mood {настроению} energy {уровню энергии} stress {уровню стресса} sleepHours {продолжительности сна} sleepQuality {качеству сна} exerciseMinutes {физической активности} other {показателю}} {period}: {days}',
  'searchAnswers.filter.found':
    '{count, plural, one {Найден # день} few {Найдено # дня} many {Найдено # дней} other {Найдено # дня}} {metric, select, mood {с настроением} energy {с уровнем энергии} stress {с уровнем стресса} sleepHours {с продолжительностью сна} sleepQuality {с качеством сна} exerciseMinutes {с физической активностью} other {со значением}} {comparison} {period}: {days}{more, plural, =0 {} one { и ещё # день} few { и ещё # дня} many { и ещё # дней} other { и ещё # дня}}',
  'searchAnswers.emotion.found':
    'Дни с эмоцией: {emotions} {period} - {count, plural, one {# день} few {# дня} many {# дней} other {# дня}}: {days}{more, plural, =0 {} one { и ещё # день} few { и ещё # дня} many { и ещё # дней} other { и ещё # дня}}',
  'searchAnswers.mention.found':
    'Вы упоминали {terms} в {count, plural, =1 {# записи {period} ({first})} one {# записи {period} (первая - {first}, последняя - {last})} few {# записях {period} (первая - {first}, последняя - {last})} many {# записях {period} (первая - {first}, последняя - {last})} other {# записи {period} (первая - {first}, последняя - {last})}}.',
  'searchAnswers.list.found':
    '{count, plural, one {Найдена # запись} few {Найдено # записи} many {Найдено # записей} other {Найдено # записи}} {period} (последняя - {last}).',
  'searchAnswers.list.foundTerms':
    '{count, plural, one {Найдена # запись, содержащая} few {Найдено # записи, содержащие} many {Найдено # записей, содержащих} other {Найдено # записи, содержащие}} {terms}, {period} (последняя - {last}).',
  'searchAnswers.unknown.fallback':
    'Вопрос не совсем понятен, поэтому {count, plural, =1 {вот последняя запись} one {вот последняя # запись} few {вот последние # записи} many {вот последние # записей} other {вот последние # записи}} из {total}. {explanation}',
  'searchAnswers.trend.insufficient':
    'Недостаточно данных, чтобы увидеть тенденцию {metric, select, mood {вашего настроения} energy {вашего уровня энергии} stress {вашего уровня стресса} sleepHours {продолжительности вашего сна} sleepQuality {качества вашего сна} exerciseMinutes {вашей физической активности} other {ваших показателей}} {period}.',
  'searchAnswers.trend.evidence':
    '(по {first, plural, one {# дню} few {# дням} many {# дням} other {# дня}} в начале периода и {last, plural, one {# дню} few {# дням} many {# дням} other {# дня}} в конце)',
  'searchAnswers.trend.stable':
    '{metric, select, mood {Ваше среднее настроение оставалось стабильным} energy {Ваш средний уровень энергии оставался стабильным} stress {Ваш средний уровень стресса оставался стабильным} sleepHours {Ваша средняя продолжительность сна оставалась стабильной} sleepQuality {Ваше среднее качество сна оставалось стабильным} exerciseMinutes {Ваша средняя физическая активность оставалась стабильной} other {Ваш средний показатель оставался стабильным}} {period}: {from} против {to} {evidence}.',
  'searchAnswers.trend.up':
    '{metric, select, mood {Ваше среднее настроение выросло} energy {Ваш средний уровень энергии вырос} stress {Ваш средний уровень стресса вырос} sleepHours {Ваша средняя продолжительность сна выросла} sleepQuality {Ваше среднее качество сна выросло} exerciseMinutes {Ваша средняя физическая активность выросла} other {Ваш средний показатель вырос}} с {from} до {to} {period} {evidence}.',
  'searchAnswers.trend.down':
    '{metric, select, mood {Ваше среднее настроение снизилось} energy {Ваш средний уровень энергии снизился} stress {Ваш средний уровень стресса снизился} sleepHours {Ваша средняя продолжительность сна снизилась} sleepQuality {Ваше среднее качество сна снизилось} exerciseMinutes {Ваша средняя физическая активность снизилась} other {Ваш средний показатель снизился}} с {from} до {to} {period} {evidence}.',

  // Request validation (POST /api/search) ----------------------------------------------
  'searchAnswers.validation.body': 'Тело запроса должно содержать вопрос (query)',
  'searchAnswers.validation.query': 'Введите вопрос',
  'searchAnswers.validation.queryTooLong': 'Вопрос слишком длинный (не более {max} символов)',
  'searchAnswers.validation.limit': 'Количество результатов должно быть целым числом от 1 до {max}',
};
export default messages;
