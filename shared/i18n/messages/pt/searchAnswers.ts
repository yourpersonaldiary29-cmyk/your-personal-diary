/**
 * pt - searchAnswers messages (server/src/search: parser explanations, period labels,
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
 * Portuguese: the comparators are written to follow "de" ("de menos de 5") or to precede
 * the unit ("até 6 horas de sono"), which is how the filter sentences use them.
 */
const messages: Record<string, string> = {
  // Period labels (ParsedQuery.periodLabel and the {period} of every sentence) --------
  'searchAnswers.period.all': 'todo o período',
  'searchAnswers.period.allPhrase': 'em todo o diário',
  'searchAnswers.period.today': 'hoje',
  'searchAnswers.period.yesterday': 'ontem',
  'searchAnswers.period.twoDaysAgo': 'anteontem',
  'searchAnswers.period.week': 'na última semana',
  'searchAnswers.period.month': 'no último mês',
  'searchAnswers.period.halfYear': 'nos últimos seis meses',
  'searchAnswers.period.year': 'no último ano',
  'searchAnswers.period.startYear': 'desde o início do ano',
  'searchAnswers.period.startMonth': 'desde o início do mês',
  'searchAnswers.period.recent': 'nos últimos dias',
  'searchAnswers.period.lastDays': '{count, plural, one {hoje} other {nos últimos # dias}}',
  'searchAnswers.period.lastWeeks': '{count, plural, one {na última semana} other {nas últimas # semanas}}',
  'searchAnswers.period.lastMonths': '{count, plural, one {no último mês} other {nos últimos # meses}}',
  'searchAnswers.period.lastYears': '{count, plural, one {no último ano} other {nos últimos # anos}}',
  'searchAnswers.period.agoDays': '{count, plural, one {há um dia} other {há # dias}}',
  'searchAnswers.period.agoWeeks': '{count, plural, one {há uma semana} other {há # semanas}}',
  'searchAnswers.period.agoMonths': '{count, plural, one {há um mês} other {há # meses}}',
  'searchAnswers.period.agoYears': '{count, plural, one {há um ano} other {há # anos}}',
  'searchAnswers.period.calendarMonth': 'em {month} de {year}',
  'searchAnswers.period.onDate': 'em {date}',
  'searchAnswers.period.between': 'entre {from} e {to}',

  // Comparators ("less than 5") ------------------------------------------------------
  'searchAnswers.comparator.lt': 'menos de {value}',
  'searchAnswers.comparator.lte': 'até {value}',
  'searchAnswers.comparator.gt': 'mais de {value}',
  'searchAnswers.comparator.gte': 'pelo menos {value}',
  'searchAnswers.comparator.eq': 'exatamente {value}',

  // Lists and quoting ----------------------------------------------------------------
  'searchAnswers.quoted': '«{term}»',
  'searchAnswers.listSeparator': ', ',
  'searchAnswers.dayWithValues': '{day} ({values})',
  'searchAnswers.value.mood': 'humor {value}',
  'searchAnswers.value.energy': 'energia {value}',
  'searchAnswers.value.stress': 'stress {value}',
  'searchAnswers.value.sleepHours': 'horas de sono {value}',
  'searchAnswers.value.sleepQuality': 'qualidade do sono {value}',
  'searchAnswers.value.exerciseMinutes': 'minutos de exercício {value}',
  'searchAnswers.mention.something': 'algo',

  // "How I understood the question" (ParsedQuery.explanation) ------------------------
  'searchAnswers.explain.best': 'Entendido: os dias em que se sentiu melhor, {period}.',
  'searchAnswers.explain.bestByMetric':
    'Entendido: os melhores dias segundo {metric, select, mood {o humor} energy {o nível de energia} stress {o nível de stress} sleepHours {as horas de sono} sleepQuality {a qualidade do sono} exerciseMinutes {os minutos de exercício} other {o valor}}, {period}.',
  'searchAnswers.explain.worst': 'Entendido: os dias mais difíceis, {period}.',
  'searchAnswers.explain.worstByMetric':
    'Entendido: os dias mais difíceis segundo {metric, select, mood {o humor} energy {o nível de energia} stress {o nível de stress} sleepHours {as horas de sono} sleepQuality {a qualidade do sono} exerciseMinutes {os minutos de exercício} other {o valor}}, {period}.',
  'searchAnswers.explain.filter':
    'Entendido: dias com {metric, select, mood {humor de {comparison}} energy {nível de energia de {comparison}} stress {nível de stress de {comparison}} sleepHours {{comparison} horas de sono} sleepQuality {qualidade do sono de {comparison}} exerciseMinutes {{comparison} minutos de exercício} other {um valor de {comparison}}}, {period}.',
  'searchAnswers.explain.trend':
    'Entendido: {metric, select, mood {como evoluiu o seu humor} energy {como evoluiu o seu nível de energia} stress {como evoluiu o seu nível de stress} sleepHours {como evoluíram as suas horas de sono} sleepQuality {como evoluiu a qualidade do seu sono} exerciseMinutes {como evoluíram os seus minutos de exercício} other {como evoluíram os seus valores}}, {period}.',
  'searchAnswers.explain.mention': 'Entendido: entradas em que escreveu {terms}, {period}.',
  'searchAnswers.explain.mentionAny': 'Entendido: as entradas que escreveu, {period}.',
  'searchAnswers.explain.emotion': 'Entendido: dias em que sentiu {emotions}, {period}.',
  'searchAnswers.explain.list': 'Entendido: entradas que contêm {terms}, {period}.',
  'searchAnswers.explain.listAll': 'Entendido: todas as entradas, {period}.',
  'searchAnswers.explain.unknown':
    'Não foi possível compreender a pergunta. Pode perguntar, por exemplo: «Em que dias do último mês me senti melhor?»',

  // Answers ---------------------------------------------------------------------------
  'searchAnswers.noResults': 'Não encontrei entradas que correspondam à pergunta.',
  'searchAnswers.noResultsPeriod': 'Não encontrei entradas que correspondam à pergunta {period}.',
  'searchAnswers.rank.best': 'Os dias em que se sentiu melhor {period}: {days}.',
  'searchAnswers.rank.bestByMetric':
    'Os melhores dias segundo {metric, select, mood {o humor} energy {o nível de energia} stress {o nível de stress} sleepHours {as horas de sono} sleepQuality {a qualidade do sono} exerciseMinutes {os minutos de exercício} other {o valor}} {period}: {days}.',
  'searchAnswers.rank.worst': 'Os dias mais difíceis {period}: {days}.',
  'searchAnswers.rank.worstByMetric':
    'Os dias mais difíceis segundo {metric, select, mood {o humor} energy {o nível de energia} stress {o nível de stress} sleepHours {as horas de sono} sleepQuality {a qualidade do sono} exerciseMinutes {os minutos de exercício} other {o valor}} {period}: {days}.',
  'searchAnswers.filter.found':
    'Encontrei {count, plural, one {# dia} other {# dias}} com {metric, select, mood {humor de {comparison}} energy {nível de energia de {comparison}} stress {nível de stress de {comparison}} sleepHours {{comparison} horas de sono} sleepQuality {qualidade do sono de {comparison}} exerciseMinutes {{comparison} minutos de exercício} other {um valor de {comparison}}} {period}: {days}{more, plural, =0 {} one { e mais # dia} other { e mais # dias}}.',
  'searchAnswers.emotion.found':
    'Sentiu {emotions} em {count, plural, one {# dia} other {# dias}} {period}: {days}{more, plural, =0 {} one { e mais # dia} other { e mais # dias}}.',
  'searchAnswers.mention.found':
    'Escreveu {terms} em {count, plural, one {# entrada {period}, com data de {first}} other {# entradas {period}; a primeira com data de {first} e a última com data de {last}}}.',
  'searchAnswers.list.found': 'Encontrei {count, plural, one {# entrada} other {# entradas}} {period}; a mais recente tem data de {last}.',
  'searchAnswers.list.foundTerms':
    'Encontrei {count, plural, one {# entrada que contém} other {# entradas que contêm}} {terms} {period}; a mais recente tem data de {last}.',
  'searchAnswers.unknown.fallback':
    'Não percebi bem a pergunta, por isso aqui {count, plural, one {está a entrada mais recente} other {estão as # entradas mais recentes}} de um total de {total}. {explanation}',
  'searchAnswers.trend.insufficient':
    'Não há dados suficientes para detetar uma tendência {metric, select, mood {no seu humor} energy {no seu nível de energia} stress {no seu nível de stress} sleepHours {nas suas horas de sono} sleepQuality {na qualidade do seu sono} exerciseMinutes {nos seus minutos de exercício} other {nos seus valores}} {period}.',
  'searchAnswers.trend.evidence':
    '(com base em {first, plural, one {# dia} other {# dias}} no início do período face a {last, plural, one {# dia} other {# dias}} no fim)',
  'searchAnswers.trend.stable':
    'A sua média de {metric, select, mood {humor} energy {nível de energia} stress {nível de stress} sleepHours {horas de sono} sleepQuality {qualidade do sono} exerciseMinutes {minutos de exercício} other {valores}} manteve-se estável {period}: {from} face a {to} {evidence}.',
  'searchAnswers.trend.up':
    'A sua média de {metric, select, mood {humor} energy {nível de energia} stress {nível de stress} sleepHours {horas de sono} sleepQuality {qualidade do sono} exerciseMinutes {minutos de exercício} other {valores}} subiu de {from} para {to} {period} {evidence}.',
  'searchAnswers.trend.down':
    'A sua média de {metric, select, mood {humor} energy {nível de energia} stress {nível de stress} sleepHours {horas de sono} sleepQuality {qualidade do sono} exerciseMinutes {minutos de exercício} other {valores}} desceu de {from} para {to} {period} {evidence}.',

  // Request validation (POST /api/search) ----------------------------------------------
  'searchAnswers.validation.body': 'O corpo do pedido tem de conter uma pergunta (query)',
  'searchAnswers.validation.query': 'Escreva uma pergunta',
  'searchAnswers.validation.queryTooLong': 'A pergunta é demasiado longa (máximo de {max} carateres)',
  'searchAnswers.validation.limit': 'O número de resultados tem de ser um número inteiro entre 1 e {max}',
};
export default messages;
