/**
 * it - searchAnswers messages (server/src/search: parser explanations, period labels,
 * executor answers). Keys are prefixed 'searchAnswers.'; see shared/i18n/index.ts for the syntax.
 *
 * Note per l'italiano: il comparatore ("meno di 5", "almeno 8") sta dentro i rami della
 * metrica, così ogni metrica ha la sua costruzione naturale ("i giorni con meno di 5 ore di
 * sonno", "i giorni in cui hai valutato l'umore meno di 5") e l'accordo del verbo resta
 * corretto ("è cambiata la qualità", "sono salite le ore").
 */
const messages: Record<string, string> = {
  // Period labels (ParsedQuery.periodLabel and the {period} of every sentence) --------
  'searchAnswers.period.all': 'tutto il periodo',
  'searchAnswers.period.allPhrase': 'in tutto il diario',
  'searchAnswers.period.today': 'oggi',
  'searchAnswers.period.yesterday': 'ieri',
  'searchAnswers.period.twoDaysAgo': 'l’altro ieri',
  'searchAnswers.period.week': 'nell’ultima settimana',
  'searchAnswers.period.month': 'nell’ultimo mese',
  'searchAnswers.period.halfYear': 'negli ultimi sei mesi',
  'searchAnswers.period.year': 'nell’ultimo anno',
  'searchAnswers.period.startYear': 'dall’inizio dell’anno',
  'searchAnswers.period.startMonth': 'dall’inizio del mese',
  'searchAnswers.period.recent': 'negli ultimi giorni',
  'searchAnswers.period.lastDays': '{count, plural, one {oggi} other {negli ultimi # giorni}}',
  'searchAnswers.period.lastWeeks': '{count, plural, one {nell’ultima settimana} other {nelle ultime # settimane}}',
  'searchAnswers.period.lastMonths': '{count, plural, one {nell’ultimo mese} other {negli ultimi # mesi}}',
  'searchAnswers.period.lastYears': '{count, plural, one {nell’ultimo anno} other {negli ultimi # anni}}',
  'searchAnswers.period.agoDays': '{count, plural, one {un giorno fa} other {# giorni fa}}',
  'searchAnswers.period.agoWeeks': '{count, plural, one {una settimana fa} other {# settimane fa}}',
  'searchAnswers.period.agoMonths': '{count, plural, one {un mese fa} other {# mesi fa}}',
  'searchAnswers.period.agoYears': '{count, plural, one {un anno fa} other {# anni fa}}',
  'searchAnswers.period.calendarMonth': 'in {month} {year}',
  'searchAnswers.period.onDate': 'il {date}',
  'searchAnswers.period.between': 'tra il {from} e il {to}',

  // Comparators ("less than 5") ------------------------------------------------------
  'searchAnswers.comparator.lt': 'meno di {value}',
  'searchAnswers.comparator.lte': 'al massimo {value}',
  'searchAnswers.comparator.gt': 'più di {value}',
  'searchAnswers.comparator.gte': 'almeno {value}',
  'searchAnswers.comparator.eq': 'esattamente {value}',

  // Lists and quoting ----------------------------------------------------------------
  'searchAnswers.quoted': '“{term}”',
  'searchAnswers.listSeparator': ', ',
  'searchAnswers.dayWithValues': '{day} ({values})',
  'searchAnswers.value.mood': 'umore {value}',
  'searchAnswers.value.energy': 'energia {value}',
  'searchAnswers.value.stress': 'stress {value}',
  'searchAnswers.value.sleepHours': 'ore di sonno {value}',
  'searchAnswers.value.sleepQuality': 'qualità del sonno {value}',
  'searchAnswers.value.exerciseMinutes': 'minuti di attività fisica {value}',
  'searchAnswers.mention.something': 'qualcosa',

  // "How I understood the question" (ParsedQuery.explanation) ------------------------
  'searchAnswers.explain.best': 'Ho capito: i giorni in cui stavi meglio, {period}.',
  'searchAnswers.explain.bestByMetric':
    'Ho capito: i giorni migliori per {metric, select, mood {umore} energy {livello di energia} stress {livello di stress} sleepHours {ore di sonno} sleepQuality {qualità del sonno} exerciseMinutes {minuti di attività fisica} other {valore}}, {period}.',
  'searchAnswers.explain.worst': 'Ho capito: i giorni più difficili, {period}.',
  'searchAnswers.explain.worstByMetric':
    'Ho capito: i giorni più difficili per {metric, select, mood {umore} energy {livello di energia} stress {livello di stress} sleepHours {ore di sonno} sleepQuality {qualità del sonno} exerciseMinutes {minuti di attività fisica} other {valore}}, {period}.',
  'searchAnswers.explain.filter':
    'Ho capito: {metric, select, mood {i giorni in cui hai valutato l’umore {comparison}} energy {i giorni in cui hai valutato l’energia {comparison}} stress {i giorni in cui hai valutato lo stress {comparison}} sleepHours {i giorni con {comparison} ore di sonno} sleepQuality {i giorni in cui hai valutato la qualità del sonno {comparison}} exerciseMinutes {i giorni con {comparison} minuti di attività fisica} other {i giorni con un valore di {comparison}}}, {period}.',
  'searchAnswers.explain.trend':
    'Ho capito: {metric, select, mood {come è cambiato il tuo umore} energy {come è cambiato il tuo livello di energia} stress {come è cambiato il tuo livello di stress} sleepHours {come sono cambiate le tue ore di sonno} sleepQuality {come è cambiata la qualità del tuo sonno} exerciseMinutes {come sono cambiati i tuoi minuti di attività fisica} other {come sono cambiati i valori}}, {period}.',
  'searchAnswers.explain.mention': 'Ho capito: le voci in cui hai scritto {terms}, {period}.',
  'searchAnswers.explain.mentionAny': 'Ho capito: le voci che hai scritto, {period}.',
  'searchAnswers.explain.emotion': 'Ho capito: i giorni con l’emozione {emotions}, {period}.',
  'searchAnswers.explain.list': 'Ho capito: le voci che contengono {terms}, {period}.',
  'searchAnswers.explain.listAll': 'Ho capito: tutte le voci, {period}.',
  'searchAnswers.explain.unknown': 'Non ho capito la domanda. Puoi chiedere, per esempio: “In quali giorni del mese scorso stavo meglio?”',

  // Answers ---------------------------------------------------------------------------
  'searchAnswers.noResults': 'Non ho trovato voci che corrispondano alla domanda.',
  'searchAnswers.noResultsPeriod': 'Non ho trovato voci che corrispondano alla domanda {period}.',
  'searchAnswers.rank.best': 'I giorni in cui stavi meglio {period}: {days}.',
  'searchAnswers.rank.bestByMetric':
    'I giorni migliori per {metric, select, mood {umore} energy {livello di energia} stress {livello di stress} sleepHours {ore di sonno} sleepQuality {qualità del sonno} exerciseMinutes {minuti di attività fisica} other {valore}} {period}: {days}.',
  'searchAnswers.rank.worst': 'I giorni più difficili {period}: {days}.',
  'searchAnswers.rank.worstByMetric':
    'I giorni più difficili per {metric, select, mood {umore} energy {livello di energia} stress {livello di stress} sleepHours {ore di sonno} sleepQuality {qualità del sonno} exerciseMinutes {minuti di attività fisica} other {valore}} {period}: {days}.',
  'searchAnswers.filter.found':
    'Ho trovato {count, plural, one {# giorno} other {# giorni}} {metric, select, mood {in cui hai valutato l’umore {comparison}} energy {in cui hai valutato l’energia {comparison}} stress {in cui hai valutato lo stress {comparison}} sleepHours {con {comparison} ore di sonno} sleepQuality {in cui hai valutato la qualità del sonno {comparison}} exerciseMinutes {con {comparison} minuti di attività fisica} other {con un valore di {comparison}}} {period}: {days}{more, plural, =0 {} one { e # altro giorno} other { e altri # giorni}}.',
  'searchAnswers.emotion.found':
    'Hai registrato l’emozione {emotions} in {count, plural, one {# giorno} other {# giorni}} {period}: {days}{more, plural, =0 {} one { e # altro giorno} other { e altri # giorni}}.',
  'searchAnswers.mention.found':
    'Hai scritto {terms} in {count, plural, one {# voce {period}, datata {first}} other {# voci {period} (la prima: {first}; l’ultima: {last})}}.',
  'searchAnswers.list.found': 'Ho trovato {count, plural, one {# voce} other {# voci}} {period}; la più recente: {last}.',
  'searchAnswers.list.foundTerms':
    'Ho trovato {count, plural, one {# voce che contiene} other {# voci che contengono}} {terms} {period}; la più recente: {last}.',
  'searchAnswers.unknown.fallback':
    'La domanda non era del tutto chiara, quindi ecco {count, plural, one {l’ultima voce} other {le ultime # voci}} su {total}. {explanation}',
  'searchAnswers.trend.insufficient':
    'Non ci sono abbastanza dati per individuare una tendenza {metric, select, mood {del tuo umore} energy {del tuo livello di energia} stress {del tuo livello di stress} sleepHours {delle tue ore di sonno} sleepQuality {della qualità del tuo sonno} exerciseMinutes {dei tuoi minuti di attività fisica} other {dei valori}} {period}.',
  'searchAnswers.trend.evidence':
    '(in base a {first, plural, one {# giorno} other {# giorni}} all’inizio del periodo e a {last, plural, one {# giorno} other {# giorni}} alla fine)',
  'searchAnswers.trend.stable':
    '{metric, select, mood {Il tuo umore medio è rimasto stabile} energy {Il tuo livello di energia medio è rimasto stabile} stress {Il tuo livello di stress medio è rimasto stabile} sleepHours {Le tue ore di sonno medie sono rimaste stabili} sleepQuality {La qualità media del tuo sonno è rimasta stabile} exerciseMinutes {I tuoi minuti medi di attività fisica sono rimasti stabili} other {Il valore medio è rimasto stabile}} {period}: {from} contro {to} {evidence}.',
  'searchAnswers.trend.up':
    '{metric, select, mood {Il tuo umore medio è salito} energy {Il tuo livello di energia medio è salito} stress {Il tuo livello di stress medio è salito} sleepHours {Le tue ore di sonno medie sono salite} sleepQuality {La qualità media del tuo sonno è salita} exerciseMinutes {I tuoi minuti medi di attività fisica sono saliti} other {Il valore medio è salito}} da {from} a {to} {period} {evidence}.',
  'searchAnswers.trend.down':
    '{metric, select, mood {Il tuo umore medio è sceso} energy {Il tuo livello di energia medio è sceso} stress {Il tuo livello di stress medio è sceso} sleepHours {Le tue ore di sonno medie sono scese} sleepQuality {La qualità media del tuo sonno è scesa} exerciseMinutes {I tuoi minuti medi di attività fisica sono scesi} other {Il valore medio è sceso}} da {from} a {to} {period} {evidence}.',

  // Request validation (POST /api/search) ----------------------------------------------
  'searchAnswers.validation.body': 'Il corpo della richiesta deve contenere una domanda (query)',
  'searchAnswers.validation.query': 'Inserisci una domanda',
  'searchAnswers.validation.queryTooLong': 'La domanda è troppo lunga (massimo {max} caratteri)',
  'searchAnswers.validation.limit': 'Il numero di risultati deve essere un numero intero tra 1 e {max}',
};
export default messages;
