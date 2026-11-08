/**
 * en - searchAnswers messages (server/src/search: parser explanations, period labels,
 * executor answers). Keys are prefixed 'searchAnswers.'; see shared/i18n/index.ts for the syntax.
 *
 * Every sentence that names a metric receives it as `{metric, select, ...}` with the
 * metric key (mood, energy, stress, sleepHours, sleepQuality, exerciseMinutes): write
 * the metric's name inside each branch in the form your language needs there (gender,
 * case, article), and keep the `other` branch as a neutral fallback. `{period}` is a
 * ready phrase ("in the last month", "across the whole diary") that follows the sentence;
 * `{days}`, `{terms}` and `{emotions}` are ready lists; `{comparison}` is a rendered
 * comparator ("less than 5"); `{first}` / `{last}` are full dates.
 */
const messages: Record<string, string> = {
  // Period labels (ParsedQuery.periodLabel and the {period} of every sentence) --------
  'searchAnswers.period.all': 'all time',
  'searchAnswers.period.allPhrase': 'across the whole diary',
  'searchAnswers.period.today': 'today',
  'searchAnswers.period.yesterday': 'yesterday',
  'searchAnswers.period.twoDaysAgo': 'the day before yesterday',
  'searchAnswers.period.week': 'in the last week',
  'searchAnswers.period.month': 'in the last month',
  'searchAnswers.period.halfYear': 'in the last six months',
  'searchAnswers.period.year': 'in the last year',
  'searchAnswers.period.startYear': 'since the start of the year',
  'searchAnswers.period.startMonth': 'since the start of the month',
  'searchAnswers.period.recent': 'in recent days',
  'searchAnswers.period.lastDays': '{count, plural, one {today} other {in the last # days}}',
  'searchAnswers.period.lastWeeks': '{count, plural, one {in the last week} other {in the last # weeks}}',
  'searchAnswers.period.lastMonths': '{count, plural, one {in the last month} other {in the last # months}}',
  'searchAnswers.period.lastYears': '{count, plural, one {in the last year} other {in the last # years}}',
  'searchAnswers.period.agoDays': '{count, plural, one {a day ago} other {# days ago}}',
  'searchAnswers.period.agoWeeks': '{count, plural, one {a week ago} other {# weeks ago}}',
  'searchAnswers.period.agoMonths': '{count, plural, one {a month ago} other {# months ago}}',
  'searchAnswers.period.agoYears': '{count, plural, one {a year ago} other {# years ago}}',
  'searchAnswers.period.calendarMonth': 'in {month} {year}',
  'searchAnswers.period.onDate': 'on {date}',
  'searchAnswers.period.between': 'between {from} and {to}',

  // Comparators ("less than 5") ------------------------------------------------------
  'searchAnswers.comparator.lt': 'less than {value}',
  'searchAnswers.comparator.lte': 'at most {value}',
  'searchAnswers.comparator.gt': 'more than {value}',
  'searchAnswers.comparator.gte': 'at least {value}',
  'searchAnswers.comparator.eq': 'exactly {value}',

  // Lists and quoting ----------------------------------------------------------------
  'searchAnswers.quoted': '"{term}"',
  'searchAnswers.listSeparator': ', ',
  'searchAnswers.dayWithValues': '{day} ({values})',
  'searchAnswers.value.mood': 'mood {value}',
  'searchAnswers.value.energy': 'energy {value}',
  'searchAnswers.value.stress': 'stress {value}',
  'searchAnswers.value.sleepHours': 'sleep hours {value}',
  'searchAnswers.value.sleepQuality': 'sleep quality {value}',
  'searchAnswers.value.exerciseMinutes': 'exercise minutes {value}',
  'searchAnswers.mention.something': 'something',

  // "How I understood the question" (ParsedQuery.explanation) ------------------------
  'searchAnswers.explain.best': 'Understood: the days you felt best, {period}.',
  'searchAnswers.explain.bestByMetric':
    'Understood: the days you felt best by {metric, select, mood {mood} energy {energy level} stress {stress level} sleepHours {sleep hours} sleepQuality {sleep quality} exerciseMinutes {exercise minutes} other {value}}, {period}.',
  'searchAnswers.explain.worst': 'Understood: the hardest days, {period}.',
  'searchAnswers.explain.worstByMetric':
    'Understood: the hardest days by {metric, select, mood {mood} energy {energy level} stress {stress level} sleepHours {sleep hours} sleepQuality {sleep quality} exerciseMinutes {exercise minutes} other {value}}, {period}.',
  'searchAnswers.explain.filter':
    'Understood: days with {metric, select, mood {mood} energy {energy level} stress {stress level} sleepHours {sleep hours} sleepQuality {sleep quality} exerciseMinutes {exercise minutes} other {a value}} {comparison}, {period}.',
  'searchAnswers.explain.trend':
    'Understood: how your {metric, select, mood {mood} energy {energy level} stress {stress level} sleepHours {sleep hours} sleepQuality {sleep quality} exerciseMinutes {exercise minutes} other {values}} changed, {period}.',
  'searchAnswers.explain.mention': 'Understood: entries where you wrote {terms}, {period}.',
  'searchAnswers.explain.mentionAny': 'Understood: entries you wrote, {period}.',
  'searchAnswers.explain.emotion': 'Understood: days you felt {emotions}, {period}.',
  'searchAnswers.explain.list': 'Understood: entries containing {terms}, {period}.',
  'searchAnswers.explain.listAll': 'Understood: all entries, {period}.',
  'searchAnswers.explain.unknown': 'I could not understand the question. You can ask, for example: "Which days last month did I feel best?"',

  // Answers ---------------------------------------------------------------------------
  'searchAnswers.noResults': 'I found no entries matching the question.',
  'searchAnswers.noResultsPeriod': 'I found no entries matching the question {period}.',
  'searchAnswers.rank.best': 'The days you felt best {period}: {days}.',
  'searchAnswers.rank.bestByMetric':
    'The days you felt best by {metric, select, mood {mood} energy {energy level} stress {stress level} sleepHours {sleep hours} sleepQuality {sleep quality} exerciseMinutes {exercise minutes} other {value}} {period}: {days}.',
  'searchAnswers.rank.worst': 'The hardest days {period}: {days}.',
  'searchAnswers.rank.worstByMetric':
    'The hardest days by {metric, select, mood {mood} energy {energy level} stress {stress level} sleepHours {sleep hours} sleepQuality {sleep quality} exerciseMinutes {exercise minutes} other {value}} {period}: {days}.',
  'searchAnswers.filter.found':
    'I found {count, plural, one {# day} other {# days}} with {metric, select, mood {mood} energy {energy level} stress {stress level} sleepHours {sleep hours} sleepQuality {sleep quality} exerciseMinutes {exercise minutes} other {a value}} {comparison} {period}: {days}{more, plural, =0 {} one { and # more day} other { and # more days}}.',
  'searchAnswers.emotion.found':
    'You felt {emotions} on {count, plural, one {# day} other {# days}} {period}: {days}{more, plural, =0 {} one { and # more day} other { and # more days}}.',
  'searchAnswers.mention.found':
    'You wrote {terms} in {count, plural, one {# entry {period}, on {first}} other {# entries {period}; the first on {first} and the last on {last}}}.',
  'searchAnswers.list.found': 'I found {count, plural, one {# entry} other {# entries}} {period}; the latest on {last}.',
  'searchAnswers.list.foundTerms':
    'I found {count, plural, one {# entry containing} other {# entries containing}} {terms} {period}; the latest on {last}.',
  'searchAnswers.unknown.fallback':
    'I was not sure what the question was, so here {count, plural, one {is the latest entry} other {are the latest # entries}} out of {total}. {explanation}',
  'searchAnswers.trend.insufficient':
    'There is not enough data to detect a trend in your {metric, select, mood {mood} energy {energy level} stress {stress level} sleepHours {sleep hours} sleepQuality {sleep quality} exerciseMinutes {exercise minutes} other {values}} {period}.',
  'searchAnswers.trend.evidence':
    '(based on {first, plural, one {# day} other {# days}} at the start of the period versus {last, plural, one {# day} other {# days}} at the end)',
  'searchAnswers.trend.stable':
    'Your average {metric, select, mood {mood} energy {energy level} stress {stress level} sleepHours {sleep hours} sleepQuality {sleep quality} exerciseMinutes {exercise minutes} other {value}} stayed stable {period}: {from} versus {to} {evidence}.',
  'searchAnswers.trend.up':
    'Your average {metric, select, mood {mood} energy {energy level} stress {stress level} sleepHours {sleep hours} sleepQuality {sleep quality} exerciseMinutes {exercise minutes} other {value}} rose from {from} to {to} {period} {evidence}.',
  'searchAnswers.trend.down':
    'Your average {metric, select, mood {mood} energy {energy level} stress {stress level} sleepHours {sleep hours} sleepQuality {sleep quality} exerciseMinutes {exercise minutes} other {value}} fell from {from} to {to} {period} {evidence}.',

  // Request validation (POST /api/search) ----------------------------------------------
  'searchAnswers.validation.body': 'The request body must contain a question (query)',
  'searchAnswers.validation.query': 'Enter a question',
  'searchAnswers.validation.queryTooLong': 'The question is too long (up to {max} characters)',
  'searchAnswers.validation.limit': 'The number of results must be a whole number between 1 and {max}',
};
export default messages;
