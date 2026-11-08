/**
 * cs - searchAnswers messages (server/src/search: parser explanations, period labels,
 * executor answers). Keys are prefixed 'searchAnswers.'; see shared/i18n/index.ts for the syntax.
 *
 * Czech notes: `{period}` is a ready phrase ("za poslední měsíc", "v celém deníku") and always
 * stands after the verb; the metric branches carry the case each sentence needs ("podle úrovně
 * stresu", "byla nálada"); the month of 'period.calendarMonth' is selected by its nominative name
 * to get the locative ("v červenci 2026"). Answers avoid gendered past forms ("Našlo se…",
 * "se objevuje") because the user's gender is unknown.
 */
const messages: Record<string, string> = {
  // Period labels (ParsedQuery.periodLabel and the {period} of every sentence) --------
  'searchAnswers.period.all': 'celé období',
  'searchAnswers.period.allPhrase': 'v celém deníku',
  'searchAnswers.period.today': 'dnes',
  'searchAnswers.period.yesterday': 'včera',
  'searchAnswers.period.twoDaysAgo': 'předevčírem',
  'searchAnswers.period.week': 'za poslední týden',
  'searchAnswers.period.month': 'za poslední měsíc',
  'searchAnswers.period.halfYear': 'za posledních šest měsíců',
  'searchAnswers.period.year': 'za poslední rok',
  'searchAnswers.period.startYear': 'od začátku roku',
  'searchAnswers.period.startMonth': 'od začátku měsíce',
  'searchAnswers.period.recent': 'v posledních dnech',
  'searchAnswers.period.lastDays':
    '{count, plural, one {dnes} few {za poslední # dny} many {za posledních # dne} other {za posledních # dní}}',
  'searchAnswers.period.lastWeeks':
    '{count, plural, one {za poslední týden} few {za poslední # týdny} many {za posledních # týdne} other {za posledních # týdnů}}',
  'searchAnswers.period.lastMonths':
    '{count, plural, one {za poslední měsíc} few {za poslední # měsíce} many {za posledních # měsíce} other {za posledních # měsíců}}',
  'searchAnswers.period.lastYears':
    '{count, plural, one {za poslední rok} few {za poslední # roky} many {za posledních # roku} other {za posledních # let}}',
  'searchAnswers.period.agoDays': '{count, plural, one {před jedním dnem} few {před # dny} many {před # dne} other {před # dny}}',
  'searchAnswers.period.agoWeeks': '{count, plural, one {před týdnem} few {před # týdny} many {před # týdne} other {před # týdny}}',
  'searchAnswers.period.agoMonths': '{count, plural, one {před měsícem} few {před # měsíci} many {před # měsíce} other {před # měsíci}}',
  'searchAnswers.period.agoYears': '{count, plural, one {před rokem} few {před # lety} many {před # roku} other {před # lety}}',
  'searchAnswers.period.calendarMonth':
    '{month, select, leden {v lednu {year}} únor {v únoru {year}} březen {v březnu {year}} duben {v dubnu {year}} květen {v květnu {year}} červen {v červnu {year}} červenec {v červenci {year}} srpen {v srpnu {year}} září {v září {year}} říjen {v říjnu {year}} listopad {v listopadu {year}} prosinec {v prosinci {year}} other {v měsíci {month} {year}}}',
  'searchAnswers.period.onDate': 'dne {date}',
  'searchAnswers.period.between': 'od {from} do {to}',

  // Comparators ("méně než 5") ------------------------------------------------------
  'searchAnswers.comparator.lt': 'méně než {value}',
  'searchAnswers.comparator.lte': 'nejvýše {value}',
  'searchAnswers.comparator.gt': 'více než {value}',
  'searchAnswers.comparator.gte': 'alespoň {value}',
  'searchAnswers.comparator.eq': 'přesně {value}',

  // Lists and quoting ----------------------------------------------------------------
  'searchAnswers.quoted': '„{term}“',
  'searchAnswers.listSeparator': ', ',
  'searchAnswers.dayWithValues': '{day} ({values})',
  'searchAnswers.value.mood': 'nálada {value}',
  'searchAnswers.value.energy': 'energie {value}',
  'searchAnswers.value.stress': 'stres {value}',
  'searchAnswers.value.sleepHours': 'hodiny spánku {value}',
  'searchAnswers.value.sleepQuality': 'kvalita spánku {value}',
  'searchAnswers.value.exerciseMinutes': 'minuty cvičení {value}',
  'searchAnswers.mention.something': 'Nějaký text',

  // "How I understood the question" (ParsedQuery.explanation) ------------------------
  'searchAnswers.explain.best': 'Rozumím: nejlepší dny, {period}.',
  'searchAnswers.explain.bestByMetric':
    'Rozumím: nejlepší dny podle {metric, select, mood {tvé nálady} energy {úrovně energie} stress {úrovně stresu} sleepHours {hodin spánku} sleepQuality {kvality spánku} exerciseMinutes {minut cvičení} other {zadané hodnoty}}, {period}.',
  'searchAnswers.explain.worst': 'Rozumím: nejtěžší dny, {period}.',
  'searchAnswers.explain.worstByMetric':
    'Rozumím: nejtěžší dny podle {metric, select, mood {tvé nálady} energy {úrovně energie} stress {úrovně stresu} sleepHours {hodin spánku} sleepQuality {kvality spánku} exerciseMinutes {minut cvičení} other {zadané hodnoty}}, {period}.',
  'searchAnswers.explain.filter':
    'Rozumím: dny, kdy {metric, select, mood {byla nálada} energy {byla úroveň energie} stress {byla úroveň stresu} sleepHours {byl počet hodin spánku} sleepQuality {byla kvalita spánku} exerciseMinutes {byl počet minut cvičení} other {byla hodnota}} {comparison}, {period}.',
  'searchAnswers.explain.trend':
    'Rozumím: jak se {metric, select, mood {měnila tvoje nálada} energy {měnila tvoje úroveň energie} stress {měnila tvoje úroveň stresu} sleepHours {měnila délka tvého spánku} sleepQuality {měnila kvalita tvého spánku} exerciseMinutes {měnila délka tvého cvičení} other {měnily tvoje hodnoty}}, {period}.',
  'searchAnswers.explain.mention': 'Rozumím: záznamy, ve kterých se objevuje {terms}, {period}.',
  'searchAnswers.explain.mentionAny': 'Rozumím: tvoje záznamy, {period}.',
  'searchAnswers.explain.emotion': 'Rozumím: dny s emocí {emotions}, {period}.',
  'searchAnswers.explain.list': 'Rozumím: záznamy obsahující {terms}, {period}.',
  'searchAnswers.explain.listAll': 'Rozumím: všechny záznamy, {period}.',
  'searchAnswers.explain.unknown':
    'Otázce se nepodařilo porozumět. Můžeš se zeptat například: „Které dny za poslední měsíc byly nejlepší?“',

  // Answers ---------------------------------------------------------------------------
  'searchAnswers.noResults': 'Nenašly se žádné záznamy, které by odpovídaly otázce.',
  'searchAnswers.noResultsPeriod': 'Žádné záznamy odpovídající otázce se nenašly {period}.',
  'searchAnswers.rank.best': 'Nejlepší dny {period}: {days}.',
  'searchAnswers.rank.bestByMetric':
    'Nejlepší dny podle {metric, select, mood {tvé nálady} energy {úrovně energie} stress {úrovně stresu} sleepHours {hodin spánku} sleepQuality {kvality spánku} exerciseMinutes {minut cvičení} other {zadané hodnoty}} {period}: {days}.',
  'searchAnswers.rank.worst': 'Nejtěžší dny {period}: {days}.',
  'searchAnswers.rank.worstByMetric':
    'Nejtěžší dny podle {metric, select, mood {tvé nálady} energy {úrovně energie} stress {úrovně stresu} sleepHours {hodin spánku} sleepQuality {kvality spánku} exerciseMinutes {minut cvičení} other {zadané hodnoty}} {period}: {days}.',
  'searchAnswers.filter.found':
    '{count, plural, one {Našel se # den} few {Našly se # dny} many {Našlo se # dne} other {Našlo se # dní}}, kdy {metric, select, mood {byla nálada} energy {byla úroveň energie} stress {byla úroveň stresu} sleepHours {byl počet hodin spánku} sleepQuality {byla kvalita spánku} exerciseMinutes {byl počet minut cvičení} other {byla hodnota}} {comparison} – {period}: {days}{more, plural, =0 {} one { a # další den} few { a # další dny} many { a # dalšího dne} other { a # dalších dní}}.',
  'searchAnswers.emotion.found':
    'Emoce {emotions} se objevila {count, plural, one {v # dni} few {ve # dnech} many {v # dne} other {v # dnech}} {period}: {days}{more, plural, =0 {} one { a # další den} few { a # další dny} many { a # dalšího dne} other { a # dalších dní}}.',
  'searchAnswers.mention.found':
    '{terms} se objevuje {count, plural, one {v # záznamu {period}, dne {first}} few {ve # záznamech {period}; první dne {first}, poslední dne {last}} many {v # záznamu {period}; první dne {first}, poslední dne {last}} other {v # záznamech {period}; první dne {first}, poslední dne {last}}}.',
  'searchAnswers.list.found':
    '{count, plural, one {Našel se # záznam} few {Našly se # záznamy} many {Našlo se # záznamu} other {Našlo se # záznamů}} {period}; nejnovější dne {last}.',
  'searchAnswers.list.foundTerms':
    '{count, plural, one {Našel se # záznam obsahující} few {Našly se # záznamy obsahující} many {Našlo se # záznamu obsahujícího} other {Našlo se # záznamů obsahujících}} {terms} {period}; nejnovější dne {last}.',
  'searchAnswers.unknown.fallback':
    'Otázka nebyla úplně jasná, takže tady {count, plural, one {je nejnovější záznam} few {jsou # nejnovější záznamy} many {je # nejnovějšího záznamu} other {je # nejnovějších záznamů}} z celkových {total}. {explanation}',
  'searchAnswers.trend.insufficient':
    'Na rozpoznání trendu {metric, select, mood {tvé nálady} energy {tvé úrovně energie} stress {tvé úrovně stresu} sleepHours {délky tvého spánku} sleepQuality {kvality tvého spánku} exerciseMinutes {délky tvého cvičení} other {tvých hodnot}} {period} zatím není dost dat.',
  'searchAnswers.trend.evidence':
    '(na základě {first, plural, one {# dne} few {# dnů} many {# dne} other {# dnů}} na začátku období a {last, plural, one {# dne} few {# dnů} many {# dne} other {# dnů}} na konci)',
  'searchAnswers.trend.stable':
    '{metric, select, mood {Průměrná nálada zůstala} energy {Průměrná úroveň energie zůstala} stress {Průměrná úroveň stresu zůstala} sleepHours {Průměrná délka spánku zůstala} sleepQuality {Průměrná kvalita spánku zůstala} exerciseMinutes {Průměrná délka cvičení zůstala} other {Průměrná hodnota zůstala}} {period} stabilní: {from} oproti {to} {evidence}.',
  'searchAnswers.trend.up':
    '{metric, select, mood {Průměrná nálada vzrostla} energy {Průměrná úroveň energie vzrostla} stress {Průměrná úroveň stresu vzrostla} sleepHours {Průměrná délka spánku vzrostla} sleepQuality {Průměrná kvalita spánku vzrostla} exerciseMinutes {Průměrná délka cvičení vzrostla} other {Průměrná hodnota vzrostla}} {period} z {from} na {to} {evidence}.',
  'searchAnswers.trend.down':
    '{metric, select, mood {Průměrná nálada klesla} energy {Průměrná úroveň energie klesla} stress {Průměrná úroveň stresu klesla} sleepHours {Průměrná délka spánku klesla} sleepQuality {Průměrná kvalita spánku klesla} exerciseMinutes {Průměrná délka cvičení klesla} other {Průměrná hodnota klesla}} {period} z {from} na {to} {evidence}.',

  // Request validation (POST /api/search) ----------------------------------------------
  'searchAnswers.validation.body': 'Tělo požadavku musí obsahovat otázku (query)',
  'searchAnswers.validation.query': 'Napiš otázku',
  'searchAnswers.validation.queryTooLong': 'Otázka je příliš dlouhá (nejvýše {max} znaků)',
  'searchAnswers.validation.limit': 'Počet výsledků musí být celé číslo od 1 do {max}',
};
export default messages;
