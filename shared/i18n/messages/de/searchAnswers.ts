/**
 * de - searchAnswers messages (server/src/search: parser explanations, period labels,
 * executor answers). Keys are prefixed 'searchAnswers.'; see shared/i18n/index.ts for the syntax
 * and the English file for the parameters.
 *
 * German notes: `{period}` is an adverbial ("im letzten Monat", "im gesamten Tagebuch") and is
 * placed inside the clause; emotion labels are capitalised nouns/adjectives from the picker, so
 * they are introduced as "das Gefühl {emotions}". 'noResultsPeriod' starts with the exact text of
 * 'noResults' (without the full stop): noResultsPrefix() relies on it.
 */
const messages: Record<string, string> = {
  // Period labels (ParsedQuery.periodLabel and the {period} of every sentence) --------
  'searchAnswers.period.all': 'gesamter Zeitraum',
  'searchAnswers.period.allPhrase': 'im gesamten Tagebuch',
  'searchAnswers.period.today': 'heute',
  'searchAnswers.period.yesterday': 'gestern',
  'searchAnswers.period.twoDaysAgo': 'vorgestern',
  'searchAnswers.period.week': 'in der letzten Woche',
  'searchAnswers.period.month': 'im letzten Monat',
  'searchAnswers.period.halfYear': 'im letzten halben Jahr',
  'searchAnswers.period.year': 'im letzten Jahr',
  'searchAnswers.period.startYear': 'seit Jahresbeginn',
  'searchAnswers.period.startMonth': 'seit Monatsbeginn',
  'searchAnswers.period.recent': 'in den letzten Tagen',
  'searchAnswers.period.lastDays': '{count, plural, one {heute} other {in den letzten # Tagen}}',
  'searchAnswers.period.lastWeeks': '{count, plural, one {in der letzten Woche} other {in den letzten # Wochen}}',
  'searchAnswers.period.lastMonths': '{count, plural, one {im letzten Monat} other {in den letzten # Monaten}}',
  'searchAnswers.period.lastYears': '{count, plural, one {im letzten Jahr} other {in den letzten # Jahren}}',
  'searchAnswers.period.agoDays': '{count, plural, one {vor einem Tag} other {vor # Tagen}}',
  'searchAnswers.period.agoWeeks': '{count, plural, one {vor einer Woche} other {vor # Wochen}}',
  'searchAnswers.period.agoMonths': '{count, plural, one {vor einem Monat} other {vor # Monaten}}',
  'searchAnswers.period.agoYears': '{count, plural, one {vor einem Jahr} other {vor # Jahren}}',
  'searchAnswers.period.calendarMonth': 'im {month} {year}',
  'searchAnswers.period.onDate': 'am {date}',
  'searchAnswers.period.between': 'zwischen {from} und {to}',

  // Comparators ("less than 5") ------------------------------------------------------
  'searchAnswers.comparator.lt': 'weniger als {value}',
  'searchAnswers.comparator.lte': 'höchstens {value}',
  'searchAnswers.comparator.gt': 'mehr als {value}',
  'searchAnswers.comparator.gte': 'mindestens {value}',
  'searchAnswers.comparator.eq': 'genau {value}',

  // Lists and quoting ----------------------------------------------------------------
  'searchAnswers.quoted': '„{term}“',
  'searchAnswers.listSeparator': ', ',
  'searchAnswers.dayWithValues': '{day} ({values})',
  'searchAnswers.value.mood': 'Stimmung {value}',
  'searchAnswers.value.energy': 'Energie {value}',
  'searchAnswers.value.stress': 'Stress {value}',
  'searchAnswers.value.sleepHours': 'Schlafstunden {value}',
  'searchAnswers.value.sleepQuality': 'Schlafqualität {value}',
  'searchAnswers.value.exerciseMinutes': 'Sportminuten {value}',
  'searchAnswers.mention.something': 'etwas',

  // "How I understood the question" (ParsedQuery.explanation) ------------------------
  'searchAnswers.explain.best': 'Verstanden: die Tage, an denen du dich am besten gefühlt hast, {period}.',
  'searchAnswers.explain.bestByMetric':
    'Verstanden: die besten Tage nach {metric, select, mood {Stimmung} energy {Energielevel} stress {Stresslevel} sleepHours {Schlafstunden} sleepQuality {Schlafqualität} exerciseMinutes {Sportminuten} other {Wert}}, {period}.',
  'searchAnswers.explain.worst': 'Verstanden: die schwierigsten Tage, {period}.',
  'searchAnswers.explain.worstByMetric':
    'Verstanden: die schwierigsten Tage nach {metric, select, mood {Stimmung} energy {Energielevel} stress {Stresslevel} sleepHours {Schlafstunden} sleepQuality {Schlafqualität} exerciseMinutes {Sportminuten} other {Wert}}, {period}.',
  'searchAnswers.explain.filter':
    'Verstanden: Tage mit {metric, select, mood {einer Stimmung von {comparison}} energy {einem Energielevel von {comparison}} stress {einem Stresslevel von {comparison}} sleepHours {{comparison} Stunden Schlaf} sleepQuality {einer Schlafqualität von {comparison}} exerciseMinutes {{comparison} Minuten Sport} other {einem Wert von {comparison}}}, {period}.',
  'searchAnswers.explain.trend':
    'Verstanden: die Entwicklung {metric, select, mood {deiner Stimmung} energy {deines Energielevels} stress {deines Stresslevels} sleepHours {deiner Schlafdauer} sleepQuality {deiner Schlafqualität} exerciseMinutes {deiner Sportdauer} other {deiner Werte}}, {period}.',
  'searchAnswers.explain.mention': 'Verstanden: Einträge, in denen du {terms} geschrieben hast, {period}.',
  'searchAnswers.explain.mentionAny': 'Verstanden: Einträge, die du geschrieben hast, {period}.',
  'searchAnswers.explain.emotion': 'Verstanden: Tage mit dem Gefühl {emotions}, {period}.',
  'searchAnswers.explain.list': 'Verstanden: Einträge, die {terms} enthalten, {period}.',
  'searchAnswers.explain.listAll': 'Verstanden: alle Einträge, {period}.',
  'searchAnswers.explain.unknown': 'Ich konnte die Frage nicht verstehen. Du kannst zum Beispiel fragen: „An welchen Tagen im letzten Monat habe ich mich am besten gefühlt?“',

  // Answers ---------------------------------------------------------------------------
  'searchAnswers.noResults': 'Ich habe keine passenden Einträge gefunden.',
  'searchAnswers.noResultsPeriod': 'Ich habe keine passenden Einträge gefunden ({period}).',
  'searchAnswers.rank.best': 'Die Tage, an denen du dich {period} am besten gefühlt hast: {days}.',
  'searchAnswers.rank.bestByMetric':
    'Die besten Tage nach {metric, select, mood {Stimmung} energy {Energielevel} stress {Stresslevel} sleepHours {Schlafstunden} sleepQuality {Schlafqualität} exerciseMinutes {Sportminuten} other {Wert}} {period}: {days}.',
  'searchAnswers.rank.worst': 'Die schwierigsten Tage {period}: {days}.',
  'searchAnswers.rank.worstByMetric':
    'Die schwierigsten Tage nach {metric, select, mood {Stimmung} energy {Energielevel} stress {Stresslevel} sleepHours {Schlafstunden} sleepQuality {Schlafqualität} exerciseMinutes {Sportminuten} other {Wert}} {period}: {days}.',
  'searchAnswers.filter.found':
    'Ich habe {period} {count, plural, one {# Tag} other {# Tage}} mit {metric, select, mood {einer Stimmung von {comparison}} energy {einem Energielevel von {comparison}} stress {einem Stresslevel von {comparison}} sleepHours {{comparison} Stunden Schlaf} sleepQuality {einer Schlafqualität von {comparison}} exerciseMinutes {{comparison} Minuten Sport} other {einem Wert von {comparison}}} gefunden: {days}{more, plural, =0 {} one { und # weiteren Tag} other { und # weitere Tage}}.',
  'searchAnswers.emotion.found':
    'Das Gefühl {emotions} hast du {period} an {count, plural, one {# Tag} other {# Tagen}} angegeben: {days}{more, plural, =0 {} one { und an # weiteren Tag} other { und an # weiteren Tagen}}.',
  'searchAnswers.mention.found':
    'Du hast {terms} {count, plural, one {in # Eintrag {period} geschrieben, am {first}} other {in # Einträgen {period} geschrieben; zuerst am {first} und zuletzt am {last}}}.',
  'searchAnswers.list.found': 'Ich habe {period} {count, plural, one {# Eintrag} other {# Einträge}} gefunden; der neueste ist vom {last}.',
  'searchAnswers.list.foundTerms':
    'Ich habe {period} {count, plural, one {# Eintrag} other {# Einträge}} mit {terms} gefunden; der neueste ist vom {last}.',
  'searchAnswers.unknown.fallback':
    'Ich war mir nicht sicher, was gemeint ist, deshalb {count, plural, one {hier der neueste Eintrag} other {hier die neuesten # Einträge}} von insgesamt {total}. {explanation}',
  'searchAnswers.trend.insufficient':
    'Es gibt nicht genug Daten, um {period} einen Trend {metric, select, mood {deiner Stimmung} energy {deines Energielevels} stress {deines Stresslevels} sleepHours {deiner Schlafdauer} sleepQuality {deiner Schlafqualität} exerciseMinutes {deiner Sportdauer} other {deiner Werte}} zu erkennen.',
  'searchAnswers.trend.evidence':
    '(auf Grundlage von {first, plural, one {# Tag} other {# Tagen}} am Anfang des Zeitraums gegenüber {last, plural, one {# Tag} other {# Tagen}} am Ende)',
  'searchAnswers.trend.stable':
    '{metric, select, mood {Deine durchschnittliche Stimmung blieb} energy {Dein durchschnittliches Energielevel blieb} stress {Dein durchschnittliches Stresslevel blieb} sleepHours {Deine durchschnittliche Schlafdauer blieb} sleepQuality {Deine durchschnittliche Schlafqualität blieb} exerciseMinutes {Deine durchschnittliche Sportdauer blieb} other {Dein Durchschnittswert blieb}} {period} stabil: {from} gegenüber {to} {evidence}.',
  'searchAnswers.trend.up':
    '{metric, select, mood {Deine durchschnittliche Stimmung stieg} energy {Dein durchschnittliches Energielevel stieg} stress {Dein durchschnittliches Stresslevel stieg} sleepHours {Deine durchschnittliche Schlafdauer stieg} sleepQuality {Deine durchschnittliche Schlafqualität stieg} exerciseMinutes {Deine durchschnittliche Sportdauer stieg} other {Dein Durchschnittswert stieg}} {period} von {from} auf {to} {evidence}.',
  'searchAnswers.trend.down':
    '{metric, select, mood {Deine durchschnittliche Stimmung sank} energy {Dein durchschnittliches Energielevel sank} stress {Dein durchschnittliches Stresslevel sank} sleepHours {Deine durchschnittliche Schlafdauer sank} sleepQuality {Deine durchschnittliche Schlafqualität sank} exerciseMinutes {Deine durchschnittliche Sportdauer sank} other {Dein Durchschnittswert sank}} {period} von {from} auf {to} {evidence}.',

  // Request validation (POST /api/search) ----------------------------------------------
  'searchAnswers.validation.body': 'Der Inhalt der Anfrage muss eine Frage (query) enthalten',
  'searchAnswers.validation.query': 'Gib eine Frage ein',
  'searchAnswers.validation.queryTooLong': 'Die Frage ist zu lang (höchstens {max} Zeichen)',
  'searchAnswers.validation.limit': 'Die Anzahl der Ergebnisse muss eine ganze Zahl zwischen 1 und {max} sein',
};
export default messages;
