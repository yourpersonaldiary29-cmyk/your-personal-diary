/**
 * ro - analysis messages (server-side insight templates, notes and labels). Keys are prefixed
 * 'analysis.'; see shared/i18n/index.ts for the template syntax and the English file for the
 * conventions.
 *
 * Romanian notes:
 *  - Every sentence is hedged ("Se pare că...", "ar putea exista o legătură") and never causal.
 *  - Labels are articulated nouns ("dispoziția", "nivelul de stres") and `metricDefined`
 *    already carries the possessive ("dispoziția ta", "nivelul tău de stres"); sentences keep
 *    both in the nominative/accusative, so no genitive forms are needed.
 *  - `gender` classes: 'f' (dispoziția, calitatea somnului -> "mai bună / mai scăzută"),
 *    'n' (nivelul de energie / de stres -> "mai ridicat / mai scăzut") and 'fd' for the feminine
 *    duration nouns (durata somnului, durata activității fizice -> "mai lungă / mai scurtă").
 *  - Counts use one / few / other; "de" is inserted from 20 on ("20 de zile").
 */
const messages: Record<string, string> = {
  // Engine / provider -----------------------------------------------------------------
  'analysis.engine.providerFailed': 'Analiza tiparelor nu s-a încheiat (eroare internă). Încearcă din nou mai târziu.',
  'analysis.engine.detectorFailed': 'Verificarea „{label}” nu s-a încheiat (eroare internă); celelalte observații nu sunt afectate.',

  // Strength --------------------------------------------------------------------------
  'analysis.strength.weak': 'slabă',
  'analysis.strength.moderate': 'moderată',
  'analysis.strength.strong': 'puternică',

  // Metrics: label (short, standalone), defined (subject inside a sentence), gender -----
  'analysis.metric.mood.label': 'dispoziția',
  'analysis.metric.mood.defined': 'dispoziția ta',
  'analysis.metric.mood.gender': 'f',
  'analysis.metric.energy.label': 'nivelul de energie',
  'analysis.metric.energy.defined': 'nivelul tău de energie',
  'analysis.metric.energy.gender': 'n',
  'analysis.metric.stress.label': 'nivelul de stres',
  'analysis.metric.stress.defined': 'nivelul tău de stres',
  'analysis.metric.stress.gender': 'n',
  'analysis.metric.sleepHours.label': 'durata somnului',
  'analysis.metric.sleepHours.defined': 'durata somnului tău',
  'analysis.metric.sleepHours.gender': 'fd',
  'analysis.metric.sleepQuality.label': 'calitatea somnului',
  'analysis.metric.sleepQuality.defined': 'calitatea somnului tău',
  'analysis.metric.sleepQuality.gender': 'f',
  'analysis.metric.exerciseMinutes.label': 'durata activității fizice',
  'analysis.metric.exerciseMinutes.defined': 'durata activității tale fizice',
  'analysis.metric.exerciseMinutes.gender': 'fd',
  'analysis.metric.entries.label': 'însemnările din jurnal',
  'analysis.metric.entries.defined': 'numărul însemnărilor tale',
  'analysis.metric.entries.gender': 'n',

  // Counts and dates ------------------------------------------------------------------
  'analysis.count.days': '{count, plural, one {# zi} few {# zile} other {# de zile}}',
  'analysis.count.weeks': '{count, plural, one {# săptămână} few {# săptămâni} other {# de săptămâni}}',
  'analysis.date.dayWithDate': '{weekday}, {date}',

  // Weekdays (index 0 = Sunday) --------------------------------------------------------
  'analysis.weekday.plural.0': 'zilele de duminică',
  'analysis.weekday.plural.1': 'zilele de luni',
  'analysis.weekday.plural.2': 'zilele de marți',
  'analysis.weekday.plural.3': 'zilele de miercuri',
  'analysis.weekday.plural.4': 'zilele de joi',
  'analysis.weekday.plural.5': 'zilele de vineri',
  'analysis.weekday.plural.6': 'zilele de sâmbătă',
  'analysis.weekday.on.0': 'duminica',
  'analysis.weekday.on.1': 'lunea',
  'analysis.weekday.on.2': 'marțea',
  'analysis.weekday.on.3': 'miercurea',
  'analysis.weekday.on.4': 'joia',
  'analysis.weekday.on.5': 'vinerea',
  'analysis.weekday.on.6': 'sâmbăta',

  // Notes shared by the detectors -------------------------------------------------------
  'analysis.note.insufficient': 'Încă nu există suficiente date pentru a verifica {what} (este nevoie de cel puțin {required}; ai {have}).',
  'analysis.note.insufficientWhether': 'Încă nu există suficiente date pentru a verifica {what} (este nevoie de cel puțin {required}; ai {have}).',
  'analysis.note.nothingNotable':
    'Am verificat {what} {count, plural, one {pe parcursul unei zile} few {pe parcursul a # zile} other {pe parcursul a # de zile}} și nu am găsit nicio diferență notabilă.',

  // Requirement / availability phrases used inside the notes above ----------------------
  'analysis.req.daysBothValues': '{count, plural, one {# zi cu ambele valori} few {# zile cu ambele valori} other {# de zile cu ambele valori}}',
  'analysis.req.daysPerGroup': '{count, plural, one {# zi în fiecare grup} few {# zile în fiecare grup} other {# de zile în fiecare grup}}',
  'analysis.req.daysWithReport': '{count, plural, one {# zi cu valori raportate} few {# zile cu valori raportate} other {# de zile cu valori raportate}}',
  'analysis.req.daysWithRatings': '{count, plural, one {# zi cu evaluări} few {# zile cu evaluări} other {# de zile cu evaluări}}',
  'analysis.req.daysPerMonth':
    '{count, plural, one {# zi cu valori raportate în fiecare lună} few {# zile cu valori raportate în fiecare lună} other {# de zile cu valori raportate în fiecare lună}}',
  'analysis.req.recentDays':
    '{count, plural, one {# zi cu valori raportate în ultimele două săptămâni} few {# zile cu valori raportate în ultimele două săptămâni} other {# de zile cu valori raportate în ultimele două săptămâni}}',
  'analysis.req.fullWeeks':
    '{count, plural, one {# săptămână completă cu valori raportate} few {# săptămâni complete cu valori raportate} other {# de săptămâni complete cu valori raportate}}',
  'analysis.req.weeksOfLogs': '{count, plural, one {# săptămână de înregistrări} few {# săptămâni de înregistrări} other {# de săptămâni de înregistrări}}',
  'analysis.req.weekPerGroup': 'o săptămână în fiecare grup și {count, plural, one {# zi} few {# zile} other {# de zile}} cu valori raportate în fiecare grup',
  'analysis.req.moodReports':
    '{count, plural, one {# valoare raportată pentru dispoziție} few {# valori raportate pentru dispoziție} other {# de valori raportate pentru dispoziție}}',
  'analysis.req.reportsInWindow':
    '{count, plural, one {# valoare raportată într-un singur interval orar} few {# valori raportate într-un singur interval orar} other {# de valori raportate într-un singur interval orar}}',
  'analysis.req.emotionRepeated': 'o emoție raportată în {count, plural, one {# zi} few {# zile} other {# de zile}}',
  'analysis.have.twoGroups':
    '{groupA}: {countA, plural, one {# zi} few {# zile} other {# de zile}}; {groupB}: {countB, plural, one {# zi} few {# zile} other {# de zile}}',
  'analysis.have.weeksTwoGroups':
    'săptămâni cu ținta atinsă: {metWeeks, plural, one {# săptămână} few {# săptămâni} other {# de săptămâni}} ({metDays, plural, one {# zi} few {# zile} other {# de zile}}); săptămâni sub țintă: {belowWeeks, plural, one {# săptămână} few {# săptămâni} other {# de săptămâni}} ({belowDays, plural, one {# zi} few {# zile} other {# de zile}})',
  'analysis.have.twoMonths':
    '{countA, plural, one {# zi} few {# zile} other {# de zile}} în {cur} și {countB, plural, one {# zi} few {# zile} other {# de zile}} în {prev}',
  'analysis.have.noData': 'nicio dată',
  'analysis.have.noSuchEmotion': 'niciuna deocamdată',
  'analysis.have.fewerInEveryWindow': 'mai puține în fiecare interval',

  // Sentences shared by the group-comparison detectors ----------------------------------
  'analysis.relation.text':
    'Se pare că, în datele tale, {condition}, {metricDefined} {gender, select, f {a fost în medie {direction, select, higher {mai bună} other {mai scăzută}}} fd {a fost în medie {direction, select, higher {mai lungă} other {mai scurtă}}} other {a fost în medie {direction, select, higher {mai ridicat} other {mai scăzut}}}} ({meanA} față de {meanB}).',
  'analysis.correlation.text':
    'Se pare că în datele tale ar putea exista o legătură între {x} și {y}: {xGender, select, f {când {x} era mai bună} fd {când {x} era mai lungă} other {când {x} era mai ridicat}}, {yGender, select, f {{y} tindea să fie {direction, select, higher {mai bună} other {mai scăzută}}} fd {{y} tindea să fie {direction, select, higher {mai lungă} other {mai scurtă}}} other {{y} tindea să fie {direction, select, higher {mai ridicat} other {mai scăzut}}}} (corelație {r}).',
  'analysis.explain.checkedDays': 'Am verificat {count, plural, one {# zi} few {# zile} other {# de zile}}.',
  'analysis.explain.onDaysCondition': 'În {count, plural, one {# zi} few {# zile} other {# de zile}} {conditionPast}.',
  'analysis.explain.groupMeans':
    'În acele zile, {metricDefined} {gender, select, other {a avut în medie valoarea {meanA}}}, față de {meanB} în celelalte zile.',
  'analysis.explain.correlation': 'Corelație: {r}.',
  'analysis.explain.correlationBetween': 'Corelația dintre {predictor} și {outcome}: {r}.',
  'analysis.explain.diffAndStrength': 'Diferența dintre medii: {diff} puncte. Intensitatea tiparului: {strength}.',
  'analysis.explain.diffStrength': 'Diferență: {diff} puncte. Intensitatea tiparului: {strength}.',
  'analysis.split.corrExplainChecked':
    'Am verificat {count, plural, one {# zi} few {# zile} other {# de zile}} în care au fost raportate atât {x}, cât și {y}.',
  'analysis.split.corrExplainPearson': 'Corelația Pearson: {r} (intensitate: {strength}).',
  'analysis.split.corrExplainGroups':
    'Nu au existat suficiente zile în fiecare grup pentru a compara mediile ({groupA}: {countA, plural, one {# zi} few {# zile} other {# de zile}}; {groupB}: {countB, plural, one {# zi} few {# zile} other {# de zile}}; este nevoie de cel puțin {min} în fiecare grup).',

  // Evidence table keys ---------------------------------------------------------------
  'analysis.extra.predictor': 'Predictor',
  'analysis.extra.strength': 'Intensitate',
  'analysis.extra.meanDiff': 'Diferența mediilor (A minus B)',
  'analysis.extra.cohenD': 'Mărimea efectului (d al lui Cohen)',
  'analysis.extra.weeksChecked': 'Săptămâni verificate',
  'analysis.extra.weeklyTarget': 'Țintă săptămânală',
  'analysis.extra.target': 'Țintă',
  'analysis.extra.frequency': 'Frecvență',
  'analysis.extra.periodMean': 'Media perioadei',
  'analysis.extra.overallMean': 'Media generală',
  'analysis.extra.stddev': 'Abaterea standard',
  'analysis.extra.slopePerDay': 'Panta pe zi',
  'analysis.extra.daysInWindow': 'Zile în interval',
  'analysis.extra.movingWindow': 'Intervalul mediei mobile',
  'analysis.extra.relativeChange': 'Schimbare relativă',
  'analysis.extra.longestStreak': 'Cea mai lungă serie din perioadă',
  'analysis.extra.shareOfEmotionDays': 'Ponderea din zilele cu această emoție',
  'analysis.frequency.daily': 'zilnic',
  'analysis.frequency.weekly': 'săptămânal',
  'analysis.groupB.otherDays': 'Celelalte zile',

  // Sleep detectors -------------------------------------------------------------------
  'analysis.sleep.groupA': 'Zile cu mai puțin de {hours} ore de somn',
  'analysis.sleep.groupB': 'Zile cu {hours} ore de somn sau mai mult',
  'analysis.sleep.condition': 'în zilele în care ai dormit mai puțin de {hours} ore',
  'analysis.sleep.conditionPast': 'ai dormit mai puțin de {hours} ore',
  'analysis.sleepMood.label': 'legătura dintre somn și dispoziție',
  'analysis.sleepMood.title': '{direction, select, lower {Somn scurt și dispoziție mai scăzută} other {Somn scurt și dispoziție mai bună}}',
  'analysis.sleepMood.corrTitle': 'Posibilă legătură între durata somnului și dispoziție',
  'analysis.sleepEnergy.label': 'legătura dintre somn și nivelul de energie',
  'analysis.sleepEnergy.title': '{direction, select, lower {Somn scurt și energie mai scăzută} other {Somn scurt și energie mai ridicată}}',
  'analysis.sleepEnergy.corrTitle': 'Posibilă legătură între durata somnului și nivelul de energie',

  // Exercise detectors ----------------------------------------------------------------
  'analysis.exercise.groupA': 'Zile cu activitate fizică',
  'analysis.exercise.groupB': 'Zile fără activitate fizică',
  'analysis.exercise.condition': 'în zilele în care ai făcut sport',
  'analysis.exercise.conditionPast': 'ai făcut sport',
  'analysis.exerciseMood.label': 'legătura dintre activitatea fizică și dispoziție',
  'analysis.exerciseMood.title': '{direction, select, higher {Activitate fizică și dispoziție mai bună} other {Activitate fizică și dispoziție mai scăzută}}',
  'analysis.exerciseMood.corrTitle': 'Posibilă legătură între durata activității fizice și dispoziție',
  'analysis.exerciseEnergy.label': 'legătura dintre activitatea fizică și nivelul de energie',
  'analysis.exerciseEnergy.title': '{direction, select, higher {Activitate fizică și energie mai ridicată} other {Activitate fizică și energie mai scăzută}}',
  'analysis.exerciseEnergy.corrTitle': 'Posibilă legătură între durata activității fizice și nivelul de energie',

  // Habit - mood / energy / stress ------------------------------------------------------
  'analysis.habit.detectorLabel': 'legătura dintre obiceiuri și dispoziție',
  'analysis.habit.noHabits': 'Nu există obiceiuri active, așa că nu am verificat legătura dintre obiceiuri și dispoziție.',
  'analysis.habit.noLogs': 'Obiceiul „{habit}” nu are încă înregistrări în această perioadă, așa că nu am verificat legătura dintre el și dispoziție.',
  'analysis.habit.noFullWeeks': 'Obiceiul „{habit}” nu are încă săptămâni complete cu înregistrări, așa că nu am verificat legătura dintre el și dispoziție.',
  'analysis.habit.label': 'legătura dintre obiceiul „{habit}” și {metric}',
  'analysis.habit.groupA': 'Zile în care obiceiul „{habit}” a fost îndeplinit',
  'analysis.habit.groupB': 'Zile în care obiceiul „{habit}” nu a fost îndeplinit',
  'analysis.habit.condition': 'în zilele în care ai îndeplinit obiceiul „{habit}”',
  'analysis.habit.conditionPast': 'ai îndeplinit obiceiul „{habit}”',
  'analysis.habit.title':
    'Obiceiul „{habit}” și {metric} {gender, select, f {{direction, select, higher {în medie mai bună} other {în medie mai scăzută}}} fd {{direction, select, higher {în medie mai lungă} other {în medie mai scurtă}}} other {{direction, select, higher {în medie mai ridicat} other {în medie mai scăzut}}}}',
  'analysis.habit.corrTitle': 'Posibilă legătură între obiceiul „{habit}” și {metric}',
  'analysis.habit.weeklyCondition': 'în săptămânile în care ai atins ținta obiceiului „{habit}”',
  'analysis.habit.weeklyTarget': '{target} {unit} pe săptămână',
  'analysis.habit.targetValue': '{target} {unit}',
  'analysis.habit.weeklyExplainChecked':
    'Am verificat {weeks, plural, one {# săptămână completă} few {# săptămâni complete} other {# de săptămâni complete}} ({days, plural, one {# zi} few {# zile} other {# de zile}} în care ai raportat {metric}).',
  'analysis.habit.weeklyExplainMet': 'În {count, plural, one {# săptămână} few {# săptămâni} other {# de săptămâni}} ai atins ținta obiceiului ({target}).',
  'analysis.habit.weeklyExplainMeans':
    'În zilele acelor săptămâni, {metricDefined} {gender, select, other {a avut în medie valoarea {meanA}}}, față de {meanB} {count, plural, one {în zilele săptămânii sub țintă} few {în zilele celor # săptămâni sub țintă} other {în zilele celor # de săptămâni sub țintă}}.',
  'analysis.habit.groupAWeeks': 'Zile din săptămânile cu ținta atinsă ({count, plural, one {# săptămână} few {# săptămâni} other {# de săptămâni}})',
  'analysis.habit.groupBWeeks': 'Zile din săptămânile sub țintă ({count, plural, one {# săptămână} few {# săptămâni} other {# de săptămâni}})',

  // Weekday differences -----------------------------------------------------------------
  'analysis.weekday.label': 'diferențele dintre zilele săptămânii',
  'analysis.weekday.text':
    'Se pare că, în datele tale, {onWeekday}, {metricDefined} {gender, select, f {a fost în medie {direction, select, higher {mai bună} other {mai scăzută}}} fd {a fost în medie {direction, select, higher {mai lungă} other {mai scurtă}}} other {a fost în medie {direction, select, higher {mai ridicat} other {mai scăzut}}}} decât în celelalte zile ale săptămânii ({meanA} față de {meanB}).',
  'analysis.weekday.explainChecked':
    'Am verificat {count, plural, one {# zi} few {# zile} other {# de zile}} în care ai raportat {metric}, dintre care {countA} au căzut în {weekdays}.',
  'analysis.weekday.explainMeans':
    'În medie, {metricDefined} {gender, select, other {a avut {onWeekday} valoarea {meanA}}}, față de {meanB} în celelalte zile.',
  'analysis.weekday.title':
    'În {weekdays}: {metric} {gender, select, f {{direction, select, higher {în medie mai bună} other {în medie mai scăzută}}} fd {{direction, select, higher {în medie mai lungă} other {în medie mai scurtă}}} other {{direction, select, higher {în medie mai ridicat} other {în medie mai scăzut}}}}',
  'analysis.weekday.groupB': 'Celelalte zile ale săptămânii',
  'analysis.weekday.tableValue': '{mean} ({count, plural, one {# zi} few {# zile} other {# de zile}})',
  'analysis.weekday.nothing':
    'Am căutat diferențe între zilele săptămânii {count, plural, one {pe parcursul unei zile} few {pe parcursul a # zile} other {pe parcursul a # de zile}} și nu am găsit nicio diferență notabilă.',

  // Time of day -------------------------------------------------------------------------
  'analysis.timeOfDay.label': 'legătura dintre momentul scrierii și dispoziție',
  'analysis.timeOfDay.morning.label': 'Dimineața',
  'analysis.timeOfDay.morning.phrase': 'dimineața',
  'analysis.timeOfDay.late_morning.label': 'Înainte de prânz',
  'analysis.timeOfDay.late_morning.phrase': 'înainte de prânz',
  'analysis.timeOfDay.afternoon.label': 'După-amiaza',
  'analysis.timeOfDay.afternoon.phrase': 'după-amiaza',
  'analysis.timeOfDay.evening.label': 'Seara',
  'analysis.timeOfDay.evening.phrase': 'seara',
  'analysis.timeOfDay.night.label': 'Noaptea',
  'analysis.timeOfDay.night.phrase': 'noaptea',
  'analysis.timeOfDay.tableKey': '{label} ({hours})',
  'analysis.timeOfDay.tableValue': 'media {mean}, {count, plural, one {# valoare raportată} few {# valori raportate} other {# de valori raportate}}',
  'analysis.timeOfDay.tableRow': '{key}: {value}',
  'analysis.timeOfDay.nothing':
    'Am verificat {label} {count, plural, one {pe baza unei singure valori raportate} few {pe baza a # valori raportate} other {pe baza a # de valori raportate}} și nu am găsit niciun interval orar care să iasă în evidență peste medie.',
  'analysis.timeOfDay.text':
    'Se pare că, în datele tale, dispoziția pe care ai raportat-o {phrase} ({hours}) a fost cea mai bună: în medie {mean}, față de {overall} în toate valorile raportate.',
  'analysis.timeOfDay.explainChecked':
    'Am verificat {count, plural, one {# valoare a dispoziției} few {# valori ale dispoziției} other {# de valori ale dispoziției}} din {days, plural, one {# zi} few {# zile} other {# de zile}}, în funcție de ora la care a fost scrisă însemnarea.',
  'analysis.timeOfDay.explainTable': '{table}. Media generală: {overall}.',
  'analysis.timeOfDay.explainDiff': 'Diferența dintre intervalul orar cu media cea mai mare și media generală: {diff} puncte. Intensitatea tiparului: {strength}.',
  'analysis.timeOfDay.title': 'Dispoziție mai bună {phrase}',
  'analysis.timeOfDay.groupA': 'Valori raportate {phrase} ({hours})',
  'analysis.timeOfDay.groupB': 'Celelalte valori raportate',

  // Trends ------------------------------------------------------------------------------
  'analysis.trends.label': 'tendințele dispoziției, stresului și somnului',
  'analysis.trends.text':
    'Se pare că, în datele tale, {metricDefined} {gender, select, other {are o {direction, select, up {tendință de creștere} other {tendință de scădere}}}} {horizon, select, period {în întreaga perioadă} monthly {în ultima lună} other {în ultimele două săptămâni}}: linia de tendință a mediei mobile {direction, select, up {a urcat de la} other {a coborât de la}} {fromValue} la {toValue}.',
  'analysis.trends.explainChecked':
    'Am verificat {count, plural, one {# zi} few {# zile} other {# de zile}} în care ai raportat {metric}, din {horizon, select, period {{len, plural, one {singura zi a perioadei} few {cele # zile ale perioadei} other {cele # de zile ale perioadei}}} other {{len, plural, one {cea mai recentă zi} few {cele mai recente # zile} other {cele mai recente # de zile}}}} ({from}–{to}).',
  'analysis.trends.explainFit':
    'Am calculat o medie mobilă pe {window} zile și, prin ea, o linie de tendință (regresie liniară): {direction, select, up {o pantă ascendentă} other {o pantă descendentă}} de {unit, select, hours {{slope} ore} other {{slope} puncte}} pe zi, adică o schimbare de aproximativ {unit, select, hours {{change} ore} other {{change} puncte}} pe parcursul intervalului (de la {fromValue} la {toValue} de-a lungul liniei de tendință). Intensitatea tendinței: {strength}.',
  'analysis.trends.title':
    '{direction, select, up {Tendință de creștere} other {Tendință de scădere}} {metric, select, mood {a dispoziției tale} energy {a nivelului tău de energie} stress {a nivelului tău de stres} sleepHours {a duratei somnului tău} sleepQuality {a calității somnului tău} exerciseMinutes {a duratei activității tale fizice} other {a numărului de însemnări}} {horizon, select, period {în întreaga perioadă} monthly {în ultima lună} other {în ultimele două săptămâni}}',
  'analysis.trends.groupA': 'Începutul intervalului (linia de tendință)',
  'analysis.trends.groupB': 'Sfârșitul intervalului (linia de tendință)',
  'analysis.trends.slopeValue': '{unit, select, hours {{slope} ore} other {{slope} puncte}}',
  'analysis.trends.nothingSince': 'Am căutat tendințe ale dispoziției, stresului și somnului începând cu {from} și nu am găsit nicio tendință notabilă.',
  'analysis.trends.nothingAll': 'Am căutat tendințe ale dispoziției, stresului și somnului în întreaga perioadă și nu am găsit nicio tendință notabilă.',

  // Month comparison --------------------------------------------------------------------
  'analysis.periodCompare.label': 'comparația dintre luna curentă și luna precedentă',
  'analysis.periodCompare.text':
    'Se pare că, în datele tale, {metricDefined} {gender, select, f {a fost în {cur} în medie {direction, select, higher {mai bună} other {mai scăzută}}} fd {a fost în {cur} în medie {direction, select, higher {mai lungă} other {mai scurtă}}} other {a fost în {cur} în medie {direction, select, higher {mai ridicat} other {mai scăzut}}}} decât în {prev} ({meanA} față de {meanB}).',
  'analysis.periodCompare.explain':
    'Am comparat zilele în care ai raportat {metric} în {cur} ({countA, plural, one {# zi} few {# zile} other {# de zile}}, până azi) cu zilele din {prev} ({countB, plural, one {# zi} few {# zile} other {# de zile}}). Media în {cur}: {meanA}; în {prev}: {meanB}. Diferență: {unit, select, hours {{diff} ore} other {{diff} puncte}}. Intensitatea diferenței: {strength}.',
  'analysis.periodCompare.title':
    'În {cur}: {metric} {gender, select, f {{direction, select, higher {mai bună} other {mai scăzută}}} fd {{direction, select, higher {mai lungă} other {mai scurtă}}} other {{direction, select, higher {mai ridicat} other {mai scăzut}}}} decât în {prev}',
  'analysis.periodCompare.entriesText':
    'Se pare că ai {direction, select, more {scris mai mult} other {scris mai puțin}} în {window, plural, one {prima zi} few {primele # zile} other {primele # de zile}} din {cur} ({countA, plural, one {# însemnare} few {# însemnări} other {# de însemnări}}) decât în {window, plural, one {prima zi} few {primele # zile} other {primele # de zile}} din {prev} ({countB, plural, one {# însemnare} few {# însemnări} other {# de însemnări}}).',
  'analysis.periodCompare.entriesExplain':
    'Am numărat însemnările din {window, plural, one {prima zi} few {primele # zile} other {primele # de zile}} ale fiecărei luni, ca să compar intervale egale: {cur} – {countA, plural, one {# însemnare} few {# însemnări} other {# de însemnări}}, {prev} – {countB, plural, one {# însemnare} few {# însemnări} other {# de însemnări}}. Diferență: {diff, plural, one {# însemnare} few {# însemnări} other {# de însemnări}} ({percent}). Intensitatea diferenței: {strength}.',
  'analysis.periodCompare.entriesTitle': '{direction, select, more {Mai multe însemnări} other {Mai puține însemnări}} în {cur} decât în {prev}',
  'analysis.periodCompare.monthWindow': '{month} ({window, plural, one {prima zi} few {primele # zile} other {primele # de zile}})',
  'analysis.periodCompare.insufficientWhat': 'comparația dintre {cur} și {prev}',
  'analysis.periodCompare.nothing': 'Am comparat {cur} cu {prev} și nu am găsit nicio diferență notabilă la dispoziție, stres, somn sau numărul de însemnări.',

  // Habit trend (improved / declined) -----------------------------------------------------
  'analysis.habitsTrend.label': 'obiceiurile care s-au îmbunătățit sau s-au înrăutățit',
  'analysis.habitsTrend.whether': 'dacă obiceiul „{habit}” s-a îmbunătățit sau s-a înrăutățit',
  'analysis.habitsTrend.textDaily':
    'Se pare că obiceiul „{habit}” {direction, select, improved {s-a îmbunătățit} other {s-a înrăutățit}}: în ultimele două săptămâni l-ai îndeplinit în {recent} din {window} zile, față de {previous} din {window} în cele două săptămâni dinainte.',
  'analysis.habitsTrend.textWeekly':
    'Se pare că obiceiul „{habit}” {direction, select, improved {s-a îmbunătățit} other {s-a înrăutățit}}: în ultimele două săptămâni ai înregistrat {recent} {unit}, față de {previous} în cele două săptămâni dinainte (țintă: {target} {unit} pe săptămână).',
  'analysis.habitsTrend.explain':
    'Am comparat rata de îndeplinire a obiceiului din ultimele două săptămâni ({recentFrom}–{recentTo}) cu cea din cele două săptămâni dinainte ({previousFrom}–{previousTo}): {recentRate} față de {previousRate}. Diferență: {diff} puncte procentuale. Intensitatea schimbării: {strength}.',
  'analysis.habitsTrend.title': 'Obiceiul „{habit}” {direction, select, improved {s-a îmbunătățit} other {s-a înrăutățit}} în ultimele două săptămâni',
  'analysis.habitsTrend.metric': 'Rata de îndeplinire – {habit}',
  'analysis.habitsTrend.groupA': 'Ultimele două săptămâni',
  'analysis.habitsTrend.groupB': 'Cele două săptămâni anterioare',

  // Best / hardest days ------------------------------------------------------------------
  'analysis.bestWorst.label': 'cele mai bune și cele mai grele zile',
  'analysis.bestWorst.describedDay': '{day} („{title}”)',
  'analysis.bestWorst.noTitle': 'Fără titlu',
  'analysis.bestWorst.extraValue': '{titles} – scor {score}',
  'analysis.bestWorst.text':
    '{kind, select, best {Cele mai bune zile} other {Cele mai grele zile}} din perioadă, după un scor combinat al dispoziției, energiei și stresului: {days}.',
  'analysis.bestWorst.explainScore':
    'Pentru {count, plural, one {ziua respectivă} few {fiecare dintre cele # zile} other {fiecare dintre cele # de zile}} am calculat un scor combinat: media dintre dispoziție, nivelul de energie și (11 minus nivelul de stres), din valorile raportate în acea zi.',
  'analysis.bestWorst.explainMeans':
    'Scorul mediu din perioadă: {overall}. {kind, select, best {{count, plural, one {Cea mai bună zi a avut} =3 {Cele mai bune trei zile au avut} other {Cele mai bune zile au avut}}} other {{count, plural, one {Cea mai grea zi a avut} =3 {Cele mai grele trei zile au avut} other {Cele mai grele zile au avut}}}} în medie {mean}.',
  'analysis.bestWorst.explainDiff': 'Diferența față de medie: {diff} puncte. Intensitatea diferenței: {strength}.',
  'analysis.bestWorst.title': '{kind, select, best {Cele mai bune zile din perioadă} other {Cele mai grele zile din perioadă}}',
  'analysis.bestWorst.metric': 'Scor combinat (dispoziție + energie + stres inversat)',
  'analysis.bestWorst.groupA': '{kind, select, best {Cele mai bune zile} other {Cele mai grele zile}}',
  'analysis.bestWorst.nothing':
    'Am verificat {label} {count, plural, one {pe parcursul unei zile} few {pe parcursul a # zile} other {pe parcursul a # de zile}}; scorurile au fost asemănătoare și nicio zi nu a ieșit în evidență.',

  // Streaks -------------------------------------------------------------------------------
  'analysis.streaks.label': 'seriile de scris și de obiceiuri',
  'analysis.streaks.entriesTitle': 'Serie de scris de {count, plural, one {# zi} few {# zile} other {# de zile}}',
  'analysis.streaks.entriesText': 'Bravo! Ai scris în jurnal {count, plural, one {o zi la rând} few {# zile la rând} other {# de zile la rând}} ({from}–{to}).',
  'analysis.streaks.entriesExplain':
    'Am numărat zilele consecutive cu cel puțin o însemnare, până azi sau ieri. Seria curentă: {count, plural, one {# zi} few {# zile} other {# de zile}}, de la {from} până la {to}. Cea mai lungă serie din perioadă: {best, plural, one {# zi} few {# zile} other {# de zile}}.',
  'analysis.streaks.entriesMetric': 'Zile de scris',
  'analysis.streaks.currentDays': 'Zile în seria curentă',
  'analysis.streaks.daysWithEntry': 'Zile cu însemnări în perioadă',
  'analysis.streaks.habitTitle': 'Serie de {count, plural, one {# zi} few {# zile} other {# de zile}} pentru obiceiul „{habit}”',
  'analysis.streaks.habitText': 'Ai îndeplinit obiceiul „{habit}” {count, plural, one {o zi la rând} few {# zile la rând} other {# de zile la rând}} ({from}–{to}).',
  'analysis.streaks.habitExplain':
    'Am numărat zilele consecutive în care obiceiul „{habit}” a fost marcat ca îndeplinit, până azi sau ieri. Seria curentă: {count, plural, one {# zi} few {# zile} other {# de zile}}. Cea mai lungă serie din perioadă: {best, plural, one {# zi} few {# zile} other {# de zile}}.',
  'analysis.streaks.habitMetric': 'Îndeplinirea obiceiului {habit}',
  'analysis.streaks.daysCompleted': 'Zile din perioadă în care obiceiul a fost îndeplinit',
  'analysis.streaks.weeklyTitle': 'Serie de {count, plural, one {# săptămână} few {# săptămâni} other {# de săptămâni}} pentru obiceiul „{habit}”',
  'analysis.streaks.weeklyText':
    'Ai atins ținta obiceiului „{habit}” {count, plural, one {o săptămână la rând} few {# săptămâni la rând} other {# de săptămâni la rând}} ({from}–{to}).',
  'analysis.streaks.weeklyExplain':
    'Am adunat cantitatea înregistrată pentru obiceiul „{habit}” în fiecare săptămână și am comparat-o cu ținta săptămânală ({target}). Seria curentă de săptămâni cu ținta atinsă: {count, plural, one {# săptămână} few {# săptămâni} other {# de săptămâni}}.',
  'analysis.streaks.weeklyMetric': 'Țintă săptămânală atinsă – {habit}',
  'analysis.streaks.currentWeeks': 'Săptămâni în seria curentă',
  'analysis.streaks.weeksWithLogs': 'Săptămâni cu înregistrări în perioadă',
  'analysis.streaks.none':
    'Nu au fost găsite serii active (o serie de scris de cel puțin {entryMin} zile sau o serie a unui obicei de cel puțin {habitMin} zile sau săptămâni).',

  // Anomalies -----------------------------------------------------------------------------
  'analysis.anomalies.label': 'zilele neobișnuite ca dispoziție sau stres',
  'analysis.anomalies.textOne':
    'Se pare că, {day}, {metricDefined} {gender, select, f {{side, select, high {a fost neobișnuit de bună} other {a fost neobișnuit de scăzută}}} fd {{side, select, high {a fost neobișnuit de lungă} other {a fost neobișnuit de scurtă}}} other {{side, select, high {a fost neobișnuit de ridicat} other {a fost neobișnuit de scăzut}}}} față de restul perioadei ({value}, față de o medie de {mean}).',
  'analysis.anomalies.textMany':
    'Se pare că în {count, plural, one {# zi} few {# zile} other {# de zile}} {metricDefined} {gender, select, f {{side, select, high {a fost neobișnuit de bună} other {a fost neobișnuit de scăzută}}} fd {{side, select, high {a fost neobișnuit de lungă} other {a fost neobișnuit de scurtă}}} other {{side, select, high {a fost neobișnuit de ridicat} other {a fost neobișnuit de scăzut}}}} față de restul perioadei: {days}; media din perioadă: {mean}.',
  'analysis.anomalies.textManyMore':
    'Se pare că în {count, plural, one {# zi} few {# zile} other {# de zile}} {metricDefined} {gender, select, f {{side, select, high {a fost neobișnuit de bună} other {a fost neobișnuit de scăzută}}} fd {{side, select, high {a fost neobișnuit de lungă} other {a fost neobișnuit de scurtă}}} other {{side, select, high {a fost neobișnuit de ridicat} other {a fost neobișnuit de scăzut}}}} față de restul perioadei: {days} și altele; media din perioadă: {mean}.',
  'analysis.anomalies.dayItem': '{day} ({value})',
  'analysis.anomalies.detail': '{date}: {value} ({z} abateri standard {side, select, above {peste medie} other {sub medie}})',
  'analysis.anomalies.explain':
    'Am verificat {count, plural, one {# zi} few {# zile} other {# de zile}} în care ai raportat {metric}. Medie: {mean}, abatere standard: {sd}. O zi este considerată neobișnuită când valoarea ei se află la {z} abateri standard sau mai mult de medie. {details}. Intensitatea abaterii: {strength}.',
  'analysis.anomalies.title':
    '{count, plural, one {O zi în care} few {Zile în care} other {Zile în care}} {metric} {gender, select, f {{side, select, high {a fost neobișnuit de bună} other {a fost neobișnuit de scăzută}}} fd {{side, select, high {a fost neobișnuit de lungă} other {a fost neobișnuit de scurtă}}} other {{side, select, high {a fost neobișnuit de ridicat} other {a fost neobișnuit de scăzut}}}}',
  'analysis.anomalies.groupA': 'Zile neobișnuite',
  'analysis.anomalies.zValue': '{value} (z {z})',
  'analysis.anomalies.nothing':
    'Am căutat zile neobișnuite {count, plural, one {pe parcursul unei zile} few {pe parcursul a # zile} other {pe parcursul a # de zile}} și nu am găsit nicio zi care să se abată de la medie cu {z} abateri standard sau mai mult.',

  // Emotion patterns ----------------------------------------------------------------------
  'analysis.emotion.label': 'tiparele emoțiilor după zile, oameni și locuri',
  'analysis.emotion.metric': 'Emoția {emotion}',
  'analysis.emotion.groupA': 'Zile cu emoția „{emotion}”',
  'analysis.emotion.weekdayTitle': 'Emoția „{emotion}” apare mai ales {onWeekday}',
  'analysis.emotion.weekdayText': 'Se pare că, în datele tale, emoția „{emotion}” a apărut mai ales {onWeekday} (de {top} ori din {total}).',
  'analysis.emotion.weekdayExplain':
    'Am verificat {count, plural, one {# zi} few {# zile} other {# de zile}}. Emoția „{emotion}” a fost raportată în {total, plural, one {# zi} few {# zile} other {# de zile}}; {top} dintre ele au căzut în {weekdays} ({share}), în timp ce {weekdays} reprezintă {baseline} din toate zilele verificate. Intensitatea tiparului: {strength}.',
  'analysis.emotion.groupBWeekday': 'Dintre ele, în {weekdays}',
  'analysis.emotion.weekdayShareKey': 'Ponderea pe care o au {weekdays} din toate zilele',
  'analysis.emotion.personTitle': 'Emoția „{emotion}” și {name}',
  'analysis.emotion.placeTitle': 'Emoția „{emotion}” și „{place}”',
  'analysis.emotion.personText':
    'Se pare că, în datele tale, emoția „{emotion}” a apărut des în zilele în care te-ai întâlnit cu {name} (de {with} ori din {total}).',
  'analysis.emotion.placeText':
    'Se pare că, în datele tale, emoția „{emotion}” a apărut des în zilele în care locul a fost „{place}” (de {with} ori din {total}).',
  'analysis.emotion.personExplain':
    'Am verificat {count, plural, one {# zi} few {# zile} other {# de zile}}. Emoția „{emotion}” a fost raportată în {total, plural, one {# zi} few {# zile} other {# de zile}}; în {with} dintre ele ({share}), {name} a apărut și în însemnare. {name} apare, în total, în {baselineCount} din toate zilele verificate ({baseline}). Intensitatea tiparului: {strength}.',
  'analysis.emotion.placeExplain':
    'Am verificat {count, plural, one {# zi} few {# zile} other {# de zile}}. Emoția „{emotion}” a fost raportată în {total, plural, one {# zi} few {# zile} other {# de zile}}; în {with} dintre ele ({share}), în însemnare a apărut și locul „{place}”. Locul „{place}” apare, în total, în {baselineCount} din toate zilele verificate ({baseline}). Intensitatea tiparului: {strength}.',
  'analysis.emotion.groupBPerson': 'Dintre ele, cu {name}',
  'analysis.emotion.groupBPlace': 'Dintre ele, la „{place}”',
  'analysis.emotion.personShareKey': 'Ponderea zilelor cu {name} din toate zilele',
  'analysis.emotion.placeShareKey': 'Ponderea zilelor cu locul „{place}” din toate zilele',
  'analysis.emotion.nothing':
    'Am verificat {count, plural, one {# emoție} few {# emoții} other {# de emoții}} care au revenit de cel puțin {min} ori și nu am găsit nicio concentrare notabilă în anumite zile, alături de anumiți oameni sau în anumite locuri.',
};
export default messages;
