/**
 * pl - analysis messages (server-side insight templates, notes and labels). Keys are prefixed
 * 'analysis.'; see shared/i18n/index.ts for the template syntax and en/analysis.ts for the conventions.
 *
 * Polish notes:
 *  - Hedged, never causal ("Wygląda na to, że…", "mogą być ze sobą powiązane"); no "powoduje",
 *    "z powodu", "prowadzi do", "sprawia, że".
 *  - The app never uses a gendered past tense for itself or for the user: "Sprawdzono",
 *    "Porównano", "Policzono" (impersonal), present tense ("Piszesz w dzienniku już 5 dni z rzędu")
 *    or a non-personal subject ("sen trwał krócej niż 6 godzin").
 *  - `gender` classes of the metric nouns ('analysis.metric.<metric>.gender'):
 *      m  = masculine, higher/lower = wyższy/niższy           (nastrój, poziom energii, poziom stresu)
 *      f  = feminine,  higher/lower = wyższa/niższa           (jakość snu)
 *      fn = feminine amount, higher/lower = większa/mniejsza  (długość snu, liczba wpisów)
 *      md = masculine duration, higher/lower = dłuższy/krótszy (czas aktywności fizycznej)
 *    Labels equal the defined forms, so the same class fits `{metric}` in titles. Every noun chosen
 *    has accusative = nominative, so labels also work as objects ("Sprawdzono {what}").
 *  - `{cur}` / `{prev}` are nominative month names ("wrzesień"): they stand in parentheses or after a
 *    dash ("w tym miesiącu (wrzesień)"), never after a preposition that would need another case.
 *  - Branch bodies are never one bare word (see en/analysis.ts).
 */
