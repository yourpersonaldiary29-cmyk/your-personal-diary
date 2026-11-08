/**
 * ru - analysis messages (server-side insight templates, notes and labels).
 * Keys are prefixed 'analysis.'; see shared/i18n/index.ts for the template syntax and
 * shared/i18n/messages/en/analysis.ts for the conventions.
 *
 * Russian notes:
 *  - The app speaks as "мы" ("Мы проверили..."), which is gender-neutral, and addresses the
 *    user with "вы" (plural past tense "вы спали" is gender-neutral as well).
 *  - `gender` is m / f / n of the metric noun ('analysis.metric.<metric>.gender'); the metric
 *    phrases are placed as the grammatical subject (nominative) so that only the possessive,
 *    the adjective and the past-tense verb need to agree ("ваш уровень энергии был выше",
 *    "ваша продолжительность сна была выше", "ваше настроение было выше").
 *  - Where a metric label would need another case it is quoted after "показатель"
 *    ("с данными о показателе «настроение»").
 *  - Detector labels ({what}, {label}) are chosen so that the accusative equals the
 *    nominative ("связь ...", "тенденции ...", "различия ..."), because they follow
 *    "проверить" / "Мы проверили".
 *  - Month names arrive in the nominative ("сентябрь"): "за {cur}" keeps them unchanged.
 *  - Hedged, never causal: "Похоже...", "может быть связь"; no "вызывает", "приводит к", "из-за".
 */
