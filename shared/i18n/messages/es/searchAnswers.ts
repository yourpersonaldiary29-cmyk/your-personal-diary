/**
 * es - searchAnswers messages (server/src/search: parser explanations, period labels,
 * executor answers). Keys are prefixed 'searchAnswers.'; see shared/i18n/index.ts for the syntax.
 *
 * Every sentence that names a metric receives it as `{metric, select, ...}` with the
 * metric key (mood, energy, stress, sleepHours, sleepQuality, exerciseMinutes): write
 * the metric's name inside each branch in the form your language needs there (gender,
 * case, article), and keep the `other` branch as a neutral fallback. `{period}` is a
 * ready phrase ("in the last month", "across the whole diary") that follows the sentence;
 * `{days}`, `{terms}` and `{emotions}` are ready lists; `{comparison}` is a rendered
 * comparator ("less than 5"); `{first}` / `{last}` are full dates.
 *
 * Spanish: the comparators are written to follow "de" ("de menos de 5", "de hasta 6") or to
 * precede the unit ("menos de 5 horas de sueño"), which is how the filter sentences use them.
 */
const messages: Record<string, string> = {
  // Period labels (ParsedQuery.periodLabel and the {period} of every sentence) --------
  'searchAnswers.period.all': 'todo el periodo',
  'searchAnswers.period.allPhrase': 'en todo el diario',
  'searchAnswers.period.today': 'hoy',
  'searchAnswers.period.yesterday': 'ayer',
  'searchAnswers.period.twoDaysAgo': 'anteayer',
  'searchAnswers.period.week': 'en la última semana',
  'searchAnswers.period.month': 'en el último mes',
  'searchAnswers.period.halfYear': 'en los últimos seis meses',
  'searchAnswers.period.year': 'en el último año',
  'searchAnswers.period.startYear': 'desde principios de año',
  'searchAnswers.period.startMonth': 'desde principios de mes',
  'searchAnswers.period.recent': 'en los últimos días',
  'searchAnswers.period.lastDays': '{count, plural, one {hoy} other {en los últimos # días}}',
  'searchAnswers.period.lastWeeks': '{count, plural, one {en la última semana} other {en las últimas # semanas}}',
  'searchAnswers.period.lastMonths': '{count, plural, one {en el último mes} other {en los últimos # meses}}',
  'searchAnswers.period.lastYears': '{count, plural, one {en el último año} other {en los últimos # años}}',
  'searchAnswers.period.agoDays': '{count, plural, one {hace un día} other {hace # días}}',
  'searchAnswers.period.agoWeeks': '{count, plural, one {hace una semana} other {hace # semanas}}',
  'searchAnswers.period.agoMonths': '{count, plural, one {hace un mes} other {hace # meses}}',
  'searchAnswers.period.agoYears': '{count, plural, one {hace un año} other {hace # años}}',
  'searchAnswers.period.calendarMonth': 'en {month} de {year}',
  'searchAnswers.period.onDate': 'el {date}',
  'searchAnswers.period.between': 'entre el {from} y el {to}',

  // Comparators ("less than 5") ------------------------------------------------------
  'searchAnswers.comparator.lt': 'menos de {value}',
  'searchAnswers.comparator.lte': 'hasta {value}',
  'searchAnswers.comparator.gt': 'más de {value}',
  'searchAnswers.comparator.gte': 'al menos {value}',
  'searchAnswers.comparator.eq': 'exactamente {value}',

  // Lists and quoting ----------------------------------------------------------------
  'searchAnswers.quoted': '«{term}»',
  'searchAnswers.listSeparator': ', ',
  'searchAnswers.dayWithValues': '{day} ({values})',
  'searchAnswers.value.mood': 'ánimo {value}',
  'searchAnswers.value.energy': 'energía {value}',
  'searchAnswers.value.stress': 'estrés {value}',
  'searchAnswers.value.sleepHours': 'horas de sueño {value}',
  'searchAnswers.value.sleepQuality': 'calidad del sueño {value}',
  'searchAnswers.value.exerciseMinutes': 'minutos de ejercicio {value}',
  'searchAnswers.mention.something': 'algo',

  // "How I understood the question" (ParsedQuery.explanation) ------------------------
  'searchAnswers.explain.best': 'Entendido: los días en que te sentiste mejor, {period}.',
  'searchAnswers.explain.bestByMetric':
    'Entendido: los mejores días según {metric, select, mood {el estado de ánimo} energy {el nivel de energía} stress {el nivel de estrés} sleepHours {las horas de sueño} sleepQuality {la calidad del sueño} exerciseMinutes {los minutos de ejercicio} other {el valor}}, {period}.',
  'searchAnswers.explain.worst': 'Entendido: los días más difíciles, {period}.',
  'searchAnswers.explain.worstByMetric':
    'Entendido: los días más difíciles según {metric, select, mood {el estado de ánimo} energy {el nivel de energía} stress {el nivel de estrés} sleepHours {las horas de sueño} sleepQuality {la calidad del sueño} exerciseMinutes {los minutos de ejercicio} other {el valor}}, {period}.',
  'searchAnswers.explain.filter':
    'Entendido: días con {metric, select, mood {un estado de ánimo de {comparison}} energy {un nivel de energía de {comparison}} stress {un nivel de estrés de {comparison}} sleepHours {{comparison} horas de sueño} sleepQuality {una calidad del sueño de {comparison}} exerciseMinutes {{comparison} minutos de ejercicio} other {un valor de {comparison}}}, {period}.',
  'searchAnswers.explain.trend':
    'Entendido: {metric, select, mood {cómo ha evolucionado tu estado de ánimo} energy {cómo ha evolucionado tu nivel de energía} stress {cómo ha evolucionado tu nivel de estrés} sleepHours {cómo han evolucionado tus horas de sueño} sleepQuality {cómo ha evolucionado la calidad de tu sueño} exerciseMinutes {cómo han evolucionado tus minutos de ejercicio} other {cómo han evolucionado tus valores}}, {period}.',
  'searchAnswers.explain.mention': 'Entendido: entradas en las que escribiste {terms}, {period}.',
  'searchAnswers.explain.mentionAny': 'Entendido: las entradas que escribiste, {period}.',
  'searchAnswers.explain.emotion': 'Entendido: días en los que sentiste {emotions}, {period}.',
  'searchAnswers.explain.list': 'Entendido: entradas que contienen {terms}, {period}.',
  'searchAnswers.explain.listAll': 'Entendido: todas las entradas, {period}.',
  'searchAnswers.explain.unknown':
    'No he podido entender la pregunta. Puedes preguntar, por ejemplo: «¿Qué días del último mes me sentí mejor?»',

  // Answers ---------------------------------------------------------------------------
  'searchAnswers.noResults': 'No he encontrado entradas que coincidan con la pregunta.',
  'searchAnswers.noResultsPeriod': 'No he encontrado entradas que coincidan con la pregunta {period}.',
  'searchAnswers.rank.best': 'Los días en que te sentiste mejor {period}: {days}.',
  'searchAnswers.rank.bestByMetric':
    'Los mejores días según {metric, select, mood {el estado de ánimo} energy {el nivel de energía} stress {el nivel de estrés} sleepHours {las horas de sueño} sleepQuality {la calidad del sueño} exerciseMinutes {los minutos de ejercicio} other {el valor}} {period}: {days}.',
  'searchAnswers.rank.worst': 'Los días más difíciles {period}: {days}.',
  'searchAnswers.rank.worstByMetric':
    'Los días más difíciles según {metric, select, mood {el estado de ánimo} energy {el nivel de energía} stress {el nivel de estrés} sleepHours {las horas de sueño} sleepQuality {la calidad del sueño} exerciseMinutes {los minutos de ejercicio} other {el valor}} {period}: {days}.',
  'searchAnswers.filter.found':
    'He encontrado {count, plural, one {# día} other {# días}} con {metric, select, mood {un estado de ánimo de {comparison}} energy {un nivel de energía de {comparison}} stress {un nivel de estrés de {comparison}} sleepHours {{comparison} horas de sueño} sleepQuality {una calidad del sueño de {comparison}} exerciseMinutes {{comparison} minutos de ejercicio} other {un valor de {comparison}}} {period}: {days}{more, plural, =0 {} one { y # día más} other { y # días más}}.',
  'searchAnswers.emotion.found':
    'Sentiste {emotions} en {count, plural, one {# día} other {# días}} {period}: {days}{more, plural, =0 {} one { y # día más} other { y # días más}}.',
  'searchAnswers.mention.found':
    'Escribiste {terms} en {count, plural, one {# entrada {period}, el {first}} other {# entradas {period}; la primera, el {first}, y la última, el {last}}}.',
  'searchAnswers.list.found': 'He encontrado {count, plural, one {# entrada} other {# entradas}} {period}; la más reciente es del {last}.',
  'searchAnswers.list.foundTerms':
    'He encontrado {count, plural, one {# entrada que contiene} other {# entradas que contienen}} {terms} {period}; la más reciente es del {last}.',
  'searchAnswers.unknown.fallback':
    'No he entendido bien la pregunta, así que aquí {count, plural, one {tienes la entrada más reciente} other {tienes las # entradas más recientes}} de un total de {total}. {explanation}',
  'searchAnswers.trend.insufficient':
    'No hay datos suficientes para detectar una tendencia en {metric, select, mood {tu estado de ánimo} energy {tu nivel de energía} stress {tu nivel de estrés} sleepHours {tus horas de sueño} sleepQuality {la calidad de tu sueño} exerciseMinutes {tus minutos de ejercicio} other {tus valores}} {period}.',
  'searchAnswers.trend.evidence':
    '(según {first, plural, one {# día} other {# días}} al principio del periodo frente a {last, plural, one {# día} other {# días}} al final)',
  'searchAnswers.trend.stable':
    'Tu media de {metric, select, mood {estado de ánimo} energy {nivel de energía} stress {nivel de estrés} sleepHours {horas de sueño} sleepQuality {calidad del sueño} exerciseMinutes {minutos de ejercicio} other {valores}} se mantuvo estable {period}: {from} frente a {to} {evidence}.',
  'searchAnswers.trend.up':
    'Tu media de {metric, select, mood {estado de ánimo} energy {nivel de energía} stress {nivel de estrés} sleepHours {horas de sueño} sleepQuality {calidad del sueño} exerciseMinutes {minutos de ejercicio} other {valores}} subió de {from} a {to} {period} {evidence}.',
  'searchAnswers.trend.down':
    'Tu media de {metric, select, mood {estado de ánimo} energy {nivel de energía} stress {nivel de estrés} sleepHours {horas de sueño} sleepQuality {calidad del sueño} exerciseMinutes {minutos de ejercicio} other {valores}} bajó de {from} a {to} {period} {evidence}.',

  // Request validation (POST /api/search) ----------------------------------------------
  'searchAnswers.validation.body': 'El cuerpo de la solicitud debe contener una pregunta (query)',
  'searchAnswers.validation.query': 'Escribe una pregunta',
  'searchAnswers.validation.queryTooLong': 'La pregunta es demasiado larga (máximo {max} caracteres)',
  'searchAnswers.validation.limit': 'El número de resultados debe ser un número entero entre 1 y {max}',
};
export default messages;
