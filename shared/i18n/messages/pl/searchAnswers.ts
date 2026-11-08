/**
 * pl - searchAnswers messages (server/src/search: parser explanations, period labels,
 * executor answers). Keys are prefixed 'searchAnswers.'; see shared/i18n/index.ts for the syntax.
 *
 * Polish notes: the app never speaks in a gendered past tense ("znalazłem/znalazłam"), so the
 * answers use impersonal forms ("Znaleziono", "Nie udało się"), the present tense ("Rozumiem")
 * or a subject that is not the user. `{period}` is a ready adverbial phrase ("w ostatnim miesiącu").
 * `{month}` in 'period.calendarMonth' is the nominative month name from Intl ("lipiec"); the select
 * turns it into the locative ("w lipcu") and falls back to "w miesiącu: …" for any other spelling.
 */
const messages: Record<string, string> = {
  // Period labels (ParsedQuery.periodLabel and the {period} of every sentence) --------
  'searchAnswers.period.all': 'cały okres',
  'searchAnswers.period.allPhrase': 'w całym dzienniku',
  'searchAnswers.period.today': 'dzisiaj',
  'searchAnswers.period.yesterday': 'wczoraj',
  'searchAnswers.period.twoDaysAgo': 'przedwczoraj',
  'searchAnswers.period.week': 'w ostatnim tygodniu',
  'searchAnswers.period.month': 'w ostatnim miesiącu',
  'searchAnswers.period.halfYear': 'w ostatnich sześciu miesiącach',
  'searchAnswers.period.year': 'w ostatnim roku',
  'searchAnswers.period.startYear': 'od początku roku',
  'searchAnswers.period.startMonth': 'od początku miesiąca',
  'searchAnswers.period.recent': 'w ostatnich dniach',
  'searchAnswers.period.lastDays':
    '{count, plural, one {dzisiaj} few {w ostatnich # dniach} many {w ostatnich # dniach} other {w ostatnich # dniach}}',
  'searchAnswers.period.lastWeeks':
    '{count, plural, one {w ostatnim tygodniu} few {w ostatnich # tygodniach} many {w ostatnich # tygodniach} other {w ostatnich # tygodniach}}',
  'searchAnswers.period.lastMonths':
    '{count, plural, one {w ostatnim miesiącu} few {w ostatnich # miesiącach} many {w ostatnich # miesiącach} other {w ostatnich # miesiącach}}',
  'searchAnswers.period.lastYears':
    '{count, plural, one {w ostatnim roku} few {w ostatnich # latach} many {w ostatnich # latach} other {w ostatnich # latach}}',
  'searchAnswers.period.agoDays': '{count, plural, one {dzień temu} few {# dni temu} many {# dni temu} other {# dnia temu}}',
  'searchAnswers.period.agoWeeks':
    '{count, plural, one {tydzień temu} few {# tygodnie temu} many {# tygodni temu} other {# tygodnia temu}}',
  'searchAnswers.period.agoMonths':
    '{count, plural, one {miesiąc temu} few {# miesiące temu} many {# miesięcy temu} other {# miesiąca temu}}',
  'searchAnswers.period.agoYears': '{count, plural, one {rok temu} few {# lata temu} many {# lat temu} other {# roku temu}}',
  'searchAnswers.period.calendarMonth':
    '{month, select, styczeń {w styczniu} luty {w lutym} marzec {w marcu} kwiecień {w kwietniu} maj {w maju} czerwiec {w czerwcu} lipiec {w lipcu} sierpień {w sierpniu} wrzesień {we wrześniu} październik {w październiku} listopad {w listopadzie} grudzień {w grudniu} other {w miesiącu: {month}}} {year}',
  'searchAnswers.period.onDate': 'dnia {date}',
  'searchAnswers.period.between': 'między {from} a {to}',

  // Comparators ("less than 5") ------------------------------------------------------
  'searchAnswers.comparator.lt': 'mniej niż {value}',
  'searchAnswers.comparator.lte': 'co najwyżej {value}',
  'searchAnswers.comparator.gt': 'więcej niż {value}',
  'searchAnswers.comparator.gte': 'co najmniej {value}',
  'searchAnswers.comparator.eq': 'dokładnie {value}',

  // Lists and quoting ----------------------------------------------------------------
  'searchAnswers.quoted': '„{term}”',
  'searchAnswers.listSeparator': ', ',
  'searchAnswers.dayWithValues': '{day} ({values})',
  'searchAnswers.value.mood': 'nastrój {value}',
  'searchAnswers.value.energy': 'energia {value}',
  'searchAnswers.value.stress': 'stres {value}',
  'searchAnswers.value.sleepHours': 'godziny snu {value}',
  'searchAnswers.value.sleepQuality': 'jakość snu {value}',
  'searchAnswers.value.exerciseMinutes': 'minuty aktywności {value}',
  'searchAnswers.mention.something': 'coś',

  // "How I understood the question" (ParsedQuery.explanation) ------------------------
  'searchAnswers.explain.best': 'Rozumiem: twoje najlepsze dni {period}.',
  'searchAnswers.explain.bestByMetric':
    'Rozumiem: najlepsze dni pod względem {metric, select, mood {nastroju} energy {poziomu energii} stress {poziomu stresu} sleepHours {długości snu} sleepQuality {jakości snu} exerciseMinutes {czasu aktywności} other {wartości}} {period}.',
  'searchAnswers.explain.worst': 'Rozumiem: najtrudniejsze dni {period}.',
  'searchAnswers.explain.worstByMetric':
    'Rozumiem: najtrudniejsze dni pod względem {metric, select, mood {nastroju} energy {poziomu energii} stress {poziomu stresu} sleepHours {długości snu} sleepQuality {jakości snu} exerciseMinutes {czasu aktywności} other {wartości}} {period}.',
  'searchAnswers.explain.filter':
    'Rozumiem: dni {period}, w których {metric, select, mood {nastrój wynosił} energy {poziom energii wynosił} stress {poziom stresu wynosił} sleepHours {długość snu wynosiła} sleepQuality {jakość snu wynosiła} exerciseMinutes {czas aktywności wynosił} other {wartość wynosiła}} {comparison}.',
  'searchAnswers.explain.trend':
    'Rozumiem: {metric, select, mood {jak zmieniał się twój nastrój} energy {jak zmieniał się twój poziom energii} stress {jak zmieniał się twój poziom stresu} sleepHours {jak zmieniała się długość twojego snu} sleepQuality {jak zmieniała się jakość twojego snu} exerciseMinutes {jak zmieniał się czas twojej aktywności} other {jak zmieniały się twoje wartości}} {period}.',
  'searchAnswers.explain.mention': 'Rozumiem: wpisy {period}, w których piszesz: {terms}.',
  'searchAnswers.explain.mentionAny': 'Rozumiem: twoje wpisy {period}.',
  'searchAnswers.explain.emotion': 'Rozumiem: dni {period}, w których pojawiła się emocja: {emotions}.',
  'searchAnswers.explain.list': 'Rozumiem: wpisy {period} zawierające {terms}.',
  'searchAnswers.explain.listAll': 'Rozumiem: wszystkie wpisy {period}.',
  'searchAnswers.explain.unknown':
    'Nie udało mi się zrozumieć pytania. Możesz zapytać na przykład: „Które dni w ostatnim miesiącu były dla mnie najlepsze?”',

  // Answers ---------------------------------------------------------------------------
  'searchAnswers.noResults': 'Nie znaleziono wpisów pasujących do pytania.',
  'searchAnswers.noResultsPeriod': 'Nie znaleziono {period} wpisów pasujących do pytania.',
  'searchAnswers.rank.best': 'Twoje najlepsze dni {period}: {days}.',
  'searchAnswers.rank.bestByMetric':
    'Najlepsze dni pod względem {metric, select, mood {nastroju} energy {poziomu energii} stress {poziomu stresu} sleepHours {długości snu} sleepQuality {jakości snu} exerciseMinutes {czasu aktywności} other {wartości}} {period}: {days}.',
  'searchAnswers.rank.worst': 'Najtrudniejsze dni {period}: {days}.',
  'searchAnswers.rank.worstByMetric':
    'Najtrudniejsze dni pod względem {metric, select, mood {nastroju} energy {poziomu energii} stress {poziomu stresu} sleepHours {długości snu} sleepQuality {jakości snu} exerciseMinutes {czasu aktywności} other {wartości}} {period}: {days}.',
  'searchAnswers.filter.found':
    '{count, plural, one {Znaleziono # dzień {period}, w którym} few {Znaleziono # dni {period}, w których} many {Znaleziono # dni {period}, w których} other {Znaleziono # dnia {period}, w których}} {metric, select, mood {nastrój wynosił} energy {poziom energii wynosił} stress {poziom stresu wynosił} sleepHours {długość snu wynosiła} sleepQuality {jakość snu wynosiła} exerciseMinutes {czas aktywności wynosił} other {wartość wynosiła}} {comparison}: {days}{more, plural, =0 {} one { i jeszcze # dzień} few { i jeszcze # dni} many { i jeszcze # dni} other { i jeszcze # dnia}}.',
  'searchAnswers.emotion.found':
    'Emocja {emotions} pojawiła się {period} {count, plural, one {w # dniu} few {w # dniach} many {w # dniach} other {w # dnia}}: {days}{more, plural, =0 {} one { i jeszcze # dzień} few { i jeszcze # dni} many { i jeszcze # dni} other { i jeszcze # dnia}}.',
  'searchAnswers.mention.found':
    'Znaleziono {terms} w {count, plural, one {# wpisie {period}, z dnia {first}} few {# wpisach {period}; pierwszy z dnia {first}, ostatni z dnia {last}} many {# wpisach {period}; pierwszy z dnia {first}, ostatni z dnia {last}} other {# wpisu {period}; pierwszy z dnia {first}, ostatni z dnia {last}}}.',
  'searchAnswers.list.found':
    'Znaleziono {count, plural, one {# wpis} few {# wpisy} many {# wpisów} other {# wpisu}} {period}; ostatni z dnia {last}.',
  'searchAnswers.list.foundTerms':
    'Znaleziono {count, plural, one {# wpis zawierający} few {# wpisy zawierające} many {# wpisów zawierających} other {# wpisu zawierającego}} {terms} {period}; ostatni z dnia {last}.',
  'searchAnswers.unknown.fallback':
    'Nie mam pewności, o co chodzi w pytaniu, dlatego {count, plural, one {pokazuję najnowszy wpis} few {pokazuję # najnowsze wpisy} many {pokazuję # najnowszych wpisów} other {pokazuję # najnowszego wpisu}} z {total}. {explanation}',
  'searchAnswers.trend.insufficient':
    'Za mało danych, aby wykryć trend {metric, select, mood {twojego nastroju} energy {twojego poziomu energii} stress {twojego poziomu stresu} sleepHours {długości twojego snu} sleepQuality {jakości twojego snu} exerciseMinutes {czasu twojej aktywności} other {twoich wartości}} {period}.',
  'searchAnswers.trend.evidence':
    '(na podstawie {first, plural, one {# dnia} few {# dni} many {# dni} other {# dnia}} z początku okresu i {last, plural, one {# dnia} few {# dni} many {# dni} other {# dnia}} z jego końca)',
  'searchAnswers.trend.stable':
    '{metric, select, mood {Twój średni nastrój pozostał stabilny} energy {Twój średni poziom energii pozostał stabilny} stress {Twój średni poziom stresu pozostał stabilny} sleepHours {Średnia długość twojego snu pozostała stabilna} sleepQuality {Średnia jakość twojego snu pozostała stabilna} exerciseMinutes {Średni czas twojej aktywności pozostał stabilny} other {Średnia wartość pozostała stabilna}} {period}: {from} wobec {to} {evidence}.',
  'searchAnswers.trend.up':
    '{metric, select, mood {Twój średni nastrój wzrósł} energy {Twój średni poziom energii wzrósł} stress {Twój średni poziom stresu wzrósł} sleepHours {Średnia długość twojego snu wzrosła} sleepQuality {Średnia jakość twojego snu wzrosła} exerciseMinutes {Średni czas twojej aktywności wzrósł} other {Średnia wartość wzrosła}} z {from} do {to} {period} {evidence}.',
  'searchAnswers.trend.down':
    '{metric, select, mood {Twój średni nastrój spadł} energy {Twój średni poziom energii spadł} stress {Twój średni poziom stresu spadł} sleepHours {Średnia długość twojego snu spadła} sleepQuality {Średnia jakość twojego snu spadła} exerciseMinutes {Średni czas twojej aktywności spadł} other {Średnia wartość spadła}} z {from} do {to} {period} {evidence}.',

  // Request validation (POST /api/search) ----------------------------------------------
  'searchAnswers.validation.body': 'Treść żądania musi zawierać pytanie (query)',
  'searchAnswers.validation.query': 'Wpisz pytanie',
  'searchAnswers.validation.queryTooLong': 'Pytanie jest za długie (maks. {max} znaków)',
  'searchAnswers.validation.limit': 'Liczba wyników musi być liczbą całkowitą od 1 do {max}',
};
export default messages;
