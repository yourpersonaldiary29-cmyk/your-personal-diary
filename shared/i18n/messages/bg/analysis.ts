/**
 * bg - analysis messages (server-side insight templates, notes and labels).
 * Keys are prefixed 'analysis.'; see shared/i18n/index.ts for the template syntax and
 * shared/i18n/messages/en/analysis.ts for the conventions.
 *
 * Bulgarian notes:
 *  - The app speaks in the first-person aorist ("Проверих", "Сравних"), which is the same for
 *    every speaker, and addresses the user with the plural "вие" forms ("сте спали").
 *  - `gender` is m / f / n of the metric noun ('analysis.metric.<metric>.gender'); the
 *    definite metric phrase ('.defined', "настроението", "нивото на енергия") is the subject,
 *    so only the adjective agrees ("беше по-високо / по-висок / по-висока").
 *  - Detector labels ({what}, {label}) carry the definite article because they follow
 *    "да се провери" / "Проверих" ("връзката между съня и настроението").
 *  - Hedged, never causal: "Изглежда, че...", "може да има връзка"; no "причинява", "води до", "заради".
 */
const messages: Record<string, string> = {
  // Engine / provider -----------------------------------------------------------------
  'analysis.engine.providerFailed': 'Анализът на закономерностите не завърши (вътрешна грешка). Моля, опитайте по-късно.',
  'analysis.engine.detectorFailed': 'Проверката „{label}“ не завърши (вътрешна грешка); останалите наблюдения са наред.',

  // Strength --------------------------------------------------------------------------
  'analysis.strength.weak': 'слаба',
  'analysis.strength.moderate': 'умерена',
  'analysis.strength.strong': 'силна',

  // Metrics: label (short, standalone), defined (subject inside a sentence), gender -----
  'analysis.metric.mood.label': 'настроение',
  'analysis.metric.mood.defined': 'настроението',
  'analysis.metric.mood.gender': 'n',
  'analysis.metric.energy.label': 'ниво на енергия',
  'analysis.metric.energy.defined': 'нивото на енергия',
  'analysis.metric.energy.gender': 'n',
  'analysis.metric.stress.label': 'ниво на стрес',
  'analysis.metric.stress.defined': 'нивото на стрес',
  'analysis.metric.stress.gender': 'n',
  'analysis.metric.sleepHours.label': 'продължителност на съня',
  'analysis.metric.sleepHours.defined': 'продължителността на съня',
  'analysis.metric.sleepHours.gender': 'f',
  'analysis.metric.sleepQuality.label': 'качество на съня',
  'analysis.metric.sleepQuality.defined': 'качеството на съня',
  'analysis.metric.sleepQuality.gender': 'n',
  'analysis.metric.exerciseMinutes.label': 'време за физическа активност',
  'analysis.metric.exerciseMinutes.defined': 'времето за физическа активност',
  'analysis.metric.exerciseMinutes.gender': 'n',
  'analysis.metric.entries.label': 'брой записи',
  'analysis.metric.entries.defined': 'броят на записите',
  'analysis.metric.entries.gender': 'm',

  // Counts and dates ------------------------------------------------------------------
  'analysis.count.days': '{count, plural, one {# ден} other {# дни}}',
  'analysis.count.weeks': '{count, plural, one {# седмица} other {# седмици}}',
  'analysis.date.dayWithDate': '{weekday}, {date}',

  // Weekdays (index 0 = Sunday) --------------------------------------------------------
  'analysis.weekday.plural.0': 'недели',
  'analysis.weekday.plural.1': 'понеделници',
  'analysis.weekday.plural.2': 'вторници',
  'analysis.weekday.plural.3': 'среди',
  'analysis.weekday.plural.4': 'четвъртъци',
  'analysis.weekday.plural.5': 'петъци',
  'analysis.weekday.plural.6': 'съботи',
  'analysis.weekday.on.0': 'в неделите',
  'analysis.weekday.on.1': 'в понеделниците',
  'analysis.weekday.on.2': 'във вторниците',
  'analysis.weekday.on.3': 'в срядите',
  'analysis.weekday.on.4': 'в четвъртъците',
  'analysis.weekday.on.5': 'в петъците',
  'analysis.weekday.on.6': 'в съботите',

  // Notes shared by the detectors -------------------------------------------------------
  'analysis.note.insufficient':
    'Няма достатъчно данни, за да се провери {what} (нужни са поне: {required}; в момента: {have}).',
  'analysis.note.insufficientWhether':
    'Няма достатъчно данни, за да се провери {what} (нужни са поне: {required}; в момента: {have}).',
  'analysis.note.nothingNotable':
    'Проверих {what} за {count, plural, one {# ден} other {# дни}} и не открих забележима разлика.',

  // Requirement / availability phrases used inside the notes above ----------------------
  'analysis.req.daysBothValues': '{count, plural, one {# ден с двете стойности} other {# дни с двете стойности}}',
  'analysis.req.daysPerGroup': '{count, plural, one {# ден във всяка група} other {# дни във всяка група}}',
  'analysis.req.daysWithReport': '{count, plural, one {# ден с данни} other {# дни с данни}}',
  'analysis.req.daysWithRatings': '{count, plural, one {# ден с оценки} other {# дни с оценки}}',
  'analysis.req.daysPerMonth': '{count, plural, one {# ден с данни във всеки месец} other {# дни с данни във всеки месец}}',
  'analysis.req.recentDays':
    '{count, plural, one {# ден с данни през последните две седмици} other {# дни с данни през последните две седмици}}',
  'analysis.req.fullWeeks': '{count, plural, one {# пълна седмица с данни} other {# пълни седмици с данни}}',
  'analysis.req.weeksOfLogs': '{count, plural, one {# седмица с отбелязвания} other {# седмици с отбелязвания}}',
  'analysis.req.weekPerGroup':
    'една седмица във всяка група и {count, plural, one {# ден} other {# дни}} с данни във всяка група',
  'analysis.req.moodReports':
    '{count, plural, one {# отбелязване на настроението} other {# отбелязвания на настроението}}',
  'analysis.req.reportsInWindow':
    '{count, plural, one {# отбелязване в един времеви интервал} other {# отбелязвания в един времеви интервал}}',
  'analysis.req.emotionRepeated': 'една емоция, отбелязана в {count, plural, one {# ден} other {# дни}}',
  'analysis.have.twoGroups':
    '{groupA}: {countA, plural, one {# ден} other {# дни}}; {groupB}: {countB, plural, one {# ден} other {# дни}}',
  'analysis.have.weeksTwoGroups':
    'седмици с постигната цел: {metWeeks, plural, one {# седмица} other {# седмици}} ({metDays, plural, one {# ден} other {# дни}}); седмици под целта: {belowWeeks, plural, one {# седмица} other {# седмици}} ({belowDays, plural, one {# ден} other {# дни}})',
  'analysis.have.twoMonths':
    '{countA, plural, one {# ден} other {# дни}} през {cur} и {countB, plural, one {# ден} other {# дни}} през {prev}',
  'analysis.have.noData': 'няма данни',
  'analysis.have.noSuchEmotion': 'все още няма',
  'analysis.have.fewerInEveryWindow': 'по-малко във всеки интервал',

  // Sentences shared by the group-comparison detectors ----------------------------------
  // {condition} ends with a subordinate clause ("в дните, в които сте спали..."), hence the comma after it.
  'analysis.relation.text':
    'Изглежда, че в данните ви {condition}, {metricDefined} {gender, select, m {беше {direction, select, higher {средно по-висок} other {средно по-нисък}}} f {беше {direction, select, higher {средно по-висока} other {средно по-ниска}}} n {беше {direction, select, higher {средно по-високо} other {средно по-ниско}}} other {беше {direction, select, higher {средно по-високо} other {средно по-ниско}}}} ({meanA} спрямо {meanB}).',
  'analysis.correlation.text':
    'Изглежда, че в данните ви може да има връзка между {x} и {y}: {xGender, select, m {когато {x} беше по-висок} f {когато {x} беше по-висока} n {когато {x} беше по-високо} other {когато {x} беше по-високо}}, {yGender, select, m {{y} {direction, select, higher {обикновено също беше по-висок} other {обикновено беше по-нисък}}} f {{y} {direction, select, higher {обикновено също беше по-висока} other {обикновено беше по-ниска}}} n {{y} {direction, select, higher {обикновено също беше по-високо} other {обикновено беше по-ниско}}} other {{y} {direction, select, higher {обикновено също беше по-високо} other {обикновено беше по-ниско}}}} (корелация {r}).',
  'analysis.explain.checkedDays': 'Проверих {count, plural, one {# ден} other {# дни}}.',
  'analysis.explain.onDaysCondition': 'В {count, plural, one {# ден} other {# дни}} сте {conditionPast}.',
  'analysis.explain.groupMeans':
    '{gender, select, other {В тези дни {metricDefined} беше средно {meanA}}}, а в останалите дни - {meanB}.',
  'analysis.explain.correlation': 'Корелация: {r}.',
  'analysis.explain.correlationBetween': 'Корелация ({predictor} и {outcome}): {r}.',
  'analysis.explain.diffAndStrength': 'Разлика между средните стойности: {diff} точки. Сила на закономерността: {strength}.',
  'analysis.explain.diffStrength': 'Разлика: {diff} точки. Сила на закономерността: {strength}.',
  'analysis.split.corrExplainChecked':
    'Проверих {count, plural, one {# ден} other {# дни}}, в които са отбелязани и {x}, и {y}.',
  'analysis.split.corrExplainPearson': 'Корелация на Пирсън: {r} (сила: {strength}).',
  'analysis.split.corrExplainGroups':
    'Нямаше достатъчно дни във всяка група, за да се сравнят средните стойности ({groupA}: {countA, plural, one {# ден} other {# дни}}; {groupB}: {countB, plural, one {# ден} other {# дни}}; нужни са поне {min} във всяка група).',

  // Evidence table keys ---------------------------------------------------------------
  'analysis.extra.predictor': 'Предиктор',
  'analysis.extra.strength': 'Сила',
  'analysis.extra.meanDiff': 'Разлика в средните (A минус B)',
  'analysis.extra.cohenD': 'Размер на ефекта (d на Коен)',
  'analysis.extra.weeksChecked': 'Проверени седмици',
  'analysis.extra.weeklyTarget': 'Седмична цел',
  'analysis.extra.target': 'Цел',
  'analysis.extra.frequency': 'Честота',
  'analysis.extra.periodMean': 'Средно за периода',
  'analysis.extra.overallMean': 'Общо средно',
  'analysis.extra.stddev': 'Стандартно отклонение',
  'analysis.extra.slopePerDay': 'Наклон за ден',
  'analysis.extra.daysInWindow': 'Дни в интервала',
  'analysis.extra.movingWindow': 'Интервал на плъзгащата средна',
  'analysis.extra.relativeChange': 'Относителна промяна',
  'analysis.extra.longestStreak': 'Най-дълга серия в периода',
  'analysis.extra.shareOfEmotionDays': 'Дял на дните с емоцията',
  'analysis.frequency.daily': 'ежедневно',
  'analysis.frequency.weekly': 'ежеседмично',
  'analysis.groupB.otherDays': 'Останалите дни',

  // Sleep detectors -------------------------------------------------------------------
  'analysis.sleep.groupA': 'Дни с по-малко от {hours} часа сън',
  'analysis.sleep.groupB': 'Дни с {hours} или повече часа сън',
  'analysis.sleep.condition': 'в дните, в които сте спали по-малко от {hours} часа',
  'analysis.sleep.conditionPast': 'спали по-малко от {hours} часа',
  'analysis.sleepMood.label': 'връзката между съня и настроението',
  'analysis.sleepMood.title':
    '{direction, select, lower {Кратък сън и по-ниско настроение} other {Кратък сън и по-високо настроение}}',
  'analysis.sleepMood.corrTitle': 'Възможна връзка между часовете сън и настроението',
  'analysis.sleepEnergy.label': 'връзката между съня и нивото на енергия',
  'analysis.sleepEnergy.title': '{direction, select, lower {Кратък сън и по-ниска енергия} other {Кратък сън и по-висока енергия}}',
  'analysis.sleepEnergy.corrTitle': 'Възможна връзка между часовете сън и нивото на енергия',

  // Exercise detectors ----------------------------------------------------------------
  'analysis.exercise.groupA': 'Дни с физическа активност',
  'analysis.exercise.groupB': 'Дни без физическа активност',
  'analysis.exercise.condition': 'в дните, в които сте имали физическа активност',
  'analysis.exercise.conditionPast': 'имали физическа активност',
  'analysis.exerciseMood.label': 'връзката между физическата активност и настроението',
  'analysis.exerciseMood.title':
    '{direction, select, higher {Физическа активност и по-високо настроение} other {Физическа активност и по-ниско настроение}}',
  'analysis.exerciseMood.corrTitle': 'Възможна връзка между минутите активност и настроението',
  'analysis.exerciseEnergy.label': 'връзката между физическата активност и нивото на енергия',
  'analysis.exerciseEnergy.title':
    '{direction, select, higher {Физическа активност и по-висока енергия} other {Физическа активност и по-ниска енергия}}',
  'analysis.exerciseEnergy.corrTitle': 'Възможна връзка между минутите активност и нивото на енергия',

  // Habit - mood / energy / stress ------------------------------------------------------
  'analysis.habit.detectorLabel': 'връзката между навиците и настроението',
  'analysis.habit.noHabits': 'Няма активни навици, затова не проверих за връзка между навиците и настроението.',
  'analysis.habit.noLogs':
    'Навикът „{habit}“ все още няма отбелязвания в този период, затова не проверих за връзка между него и настроението.',
  'analysis.habit.noFullWeeks':
    'Навикът „{habit}“ все още няма пълни седмици с отбелязвания, затова не проверих за връзка между него и настроението.',
  'analysis.habit.label': 'връзката между навика „{habit}“ и показателя „{metric}“',
  'analysis.habit.groupA': 'Дни, в които навикът „{habit}“ е изпълнен',
  'analysis.habit.groupB': 'Дни, в които навикът „{habit}“ не е изпълнен',
  'analysis.habit.condition': 'в дните, в които сте изпълнили навика „{habit}“',
  'analysis.habit.conditionPast': 'изпълнили навика „{habit}“',
  'analysis.habit.title':
    'Навикът „{habit}“ и {gender, select, m {{direction, select, higher {по-висок {metric}} other {по-нисък {metric}}}} f {{direction, select, higher {по-висока {metric}} other {по-ниска {metric}}}} n {{direction, select, higher {по-високо {metric}} other {по-ниско {metric}}}} other {{direction, select, higher {по-висок показател „{metric}“} other {по-нисък показател „{metric}“}}}}',
  'analysis.habit.corrTitle': 'Възможна връзка между навика „{habit}“ и показателя „{metric}“',
  'analysis.habit.weeklyCondition': 'в седмиците, в които сте постигнали целта на навика „{habit}“',
  'analysis.habit.weeklyTarget': '{target} {unit} седмично',
  'analysis.habit.targetValue': '{target} {unit}',
  'analysis.habit.weeklyExplainChecked':
    'Проверих {weeks, plural, one {# пълна седмица} other {# пълни седмици}} ({days, plural, one {# ден} other {# дни}} с данни за „{metric}“).',
  'analysis.habit.weeklyExplainMet':
    'В {count, plural, one {# седмица} other {# седмици}} сте постигнали целта на навика ({target}).',
  'analysis.habit.weeklyExplainMeans':
    '{gender, select, other {В дните от тези седмици {metricDefined} беше средно {meanA}}}, а в дните от {count, plural, one {# седмица} other {# седмици}} под целта - {meanB}.',
  'analysis.habit.groupAWeeks': 'Дни от седмици с постигната цел ({count, plural, one {# седмица} other {# седмици}})',
  'analysis.habit.groupBWeeks': 'Дни от седмици под целта ({count, plural, one {# седмица} other {# седмици}})',

  // Weekday differences -----------------------------------------------------------------
  'analysis.weekday.label': 'разликите между дните от седмицата',
  'analysis.weekday.text':
    'Изглежда, че в данните ви {onWeekday} {metricDefined} {gender, select, m {беше {direction, select, higher {средно по-висок} other {средно по-нисък}}} f {беше {direction, select, higher {средно по-висока} other {средно по-ниска}}} n {беше {direction, select, higher {средно по-високо} other {средно по-ниско}}} other {беше {direction, select, higher {средно по-високо} other {средно по-ниско}}}}, отколкото в останалите дни от седмицата ({meanA} спрямо {meanB}).',
  'analysis.weekday.explainChecked':
    'Проверих {count, plural, one {# ден} other {# дни}} с данни за „{metric}“, от които {countA} бяха {weekdays}.',
  'analysis.weekday.explainMeans':
    '{gender, select, other {Средно {onWeekday} {metricDefined} беше {meanA}}}, а в останалите дни - {meanB}.',
  'analysis.weekday.title':
    '{gender, select, m {{direction, select, higher {По-висок {metric}} other {По-нисък {metric}}}} f {{direction, select, higher {По-висока {metric}} other {По-ниска {metric}}}} n {{direction, select, higher {По-високо {metric}} other {По-ниско {metric}}}} other {{direction, select, higher {По-висок показател „{metric}“} other {По-нисък показател „{metric}“}}}}: {weekdays}',
  'analysis.weekday.groupB': 'Останалите дни от седмицата',
  'analysis.weekday.tableValue': '{mean} ({count, plural, one {# ден} other {# дни}})',
  'analysis.weekday.nothing':
    'Проверих за разлики между дните от седмицата за {count, plural, one {# ден} other {# дни}} и не открих забележима разлика.',

  // Time of day -------------------------------------------------------------------------
  'analysis.timeOfDay.label': 'връзката между часа на писане и настроението',
  'analysis.timeOfDay.morning.label': 'Сутрин',
  'analysis.timeOfDay.morning.phrase': 'сутрин',
  'analysis.timeOfDay.late_morning.label': 'Късна сутрин',
  'analysis.timeOfDay.late_morning.phrase': 'късно сутрин',
  'analysis.timeOfDay.afternoon.label': 'Следобед',
  'analysis.timeOfDay.afternoon.phrase': 'следобед',
  'analysis.timeOfDay.evening.label': 'Вечер',
  'analysis.timeOfDay.evening.phrase': 'вечер',
  'analysis.timeOfDay.night.label': 'Нощ',
  'analysis.timeOfDay.night.phrase': 'през нощта',
  'analysis.timeOfDay.tableKey': '{label} ({hours})',
  'analysis.timeOfDay.tableValue': 'средно {mean}, {count, plural, one {# отбелязване} other {# отбелязвания}}',
  'analysis.timeOfDay.tableRow': '{key}: {value}',
  'analysis.timeOfDay.nothing':
    'Проверих {label} по {count, plural, one {# отбелязване} other {# отбелязвания}} и не открих времеви интервал, който да се откроява над средното.',
  'analysis.timeOfDay.text':
    'Изглежда, че в данните ви настроението, отбелязано {phrase} ({hours}), е било най-високо: средно {mean} при {overall} за всички отбелязвания.',
  'analysis.timeOfDay.explainChecked':
    'Проверих {count, plural, one {# отбелязване на настроението} other {# отбелязвания на настроението}} от {days, plural, one {# ден} other {# дни}} според часа, в който е написан записът.',
  'analysis.timeOfDay.explainTable': '{table}. Общо средно: {overall}.',
  'analysis.timeOfDay.explainDiff':
    'Разлика между най-високия времеви интервал и общото средно: {diff} точки. Сила на закономерността: {strength}.',
  'analysis.timeOfDay.title': 'По-високо настроение {phrase}',
  'analysis.timeOfDay.groupA': 'Отбелязвания {phrase} ({hours})',
  'analysis.timeOfDay.groupB': 'Останалите отбелязвания',

  // Trends ------------------------------------------------------------------------------
  'analysis.trends.label': 'тенденциите в настроението, стреса и съня',
  'analysis.trends.text':
    'Изглежда, че в данните ви {metricDefined} {gender, select, other {{direction, select, up {има тенденция към покачване} other {има тенденция към спад}}}} {horizon, select, period {през периода} monthly {през последния месец} other {през последните две седмици}}: линията на тренда на плъзгащата средна {direction, select, up {се покачи} other {спадна}} от {fromValue} на {toValue}.',
  'analysis.trends.explainChecked':
    'Проверих {count, plural, one {# ден} other {# дни}} с данни за „{metric}“ от {len} {horizon, select, period {дни в периода} other {последни дни}} ({from}–{to}).',
  'analysis.trends.explainFit':
    'Изчислих {window}-дневна плъзгаща средна и линия на тренда през нея (линейна регресия): {direction, select, up {наклон нагоре} other {наклон надолу}} от {unit, select, hours {{slope} часа} other {{slope} точки}} на ден, т.е. промяна от около {unit, select, hours {{change} часа} other {{change} точки}} за интервала (от {fromValue} до {toValue} по линията на тренда). Сила на тенденцията: {strength}.',
  'analysis.trends.title':
    '{direction, select, up {Тенденция към покачване} other {Тенденция към спад}} {metric, select, mood {на настроението ви} energy {на нивото ви на енергия} stress {на нивото ви на стрес} sleepHours {на часовете ви сън} sleepQuality {на качеството на съня ви} exerciseMinutes {на минутите ви активност} other {на броя записи}} {horizon, select, period {през периода} monthly {през последния месец} other {през последните две седмици}}',
  'analysis.trends.groupA': 'Начало на интервала (линия на тренда)',
  'analysis.trends.groupB': 'Край на интервала (линия на тренда)',
  'analysis.trends.slopeValue': '{unit, select, hours {{slope} часа} other {{slope} точки}}',
  'analysis.trends.nothingSince':
    'Проверих за тенденции в настроението, стреса и съня от {from} насам и не открих забележима тенденция.',
  'analysis.trends.nothingAll':
    'Проверих за тенденции в настроението, стреса и съня за целия период и не открих забележима тенденция.',

  // Month comparison --------------------------------------------------------------------
  'analysis.periodCompare.label': 'сравнението между текущия и предишния месец',
  'analysis.periodCompare.text':
    'Изглежда, че в данните ви през {cur} {metricDefined} {gender, select, m {беше {direction, select, higher {средно по-висок} other {средно по-нисък}}} f {беше {direction, select, higher {средно по-висока} other {средно по-ниска}}} n {беше {direction, select, higher {средно по-високо} other {средно по-ниско}}} other {беше {direction, select, higher {средно по-високо} other {средно по-ниско}}}}, отколкото през {prev} ({meanA} спрямо {meanB}).',
  'analysis.periodCompare.explain':
    'Сравних дните с данни за „{metric}“ през {cur} ({countA, plural, one {# ден} other {# дни}}, до днес) с дните през {prev} ({countB, plural, one {# ден} other {# дни}}). Средно през {cur}: {meanA}; през {prev}: {meanB}. Разлика: {unit, select, hours {{diff} часа} other {{diff} точки}}. Сила на разликата: {strength}.',
  'analysis.periodCompare.title':
    'През {cur}: {gender, select, m {{direction, select, higher {по-висок {metric}} other {по-нисък {metric}}}} f {{direction, select, higher {по-висока {metric}} other {по-ниска {metric}}}} n {{direction, select, higher {по-високо {metric}} other {по-ниско {metric}}}} other {{direction, select, higher {по-висок показател „{metric}“} other {по-нисък показател „{metric}“}}}}, отколкото през {prev}',
  'analysis.periodCompare.entriesText':
    'Изглежда, че през {window, plural, one {първия ден} other {първите # дни}} на {cur} сте писали {direction, select, more {повече} other {по-малко}} ({countA, plural, one {# запис} other {# записа}}), отколкото през {window, plural, one {първия ден} other {първите # дни}} на {prev} ({countB, plural, one {# запис} other {# записа}}).',
  'analysis.periodCompare.entriesExplain':
    'Преброих записите през {window, plural, one {първия ден} other {първите # дни}} на всеки месец, за да сравня еднакви периоди: {cur} - {countA, plural, one {# запис} other {# записа}}, {prev} - {countB, plural, one {# запис} other {# записа}}. Разлика: {diff, plural, one {# запис} other {# записа}} ({percent}). Сила на разликата: {strength}.',
  'analysis.periodCompare.entriesTitle': '{direction, select, more {Повече записи} other {По-малко записи}} през {cur}, отколкото през {prev}',
  'analysis.periodCompare.monthWindow': '{month} ({window, plural, one {първия ден} other {първите # дни}})',
  'analysis.periodCompare.insufficientWhat': 'сравнението между {cur} и {prev}',
  'analysis.periodCompare.nothing':
    'Сравних {cur} с {prev} и не открих забележима разлика в настроението, стреса, съня или броя на записите.',

  // Habit trend (improved / declined) -----------------------------------------------------
  'analysis.habitsTrend.label': 'навиците, които са се подобрили или влошили',
  'analysis.habitsTrend.whether': 'дали навикът „{habit}“ се е подобрил или влошил',
  'analysis.habitsTrend.textDaily':
    'Изглежда, че навикът „{habit}“ {direction, select, improved {се е подобрил} other {се е влошил}}: през последните две седмици сте го изпълнили в {recent} от {window} дни, в сравнение с {previous} от {window} през предходните две седмици.',
  'analysis.habitsTrend.textWeekly':
    'Изглежда, че навикът „{habit}“ {direction, select, improved {се е подобрил} other {се е влошил}}: през последните две седмици сте отбелязали {recent} {unit}, в сравнение с {previous} през предходните две седмици (цел: {target} {unit} седмично).',
  'analysis.habitsTrend.explain':
    'Сравних процента на изпълнение на навика през последните две седмици ({recentFrom}–{recentTo}) с предходните две седмици ({previousFrom}–{previousTo}): {recentRate} спрямо {previousRate}. Разлика: {diff} процентни пункта. Сила на промяната: {strength}.',
  'analysis.habitsTrend.title':
    'Навикът „{habit}“ {direction, select, improved {се е подобрил} other {се е влошил}} през последните две седмици',
  'analysis.habitsTrend.metric': 'Процент на изпълнение - {habit}',
  'analysis.habitsTrend.groupA': 'Последните две седмици',
  'analysis.habitsTrend.groupB': 'Предходните две седмици',

  // Best / hardest days ------------------------------------------------------------------
  'analysis.bestWorst.label': 'най-добрите и най-трудните дни',
  'analysis.bestWorst.describedDay': '{day} („{title}“)',
  'analysis.bestWorst.noTitle': 'Без заглавие',
  'analysis.bestWorst.extraValue': '{titles} - оценка {score}',
  'analysis.bestWorst.text':
    '{kind, select, best {Най-добрите дни} other {Най-трудните дни}} в периода по комбинирана оценка на настроението, енергията и стреса: {days}.',
  'analysis.bestWorst.explainScore':
    'За всеки от проверените дни ({count, plural, one {# ден} other {# дни}}) изчислих комбинирана оценка: средното на настроението, нивото на енергия и (11 минус нивото на стрес) от стойностите, отбелязани в този ден.',
  'analysis.bestWorst.explainMeans':
    'Средната оценка за периода: {overall}. {kind, select, best {{count, plural, one {Най-добрият ден получи} =3 {Трите най-добри дни получиха} other {Най-добрите дни получиха}}} other {{count, plural, one {Най-трудният ден получи} =3 {Трите най-трудни дни получиха} other {Най-трудните дни получиха}}}} средно {mean}.',
  'analysis.bestWorst.explainDiff': 'Разлика спрямо средното: {diff} точки. Сила на разликата: {strength}.',
  'analysis.bestWorst.title': '{kind, select, best {Най-добрите дни в периода} other {Най-трудните дни в периода}}',
  'analysis.bestWorst.metric': 'Комбинирана оценка (настроение + енергия + обърнат стрес)',
  'analysis.bestWorst.groupA': '{kind, select, best {Най-добрите дни} other {Най-трудните дни}}',
  'analysis.bestWorst.nothing':
    'Проверих {label} за {count, plural, one {# ден} other {# дни}}; оценките бяха сходни и нито един ден не се открои.',

  // Streaks -------------------------------------------------------------------------------
  'analysis.streaks.label': 'сериите от записи и навици',
  'analysis.streaks.entriesTitle': 'Серия от {count, plural, one {# ден} other {# дни}} с писане',
  'analysis.streaks.entriesText': 'Браво! Писахте в дневника си {count, plural, one {# ден} other {# дни}} поред ({from}–{to}).',
  'analysis.streaks.entriesExplain':
    'Преброих поредните дни с поне един запис до днес или вчера. Текуща серия: {count, plural, one {# ден} other {# дни}} ({from}–{to}). Най-дълга серия в периода: {best, plural, one {# ден} other {# дни}}.',
  'analysis.streaks.entriesMetric': 'Дни с писане',
  'analysis.streaks.currentDays': 'Дни в текущата серия',
  'analysis.streaks.daysWithEntry': 'Дни със запис в периода',
  'analysis.streaks.habitTitle': 'Серия от {count, plural, one {# ден} other {# дни}} за навика „{habit}“',
  'analysis.streaks.habitText': 'Изпълнявахте навика „{habit}“ {count, plural, one {# ден} other {# дни}} поред ({from}–{to}).',
  'analysis.streaks.habitExplain':
    'Преброих поредните дни, в които навикът „{habit}“ е отбелязан като изпълнен, до днес или вчера. Текуща серия: {count, plural, one {# ден} other {# дни}}. Най-дълга серия в периода: {best, plural, one {# ден} other {# дни}}.',
  'analysis.streaks.habitMetric': 'Изпълнение на навика „{habit}“',
  'analysis.streaks.daysCompleted': 'Дни с изпълнен навик в периода',
  'analysis.streaks.weeklyTitle': 'Серия от {count, plural, one {# седмица} other {# седмици}} за навика „{habit}“',
  'analysis.streaks.weeklyText':
    'Постигахте целта на навика „{habit}“ {count, plural, one {# седмица} other {# седмици}} поред ({from}–{to}).',
  'analysis.streaks.weeklyExplain':
    'Сумирах отбелязаното количество за навика „{habit}“ за всяка седмица и го сравних със седмичната цел ({target}). Текуща серия от седмици с постигната цел: {count, plural, one {# седмица} other {# седмици}}.',
  'analysis.streaks.weeklyMetric': 'Постигната седмична цел - {habit}',
  'analysis.streaks.currentWeeks': 'Седмици в текущата серия',
  'analysis.streaks.weeksWithLogs': 'Седмици с отбелязвания в периода',
  'analysis.streaks.none':
    'Не са открити активни серии (серия от записи от {entryMin} или повече дни или серия на навик от {habitMin} или повече дни или седмици).',

  // Anomalies -----------------------------------------------------------------------------
  'analysis.anomalies.label': 'необичайните дни по настроение или стрес',
  'analysis.anomalies.textOne':
    'Изглежда, че в този ден ({day}) {metricDefined} {gender, select, m {беше {side, select, high {необичайно висок} other {необичайно нисък}}} f {беше {side, select, high {необичайно висока} other {необичайно ниска}}} n {беше {side, select, high {необичайно високо} other {необичайно ниско}}} other {беше {side, select, high {необичайно високо} other {необичайно ниско}}}} в сравнение с останалата част от периода ({value} при средно {mean}).',
  'analysis.anomalies.textMany':
    'Изглежда, че в {count, plural, one {# ден} other {# дни}} {metricDefined} {gender, select, m {беше {side, select, high {необичайно висок} other {необичайно нисък}}} f {беше {side, select, high {необичайно висока} other {необичайно ниска}}} n {беше {side, select, high {необичайно високо} other {необичайно ниско}}} other {беше {side, select, high {необичайно високо} other {необичайно ниско}}}} в сравнение с останалата част от периода: {days}; средно за периода: {mean}.',
  'analysis.anomalies.textManyMore':
    'Изглежда, че в {count, plural, one {# ден} other {# дни}} {metricDefined} {gender, select, m {беше {side, select, high {необичайно висок} other {необичайно нисък}}} f {беше {side, select, high {необичайно висока} other {необичайно ниска}}} n {беше {side, select, high {необичайно високо} other {необичайно ниско}}} other {беше {side, select, high {необичайно високо} other {необичайно ниско}}}} в сравнение с останалата част от периода: {days} и други; средно за периода: {mean}.',
  'analysis.anomalies.dayItem': '{day} ({value})',
  'analysis.anomalies.detail':
    '{date}: {value} ({z} стандартни отклонения {side, select, above {над средното} other {под средното}})',
  'analysis.anomalies.explain':
    'Проверих {count, plural, one {# ден} other {# дни}} с данни за „{metric}“. Средно: {mean}, стандартно отклонение: {sd}. Един ден се смята за необичаен, когато стойността му се отклонява от средното с {z} или повече стандартни отклонения. {details}. Сила на отклонението: {strength}.',
  'analysis.anomalies.title':
    '{gender, select, m {{side, select, high {Необичайно висок {metric}} other {Необичайно нисък {metric}}}} f {{side, select, high {Необичайно висока {metric}} other {Необичайно ниска {metric}}}} n {{side, select, high {Необичайно високо {metric}} other {Необичайно ниско {metric}}}} other {{side, select, high {Необичайно висок показател „{metric}“} other {Необичайно нисък показател „{metric}“}}}} ({count, plural, one {# ден} other {# дни}})',
  'analysis.anomalies.groupA': 'Необичайни дни',
  'analysis.anomalies.zValue': '{value} (z {z})',
  'analysis.anomalies.nothing':
    'Проверих за необичайни дни за {count, plural, one {# ден} other {# дни}} и не открих ден, който да се отклонява от средното с {z} или повече стандартни отклонения.',

  // Emotion patterns ----------------------------------------------------------------------
  'analysis.emotion.label': 'закономерностите в емоциите по дни, хора и места',
  'analysis.emotion.metric': 'Емоцията „{emotion}“',
  'analysis.emotion.groupA': 'Дни с емоцията „{emotion}“',
  'analysis.emotion.weekdayTitle': 'Емоцията „{emotion}“ се появява най-често {onWeekday}',
  'analysis.emotion.weekdayText':
    'Изглежда, че в данните ви емоцията „{emotion}“ се е появявала най-често {onWeekday} ({top} от {total} пъти).',
  'analysis.emotion.weekdayExplain':
    'Проверих {count, plural, one {# ден} other {# дни}}. Емоцията „{emotion}“ е отбелязана в {total, plural, one {# ден} other {# дни}}; {top} от тях бяха {weekdays} ({share}), а {weekdays} са {baseline} от всички проверени дни. Сила на закономерността: {strength}.',
  'analysis.emotion.groupBWeekday': 'От тях: {weekdays}',
  'analysis.emotion.weekdayShareKey': 'Дял сред всички дни: {weekdays}',
  'analysis.emotion.personTitle': 'Емоцията „{emotion}“ и {name}',
  'analysis.emotion.placeTitle': 'Емоцията „{emotion}“ и „{place}“',
  'analysis.emotion.personText':
    'Изглежда, че в данните ви емоцията „{emotion}“ често се е появявала в дните, в които сте се срещали с {name} ({with} от {total} пъти).',
  'analysis.emotion.placeText':
    'Изглежда, че в данните ви емоцията „{emotion}“ често се е появявала в дните, в които мястото е било „{place}“ ({with} от {total} пъти).',
  'analysis.emotion.personExplain':
    'Проверих {count, plural, one {# ден} other {# дни}}. Емоцията „{emotion}“ е отбелязана в {total} дни; в {with} от тях ({share}) в записа се появява и {name}. {name} се появява общо в {baselineCount} от {count} дни ({baseline}). Сила на закономерността: {strength}.',
  'analysis.emotion.placeExplain':
    'Проверих {count, plural, one {# ден} other {# дни}}. Емоцията „{emotion}“ е отбелязана в {total} дни; в {with} от тях ({share}) в записа се появява и мястото „{place}“. Мястото „{place}“ се появява общо в {baselineCount} от {count} дни ({baseline}). Сила на закономерността: {strength}.',
  'analysis.emotion.groupBPerson': 'От тях с {name}',
  'analysis.emotion.groupBPlace': 'От тях в „{place}“',
  'analysis.emotion.personShareKey': 'Дял сред всички дни: {name}',
  'analysis.emotion.placeShareKey': 'Дял сред всички дни: мястото „{place}“',
  'analysis.emotion.nothing':
    'Проверих {count, plural, one {# емоция} other {# емоции}}, които са се повтаряли поне {min} пъти, и не открих забележимо съсредоточаване в определени дни, хора или места.',
};
export default messages;
