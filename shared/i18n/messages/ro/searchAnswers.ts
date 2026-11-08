/**
 * ro - searchAnswers messages (server/src/search: parser explanations, period labels,
 * executor answers). Keys are prefixed 'searchAnswers.'; see shared/i18n/index.ts for the syntax
 * and the English file for the parameters.
 *
 * Romanian notes: counts use one / few / other ("# de zile" from 20 on); `{comparison}` arrives
 * preformatted ("mai puțin de 5"), so exercise minutes are written as "min" to avoid the missing
 * "de" ("mai mult de 30 min"). Emotion labels are capitalised nouns from the picker, so they are
 * introduced as "emoția {emotions}". 'noResultsPeriod' starts with the exact text of 'noResults'
 * (without the full stop): noResultsPrefix() relies on it.
 */
const messages: Record<string, string> = {
  // Period labels (ParsedQuery.periodLabel and the {period} of every sentence) --------
  'searchAnswers.period.all': 'toată perioada',
  'searchAnswers.period.allPhrase': 'în tot jurnalul',
  'searchAnswers.period.today': 'azi',
  'searchAnswers.period.yesterday': 'ieri',
  'searchAnswers.period.twoDaysAgo': 'alaltăieri',
  'searchAnswers.period.week': 'în ultima săptămână',
  'searchAnswers.period.month': 'în ultima lună',
  'searchAnswers.period.halfYear': 'în ultimele șase luni',
  'searchAnswers.period.year': 'în ultimul an',
  'searchAnswers.period.startYear': 'de la începutul anului',
  'searchAnswers.period.startMonth': 'de la începutul lunii',
  'searchAnswers.period.recent': 'în ultimele zile',
  'searchAnswers.period.lastDays': '{count, plural, one {azi} few {în ultimele # zile} other {în ultimele # de zile}}',
  'searchAnswers.period.lastWeeks': '{count, plural, one {în ultima săptămână} few {în ultimele # săptămâni} other {în ultimele # de săptămâni}}',
  'searchAnswers.period.lastMonths': '{count, plural, one {în ultima lună} few {în ultimele # luni} other {în ultimele # de luni}}',
  'searchAnswers.period.lastYears': '{count, plural, one {în ultimul an} few {în ultimii # ani} other {în ultimii # de ani}}',
  'searchAnswers.period.agoDays': '{count, plural, one {acum o zi} few {acum # zile} other {acum # de zile}}',
  'searchAnswers.period.agoWeeks': '{count, plural, one {acum o săptămână} few {acum # săptămâni} other {acum # de săptămâni}}',
  'searchAnswers.period.agoMonths': '{count, plural, one {acum o lună} few {acum # luni} other {acum # de luni}}',
  'searchAnswers.period.agoYears': '{count, plural, one {acum un an} few {acum # ani} other {acum # de ani}}',
  'searchAnswers.period.calendarMonth': 'în {month} {year}',
  'searchAnswers.period.onDate': 'pe {date}',
  'searchAnswers.period.between': 'între {from} și {to}',

  // Comparators ("less than 5") ------------------------------------------------------
  'searchAnswers.comparator.lt': 'mai puțin de {value}',
  'searchAnswers.comparator.lte': 'cel mult {value}',
  'searchAnswers.comparator.gt': 'mai mult de {value}',
  'searchAnswers.comparator.gte': 'cel puțin {value}',
  'searchAnswers.comparator.eq': 'exact {value}',

  // Lists and quoting ----------------------------------------------------------------
  'searchAnswers.quoted': '„{term}”',
  'searchAnswers.listSeparator': ', ',
  'searchAnswers.dayWithValues': '{day} ({values})',
  'searchAnswers.value.mood': 'dispoziție {value}',
  'searchAnswers.value.energy': 'energie {value}',
  'searchAnswers.value.stress': 'stres {value}',
  'searchAnswers.value.sleepHours': 'ore de somn {value}',
  'searchAnswers.value.sleepQuality': 'calitatea somnului {value}',
  'searchAnswers.value.exerciseMinutes': 'minute de sport {value}',
  'searchAnswers.mention.something': 'ceva',

  // "How I understood the question" (ParsedQuery.explanation) ------------------------
  'searchAnswers.explain.best': 'Am înțeles: zilele în care te-ai simțit cel mai bine, {period}.',
  'searchAnswers.explain.bestByMetric':
    'Am înțeles: cele mai bune zile după {metric, select, mood {dispoziție} energy {nivelul de energie} stress {nivelul de stres} sleepHours {orele de somn} sleepQuality {calitatea somnului} exerciseMinutes {minutele de sport} other {valoare}}, {period}.',
  'searchAnswers.explain.worst': 'Am înțeles: cele mai grele zile, {period}.',
  'searchAnswers.explain.worstByMetric':
    'Am înțeles: cele mai grele zile după {metric, select, mood {dispoziție} energy {nivelul de energie} stress {nivelul de stres} sleepHours {orele de somn} sleepQuality {calitatea somnului} exerciseMinutes {minutele de sport} other {valoare}}, {period}.',
  'searchAnswers.explain.filter':
    'Am înțeles: zilele în care {metric, select, mood {dispoziția a fost de {comparison}} energy {nivelul de energie a fost de {comparison}} stress {nivelul de stres a fost de {comparison}} sleepHours {ai dormit {comparison} ore} sleepQuality {calitatea somnului a fost de {comparison}} exerciseMinutes {ai făcut sport {comparison} min} other {valoarea a fost de {comparison}}}, {period}.',
  'searchAnswers.explain.trend':
    'Am înțeles: {metric, select, mood {cum s-a schimbat dispoziția ta} energy {cum s-a schimbat nivelul tău de energie} stress {cum s-a schimbat nivelul tău de stres} sleepHours {cum s-a schimbat durata somnului tău} sleepQuality {cum s-a schimbat calitatea somnului tău} exerciseMinutes {cum s-a schimbat durata activității tale fizice} other {cum s-au schimbat valorile tale}}, {period}.',
  'searchAnswers.explain.mention': 'Am înțeles: însemnările în care ai scris {terms}, {period}.',
  'searchAnswers.explain.mentionAny': 'Am înțeles: însemnările pe care le-ai scris, {period}.',
  'searchAnswers.explain.emotion': 'Am înțeles: zilele cu emoția {emotions}, {period}.',
  'searchAnswers.explain.list': 'Am înțeles: însemnările care conțin {terms}, {period}.',
  'searchAnswers.explain.listAll': 'Am înțeles: toate însemnările, {period}.',
  'searchAnswers.explain.unknown': 'Nu am reușit să înțeleg întrebarea. Poți întreba, de exemplu: „În ce zile din ultima lună m-am simțit cel mai bine?”',

  // Answers ---------------------------------------------------------------------------
  'searchAnswers.noResults': 'Nu am găsit nicio însemnare care să corespundă întrebării.',
  'searchAnswers.noResultsPeriod': 'Nu am găsit nicio însemnare care să corespundă întrebării {period}.',
  'searchAnswers.rank.best': 'Zilele în care te-ai simțit cel mai bine {period}: {days}.',
  'searchAnswers.rank.bestByMetric':
    'Cele mai bune zile după {metric, select, mood {dispoziție} energy {nivelul de energie} stress {nivelul de stres} sleepHours {orele de somn} sleepQuality {calitatea somnului} exerciseMinutes {minutele de sport} other {valoare}} {period}: {days}.',
  'searchAnswers.rank.worst': 'Cele mai grele zile {period}: {days}.',
  'searchAnswers.rank.worstByMetric':
    'Cele mai grele zile după {metric, select, mood {dispoziție} energy {nivelul de energie} stress {nivelul de stres} sleepHours {orele de somn} sleepQuality {calitatea somnului} exerciseMinutes {minutele de sport} other {valoare}} {period}: {days}.',
  'searchAnswers.filter.found':
    'Am găsit {period} {count, plural, one {o zi} few {# zile} other {# de zile}} în care {metric, select, mood {dispoziția a fost de {comparison}} energy {nivelul de energie a fost de {comparison}} stress {nivelul de stres a fost de {comparison}} sleepHours {ai dormit {comparison} ore} sleepQuality {calitatea somnului a fost de {comparison}} exerciseMinutes {ai făcut sport {comparison} min} other {valoarea a fost de {comparison}}}: {days}{more, plural, =0 {} one { și încă o zi} few { și încă # zile} other { și încă # de zile}}.',
  'searchAnswers.emotion.found':
    'Ai raportat emoția {emotions} în {count, plural, one {o zi} few {# zile} other {# de zile}} {period}: {days}{more, plural, =0 {} one { și încă o zi} few { și încă # zile} other { și încă # de zile}}.',
  'searchAnswers.mention.found':
    'Ai scris {terms} {count, plural, one {într-o însemnare {period} ({first})} few {în # însemnări {period} (prima: {first}; ultima: {last})} other {în # de însemnări {period} (prima: {first}; ultima: {last})}}.',
  'searchAnswers.list.found': 'Am găsit {count, plural, one {o însemnare} few {# însemnări} other {# de însemnări}} {period}; cea mai recentă: {last}.',
  'searchAnswers.list.foundTerms':
    'Am găsit {count, plural, one {o însemnare care conține} few {# însemnări care conțin} other {# de însemnări care conțin}} {terms} {period}; cea mai recentă: {last}.',
  'searchAnswers.unknown.fallback':
    'Nu am înțeles sigur întrebarea, așa că iată {count, plural, one {ultima însemnare} few {ultimele # însemnări} other {ultimele # de însemnări}} din {total}. {explanation}',
  'searchAnswers.trend.insufficient':
    'Nu există suficiente date pentru a detecta o tendință {metric, select, mood {a dispoziției tale} energy {a nivelului tău de energie} stress {a nivelului tău de stres} sleepHours {a duratei somnului tău} sleepQuality {a calității somnului tău} exerciseMinutes {a duratei activității tale fizice} other {a valorilor tale}} {period}.',
  'searchAnswers.trend.evidence':
    '(pe baza {first, plural, one {unei zile} few {a # zile} other {a # de zile}} de la începutul perioadei, față de {last, plural, one {o zi} few {# zile} other {# de zile}} de la sfârșit)',
  'searchAnswers.trend.stable':
    '{metric, select, mood {Dispoziția ta medie a rămas stabilă} energy {Nivelul tău mediu de energie a rămas stabil} stress {Nivelul tău mediu de stres a rămas stabil} sleepHours {Durata medie a somnului tău a rămas stabilă} sleepQuality {Calitatea medie a somnului tău a rămas stabilă} exerciseMinutes {Durata medie a activității tale fizice a rămas stabilă} other {Valoarea ta medie a rămas stabilă}} {period}: {from} față de {to} {evidence}.',
  'searchAnswers.trend.up':
    '{metric, select, mood {Dispoziția ta medie a crescut} energy {Nivelul tău mediu de energie a crescut} stress {Nivelul tău mediu de stres a crescut} sleepHours {Durata medie a somnului tău a crescut} sleepQuality {Calitatea medie a somnului tău a crescut} exerciseMinutes {Durata medie a activității tale fizice a crescut} other {Valoarea ta medie a crescut}} de la {from} la {to} {period} {evidence}.',
  'searchAnswers.trend.down':
    '{metric, select, mood {Dispoziția ta medie a scăzut} energy {Nivelul tău mediu de energie a scăzut} stress {Nivelul tău mediu de stres a scăzut} sleepHours {Durata medie a somnului tău a scăzut} sleepQuality {Calitatea medie a somnului tău a scăzut} exerciseMinutes {Durata medie a activității tale fizice a scăzut} other {Valoarea ta medie a scăzut}} de la {from} la {to} {period} {evidence}.',

  // Request validation (POST /api/search) ----------------------------------------------
  'searchAnswers.validation.body': 'Conținutul cererii trebuie să conțină o întrebare (query)',
  'searchAnswers.validation.query': 'Scrie o întrebare',
  'searchAnswers.validation.queryTooLong': 'Întrebarea este prea lungă (cel mult {max} caractere)',
  'searchAnswers.validation.limit': 'Numărul de rezultate trebuie să fie un număr întreg între 1 și {max}',
};
export default messages;