const messages: Record<string, string> = {
  // Engine / provider -----------------------------------------------------------------
  'analysis.engine.providerFailed': 'Анализ закономерностей не завершился (внутренняя ошибка). Попробуйте позже.',
  'analysis.engine.detectorFailed': 'Проверка «{label}» не завершилась (внутренняя ошибка); остальные наблюдения в порядке.',

  // Strength --------------------------------------------------------------------------
  'analysis.strength.weak': 'слабая',
  'analysis.strength.moderate': 'умеренная',
  'analysis.strength.strong': 'сильная',

  // Metrics: label (short, standalone), defined (subject inside a sentence), gender -----
  'analysis.metric.mood.label': 'настроение',
  'analysis.metric.mood.defined': 'настроение',
  'analysis.metric.mood.gender': 'n',
  'analysis.metric.energy.label': 'уровень энергии',
  'analysis.metric.energy.defined': 'уровень энергии',
  'analysis.metric.energy.gender': 'm',
  'analysis.metric.stress.label': 'уровень стресса',
  'analysis.metric.stress.defined': 'уровень стресса',
  'analysis.metric.stress.gender': 'm',
  'analysis.metric.sleepHours.label': 'продолжительность сна',
  'analysis.metric.sleepHours.defined': 'продолжительность сна',
  'analysis.metric.sleepHours.gender': 'f',
  'analysis.metric.sleepQuality.label': 'качество сна',
  'analysis.metric.sleepQuality.defined': 'качество сна',
  'analysis.metric.sleepQuality.gender': 'n',
  'analysis.metric.exerciseMinutes.label': 'время физической активности',
  'analysis.metric.exerciseMinutes.defined': 'время физической активности',
  'analysis.metric.exerciseMinutes.gender': 'n',
  'analysis.metric.entries.label': 'число записей',
  'analysis.metric.entries.defined': 'число записей',
  'analysis.metric.entries.gender': 'n',

  // Counts and dates ------------------------------------------------------------------
  'analysis.count.days': '{count, plural, one {# день} few {# дня} many {# дней} other {# дня}}',
  'analysis.count.weeks': '{count, plural, one {# неделя} few {# недели} many {# недель} other {# недели}}',
  'analysis.date.dayWithDate': '{weekday}, {date}',

  // Weekdays (index 0 = Sunday) --------------------------------------------------------
  'analysis.weekday.plural.0': 'воскресенья',
  'analysis.weekday.plural.1': 'понедельники',
  'analysis.weekday.plural.2': 'вторники',
  'analysis.weekday.plural.3': 'среды',
  'analysis.weekday.plural.4': 'четверги',
  'analysis.weekday.plural.5': 'пятницы',
  'analysis.weekday.plural.6': 'субботы',
  'analysis.weekday.on.0': 'по воскресеньям',
  'analysis.weekday.on.1': 'по понедельникам',
  'analysis.weekday.on.2': 'по вторникам',
  'analysis.weekday.on.3': 'по средам',
  'analysis.weekday.on.4': 'по четвергам',
  'analysis.weekday.on.5': 'по пятницам',
  'analysis.weekday.on.6': 'по субботам',

  // Notes shared by the detectors -------------------------------------------------------
  'analysis.note.insufficient': 'Недостаточно данных, чтобы проверить {what} (нужно минимум: {required}; сейчас: {have}).',
  'analysis.note.insufficientWhether': 'Недостаточно данных, чтобы проверить, {what} (нужно минимум: {required}; сейчас: {have}).',
  'analysis.note.nothingNotable':
    'Мы проверили {what} за {count, plural, one {# день} few {# дня} many {# дней} other {# дня}} и не нашли заметных различий.',

  // Requirement / availability phrases used inside the notes above (nominative) --------
  'analysis.req.daysBothValues':
    '{count, plural, one {# день с обоими значениями} few {# дня с обоими значениями} many {# дней с обоими значениями} other {# дня с обоими значениями}}',
  'analysis.req.daysPerGroup':
    '{count, plural, one {# день в каждой группе} few {# дня в каждой группе} many {# дней в каждой группе} other {# дня в каждой группе}}',
  'analysis.req.daysWithReport':
    '{count, plural, one {# день с данными} few {# дня с данными} many {# дней с данными} other {# дня с данными}}',
  'analysis.req.daysWithRatings':
    '{count, plural, one {# день с оценками} few {# дня с оценками} many {# дней с оценками} other {# дня с оценками}}',
  'analysis.req.daysPerMonth':
    '{count, plural, one {# день с данными в каждом месяце} few {# дня с данными в каждом месяце} many {# дней с данными в каждом месяце} other {# дня с данными в каждом месяце}}',
  'analysis.req.recentDays':
    '{count, plural, one {# день с данными за последние две недели} few {# дня с данными за последние две недели} many {# дней с данными за последние две недели} other {# дня с данными за последние две недели}}',
  'analysis.req.fullWeeks':
    '{count, plural, one {# полная неделя с данными} few {# полные недели с данными} many {# полных недель с данными} other {# полные недели с данными}}',
  'analysis.req.weeksOfLogs':
    '{count, plural, one {# неделя отметок} few {# недели отметок} many {# недель отметок} other {# недели отметок}}',
  'analysis.req.weekPerGroup':
    'одна неделя в каждой группе и {count, plural, one {# день} few {# дня} many {# дней} other {# дня}} с данными в каждой группе',
  'analysis.req.moodReports':
    '{count, plural, one {# отметка настроения} few {# отметки настроения} many {# отметок настроения} other {# отметки настроения}}',
  'analysis.req.reportsInWindow':
    '{count, plural, one {# отметка в одном временном окне} few {# отметки в одном временном окне} many {# отметок в одном временном окне} other {# отметки в одном временном окне}}',
  'analysis.req.emotionRepeated':
    'одна эмоция, отмеченная {count, plural, one {# раз} few {# раза} many {# раз} other {# раза}} в разные дни',
  'analysis.have.twoGroups':
    '{groupA}: {countA, plural, one {# день} few {# дня} many {# дней} other {# дня}}; {groupB}: {countB, plural, one {# день} few {# дня} many {# дней} other {# дня}}',
  'analysis.have.weeksTwoGroups':
    'недели с достигнутой целью: {metWeeks, plural, one {# неделя} few {# недели} many {# недель} other {# недели}} ({metDays, plural, one {# день} few {# дня} many {# дней} other {# дня}}); недели ниже цели: {belowWeeks, plural, one {# неделя} few {# недели} many {# недель} other {# недели}} ({belowDays, plural, one {# день} few {# дня} many {# дней} other {# дня}})',
  'analysis.have.twoMonths':
    '{countA, plural, one {# день} few {# дня} many {# дней} other {# дня}} за {cur} и {countB, plural, one {# день} few {# дня} many {# дней} other {# дня}} за {prev}',
  'analysis.have.noData': 'нет данных',
  'analysis.have.noSuchEmotion': 'пока нет',
  'analysis.have.fewerInEveryWindow': 'в каждом окне меньше',

  // Sentences shared by the group-comparison detectors ----------------------------------
  // {condition} ends with a subordinate clause ("в дни, когда вы спали меньше 6 ч"), hence the comma after it.
  'analysis.relation.text':
    'Похоже, в ваших данных {condition}, {gender, select, m {ваш {metricDefined} был {direction, select, higher {в среднем выше} other {в среднем ниже}}} f {ваша {metricDefined} была {direction, select, higher {в среднем выше} other {в среднем ниже}}} n {ваше {metricDefined} было {direction, select, higher {в среднем выше} other {в среднем ниже}}} other {показатель «{metricDefined}» был {direction, select, higher {в среднем выше} other {в среднем ниже}}}} ({meanA} против {meanB}).',
  'analysis.correlation.text':
    'Похоже, в ваших данных может быть связь между показателями «{x}» и «{y}»: {xGender, select, m {когда ваш {x} был выше} f {когда ваша {x} была выше} n {когда ваше {x} было выше} other {когда показатель «{x}» был выше}}, {yGender, select, m {ваш {y} {direction, select, higher {обычно тоже был выше} other {обычно был ниже}}} f {ваша {y} {direction, select, higher {обычно тоже была выше} other {обычно была ниже}}} n {ваше {y} {direction, select, higher {обычно тоже было выше} other {обычно было ниже}}} other {показатель «{y}» {direction, select, higher {обычно тоже был выше} other {обычно был ниже}}}} (корреляция {r}).',
  'analysis.explain.checkedDays': 'Мы проверили {count, plural, one {# день} few {# дня} many {# дней} other {# дня}}.',
  'analysis.explain.onDaysCondition': 'Дней, когда вы {conditionPast}: {count}.',
  'analysis.explain.groupMeans':
    '{gender, select, m {Ваш средний {metricDefined} в эти дни составил {meanA}} f {Ваша средняя {metricDefined} в эти дни составила {meanA}} n {Ваше среднее {metricDefined} в эти дни составило {meanA}} other {Среднее значение в эти дни - {meanA}}}, а в остальные дни - {meanB}.',
  'analysis.explain.correlation': 'Корреляция: {r}.',
  'analysis.explain.correlationBetween': 'Корреляция ({predictor} и {outcome}): {r}.',
  'analysis.explain.diffAndStrength': 'Разница между средними: {diff} балла. Сила закономерности: {strength}.',
  'analysis.explain.diffStrength': 'Разница: {diff} балла. Сила закономерности: {strength}.',
  'analysis.split.corrExplainChecked':
    'Мы проверили {count, plural, one {# день} few {# дня} many {# дней} other {# дня}} с данными по обоим показателям: {x} и {y}.',
  'analysis.split.corrExplainPearson': 'Корреляция Пирсона: {r} (сила: {strength}).',
  'analysis.split.corrExplainGroups':
    'В каждой группе было недостаточно дней, чтобы сравнить средние ({groupA}: {countA, plural, one {# день} few {# дня} many {# дней} other {# дня}}; {groupB}: {countB, plural, one {# день} few {# дня} many {# дней} other {# дня}}; нужно минимум {min} в каждой группе).',

  // Evidence table keys ---------------------------------------------------------------
  'analysis.extra.predictor': 'Предиктор',
  'analysis.extra.strength': 'Сила',
  'analysis.extra.meanDiff': 'Разница средних (A минус B)',
  'analysis.extra.cohenD': 'Величина эффекта (d Коэна)',
  'analysis.extra.weeksChecked': 'Проверено недель',
  'analysis.extra.weeklyTarget': 'Недельная цель',
  'analysis.extra.target': 'Цель',
  'analysis.extra.frequency': 'Периодичность',
  'analysis.extra.periodMean': 'Среднее за период',
  'analysis.extra.overallMean': 'Общее среднее',
  'analysis.extra.stddev': 'Стандартное отклонение',
  'analysis.extra.slopePerDay': 'Наклон за день',
  'analysis.extra.daysInWindow': 'Дней в окне',
  'analysis.extra.movingWindow': 'Окно скользящего среднего',
  'analysis.extra.relativeChange': 'Относительное изменение',
  'analysis.extra.longestStreak': 'Самая длинная серия за период',
  'analysis.extra.shareOfEmotionDays': 'Доля дней с эмоцией',
  'analysis.frequency.daily': 'ежедневно',
  'analysis.frequency.weekly': 'еженедельно',
  'analysis.groupB.otherDays': 'Остальные дни',

  // Sleep detectors -------------------------------------------------------------------
  'analysis.sleep.groupA': 'Дни, когда сон длился меньше {hours} ч',
  'analysis.sleep.groupB': 'Дни, когда сон длился {hours} ч или больше',
  'analysis.sleep.condition': 'в дни, когда вы спали меньше {hours} ч',
  'analysis.sleep.conditionPast': 'спали меньше {hours} ч',
  'analysis.sleepMood.label': 'связь между сном и настроением',
  'analysis.sleepMood.title':
    '{direction, select, lower {Короткий сон и более низкое настроение} other {Короткий сон и более высокое настроение}}',
  'analysis.sleepMood.corrTitle': 'Возможная связь между продолжительностью сна и настроением',
  'analysis.sleepEnergy.label': 'связь между сном и уровнем энергии',
  'analysis.sleepEnergy.title':
    '{direction, select, lower {Короткий сон и более низкий уровень энергии} other {Короткий сон и более высокий уровень энергии}}',
  'analysis.sleepEnergy.corrTitle': 'Возможная связь между продолжительностью сна и уровнем энергии',

  // Exercise detectors ----------------------------------------------------------------
  'analysis.exercise.groupA': 'Дни с физической активностью',
  'analysis.exercise.groupB': 'Дни без физической активности',
  'analysis.exercise.condition': 'в дни, когда вы занимались физической активностью',
  'analysis.exercise.conditionPast': 'занимались физической активностью',
  'analysis.exerciseMood.label': 'связь между физической активностью и настроением',
  'analysis.exerciseMood.title':
    '{direction, select, higher {Физическая активность и более высокое настроение} other {Физическая активность и более низкое настроение}}',
  'analysis.exerciseMood.corrTitle': 'Возможная связь между временем физической активности и настроением',
  'analysis.exerciseEnergy.label': 'связь между физической активностью и уровнем энергии',
  'analysis.exerciseEnergy.title':
    '{direction, select, higher {Физическая активность и более высокий уровень энергии} other {Физическая активность и более низкий уровень энергии}}',
  'analysis.exerciseEnergy.corrTitle': 'Возможная связь между временем физической активности и уровнем энергии',

  // Habit - mood / energy / stress ------------------------------------------------------
  'analysis.habit.detectorLabel': 'связь между привычками и настроением',
  'analysis.habit.noHabits': 'Активных привычек нет, поэтому связь между привычками и настроением не проверялась.',
  'analysis.habit.noLogs':
    'У привычки «{habit}» пока нет отметок за этот период, поэтому её связь с настроением не проверялась.',
  'analysis.habit.noFullWeeks':
    'У привычки «{habit}» пока нет полных недель с отметками, поэтому её связь с настроением не проверялась.',
  'analysis.habit.label': 'связь между привычкой «{habit}» и показателем «{metric}»',
  'analysis.habit.groupA': 'Дни, когда привычка «{habit}» была выполнена',
  'analysis.habit.groupB': 'Дни, когда привычка «{habit}» не была выполнена',
  'analysis.habit.condition': 'в дни, когда вы выполняли привычку «{habit}»',
  'analysis.habit.conditionPast': 'выполняли привычку «{habit}»',
  'analysis.habit.title':
    'Привычка «{habit}» и {gender, select, m {{direction, select, higher {более высокий {metric}} other {более низкий {metric}}}} f {{direction, select, higher {более высокая {metric}} other {более низкая {metric}}}} n {{direction, select, higher {более высокое {metric}} other {более низкое {metric}}}} other {{direction, select, higher {более высокий показатель «{metric}»} other {более низкий показатель «{metric}»}}}}',
  'analysis.habit.corrTitle': 'Возможная связь между привычкой «{habit}» и показателем «{metric}»',
  'analysis.habit.weeklyCondition': 'в недели, когда вы достигали цели привычки «{habit}»',
  'analysis.habit.weeklyTarget': '{target} {unit} в неделю',
  'analysis.habit.targetValue': '{target} {unit}',
  'analysis.habit.weeklyExplainChecked':
    'Мы проверили {weeks, plural, one {# полную неделю} few {# полные недели} many {# полных недель} other {# полные недели}} ({days, plural, one {# день} few {# дня} many {# дней} other {# дня}} с данными о показателе «{metric}»).',
  'analysis.habit.weeklyExplainMet': 'Недель, когда вы достигли цели привычки ({target}): {count}.',
  'analysis.habit.weeklyExplainMeans':
    '{gender, select, m {Ваш средний {metricDefined} в дни этих недель составил {meanA}} f {Ваша средняя {metricDefined} в дни этих недель составила {meanA}} n {Ваше среднее {metricDefined} в дни этих недель составило {meanA}} other {Среднее в дни этих недель - {meanA}}}, а в дни {count, plural, one {# недели} few {# недель} many {# недель} other {# недели}} ниже цели - {meanB}.',
  'analysis.habit.groupAWeeks':
    'Дни недель с достигнутой целью ({count, plural, one {# неделя} few {# недели} many {# недель} other {# недели}})',
  'analysis.habit.groupBWeeks':
    'Дни недель ниже цели ({count, plural, one {# неделя} few {# недели} many {# недель} other {# недели}})',

  // Weekday differences -----------------------------------------------------------------
  'analysis.weekday.label': 'различия между днями недели',
  'analysis.weekday.text':
    'Похоже, в ваших данных {onWeekday} {gender, select, m {ваш {metricDefined} был {direction, select, higher {в среднем выше} other {в среднем ниже}}} f {ваша {metricDefined} была {direction, select, higher {в среднем выше} other {в среднем ниже}}} n {ваше {metricDefined} было {direction, select, higher {в среднем выше} other {в среднем ниже}}} other {показатель «{metricDefined}» был {direction, select, higher {в среднем выше} other {в среднем ниже}}}}, чем в остальные дни недели ({meanA} против {meanB}).',
  'analysis.weekday.explainChecked':
    'Мы проверили {count, plural, one {# день} few {# дня} many {# дней} other {# дня}} с данными о показателе «{metric}», из них {countA} - {weekdays}.',
  'analysis.weekday.explainMeans':
    '{gender, select, m {Ваш средний {metricDefined} {onWeekday} составил {meanA}} f {Ваша средняя {metricDefined} {onWeekday} составила {meanA}} n {Ваше среднее {metricDefined} {onWeekday} составило {meanA}} other {Среднее {onWeekday} - {meanA}}}, а в остальные дни - {meanB}.',
  'analysis.weekday.title':
    '{gender, select, m {{direction, select, higher {Более высокий {metric}} other {Более низкий {metric}}}} f {{direction, select, higher {Более высокая {metric}} other {Более низкая {metric}}}} n {{direction, select, higher {Более высокое {metric}} other {Более низкое {metric}}}} other {{direction, select, higher {Более высокий показатель «{metric}»} other {Более низкий показатель «{metric}»}}}}: {weekdays}',
  'analysis.weekday.groupB': 'Остальные дни недели',
  'analysis.weekday.tableValue': '{mean} ({count, plural, one {# день} few {# дня} many {# дней} other {# дня}})',
  'analysis.weekday.nothing':
    'Мы проверили различия между днями недели за {count, plural, one {# день} few {# дня} many {# дней} other {# дня}} и не нашли заметных различий.',

  // Time of day -------------------------------------------------------------------------
  'analysis.timeOfDay.label': 'связь между временем записи и настроением',
  'analysis.timeOfDay.morning.label': 'Утро',
  'analysis.timeOfDay.morning.phrase': 'утром',
  'analysis.timeOfDay.late_morning.label': 'Позднее утро',
  'analysis.timeOfDay.late_morning.phrase': 'поздним утром',
  'analysis.timeOfDay.afternoon.label': 'День',
  'analysis.timeOfDay.afternoon.phrase': 'днём',
  'analysis.timeOfDay.evening.label': 'Вечер',
  'analysis.timeOfDay.evening.phrase': 'вечером',
  'analysis.timeOfDay.night.label': 'Ночь',
  'analysis.timeOfDay.night.phrase': 'ночью',
  'analysis.timeOfDay.tableKey': '{label} ({hours})',
  'analysis.timeOfDay.tableValue':
    'в среднем {mean}, {count, plural, one {# отметка} few {# отметки} many {# отметок} other {# отметки}}',
  'analysis.timeOfDay.tableRow': '{key}: {value}',
  'analysis.timeOfDay.nothing':
    'Мы проверили {label} по {count, plural, one {# отметке} few {# отметкам} many {# отметкам} other {# отметки}} и не нашли временного окна, которое заметно выделялось бы выше среднего.',
  'analysis.timeOfDay.text':
    'Похоже, в ваших данных настроение, которое вы отмечали {phrase} ({hours}), было самым высоким: в среднем {mean} при общем среднем {overall}.',
  'analysis.timeOfDay.explainChecked':
    'Мы проверили {count, plural, one {# отметку настроения} few {# отметки настроения} many {# отметок настроения} other {# отметки настроения}} за {days, plural, one {# день} few {# дня} many {# дней} other {# дня}} по времени написания записи.',
  'analysis.timeOfDay.explainTable': '{table}. Общее среднее: {overall}.',
  'analysis.timeOfDay.explainDiff':
    'Разница между самым высоким временным окном и общим средним: {diff} балла. Сила закономерности: {strength}.',
  'analysis.timeOfDay.title': 'Более высокое настроение {phrase}',
  'analysis.timeOfDay.groupA': 'Отметки {phrase} ({hours})',
  'analysis.timeOfDay.groupB': 'Остальные отметки',

  // Trends ------------------------------------------------------------------------------
  'analysis.trends.label': 'тенденции настроения, стресса и сна',
  'analysis.trends.text':
    'Похоже, в ваших данных {gender, select, m {ваш {metricDefined}} f {ваша {metricDefined}} n {ваше {metricDefined}} other {показатель «{metricDefined}»}} {direction, select, up {имеет тенденцию к росту} other {имеет тенденцию к снижению}} {horizon, select, period {за период} monthly {за последний месяц} other {за последние две недели}}: линия тренда скользящего среднего {direction, select, up {выросла} other {снизилась}} с {fromValue} до {toValue}.',
  'analysis.trends.explainChecked':
    'Мы проверили {count, plural, one {# день} few {# дня} many {# дней} other {# дня}} с данными о показателе «{metric}» из {len} {horizon, select, period {дней периода} other {последних дней}} ({from}–{to}).',
  'analysis.trends.explainFit':
    'Мы рассчитали {window}-дневное скользящее среднее и линию тренда по нему (линейная регрессия): {direction, select, up {наклон вверх} other {наклон вниз}} на {unit, select, hours {{slope} ч} other {{slope} балла}} в день, то есть изменение примерно на {unit, select, hours {{change} ч} other {{change} балла}} за окно (с {fromValue} до {toValue} по линии тренда). Сила тенденции: {strength}.',
  'analysis.trends.title':
    '{direction, select, up {Тенденция к росту} other {Тенденция к снижению}}: {metric, select, mood {ваше настроение} energy {ваш уровень энергии} stress {ваш уровень стресса} sleepHours {продолжительность вашего сна} sleepQuality {качество вашего сна} exerciseMinutes {время вашей физической активности} other {число записей}} {horizon, select, period {за период} monthly {за последний месяц} other {за последние две недели}}',
  'analysis.trends.groupA': 'Начало окна (линия тренда)',
  'analysis.trends.groupB': 'Конец окна (линия тренда)',
  'analysis.trends.slopeValue': '{unit, select, hours {{slope} ч} other {{slope} балла}}',
  'analysis.trends.nothingSince': 'Мы проверили тенденции настроения, стресса и сна с {from} и не нашли заметных тенденций.',
  'analysis.trends.nothingAll': 'Мы проверили тенденции настроения, стресса и сна за весь период и не нашли заметных тенденций.',

  // Month comparison --------------------------------------------------------------------
  'analysis.periodCompare.label': 'сравнение текущего месяца с предыдущим',
  'analysis.periodCompare.text':
    'Похоже, в ваших данных {gender, select, m {ваш {metricDefined} за {cur} был {direction, select, higher {в среднем выше} other {в среднем ниже}}} f {ваша {metricDefined} за {cur} была {direction, select, higher {в среднем выше} other {в среднем ниже}}} n {ваше {metricDefined} за {cur} было {direction, select, higher {в среднем выше} other {в среднем ниже}}} other {показатель «{metricDefined}» за {cur} был {direction, select, higher {в среднем выше} other {в среднем ниже}}}}, чем за {prev} ({meanA} против {meanB}).',
  'analysis.periodCompare.explain':
    'Мы сравнили дни с данными о показателе «{metric}» за {cur} ({countA, plural, one {# день} few {# дня} many {# дней} other {# дня}}, по сегодняшний день) с днями за {prev} ({countB, plural, one {# день} few {# дня} many {# дней} other {# дня}}). Среднее за {cur}: {meanA}; за {prev}: {meanB}. Разница: {unit, select, hours {{diff} ч} other {{diff} балла}}. Выраженность различия: {strength}.',
  'analysis.periodCompare.title':
    'За {cur}: {gender, select, m {{direction, select, higher {более высокий {metric}} other {более низкий {metric}}}} f {{direction, select, higher {более высокая {metric}} other {более низкая {metric}}}} n {{direction, select, higher {более высокое {metric}} other {более низкое {metric}}}} other {{direction, select, higher {более высокий показатель «{metric}»} other {более низкий показатель «{metric}»}}}}, чем за {prev}',
  'analysis.periodCompare.entriesText':
    'Похоже, что за {window, plural, one {первый # день} few {первые # дня} many {первые # дней} other {первые # дня}} месяца вы {direction, select, more {писали больше} other {писали меньше}}, чем месяцем ранее: {cur} - {countA, plural, one {# запись} few {# записи} many {# записей} other {# записи}}, {prev} - {countB, plural, one {# запись} few {# записи} many {# записей} other {# записи}}.',
  'analysis.periodCompare.entriesExplain':
    'Мы подсчитали записи за {window, plural, one {первый # день} few {первые # дня} many {первые # дней} other {первые # дня}} каждого месяца, чтобы сравнить равные промежутки: {cur} - {countA, plural, one {# запись} few {# записи} many {# записей} other {# записи}}, {prev} - {countB, plural, one {# запись} few {# записи} many {# записей} other {# записи}}. Разница: {diff, plural, one {# запись} few {# записи} many {# записей} other {# записи}} ({percent}). Выраженность различия: {strength}.',
  'analysis.periodCompare.entriesTitle': '{direction, select, more {Больше записей} other {Меньше записей}} за {cur}, чем за {prev}',
  'analysis.periodCompare.monthWindow':
    '{month} ({window, plural, one {первый # день} few {первые # дня} many {первые # дней} other {первые # дня}})',
  'analysis.periodCompare.insufficientWhat': 'разницу между месяцами: {cur} и {prev}',
  'analysis.periodCompare.nothing':
    'Мы сравнили {cur} и {prev} и не нашли заметной разницы в настроении, стрессе, сне или числе записей.',

  // Habit trend (improved / declined) -----------------------------------------------------
  'analysis.habitsTrend.label': 'привычки, выполнение которых улучшилось или ухудшилось',
  'analysis.habitsTrend.whether': 'улучшилось ли выполнение привычки «{habit}» или ухудшилось',
  'analysis.habitsTrend.textDaily':
    'Похоже, выполнение привычки «{habit}» {direction, select, improved {улучшилось} other {ухудшилось}}: за последние две недели вы выполнили её в {recent} из {window} дней, а за две недели до этого - в {previous} из {window}.',
  'analysis.habitsTrend.textWeekly':
    'Похоже, выполнение привычки «{habit}» {direction, select, improved {улучшилось} other {ухудшилось}}: за последние две недели вы отметили {recent} {unit}, а за две недели до этого - {previous} (цель: {target} {unit} в неделю).',
  'analysis.habitsTrend.explain':
    'Мы сравнили долю выполнения привычки за последние две недели ({recentFrom}–{recentTo}) с двумя неделями до этого ({previousFrom}–{previousTo}): {recentRate} против {previousRate}. Разница: {diff} п. п. Выраженность изменения: {strength}.',
  'analysis.habitsTrend.title':
    'Выполнение привычки «{habit}» {direction, select, improved {улучшилось} other {ухудшилось}} за последние две недели',
  'analysis.habitsTrend.metric': 'Доля выполнения - {habit}',
  'analysis.habitsTrend.groupA': 'Последние две недели',
  'analysis.habitsTrend.groupB': 'Предыдущие две недели',

  // Best / hardest days ------------------------------------------------------------------
  'analysis.bestWorst.label': 'лучшие и самые трудные дни',
  'analysis.bestWorst.describedDay': '{day} («{title}»)',
  'analysis.bestWorst.noTitle': 'Без названия',
  'analysis.bestWorst.extraValue': '{titles} - оценка {score}',
  'analysis.bestWorst.text':
    '{kind, select, best {Лучшие дни} other {Самые трудные дни}} периода по совокупной оценке настроения, энергии и стресса: {days}.',
  'analysis.bestWorst.explainScore':
    'Для каждого из {count, plural, one {# дня} few {# дней} many {# дней} other {# дня}} мы рассчитали совокупную оценку: среднее из настроения, уровня энергии и (11 минус уровень стресса) по значениям, указанным в этот день.',
  'analysis.bestWorst.explainMeans':
    'Средняя оценка за период: {overall}. {kind, select, best {{count, plural, one {Лучший день получил} =3 {Три лучших дня получили} other {Лучшие дни получили}}} other {{count, plural, one {Самый трудный день получил} =3 {Три самых трудных дня получили} other {Самые трудные дни получили}}}} в среднем {mean}.',
  'analysis.bestWorst.explainDiff': 'Отличие от среднего: {diff} балла. Выраженность различия: {strength}.',
  'analysis.bestWorst.title': '{kind, select, best {Лучшие дни периода} other {Самые трудные дни периода}}',
  'analysis.bestWorst.metric': 'Совокупная оценка (настроение + энергия + обратный стресс)',
  'analysis.bestWorst.groupA': '{kind, select, best {Лучшие дни} other {Самые трудные дни}}',
  'analysis.bestWorst.nothing':
    'Мы проверили {label} за {count, plural, one {# день} few {# дня} many {# дней} other {# дня}}; оценки были похожи, и ни один день особенно не выделялся.',

  // Streaks -------------------------------------------------------------------------------
  'analysis.streaks.label': 'серии записей и привычек',
  'analysis.streaks.entriesTitle': 'Серия записей: {count, plural, one {# день} few {# дня} many {# дней} other {# дня}} подряд',
  'analysis.streaks.entriesText':
    'Отлично! Вы писали в дневник {count, plural, one {# день} few {# дня} many {# дней} other {# дня}} подряд ({from}–{to}).',
  'analysis.streaks.entriesExplain':
    'Мы подсчитали дни подряд, в которые была хотя бы одна запись, до сегодняшнего или вчерашнего дня. Текущая серия: {count, plural, one {# день} few {# дня} many {# дней} other {# дня}}, с {from} по {to}. Самая длинная серия за период: {best, plural, one {# день} few {# дня} many {# дней} other {# дня}}.',
  'analysis.streaks.entriesMetric': 'Дни с записями',
  'analysis.streaks.currentDays': 'Дней в текущей серии',
  'analysis.streaks.daysWithEntry': 'Дней с записью за период',
  'analysis.streaks.habitTitle':
    'Серия {count, plural, one {# день} few {# дня} many {# дней} other {# дня}}: привычка «{habit}»',
  'analysis.streaks.habitText':
    'Вы выполняли привычку «{habit}» {count, plural, one {# день} few {# дня} many {# дней} other {# дня}} подряд ({from}–{to}).',
  'analysis.streaks.habitExplain':
    'Мы подсчитали дни подряд, в которые привычка «{habit}» была отмечена как выполненная, до сегодняшнего или вчерашнего дня. Текущая серия: {count, plural, one {# день} few {# дня} many {# дней} other {# дня}}. Самая длинная серия за период: {best, plural, one {# день} few {# дня} many {# дней} other {# дня}}.',
  'analysis.streaks.habitMetric': 'Выполнение привычки «{habit}»',
  'analysis.streaks.daysCompleted': 'Дней с выполненной привычкой за период',
  'analysis.streaks.weeklyTitle':
    'Серия {count, plural, one {# неделя} few {# недели} many {# недель} other {# недели}}: привычка «{habit}»',
  'analysis.streaks.weeklyText':
    'Вы достигали цели привычки «{habit}» {count, plural, one {# неделю} few {# недели} many {# недель} other {# недели}} подряд ({from}–{to}).',
  'analysis.streaks.weeklyExplain':
    'Мы суммировали количество, отмеченное для привычки «{habit}» за каждую неделю, и сравнили его с недельной целью ({target}). Текущая серия недель с достигнутой целью: {count, plural, one {# неделя} few {# недели} many {# недель} other {# недели}}.',
  'analysis.streaks.weeklyMetric': 'Недельная цель достигнута - {habit}',
  'analysis.streaks.currentWeeks': 'Недель в текущей серии',
  'analysis.streaks.weeksWithLogs': 'Недель с отметками за период',
  'analysis.streaks.none':
    'Активных серий не найдено (серии записей от {entryMin} дней или серии привычки от {habitMin} дней или недель).',

  // Anomalies -----------------------------------------------------------------------------
  'analysis.anomalies.label': 'необычные дни по настроению или стрессу',
  'analysis.anomalies.textOne':
    'Похоже, в этот день ({day}) {gender, select, m {ваш {metricDefined} был {side, select, high {необычно высоким} other {необычно низким}}} f {ваша {metricDefined} была {side, select, high {необычно высокой} other {необычно низкой}}} n {ваше {metricDefined} было {side, select, high {необычно высоким} other {необычно низким}}} other {показатель «{metricDefined}» был {side, select, high {необычно высоким} other {необычно низким}}}} по сравнению с остальным периодом ({value} при среднем {mean}).',
  'analysis.anomalies.textMany':
    'Похоже, в {count, plural, one {# день} few {# дня} many {# дней} other {# дня}} {gender, select, m {ваш {metricDefined} был {side, select, high {необычно высоким} other {необычно низким}}} f {ваша {metricDefined} была {side, select, high {необычно высокой} other {необычно низкой}}} n {ваше {metricDefined} было {side, select, high {необычно высоким} other {необычно низким}}} other {показатель «{metricDefined}» был {side, select, high {необычно высоким} other {необычно низким}}}} по сравнению с остальным периодом: {days}; среднее за период: {mean}.',
  'analysis.anomalies.textManyMore':
    'Похоже, в {count, plural, one {# день} few {# дня} many {# дней} other {# дня}} {gender, select, m {ваш {metricDefined} был {side, select, high {необычно высоким} other {необычно низким}}} f {ваша {metricDefined} была {side, select, high {необычно высокой} other {необычно низкой}}} n {ваше {metricDefined} было {side, select, high {необычно высоким} other {необычно низким}}} other {показатель «{metricDefined}» был {side, select, high {необычно высоким} other {необычно низким}}}} по сравнению с остальным периодом: {days} и другие; среднее за период: {mean}.',
  'analysis.anomalies.dayItem': '{day} ({value})',
  'analysis.anomalies.detail':
    '{date}: {value} ({z} стандартного отклонения {side, select, above {выше среднего} other {ниже среднего}})',
  'analysis.anomalies.explain':
    'Мы проверили {count, plural, one {# день} few {# дня} many {# дней} other {# дня}} с данными о показателе «{metric}». Среднее: {mean}, стандартное отклонение: {sd}. День считается необычным, если его значение отличается от среднего на {z} стандартного отклонения или больше. {details}. Выраженность отклонения: {strength}.',
  'analysis.anomalies.title':
    '{gender, select, m {{side, select, high {Необычно высокий {metric}} other {Необычно низкий {metric}}}} f {{side, select, high {Необычно высокая {metric}} other {Необычно низкая {metric}}}} n {{side, select, high {Необычно высокое {metric}} other {Необычно низкое {metric}}}} other {{side, select, high {Необычно высокий показатель «{metric}»} other {Необычно низкий показатель «{metric}»}}}} ({count, plural, one {# день} few {# дня} many {# дней} other {# дня}})',
  'analysis.anomalies.groupA': 'Необычные дни',
  'analysis.anomalies.zValue': '{value} (z {z})',
  'analysis.anomalies.nothing':
    'Мы искали необычные дни среди {count, plural, one {# дня} few {# дней} many {# дней} other {# дня}} и не нашли ни одного дня, который отклонялся бы от среднего на {z} стандартного отклонения или больше.',

  // Emotion patterns ----------------------------------------------------------------------
  'analysis.emotion.label': 'закономерности эмоций по дням, людям и местам',
  'analysis.emotion.metric': 'Эмоция «{emotion}»',
  'analysis.emotion.groupA': 'Дни с эмоцией «{emotion}»',
  'analysis.emotion.weekdayTitle': 'Эмоция «{emotion}» чаще всего появляется {onWeekday}',
  'analysis.emotion.weekdayText':
    'Похоже, в ваших данных эмоция «{emotion}» чаще всего появлялась {onWeekday} ({top} из {total} раз).',
  'analysis.emotion.weekdayExplain':
    'Мы проверили {count, plural, one {# день} few {# дня} many {# дней} other {# дня}}. Дней с эмоцией «{emotion}»: {total}; из них {top} пришлись на {weekdays} ({share}), тогда как {weekdays} составляют {baseline} всех проверенных дней. Сила закономерности: {strength}.',
  'analysis.emotion.groupBWeekday': 'Из них: {weekdays}',
  'analysis.emotion.weekdayShareKey': 'Доля среди всех дней: {weekdays}',
  'analysis.emotion.personTitle': 'Эмоция «{emotion}» и {name}',
  'analysis.emotion.placeTitle': 'Эмоция «{emotion}» и «{place}»',
  'analysis.emotion.personText':
    'Похоже, в ваших данных эмоция «{emotion}» часто появлялась в дни, когда вы отмечали встречу: {name} ({with} из {total} раз).',
  'analysis.emotion.placeText':
    'Похоже, в ваших данных эмоция «{emotion}» часто появлялась в дни, когда местом было «{place}» ({with} из {total} раз).',
  'analysis.emotion.personExplain':
    'Мы проверили {count, plural, one {# день} few {# дня} many {# дней} other {# дня}}. Дней с эмоцией «{emotion}»: {total}; в {with} из них ({share}) в записи также упоминается {name}. Всего {name} упоминается в {baselineCount} из {count, plural, one {# дня} few {# дней} many {# дней} other {# дня}} ({baseline}). Сила закономерности: {strength}.',
  'analysis.emotion.placeExplain':
    'Мы проверили {count, plural, one {# день} few {# дня} many {# дней} other {# дня}}. Дней с эмоцией «{emotion}»: {total}; в {with} из них ({share}) в записи также указано место «{place}». Всего место «{place}» встречается в {baselineCount} из {count, plural, one {# дня} few {# дней} many {# дней} other {# дня}} ({baseline}). Сила закономерности: {strength}.',
  'analysis.emotion.groupBPerson': 'Из них: {name}',
  'analysis.emotion.groupBPlace': 'Из них: «{place}»',
  'analysis.emotion.personShareKey': 'Доля среди всех дней: {name}',
  'analysis.emotion.placeShareKey': 'Доля среди всех дней: место «{place}»',
  'analysis.emotion.nothing':
    'Среди эмоций, которые повторялись не менее {min} раз (проверено: {count, plural, one {# эмоция} few {# эмоции} many {# эмоций} other {# эмоции}}), не найдено заметной привязки к определённым дням, людям или местам.',
};
export default messages;
