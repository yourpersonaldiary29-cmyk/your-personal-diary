/**
 * bg - searchAnswers messages (server/src/search: parser explanations, period labels,
 * executor answers). Keys are prefixed 'searchAnswers.'; see shared/i18n/index.ts for the syntax.
 *
 * Every sentence that names a metric receives it as `{metric, select, ...}`: each branch
 * carries the article form and, where needed, the verb that agrees with it. `{period}` is a
 * ready phrase ("през последния месец", "в целия дневник"). The app speaks in the aorist
 * ("Разбрах", "Намерих"), which is the same for every speaker, and addresses the user
 * with the plural "вие" forms ("сте се чувствали").
 */
const messages: Record<string, string> = {
  // Period labels (ParsedQuery.periodLabel and the {period} of every sentence) --------
  'searchAnswers.period.all': 'целия период',
  'searchAnswers.period.allPhrase': 'в целия дневник',
  'searchAnswers.period.today': 'днес',
  'searchAnswers.period.yesterday': 'вчера',
  'searchAnswers.period.twoDaysAgo': 'онзи ден',
  'searchAnswers.period.week': 'през последната седмица',
  'searchAnswers.period.month': 'през последния месец',
  'searchAnswers.period.halfYear': 'през последните шест месеца',
  'searchAnswers.period.year': 'през последната година',
  'searchAnswers.period.startYear': 'от началото на годината',
  'searchAnswers.period.startMonth': 'от началото на месеца',
  'searchAnswers.period.recent': 'през последните дни',
  'searchAnswers.period.lastDays': '{count, plural, one {днес} other {през последните # дни}}',
  'searchAnswers.period.lastWeeks': '{count, plural, one {през последната седмица} other {през последните # седмици}}',
  'searchAnswers.period.lastMonths': '{count, plural, one {през последния месец} other {през последните # месеца}}',
  'searchAnswers.period.lastYears': '{count, plural, one {през последната година} other {през последните # години}}',
  'searchAnswers.period.agoDays': '{count, plural, one {преди един ден} other {преди # дни}}',
  'searchAnswers.period.agoWeeks': '{count, plural, one {преди една седмица} other {преди # седмици}}',
  'searchAnswers.period.agoMonths': '{count, plural, one {преди един месец} other {преди # месеца}}',
  'searchAnswers.period.agoYears': '{count, plural, one {преди една година} other {преди # години}}',
  'searchAnswers.period.calendarMonth': 'през {month} {year}',
  'searchAnswers.period.onDate': 'на {date}',
  'searchAnswers.period.between': 'от {from} до {to}',

  // Comparators ("less than 5") ------------------------------------------------------
  'searchAnswers.comparator.lt': 'по-малко от {value}',
  'searchAnswers.comparator.lte': 'най-много {value}',
  'searchAnswers.comparator.gt': 'повече от {value}',
  'searchAnswers.comparator.gte': 'поне {value}',
  'searchAnswers.comparator.eq': 'точно {value}',

  // Lists and quoting ----------------------------------------------------------------
  'searchAnswers.quoted': '„{term}“',
  'searchAnswers.listSeparator': ', ',
  'searchAnswers.dayWithValues': '{day} ({values})',
  'searchAnswers.value.mood': 'настроение {value}',
  'searchAnswers.value.energy': 'енергия {value}',
  'searchAnswers.value.stress': 'стрес {value}',
  'searchAnswers.value.sleepHours': 'часове сън {value}',
  'searchAnswers.value.sleepQuality': 'качество на съня {value}',
  'searchAnswers.value.exerciseMinutes': 'минути активност {value}',
  'searchAnswers.mention.something': 'нещо',

  // "How I understood the question" (ParsedQuery.explanation) ------------------------
  // Bulgarian dates end in "г." ("15.08.2026 г."): {period} is put in parentheses and sentences that
  // end with {days} carry no final period, so no "г.." appears.
  'searchAnswers.explain.best': 'Разбрах: дните, в които сте се чувствали най-добре ({period}).',
  'searchAnswers.explain.bestByMetric':
    'Разбрах: най-добрите дни по {metric, select, mood {настроение} energy {ниво на енергия} stress {ниво на стрес} sleepHours {часове сън} sleepQuality {качество на съня} exerciseMinutes {минути активност} other {стойност}} ({period}).',
  'searchAnswers.explain.worst': 'Разбрах: най-трудните дни ({period}).',
  'searchAnswers.explain.worstByMetric':
    'Разбрах: най-трудните дни по {metric, select, mood {настроение} energy {ниво на енергия} stress {ниво на стрес} sleepHours {часове сън} sleepQuality {качество на съня} exerciseMinutes {минути активност} other {стойност}} ({period}).',
  'searchAnswers.explain.filter':
    'Разбрах: дни с {metric, select, mood {настроение} energy {ниво на енергия} stress {ниво на стрес} sleepHours {часове сън} sleepQuality {качество на съня} exerciseMinutes {минути активност} other {стойност}} {comparison} ({period}).',
  'searchAnswers.explain.trend':
    'Разбрах: {metric, select, mood {как се е променяло настроението ви} energy {как се е променяло нивото ви на енергия} stress {как се е променяло нивото ви на стрес} sleepHours {как са се променяли часовете ви сън} sleepQuality {как се е променяло качеството на съня ви} exerciseMinutes {как се е променяла физическата ви активност} other {как са се променяли стойностите ви}} ({period}).',
  'searchAnswers.explain.mention': 'Разбрах: записи, в които сте писали {terms} ({period}).',
  'searchAnswers.explain.mentionAny': 'Разбрах: записите ви ({period}).',
  'searchAnswers.explain.emotion': 'Разбрах: дни, в които сте изпитвали {emotions} ({period}).',
  'searchAnswers.explain.list': 'Разбрах: записи, съдържащи {terms} ({period}).',
  'searchAnswers.explain.listAll': 'Разбрах: всички записи ({period}).',
  'searchAnswers.explain.unknown':
    'Не успях да разбера въпроса. Можете да попитате например: „В кои дни през последния месец се чувствах най-добре?“',

  // Answers ---------------------------------------------------------------------------
  'searchAnswers.noResults': 'Не намерих записи, които отговарят на въпроса.',
  'searchAnswers.noResultsPeriod': 'Не намерих записи, които отговарят на въпроса ({period}).',
  'searchAnswers.rank.best': 'Дните, в които сте се чувствали най-добре {period}: {days}',
  'searchAnswers.rank.bestByMetric':
    'Най-добрите дни по {metric, select, mood {настроение} energy {ниво на енергия} stress {ниво на стрес} sleepHours {часове сън} sleepQuality {качество на съня} exerciseMinutes {минути активност} other {стойност}} {period}: {days}',
  'searchAnswers.rank.worst': 'Най-трудните дни {period}: {days}',
  'searchAnswers.rank.worstByMetric':
    'Най-трудните дни по {metric, select, mood {настроение} energy {ниво на енергия} stress {ниво на стрес} sleepHours {часове сън} sleepQuality {качество на съня} exerciseMinutes {минути активност} other {стойност}} {period}: {days}',
  'searchAnswers.filter.found':
    'Намерих {count, plural, one {# ден} other {# дни}} с {metric, select, mood {настроение} energy {ниво на енергия} stress {ниво на стрес} sleepHours {часове сън} sleepQuality {качество на съня} exerciseMinutes {минути активност} other {стойност}} {comparison} {period}: {days}{more, plural, =0 {} one { и още # ден} other { и още # дни}}',
  'searchAnswers.emotion.found':
    'Изпитвали сте {emotions} в {count, plural, one {# ден} other {# дни}} {period}: {days}{more, plural, =0 {} one { и още # ден} other { и още # дни}}',
  'searchAnswers.mention.found':
    'Писали сте {terms} в {count, plural, one {# запис {period} ({first})} other {# записа {period} (първият е от {first}, последният - от {last})}}.',
  'searchAnswers.list.found':
    'Намерих {count, plural, one {# запис} other {# записа}} {period} (последният е от {last}).',
  'searchAnswers.list.foundTerms':
    'Намерих {count, plural, one {# запис, съдържащ} other {# записа, съдържащи}} {terms} {period} (последният е от {last}).',
  'searchAnswers.unknown.fallback':
    'Въпросът не беше съвсем ясен, затова ето {count, plural, one {последния запис} other {последните # записа}} от общо {total}. {explanation}',
  'searchAnswers.trend.insufficient':
    'Няма достатъчно данни, за да се открие тенденция в {metric, select, mood {настроението ви} energy {нивото ви на енергия} stress {нивото ви на стрес} sleepHours {часовете ви сън} sleepQuality {качеството на съня ви} exerciseMinutes {физическата ви активност} other {стойностите ви}} ({period}).',
  'searchAnswers.trend.evidence':
    '(въз основа на {first, plural, one {# ден} other {# дни}} в началото на периода спрямо {last, plural, one {# ден} other {# дни}} в края)',
  'searchAnswers.trend.stable':
    '{metric, select, mood {Средното ви настроение остана стабилно} energy {Средното ви ниво на енергия остана стабилно} stress {Средното ви ниво на стрес остана стабилно} sleepHours {Средните ви часове сън останаха стабилни} sleepQuality {Средното ви качество на съня остана стабилно} exerciseMinutes {Средните ви минути активност останаха стабилни} other {Средната ви стойност остана стабилна}} {period}: {from} спрямо {to} {evidence}.',
  'searchAnswers.trend.up':
    '{metric, select, mood {Средното ви настроение се повиши} energy {Средното ви ниво на енергия се повиши} stress {Средното ви ниво на стрес се повиши} sleepHours {Средните ви часове сън се увеличиха} sleepQuality {Средното ви качество на съня се повиши} exerciseMinutes {Средните ви минути активност се увеличиха} other {Средната ви стойност се повиши}} от {from} на {to} {period} {evidence}.',
  'searchAnswers.trend.down':
    '{metric, select, mood {Средното ви настроение спадна} energy {Средното ви ниво на енергия спадна} stress {Средното ви ниво на стрес спадна} sleepHours {Средните ви часове сън намаляха} sleepQuality {Средното ви качество на съня спадна} exerciseMinutes {Средните ви минути активност намаляха} other {Средната ви стойност спадна}} от {from} на {to} {period} {evidence}.',

  // Request validation (POST /api/search) ----------------------------------------------
  'searchAnswers.validation.body': 'Тялото на заявката трябва да съдържа въпрос (query)',
  'searchAnswers.validation.query': 'Въведете въпрос',
  'searchAnswers.validation.queryTooLong': 'Въпросът е твърде дълъг (до {max} знака)',
  'searchAnswers.validation.limit': 'Броят резултати трябва да е цяло число от 1 до {max}',
};
export default messages;