const messages: Record<string, string> = {
  // Engine / provider -----------------------------------------------------------------
  'analysis.engine.providerFailed': 'Analiza wzorców nie została ukończona (błąd wewnętrzny). Spróbuj ponownie później.',
  'analysis.engine.detectorFailed':
    'Nie udało się ukończyć sprawdzenia: {label} (błąd wewnętrzny); pozostałe spostrzeżenia są w porządku.',

  // Strength (agrees with "siła": "Siła wzorca: umiarkowana") ---------------------------
  'analysis.strength.weak': 'słaba',
  'analysis.strength.moderate': 'umiarkowana',
  'analysis.strength.strong': 'wysoka',

  // Metrics: label (short, standalone), defined (subject inside a sentence), gender -----
  'analysis.metric.mood.label': 'nastrój',
  'analysis.metric.mood.defined': 'nastrój',
  'analysis.metric.mood.gender': 'm',
  'analysis.metric.energy.label': 'poziom energii',
  'analysis.metric.energy.defined': 'poziom energii',
  'analysis.metric.energy.gender': 'm',
  'analysis.metric.stress.label': 'poziom stresu',
  'analysis.metric.stress.defined': 'poziom stresu',
  'analysis.metric.stress.gender': 'm',
  'analysis.metric.sleepHours.label': 'długość snu',
  'analysis.metric.sleepHours.defined': 'długość snu',
  'analysis.metric.sleepHours.gender': 'fn',
  'analysis.metric.sleepQuality.label': 'jakość snu',
  'analysis.metric.sleepQuality.defined': 'jakość snu',
  'analysis.metric.sleepQuality.gender': 'f',
  'analysis.metric.exerciseMinutes.label': 'czas aktywności fizycznej',
  'analysis.metric.exerciseMinutes.defined': 'czas aktywności fizycznej',
  'analysis.metric.exerciseMinutes.gender': 'md',
  'analysis.metric.entries.label': 'liczba wpisów',
  'analysis.metric.entries.defined': 'liczba wpisów',
  'analysis.metric.entries.gender': 'fn',

  // Counts and dates ------------------------------------------------------------------
  'analysis.count.days': '{count, plural, one {# dzień} few {# dni} many {# dni} other {# dnia}}',
  'analysis.count.weeks': '{count, plural, one {# tydzień} few {# tygodnie} many {# tygodni} other {# tygodnia}}',
  'analysis.date.dayWithDate': '{weekday}, {date}',

  // Weekdays (index 0 = Sunday) --------------------------------------------------------
  'analysis.weekday.plural.0': 'niedziele',
  'analysis.weekday.plural.1': 'poniedziałki',
  'analysis.weekday.plural.2': 'wtorki',
  'analysis.weekday.plural.3': 'środy',
  'analysis.weekday.plural.4': 'czwartki',
  'analysis.weekday.plural.5': 'piątki',
  'analysis.weekday.plural.6': 'soboty',
  'analysis.weekday.on.0': 'w niedziele',
  'analysis.weekday.on.1': 'w poniedziałki',
  'analysis.weekday.on.2': 'we wtorki',
  'analysis.weekday.on.3': 'w środy',
  'analysis.weekday.on.4': 'w czwartki',
  'analysis.weekday.on.5': 'w piątki',
  'analysis.weekday.on.6': 'w soboty',

  // Notes shared by the detectors -------------------------------------------------------
  'analysis.note.insufficient': 'Za mało danych, aby sprawdzić {what} (potrzeba co najmniej: {required}; dostępne: {have}).',
  'analysis.note.insufficientWhether': 'Za mało danych, aby sprawdzić, {what} (potrzeba co najmniej: {required}; dostępne: {have}).',
  'analysis.note.nothingNotable':
    'Sprawdzono {what} na przestrzeni {count, plural, one {# dnia} few {# dni} many {# dni} other {# dnia}} i nie znaleziono wyraźnej różnicy.',

  // Requirement / availability phrases used inside the notes above ----------------------
  'analysis.req.daysBothValues':
    '{count, plural, one {# dzień z obiema wartościami} few {# dni z obiema wartościami} many {# dni z obiema wartościami} other {# dnia z obiema wartościami}}',
  'analysis.req.daysPerGroup':
    '{count, plural, one {# dzień w każdej grupie} few {# dni w każdej grupie} many {# dni w każdej grupie} other {# dnia w każdej grupie}}',
  'analysis.req.daysWithReport':
    '{count, plural, one {# dzień z zapisem} few {# dni z zapisami} many {# dni z zapisami} other {# dnia z zapisami}}',
  'analysis.req.daysWithRatings':
    '{count, plural, one {# dzień z ocenami} few {# dni z ocenami} many {# dni z ocenami} other {# dnia z ocenami}}',
  'analysis.req.daysPerMonth':
    '{count, plural, one {# dzień z zapisem w każdym miesiącu} few {# dni z zapisami w każdym miesiącu} many {# dni z zapisami w każdym miesiącu} other {# dnia z zapisami w każdym miesiącu}}',
  'analysis.req.recentDays':
    '{count, plural, one {# dzień z zapisem w ostatnich dwóch tygodniach} few {# dni z zapisami w ostatnich dwóch tygodniach} many {# dni z zapisami w ostatnich dwóch tygodniach} other {# dnia z zapisami w ostatnich dwóch tygodniach}}',
  'analysis.req.fullWeeks':
    '{count, plural, one {# pełny tydzień z zapisami} few {# pełne tygodnie z zapisami} many {# pełnych tygodni z zapisami} other {# pełnego tygodnia z zapisami}}',
  'analysis.req.weeksOfLogs':
    '{count, plural, one {# tydzień zapisów} few {# tygodnie zapisów} many {# tygodni zapisów} other {# tygodnia zapisów}}',
  'analysis.req.weekPerGroup':
    'jeden tydzień w każdej grupie i {count, plural, one {# dzień z zapisem} few {# dni z zapisami} many {# dni z zapisami} other {# dnia z zapisami}} w każdej grupie',
  'analysis.req.moodReports':
    '{count, plural, one {# ocena nastroju} few {# oceny nastroju} many {# ocen nastroju} other {# oceny nastroju}}',
  'analysis.req.reportsInWindow':
    '{count, plural, one {# zapis w jednym przedziale czasu} few {# zapisy w jednym przedziale czasu} many {# zapisów w jednym przedziale czasu} other {# zapisu w jednym przedziale czasu}}',
  'analysis.req.emotionRepeated':
    'jedna emocja odnotowana {count, plural, one {w # dniu} few {w # dniach} many {w # dniach} other {w # dnia}}',
  'analysis.have.twoGroups':
    '{groupA}: {countA, plural, one {# dzień} few {# dni} many {# dni} other {# dnia}}; {groupB}: {countB, plural, one {# dzień} few {# dni} many {# dni} other {# dnia}}',
  'analysis.have.weeksTwoGroups':
    'tygodnie z osiągniętym celem: {metWeeks, plural, one {# tydzień} few {# tygodnie} many {# tygodni} other {# tygodnia}} ({metDays, plural, one {# dzień} few {# dni} many {# dni} other {# dnia}}); tygodnie poniżej celu: {belowWeeks, plural, one {# tydzień} few {# tygodnie} many {# tygodni} other {# tygodnia}} ({belowDays, plural, one {# dzień} few {# dni} many {# dni} other {# dnia}})',
  'analysis.have.twoMonths':
    '{countA, plural, one {# dzień} few {# dni} many {# dni} other {# dnia}} w bieżącym miesiącu ({cur}) i {countB, plural, one {# dzień} few {# dni} many {# dni} other {# dnia}} w poprzednim ({prev})',
  'analysis.have.noData': 'brak danych',
  'analysis.have.noSuchEmotion': 'na razie żadna',
  'analysis.have.fewerInEveryWindow': 'mniej w każdym przedziale',

  // Sentences shared by the group-comparison detectors ----------------------------------
  'analysis.relation.text':
    'Wygląda na to, że w twoich danych {condition}, {metricDefined} {gender, select, m {{direction, select, higher {był średnio wyższy} other {był średnio niższy}}} f {{direction, select, higher {była średnio wyższa} other {była średnio niższa}}} fn {{direction, select, higher {była średnio większa} other {była średnio mniejsza}}} md {{direction, select, higher {był średnio dłuższy} other {był średnio krótszy}}} other {{direction, select, higher {miał średnio wyższą wartość} other {miał średnio niższą wartość}}}} ({meanA} wobec {meanB}).',
  'analysis.correlation.text':
    'Wygląda na to, że w twoich danych {x} i {y} mogą być ze sobą powiązane: {xGender, select, m {gdy {x} był wyższy} f {gdy {x} była wyższa} fn {gdy {x} była większa} md {gdy {x} był dłuższy} other {gdy wartość „{x}” była wyższa}}, {yGender, select, m {{y} {direction, select, higher {bywał zwykle wyższy} other {bywał zwykle niższy}}} f {{y} {direction, select, higher {bywała zwykle wyższa} other {bywała zwykle niższa}}} fn {{y} {direction, select, higher {bywała zwykle większa} other {bywała zwykle mniejsza}}} md {{y} {direction, select, higher {bywał zwykle dłuższy} other {bywał zwykle krótszy}}} other {wartość „{y}” {direction, select, higher {bywała zwykle wyższa} other {bywała zwykle niższa}}}} (korelacja {r}).',
  'analysis.explain.checkedDays': 'Sprawdzono {count, plural, one {# dzień} few {# dni} many {# dni} other {# dnia}}.',
  'analysis.explain.onDaysCondition': '{count, plural, one {W # dniu} few {W # dniach} many {W # dniach} other {W # dnia}} {conditionPast}.',
  'analysis.explain.groupMeans':
    '{gender, select, m {Średni {metricDefined} w tych dniach wyniósł {meanA}} f {Średnia {metricDefined} w tych dniach wyniosła {meanA}} fn {Średnia {metricDefined} w tych dniach wyniosła {meanA}} md {Średni {metricDefined} w tych dniach wyniósł {meanA}} other {Średnia wartość „{metricDefined}” w tych dniach wyniosła {meanA}}} wobec {meanB} w pozostałych dniach.',
  'analysis.explain.correlation': 'Korelacja: {r}.',
  'analysis.explain.correlationBetween': 'Korelacja ({predictor} – {outcome}): {r}.',
  'analysis.explain.diffAndStrength': 'Różnica między średnimi: {diff} pkt. Siła wzorca: {strength}.',
  'analysis.explain.diffStrength': 'Różnica: {diff} pkt. Siła wzorca: {strength}.',
  'analysis.split.corrExplainChecked':
    '{count, plural, one {Sprawdzono # dzień, w którym} few {Sprawdzono # dni, w których} many {Sprawdzono # dni, w których} other {Sprawdzono # dnia, w których}} odnotowano zarówno {x}, jak i {y}.',
  'analysis.split.corrExplainPearson': 'Korelacja Pearsona: {r} (siła: {strength}).',
  'analysis.split.corrExplainGroups':
    'W grupach było za mało dni, aby porównać średnie ({groupA}: {countA, plural, one {# dzień} few {# dni} many {# dni} other {# dnia}}; {groupB}: {countB, plural, one {# dzień} few {# dni} many {# dni} other {# dnia}}; w każdej grupie potrzeba co najmniej {min}).',

  // Evidence table keys ---------------------------------------------------------------
  'analysis.extra.predictor': 'Predyktor',
  'analysis.extra.strength': 'Siła',
  'analysis.extra.meanDiff': 'Różnica średnich (A minus B)',
  'analysis.extra.cohenD': 'Wielkość efektu (d Cohena)',
  'analysis.extra.weeksChecked': 'Sprawdzone tygodnie',
  'analysis.extra.weeklyTarget': 'Cel tygodniowy',
  'analysis.extra.target': 'Cel',
  'analysis.extra.frequency': 'Częstotliwość',
  'analysis.extra.periodMean': 'Średnia w okresie',
  'analysis.extra.overallMean': 'Średnia ogólna',
  'analysis.extra.stddev': 'Odchylenie standardowe',
  'analysis.extra.slopePerDay': 'Nachylenie na dzień',
  'analysis.extra.daysInWindow': 'Dni w oknie',
  'analysis.extra.movingWindow': 'Okno średniej kroczącej',
  'analysis.extra.relativeChange': 'Zmiana względna',
  'analysis.extra.longestStreak': 'Najdłuższa seria w okresie',
  'analysis.extra.shareOfEmotionDays': 'Udział dni z tą emocją',
  'analysis.frequency.daily': 'codziennie',
  'analysis.frequency.weekly': 'co tydzień',
  'analysis.groupB.otherDays': 'Pozostałe dni',

  // Sleep detectors -------------------------------------------------------------------
  'analysis.sleep.groupA': 'Dni ze snem krótszym niż {hours, plural, one {# godzina} few {# godziny} many {# godzin} other {# godziny}}',
  'analysis.sleep.groupB':
    'Dni ze snem trwającym co najmniej {hours, plural, one {# godzinę} few {# godziny} many {# godzin} other {# godziny}}',
  'analysis.sleep.condition':
    'w dni, w które sen trwał krócej niż {hours, plural, one {# godzinę} few {# godziny} many {# godzin} other {# godziny}}',
  'analysis.sleep.conditionPast':
    'sen trwał krócej niż {hours, plural, one {# godzinę} few {# godziny} many {# godzin} other {# godziny}}',
  'analysis.sleepMood.label': 'związek między snem a nastrojem',
  'analysis.sleepMood.title': '{direction, select, lower {Krótki sen i niższy nastrój} other {Krótki sen i wyższy nastrój}}',
  'analysis.sleepMood.corrTitle': 'Możliwy związek między długością snu a nastrojem',
  'analysis.sleepEnergy.label': 'związek między snem a poziomem energii',
  'analysis.sleepEnergy.title': '{direction, select, lower {Krótki sen i niższy poziom energii} other {Krótki sen i wyższy poziom energii}}',
  'analysis.sleepEnergy.corrTitle': 'Możliwy związek między długością snu a poziomem energii',

  // Exercise detectors ----------------------------------------------------------------
  'analysis.exercise.groupA': 'Dni z aktywnością fizyczną',
  'analysis.exercise.groupB': 'Dni bez aktywności fizycznej',
  'analysis.exercise.condition': 'w dni, w które odnotowano aktywność fizyczną',
  'analysis.exercise.conditionPast': 'odnotowano aktywność fizyczną',
  'analysis.exerciseMood.label': 'związek między aktywnością fizyczną a nastrojem',
  'analysis.exerciseMood.title': '{direction, select, higher {Aktywność fizyczna i wyższy nastrój} other {Aktywność fizyczna i niższy nastrój}}',
  'analysis.exerciseMood.corrTitle': 'Możliwy związek między czasem aktywności a nastrojem',
  'analysis.exerciseEnergy.label': 'związek między aktywnością fizyczną a poziomem energii',
  'analysis.exerciseEnergy.title':
    '{direction, select, higher {Aktywność fizyczna i wyższy poziom energii} other {Aktywność fizyczna i niższy poziom energii}}',
  'analysis.exerciseEnergy.corrTitle': 'Możliwy związek między czasem aktywności a poziomem energii',

  // Habit - mood / energy / stress ------------------------------------------------------
  'analysis.habit.detectorLabel': 'związek między nawykami a nastrojem',
  'analysis.habit.noHabits': 'Brak aktywnych nawyków, więc nie sprawdzano związku między nawykami a nastrojem.',
  'analysis.habit.noLogs': 'Nawyk „{habit}” nie ma jeszcze zapisów w tym okresie, więc nie sprawdzano jego związku z nastrojem.',
  'analysis.habit.noFullWeeks':
    'Nawyk „{habit}” nie ma jeszcze pełnych tygodni z zapisami, więc nie sprawdzano jego związku z nastrojem.',
  'analysis.habit.label': 'związek między nawykiem „{habit}” a wskaźnikiem „{metric}”',
  'analysis.habit.groupA': 'Dni, w które nawyk „{habit}” został wykonany',
  'analysis.habit.groupB': 'Dni, w które nawyk „{habit}” nie został wykonany',
  'analysis.habit.condition': 'w dni, w które nawyk „{habit}” został wykonany',
  'analysis.habit.conditionPast': 'nawyk „{habit}” został wykonany',
  'analysis.habit.title':
    'Nawyk „{habit}” i {gender, select, m {{direction, select, higher {wyższy {metric}} other {niższy {metric}}}} f {{direction, select, higher {wyższa {metric}} other {niższa {metric}}}} fn {{direction, select, higher {większa {metric}} other {mniejsza {metric}}}} md {{direction, select, higher {dłuższy {metric}} other {krótszy {metric}}}} other {{direction, select, higher {wyższe wartości: {metric}} other {niższe wartości: {metric}}}}}',
  'analysis.habit.corrTitle': 'Możliwy związek między nawykiem „{habit}” a wskaźnikiem „{metric}”',
  'analysis.habit.weeklyCondition': 'w tygodniach, w których cel nawyku „{habit}” został osiągnięty',
  'analysis.habit.weeklyTarget': '{target} {unit} na tydzień',
  'analysis.habit.targetValue': '{target} {unit}',
  'analysis.habit.weeklyExplainChecked':
    'Sprawdzono {weeks, plural, one {# pełny tydzień} few {# pełne tygodnie} many {# pełnych tygodni} other {# pełnego tygodnia}} ({days, plural, one {# dzień} few {# dni} many {# dni} other {# dnia}} z zapisem wartości „{metric}”).',
  'analysis.habit.weeklyExplainMet':
    '{count, plural, one {W # tygodniu} few {W # tygodniach} many {W # tygodniach} other {W # tygodnia}} cel nawyku ({target}) został osiągnięty.',
  'analysis.habit.weeklyExplainMeans':
    '{gender, select, m {Średni {metricDefined} w dniach tych tygodni wyniósł {meanA}} f {Średnia {metricDefined} w dniach tych tygodni wyniosła {meanA}} fn {Średnia {metricDefined} w dniach tych tygodni wyniosła {meanA}} md {Średni {metricDefined} w dniach tych tygodni wyniósł {meanA}} other {Średnia wartość „{metricDefined}” w dniach tych tygodni wyniosła {meanA}}} wobec {meanB} w dniach {count, plural, one {# tygodnia} few {# tygodni} many {# tygodni} other {# tygodnia}} poniżej celu.',
  'analysis.habit.groupAWeeks':
    'Dni w tygodniach z osiągniętym celem ({count, plural, one {# tydzień} few {# tygodnie} many {# tygodni} other {# tygodnia}})',
  'analysis.habit.groupBWeeks':
    'Dni w tygodniach poniżej celu ({count, plural, one {# tydzień} few {# tygodnie} many {# tygodni} other {# tygodnia}})',

  // Weekday differences -----------------------------------------------------------------
  'analysis.weekday.label': 'różnice między dniami tygodnia',
  'analysis.weekday.text':
    'Wygląda na to, że w twoich danych {onWeekday} {metricDefined} {gender, select, m {{direction, select, higher {był średnio wyższy} other {był średnio niższy}}} f {{direction, select, higher {była średnio wyższa} other {była średnio niższa}}} fn {{direction, select, higher {była średnio większa} other {była średnio mniejsza}}} md {{direction, select, higher {był średnio dłuższy} other {był średnio krótszy}}} other {{direction, select, higher {miał średnio wyższą wartość} other {miał średnio niższą wartość}}}} niż w pozostałe dni tygodnia ({meanA} wobec {meanB}).',
  'analysis.weekday.explainChecked':
    'Sprawdzono {count, plural, one {# dzień} few {# dni} many {# dni} other {# dnia}} z zapisem wartości „{metric}”, w tym {weekdays}: {countA}.',
  'analysis.weekday.explainMeans':
    '{gender, select, m {Średni {metricDefined} {onWeekday} wyniósł {meanA}} f {Średnia {metricDefined} {onWeekday} wyniosła {meanA}} fn {Średnia {metricDefined} {onWeekday} wyniosła {meanA}} md {Średni {metricDefined} {onWeekday} wyniósł {meanA}} other {Średnia wartość „{metricDefined}” {onWeekday} wyniosła {meanA}}} wobec {meanB} w pozostałe dni.',
  'analysis.weekday.title':
    '{gender, select, m {{direction, select, higher {Wyższy {metric}} other {Niższy {metric}}}} f {{direction, select, higher {Wyższa {metric}} other {Niższa {metric}}}} fn {{direction, select, higher {Większa {metric}} other {Mniejsza {metric}}}} md {{direction, select, higher {Dłuższy {metric}} other {Krótszy {metric}}}} other {{direction, select, higher {Wyższe wartości: {metric}} other {Niższe wartości: {metric}}}}} – {weekdays}',
  'analysis.weekday.groupB': 'Pozostałe dni tygodnia',
  'analysis.weekday.tableValue': '{mean} ({count, plural, one {# dzień} few {# dni} many {# dni} other {# dnia}})',
  'analysis.weekday.nothing':
    'Sprawdzono różnice między dniami tygodnia na przestrzeni {count, plural, one {# dnia} few {# dni} many {# dni} other {# dnia}} i nie znaleziono wyraźnej różnicy.',

  // Time of day -------------------------------------------------------------------------
  'analysis.timeOfDay.label': 'związek między porą pisania a nastrojem',
  'analysis.timeOfDay.morning.label': 'Rano',
  'analysis.timeOfDay.morning.phrase': 'rano',
  'analysis.timeOfDay.late_morning.label': 'Przedpołudnie',
  'analysis.timeOfDay.late_morning.phrase': 'przed południem',
  'analysis.timeOfDay.afternoon.label': 'Popołudnie',
  'analysis.timeOfDay.afternoon.phrase': 'po południu',
  'analysis.timeOfDay.evening.label': 'Wieczór',
  'analysis.timeOfDay.evening.phrase': 'wieczorem',
  'analysis.timeOfDay.night.label': 'Noc',
  'analysis.timeOfDay.night.phrase': 'w nocy',
  'analysis.timeOfDay.tableKey': '{label} ({hours})',
  'analysis.timeOfDay.tableValue': 'średnia {mean}, {count, plural, one {# zapis} few {# zapisy} many {# zapisów} other {# zapisu}}',
  'analysis.timeOfDay.tableRow': '{key}: {value}',
  'analysis.timeOfDay.nothing':
    'Sprawdzono {label} na podstawie {count, plural, one {# zapisu} few {# zapisów} many {# zapisów} other {# zapisu}} i nie znaleziono przedziału czasu, który wyraźnie wyróżniałby się powyżej średniej.',
  'analysis.timeOfDay.text':
    'Wygląda na to, że w twoich danych nastrój zapisywany {phrase} ({hours}) był najwyższy: średnio {mean}, wobec {overall} dla wszystkich zapisów.',
  'analysis.timeOfDay.explainChecked':
    'Sprawdzono {count, plural, one {# ocenę nastroju} few {# oceny nastroju} many {# ocen nastroju} other {# oceny nastroju}} z {days, plural, one {# dnia} few {# dni} many {# dni} other {# dnia}} według pory napisania wpisu.',
  'analysis.timeOfDay.explainTable': '{table}. Średnia ogólna: {overall}.',
  'analysis.timeOfDay.explainDiff':
    'Różnica między najwyżej ocenianym przedziałem czasu a średnią ogólną: {diff} pkt. Siła wzorca: {strength}.',
  'analysis.timeOfDay.title': 'Wyższy nastrój {phrase}',
  'analysis.timeOfDay.groupA': 'Zapisy {phrase} ({hours})',
  'analysis.timeOfDay.groupB': 'Pozostałe zapisy',

  // Trends ------------------------------------------------------------------------------
  'analysis.trends.label': 'trendy nastroju, stresu i snu',
  'analysis.trends.text':
    'Wygląda na to, że w twoich danych {metricDefined} {horizon, select, period {w całym okresie} monthly {w ostatnim miesiącu} other {w ostatnich dwóch tygodniach}} {gender, select, other {{direction, select, up {ma tendencję wzrostową} other {ma tendencję spadkową}}}}: linia trendu średniej kroczącej {direction, select, up {wzrosła z} other {spadła z}} {fromValue} do {toValue}.',
  'analysis.trends.explainChecked':
    'Sprawdzono {count, plural, one {# dzień} few {# dni} many {# dni} other {# dnia}} z zapisem wartości „{metric}” spośród {len} {horizon, select, period {dni okresu} other {ostatnich dni}} ({from}–{to}).',
  'analysis.trends.explainFit':
    'Obliczono {window}-dniową średnią kroczącą i poprowadzono przez nią linię trendu (regresja liniowa): {direction, select, up {nachylenie dodatnie} other {nachylenie ujemne}} o wartości {unit, select, hours {{slope} godz.} other {{slope} pkt}} na dzień, czyli zmiana o około {unit, select, hours {{change} godz.} other {{change} pkt}} w całym oknie (od {fromValue} do {toValue} wzdłuż linii trendu). Siła trendu: {strength}.',
  'analysis.trends.title':
    '{direction, select, up {Trend wzrostowy} other {Trend spadkowy}}: {metric, select, mood {twój nastrój} energy {poziom energii} stress {poziom stresu} sleepHours {długość snu} sleepQuality {jakość snu} exerciseMinutes {czas aktywności} other {liczba wpisów}} ({horizon, select, period {cały okres} monthly {ostatni miesiąc} other {ostatnie 2 tygodnie}})',
  'analysis.trends.groupA': 'Początek okna (linia trendu)',
  'analysis.trends.groupB': 'Koniec okna (linia trendu)',
  'analysis.trends.slopeValue': '{unit, select, hours {{slope} godz.} other {{slope} pkt}}',
  'analysis.trends.nothingSince': 'Sprawdzono trendy nastroju, stresu i snu od {from} i nie znaleziono wyraźnego trendu.',
  'analysis.trends.nothingAll': 'Sprawdzono trendy nastroju, stresu i snu w całym okresie i nie znaleziono wyraźnego trendu.',

  // Month comparison --------------------------------------------------------------------
  'analysis.periodCompare.label': 'porównanie bieżącego miesiąca z poprzednim',
  'analysis.periodCompare.text':
    'Wygląda na to, że w twoich danych w tym miesiącu ({cur}) {metricDefined} {gender, select, m {{direction, select, higher {był średnio wyższy} other {był średnio niższy}}} f {{direction, select, higher {była średnio wyższa} other {była średnio niższa}}} fn {{direction, select, higher {była średnio większa} other {była średnio mniejsza}}} md {{direction, select, higher {był średnio dłuższy} other {był średnio krótszy}}} other {{direction, select, higher {miał średnio wyższą wartość} other {miał średnio niższą wartość}}}} niż w poprzednim ({prev}): {meanA} wobec {meanB}.',
  'analysis.periodCompare.explain':
    'Porównano dni z zapisem wartości „{metric}” w bieżącym miesiącu – {cur} ({countA, plural, one {# dzień} few {# dni} many {# dni} other {# dnia}}, do dziś) – z dniami poprzedniego miesiąca – {prev} ({countB, plural, one {# dzień} few {# dni} many {# dni} other {# dnia}}). Średnia – {cur}: {meanA}; {prev}: {meanB}. Różnica: {unit, select, hours {{diff} godz.} other {{diff} pkt}}. Siła różnicy: {strength}.',
  'analysis.periodCompare.title':
    '{gender, select, m {{direction, select, higher {Wyższy {metric}} other {Niższy {metric}}}} f {{direction, select, higher {Wyższa {metric}} other {Niższa {metric}}}} fn {{direction, select, higher {Większa {metric}} other {Mniejsza {metric}}}} md {{direction, select, higher {Dłuższy {metric}} other {Krótszy {metric}}}} other {{direction, select, higher {Wyższe wartości: {metric}} other {Niższe wartości: {metric}}}}}: {cur} vs {prev}',
  'analysis.periodCompare.entriesText':
    'Wygląda na to, że w pierwszych {window} dniach tego miesiąca ({cur}) {direction, select, more {powstało więcej wpisów} other {powstało mniej wpisów}} ({countA, plural, one {# wpis} few {# wpisy} many {# wpisów} other {# wpisu}}) niż w pierwszych {window} dniach poprzedniego ({prev}; {countB, plural, one {# wpis} few {# wpisy} many {# wpisów} other {# wpisu}}).',
  'analysis.periodCompare.entriesExplain':
    'Policzono wpisy z pierwszych {window} dni każdego miesiąca, aby porównać równe przedziały czasu: {cur} – {countA, plural, one {# wpis} few {# wpisy} many {# wpisów} other {# wpisu}}, {prev} – {countB, plural, one {# wpis} few {# wpisy} many {# wpisów} other {# wpisu}}. Różnica: {diff, plural, one {# wpis} few {# wpisy} many {# wpisów} other {# wpisu}} ({percent}). Siła różnicy: {strength}.',
  'analysis.periodCompare.entriesTitle':
    '{direction, select, more {Więcej wpisów} other {Mniej wpisów}}: {cur} vs {prev}',
  'analysis.periodCompare.monthWindow': '{month} (pierwsze {window} dni)',
  'analysis.periodCompare.insufficientWhat': 'porównanie miesięcy: {cur} i {prev}',
  'analysis.periodCompare.nothing':
    'Porównano bieżący miesiąc ({cur}) z poprzednim ({prev}) i nie znaleziono wyraźnej różnicy w nastroju, stresie, śnie ani liczbie wpisów.',

  // Habit trend (improved / declined) -----------------------------------------------------
  'analysis.habitsTrend.label': 'zmiany regularności nawyków',
  'analysis.habitsTrend.whether': 'czy regularność nawyku „{habit}” wzrosła, czy spadła',
  'analysis.habitsTrend.textDaily':
    'Wygląda na to, że regularność nawyku „{habit}” {direction, select, improved {wzrosła} other {spadła}}: w ostatnich dwóch tygodniach był on wykonywany w {recent} z {window} dni, wobec {previous} z {window} w dwóch tygodniach wcześniej.',
  'analysis.habitsTrend.textWeekly':
    'Wygląda na to, że regularność nawyku „{habit}” {direction, select, improved {wzrosła} other {spadła}}: w ostatnich dwóch tygodniach zapisano {recent} {unit}, wobec {previous} w dwóch tygodniach wcześniej (cel: {target} {unit} na tydzień).',
  'analysis.habitsTrend.explain':
    'Porównano odsetek wykonania nawyku w ostatnich dwóch tygodniach ({recentFrom}–{recentTo}) z dwoma tygodniami wcześniej ({previousFrom}–{previousTo}): {recentRate} wobec {previousRate}. Różnica: {diff} pkt proc. Siła zmiany: {strength}.',
  'analysis.habitsTrend.title':
    'Nawyk „{habit}” – {direction, select, improved {poprawa w ostatnich 2 tygodniach} other {spadek w ostatnich 2 tygodniach}}',
  'analysis.habitsTrend.metric': 'Odsetek wykonania – {habit}',
  'analysis.habitsTrend.groupA': 'Ostatnie dwa tygodnie',
  'analysis.habitsTrend.groupB': 'Poprzednie dwa tygodnie',

  // Best / hardest days ------------------------------------------------------------------
  'analysis.bestWorst.label': 'najlepsze i najtrudniejsze dni',
  'analysis.bestWorst.describedDay': '{day} („{title}”)',
  'analysis.bestWorst.noTitle': 'Bez tytułu',
  'analysis.bestWorst.extraValue': '{titles} – wynik {score}',
  'analysis.bestWorst.text':
    '{kind, select, best {Najlepsze dni} other {Najtrudniejsze dni}} w okresie według łącznego wyniku nastroju, energii i stresu: {days}.',
  'analysis.bestWorst.explainScore':
    '{count, plural, one {Dla # dnia} few {Dla każdego z # dni} many {Dla każdego z # dni} other {Dla każdego z # dnia}} obliczono łączny wynik: średnią z nastroju, poziomu energii i (11 minus poziom stresu) na podstawie wartości zapisanych danego dnia.',
  'analysis.bestWorst.explainMeans':
    'Średni wynik w okresie: {overall}. {kind, select, best {{count, plural, one {Najlepszy dzień uzyskał} =3 {Trzy najlepsze dni uzyskały} other {Najlepsze dni uzyskały}}} other {{count, plural, one {Najtrudniejszy dzień uzyskał} =3 {Trzy najtrudniejsze dni uzyskały} other {Najtrudniejsze dni uzyskały}}}} średnio {mean}.',
  'analysis.bestWorst.explainDiff': 'Różnica względem średniej: {diff} pkt. Siła różnicy: {strength}.',
  'analysis.bestWorst.title': '{kind, select, best {Najlepsze dni w okresie} other {Najtrudniejsze dni w okresie}}',
  'analysis.bestWorst.metric': 'Łączny wynik (nastrój + energia + odwrócony stres)',
  'analysis.bestWorst.groupA': '{kind, select, best {Najlepsze dni} other {Najtrudniejsze dni}}',
  'analysis.bestWorst.nothing':
    'Sprawdzono {label} na przestrzeni {count, plural, one {# dnia} few {# dni} many {# dni} other {# dnia}}; wyniki były podobne i żaden dzień szczególnie się nie wyróżniał.',

  // Streaks -------------------------------------------------------------------------------
  'analysis.streaks.label': 'serie pisania i nawyków',
  'analysis.streaks.entriesTitle': 'Seria pisania: {count, plural, one {# dzień} few {# dni} many {# dni} other {# dnia}}',
  'analysis.streaks.entriesText':
    'Brawo! Piszesz w dzienniku już {count, plural, one {# dzień} few {# dni} many {# dni} other {# dnia}} z rzędu ({from}–{to}).',
  'analysis.streaks.entriesExplain':
    'Policzono kolejne dni z co najmniej jednym wpisem, do dziś lub do wczoraj. Obecna seria: {count, plural, one {# dzień} few {# dni} many {# dni} other {# dnia}}, od {from} do {to}. Najdłuższa seria w okresie: {best, plural, one {# dzień} few {# dni} many {# dni} other {# dnia}}.',
  'analysis.streaks.entriesMetric': 'Dni z pisaniem',
  'analysis.streaks.currentDays': 'Dni w obecnej serii',
  'analysis.streaks.daysWithEntry': 'Dni z wpisem w okresie',
  'analysis.streaks.habitTitle': 'Seria {count, plural, one {# dnia} few {# dni} many {# dni} other {# dnia}} – nawyk „{habit}”',
  'analysis.streaks.habitText':
    'Wykonujesz nawyk „{habit}” już {count, plural, one {# dzień} few {# dni} many {# dni} other {# dnia}} z rzędu ({from}–{to}).',
  'analysis.streaks.habitExplain':
    'Policzono kolejne dni, w których nawyk „{habit}” został oznaczony jako wykonany, do dziś lub do wczoraj. Obecna seria: {count, plural, one {# dzień} few {# dni} many {# dni} other {# dnia}}. Najdłuższa seria w okresie: {best, plural, one {# dzień} few {# dni} many {# dni} other {# dnia}}.',
  'analysis.streaks.habitMetric': 'Wykonanie nawyku „{habit}”',
  'analysis.streaks.daysCompleted': 'Dni z wykonanym nawykiem w okresie',
  'analysis.streaks.weeklyTitle':
    'Seria {count, plural, one {# tygodnia} few {# tygodni} many {# tygodni} other {# tygodnia}} – nawyk „{habit}”',
  'analysis.streaks.weeklyText':
    'Osiągasz cel nawyku „{habit}” już {count, plural, one {# tydzień} few {# tygodnie} many {# tygodni} other {# tygodnia}} z rzędu ({from}–{to}).',
  'analysis.streaks.weeklyExplain':
    'Zsumowano ilość zapisaną dla nawyku „{habit}” w każdym tygodniu i porównano ją z celem tygodniowym ({target}). Obecna seria tygodni z osiągniętym celem: {count, plural, one {# tydzień} few {# tygodnie} many {# tygodni} other {# tygodnia}}.',
  'analysis.streaks.weeklyMetric': 'Osiągnięty cel tygodniowy – {habit}',
  'analysis.streaks.currentWeeks': 'Tygodnie w obecnej serii',
  'analysis.streaks.weeksWithLogs': 'Tygodnie z zapisami w okresie',
  'analysis.streaks.none':
    'Nie znaleziono aktywnych serii (seria pisania co najmniej {entryMin}-dniowa albo seria nawyku trwająca co najmniej {habitMin} dni lub tygodni).',

  // Anomalies -----------------------------------------------------------------------------
  'analysis.anomalies.label': 'nietypowe dni pod względem nastroju lub stresu',
  'analysis.anomalies.textOne':
    'Wygląda na to, że jednego dnia ({day}) {metricDefined} {gender, select, m {{side, select, high {był nietypowo wysoki} other {był nietypowo niski}}} f {{side, select, high {była nietypowo wysoka} other {była nietypowo niska}}} fn {{side, select, high {była nietypowo duża} other {była nietypowo mała}}} md {{side, select, high {był nietypowo długi} other {był nietypowo krótki}}} other {{side, select, high {miał nietypowo wysoką wartość} other {miał nietypowo niską wartość}}}} w porównaniu z resztą okresu ({value} wobec średniej {mean}).',
  'analysis.anomalies.textMany':
    'Wygląda na to, że {count, plural, one {w # dniu} few {w # dniach} many {w # dniach} other {w # dnia}} {metricDefined} {gender, select, m {{side, select, high {był nietypowo wysoki} other {był nietypowo niski}}} f {{side, select, high {była nietypowo wysoka} other {była nietypowo niska}}} fn {{side, select, high {była nietypowo duża} other {była nietypowo mała}}} md {{side, select, high {był nietypowo długi} other {był nietypowo krótki}}} other {{side, select, high {miał nietypowo wysoką wartość} other {miał nietypowo niską wartość}}}} w porównaniu z resztą okresu: {days}; średnia w okresie: {mean}.',
  'analysis.anomalies.textManyMore':
    'Wygląda na to, że {count, plural, one {w # dniu} few {w # dniach} many {w # dniach} other {w # dnia}} {metricDefined} {gender, select, m {{side, select, high {był nietypowo wysoki} other {był nietypowo niski}}} f {{side, select, high {była nietypowo wysoka} other {była nietypowo niska}}} fn {{side, select, high {była nietypowo duża} other {była nietypowo mała}}} md {{side, select, high {był nietypowo długi} other {był nietypowo krótki}}} other {{side, select, high {miał nietypowo wysoką wartość} other {miał nietypowo niską wartość}}}} w porównaniu z resztą okresu: {days} i inne; średnia w okresie: {mean}.',
  'analysis.anomalies.dayItem': '{day} ({value})',
  'analysis.anomalies.detail': '{date}: {value} (z = {z}, {side, select, above {powyżej średniej} other {poniżej średniej}})',
  'analysis.anomalies.explain':
    'Sprawdzono {count, plural, one {# dzień} few {# dni} many {# dni} other {# dnia}} z zapisem wartości „{metric}”. Średnia: {mean}, odchylenie standardowe: {sd}. Dzień uznaje się za nietypowy, gdy jego wynik z (odległość od średniej w odchyleniach standardowych) wynosi co najmniej {z}. {details}. Siła odchylenia: {strength}.',
  'analysis.anomalies.title':
    '{gender, select, m {{side, select, high {Nietypowo wysoki {metric}} other {Nietypowo niski {metric}}}} f {{side, select, high {Nietypowo wysoka {metric}} other {Nietypowo niska {metric}}}} fn {{side, select, high {Nietypowo duża {metric}} other {Nietypowo mała {metric}}}} md {{side, select, high {Nietypowo długi {metric}} other {Nietypowo krótki {metric}}}} other {{side, select, high {Nietypowo wysokie wartości: {metric}} other {Nietypowo niskie wartości: {metric}}}}} {count, plural, one {w jednym dniu} few {w # dniach} many {w # dniach} other {w # dnia}}',
  'analysis.anomalies.groupA': 'Nietypowe dni',
  'analysis.anomalies.zValue': '{value} (z {z})',
  'analysis.anomalies.nothing':
    'Sprawdzono nietypowe dni na przestrzeni {count, plural, one {# dnia} few {# dni} many {# dni} other {# dnia}} i nie znaleziono dnia, którego wynik z (odległość od średniej w odchyleniach standardowych) wynosiłby co najmniej {z}.',

  // Emotion patterns ----------------------------------------------------------------------
  'analysis.emotion.label': 'wzorce emocji według dni, osób i miejsc',
  'analysis.emotion.metric': 'Emocja „{emotion}”',
  'analysis.emotion.groupA': 'Dni z emocją „{emotion}”',
  'analysis.emotion.weekdayTitle': 'Emocja „{emotion}” pojawia się głównie {onWeekday}',
  'analysis.emotion.weekdayText':
    'Wygląda na to, że w twoich danych emocja „{emotion}” pojawiała się głównie {onWeekday} ({top} z {total} razy).',
  'analysis.emotion.weekdayExplain':
    'Sprawdzono {count, plural, one {# dzień} few {# dni} many {# dni} other {# dnia}}. Emocję „{emotion}” odnotowano {total, plural, one {w # dniu} few {w # dniach} many {w # dniach} other {w # dnia}}; {top} z nich to {weekdays} ({share}), podczas gdy {weekdays} stanowią {baseline} wszystkich sprawdzonych dni. Siła wzorca: {strength}.',
  'analysis.emotion.groupBWeekday': 'Z tego: {weekdays}',
  'analysis.emotion.weekdayShareKey': 'Udział wśród wszystkich dni: {weekdays}',
  'analysis.emotion.personTitle': 'Emocja „{emotion}” i {name}',
  'analysis.emotion.placeTitle': 'Emocja „{emotion}” i „{place}”',
  'analysis.emotion.personText':
    'Wygląda na to, że w twoich danych emocja „{emotion}” często pojawiała się w dni, w których we wpisie występuje {name} ({with} z {total} razy).',
  'analysis.emotion.placeText':
    'Wygląda na to, że w twoich danych emocja „{emotion}” często pojawiała się w dni, w których miejscem było „{place}” ({with} z {total} razy).',
  'analysis.emotion.personExplain':
    'Sprawdzono {count, plural, one {# dzień} few {# dni} many {# dni} other {# dnia}}. Emocję „{emotion}” odnotowano w {total} dniach; w {with} z nich ({share}) we wpisie pojawia się też {name}. {name} pojawia się łącznie w {baselineCount} z {count} dni ({baseline}). Siła wzorca: {strength}.',
  'analysis.emotion.placeExplain':
    'Sprawdzono {count, plural, one {# dzień} few {# dni} many {# dni} other {# dnia}}. Emocję „{emotion}” odnotowano w {total} dniach; w {with} z nich ({share}) we wpisie pojawia się też miejsce „{place}”. Miejsce „{place}” pojawia się łącznie w {baselineCount} z {count} dni ({baseline}). Siła wzorca: {strength}.',
  'analysis.emotion.groupBPerson': 'Z tego z udziałem: {name}',
  'analysis.emotion.groupBPlace': 'Z tego w miejscu „{place}”',
  'analysis.emotion.personShareKey': '{name} – udział wśród wszystkich dni',
  'analysis.emotion.placeShareKey': 'Udział miejsca „{place}” wśród wszystkich dni',
  'analysis.emotion.nothing':
    '{count, plural, one {Sprawdzono # emocję, która pojawiła się} few {Sprawdzono # emocje, które pojawiły się} many {Sprawdzono # emocji, które pojawiły się} other {Sprawdzono # emocji, które pojawiły się}} co najmniej {min} razy, i nie znaleziono wyraźnego skupienia w określonych dniach, przy określonych osobach ani w określonych miejscach.',
};
export default messages;
