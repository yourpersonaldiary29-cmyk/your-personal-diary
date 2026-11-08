/**
 * hu - analysis messages (server-side insight templates, notes and labels). Keys are prefixed
 * 'analysis.'; see shared/i18n/index.ts for the template syntax and the English file for the
 * conventions.
 *
 * Hungarian notes:
 *  - Every sentence is hedged ("Úgy tűnik, az adataid alapján…", "kapcsolat lehet") and never causal.
 *  - Hungarian has no grammatical gender; `gender` picks the comparative that suits the noun:
 *    'q' (hangulat, alvásminőség -> "jobb / rosszabb"), 'd' for durations (alvásidő, mozgással
 *    töltött idő -> "hosszabb / rövidebb") and 'n' (energiaszint, stresszszint, bejegyzések száma ->
 *    "magasabb / alacsonyabb").
 *  - `metricDefined` carries the article and the possessive ("a hangulatod", "az alvásidőd").
 *  - Placeholders never take a case suffix (vowel harmony, a/az): month names are followed by
 *    "hónapban", numbers by "értékről / értékre", names and labels stand after a colon.
 *  - Nouns after numerals are singular, so the plural forms are one / other with the same noun.
 */
const messages: Record<string, string> = {
  // Engine / provider -----------------------------------------------------------------
  'analysis.engine.providerFailed': 'A mintázatelemzés nem fejeződött be (belső hiba). Kérlek, próbáld újra később.',
  'analysis.engine.detectorFailed': 'Ez az ellenőrzés nem fejeződött be (belső hiba): „{label}”; a többi meglátás rendben van.',

  // Strength --------------------------------------------------------------------------
  'analysis.strength.weak': 'gyenge',
  'analysis.strength.moderate': 'közepes',
  'analysis.strength.strong': 'erős',

  // Metrics: label (short, standalone), defined (subject inside a sentence), gender -----
  'analysis.metric.mood.label': 'hangulat',
  'analysis.metric.mood.defined': 'a hangulatod',
  'analysis.metric.mood.gender': 'q',
  'analysis.metric.energy.label': 'energiaszint',
  'analysis.metric.energy.defined': 'az energiaszinted',
  'analysis.metric.energy.gender': 'n',
  'analysis.metric.stress.label': 'stresszszint',
  'analysis.metric.stress.defined': 'a stresszszinted',
  'analysis.metric.stress.gender': 'n',
  'analysis.metric.sleepHours.label': 'alvásidő',
  'analysis.metric.sleepHours.defined': 'az alvásidőd',
  'analysis.metric.sleepHours.gender': 'd',
  'analysis.metric.sleepQuality.label': 'alvásminőség',
  'analysis.metric.sleepQuality.defined': 'az alvásod minősége',
  'analysis.metric.sleepQuality.gender': 'q',
  'analysis.metric.exerciseMinutes.label': 'mozgással töltött idő',
  'analysis.metric.exerciseMinutes.defined': 'a mozgással töltött időd',
  'analysis.metric.exerciseMinutes.gender': 'd',
  'analysis.metric.entries.label': 'bejegyzésszám',
  'analysis.metric.entries.defined': 'a bejegyzéseid száma',
  'analysis.metric.entries.gender': 'n',

  // Counts and dates ------------------------------------------------------------------
  'analysis.count.days': '{count, plural, one {# nap} other {# nap}}',
  'analysis.count.weeks': '{count, plural, one {# hét} other {# hét}}',
  'analysis.date.dayWithDate': '{date}, {weekday}',

  // Weekdays (index 0 = Sunday) --------------------------------------------------------
  'analysis.weekday.plural.0': 'vasárnapok',
  'analysis.weekday.plural.1': 'hétfők',
  'analysis.weekday.plural.2': 'keddek',
  'analysis.weekday.plural.3': 'szerdák',
  'analysis.weekday.plural.4': 'csütörtökök',
  'analysis.weekday.plural.5': 'péntekek',
  'analysis.weekday.plural.6': 'szombatok',
  'analysis.weekday.on.0': 'vasárnaponként',
  'analysis.weekday.on.1': 'hétfőnként',
  'analysis.weekday.on.2': 'keddenként',
  'analysis.weekday.on.3': 'szerdánként',
  'analysis.weekday.on.4': 'csütörtökönként',
  'analysis.weekday.on.5': 'péntekenként',
  'analysis.weekday.on.6': 'szombatonként',

  // Notes shared by the detectors -------------------------------------------------------
  'analysis.note.insufficient': 'Nincs elég adat ehhez az ellenőrzéshez: {what} (legalább {required} szükséges; jelenleg: {have}).',
  'analysis.note.insufficientWhether': 'Nincs elég adat annak ellenőrzéséhez, {what} (legalább {required} szükséges; jelenleg: {have}).',
  'analysis.note.nothingNotable':
    'Megvizsgáltam ezt: {what}, {count, plural, one {# nap} other {# nap}} adatai alapján, és nem találtam figyelemre méltó különbséget.',

  // Requirement / availability phrases used inside the notes above ----------------------
  'analysis.req.daysBothValues': '{count, plural, one {# nap mindkét értékkel} other {# nap mindkét értékkel}}',
  'analysis.req.daysPerGroup': '{count, plural, one {# nap csoportonként} other {# nap csoportonként}}',
  'analysis.req.daysWithReport': '{count, plural, one {# nap rögzített adattal} other {# nap rögzített adattal}}',
  'analysis.req.daysWithRatings': '{count, plural, one {# nap értékelésekkel} other {# nap értékelésekkel}}',
  'analysis.req.daysPerMonth': '{count, plural, one {havonta # nap rögzített adattal} other {havonta # nap rögzített adattal}}',
  'analysis.req.recentDays':
    '{count, plural, one {# nap rögzített adattal az elmúlt két hétben} other {# nap rögzített adattal az elmúlt két hétben}}',
  'analysis.req.fullWeeks': '{count, plural, one {# teljes hét rögzített adatokkal} other {# teljes hét rögzített adatokkal}}',
  'analysis.req.weeksOfLogs': '{count, plural, one {# hétnyi rögzítés} other {# hétnyi rögzítés}}',
  'analysis.req.weekPerGroup': 'csoportonként egy hét és {count, plural, one {# nap} other {# nap}} rögzített adattal',
  'analysis.req.moodReports': '{count, plural, one {# hangulatértékelés} other {# hangulatértékelés}}',
  'analysis.req.reportsInWindow': '{count, plural, one {# rögzítés egyetlen idősávban} other {# rögzítés egyetlen idősávban}}',
  'analysis.req.emotionRepeated': 'egy érzelem, amely legalább {count, plural, one {# napon} other {# napon}} szerepel',
  'analysis.have.twoGroups':
    '{groupA}: {countA, plural, one {# nap} other {# nap}}; {groupB}: {countB, plural, one {# nap} other {# nap}}',
  'analysis.have.weeksTwoGroups':
    'célt teljesítő hetek: {metWeeks, plural, one {# hét} other {# hét}} ({metDays, plural, one {# nap} other {# nap}}); cél alatti hetek: {belowWeeks, plural, one {# hét} other {# hét}} ({belowDays, plural, one {# nap} other {# nap}})',
  'analysis.have.twoMonths': '{cur}: {countA, plural, one {# nap} other {# nap}}, {prev}: {countB, plural, one {# nap} other {# nap}}',
  'analysis.have.noData': 'nincs adat',
  'analysis.have.noSuchEmotion': 'még nincs ilyen',
  'analysis.have.fewerInEveryWindow': 'minden idősávban kevesebb',

  // Sentences shared by the group-comparison detectors ----------------------------------
  'analysis.relation.text':
    'Úgy tűnik, az adataid alapján {condition}, {metricDefined} {gender, select, q {{direction, select, higher {átlagosan jobb volt} other {átlagosan rosszabb volt}}} d {{direction, select, higher {átlagosan hosszabb volt} other {átlagosan rövidebb volt}}} other {{direction, select, higher {átlagosan magasabb volt} other {átlagosan alacsonyabb volt}}}} ({meanA} vs. {meanB}).',
  'analysis.correlation.text':
    'Úgy tűnik, az adataidban kapcsolat lehet két mutató között ({x} és {y}): {xGender, select, q {amikor {x} jobb volt} d {amikor {x} hosszabb volt} other {amikor {x} magasabb volt}}, {yGender, select, q {{y} {direction, select, higher {általában jobb volt} other {általában rosszabb volt}}} d {{y} {direction, select, higher {általában hosszabb volt} other {általában rövidebb volt}}} other {{y} {direction, select, higher {általában magasabb volt} other {általában alacsonyabb volt}}}} (korreláció: {r}).',
  'analysis.explain.checkedDays': '{count, plural, one {# napot} other {# napot}} vizsgáltam meg.',
  'analysis.explain.onDaysCondition': '{count, plural, one {# napon} other {# napon}} {conditionPast}.',
  'analysis.explain.groupMeans':
    'Ezeken a napokon {metricDefined} {gender, select, other {átlagosan {meanA} volt}}, a többi napon {meanB}.',
  'analysis.explain.correlation': 'Korreláció: {r}.',
  'analysis.explain.correlationBetween': 'Korreláció ({predictor} vs. {outcome}): {r}.',
  'analysis.explain.diffAndStrength': 'Az átlagok közötti különbség: {diff} pont. A mintázat erőssége: {strength}.',
  'analysis.explain.diffStrength': 'Különbség: {diff} pont. A mintázat erőssége: {strength}.',
  'analysis.split.corrExplainChecked':
    '{count, plural, one {# napot} other {# napot}} vizsgáltam meg, amelyeken {x} és {y} is rögzítve volt.',
  'analysis.split.corrExplainPearson': 'Pearson-korreláció: {r} (erősség: {strength}).',
  'analysis.split.corrExplainGroups':
    'A csoportokban nem volt elég nap az átlagok összehasonlításához ({groupA}: {countA, plural, one {# nap} other {# nap}}; {groupB}: {countB, plural, one {# nap} other {# nap}}; csoportonként legalább {min} kell).',

  // Evidence table keys ---------------------------------------------------------------
  'analysis.extra.predictor': 'Előrejelző változó',
  'analysis.extra.strength': 'Erősség',
  'analysis.extra.meanDiff': 'Átlagok különbsége (A mínusz B)',
  'analysis.extra.cohenD': 'Hatásméret (Cohen-féle d)',
  'analysis.extra.weeksChecked': 'Vizsgált hetek',
  'analysis.extra.weeklyTarget': 'Heti cél',
  'analysis.extra.target': 'Cél',
  'analysis.extra.frequency': 'Gyakoriság',
  'analysis.extra.periodMean': 'Az időszak átlaga',
  'analysis.extra.overallMean': 'Teljes átlag',
  'analysis.extra.stddev': 'Szórás',
  'analysis.extra.slopePerDay': 'Napi meredekség',
  'analysis.extra.daysInWindow': 'Napok az ablakban',
  'analysis.extra.movingWindow': 'Mozgóátlag-ablak',
  'analysis.extra.relativeChange': 'Relatív változás',
  'analysis.extra.longestStreak': 'Leghosszabb sorozat az időszakban',
  'analysis.extra.shareOfEmotionDays': 'Az érzelem napjainak aránya',
  'analysis.frequency.daily': 'napi',
  'analysis.frequency.weekly': 'heti',
  'analysis.groupB.otherDays': 'Többi nap',

  // Sleep detectors -------------------------------------------------------------------
  'analysis.sleep.groupA': 'Napok {hours} óránál kevesebb alvással',
  'analysis.sleep.groupB': 'Napok legalább {hours} óra alvással',
  'analysis.sleep.condition': 'azokon a napokon, amikor {hours} óránál kevesebbet aludtál',
  'analysis.sleep.conditionPast': '{hours} óránál kevesebbet aludtál',
  'analysis.sleepMood.label': 'az alvás és a hangulat közötti kapcsolat',
  'analysis.sleepMood.title': '{direction, select, lower {Rövid alvás és rosszabb hangulat} other {Rövid alvás és jobb hangulat}}',
  'analysis.sleepMood.corrTitle': 'Lehetséges kapcsolat az alvásidő és a hangulat között',
  'analysis.sleepEnergy.label': 'az alvás és az energiaszint közötti kapcsolat',
  'analysis.sleepEnergy.title':
    '{direction, select, lower {Rövid alvás és alacsonyabb energiaszint} other {Rövid alvás és magasabb energiaszint}}',
  'analysis.sleepEnergy.corrTitle': 'Lehetséges kapcsolat az alvásidő és az energiaszint között',

  // Exercise detectors ----------------------------------------------------------------
  'analysis.exercise.groupA': 'Napok testmozgással',
  'analysis.exercise.groupB': 'Napok testmozgás nélkül',
  'analysis.exercise.condition': 'azokon a napokon, amikor mozogtál',
  'analysis.exercise.conditionPast': 'mozogtál',
  'analysis.exerciseMood.label': 'a testmozgás és a hangulat közötti kapcsolat',
  'analysis.exerciseMood.title': '{direction, select, higher {Testmozgás és jobb hangulat} other {Testmozgás és rosszabb hangulat}}',
  'analysis.exerciseMood.corrTitle': 'Lehetséges kapcsolat a mozgással töltött idő és a hangulat között',
  'analysis.exerciseEnergy.label': 'a testmozgás és az energiaszint közötti kapcsolat',
  'analysis.exerciseEnergy.title':
    '{direction, select, higher {Testmozgás és magasabb energiaszint} other {Testmozgás és alacsonyabb energiaszint}}',
  'analysis.exerciseEnergy.corrTitle': 'Lehetséges kapcsolat a mozgással töltött idő és az energiaszint között',

  // Habit - mood / energy / stress ------------------------------------------------------
  'analysis.habit.detectorLabel': 'a szokások és a hangulat közötti kapcsolat',
  'analysis.habit.noHabits': 'Nincsenek aktív szokások, ezért nem vizsgáltam a szokások és a hangulat közötti kapcsolatot.',
  'analysis.habit.noLogs':
    'Ennek a szokásnak ebben az időszakban még nincs rögzítése: „{habit}”, ezért nem vizsgáltam a kapcsolatát a hangulattal.',
  'analysis.habit.noFullWeeks':
    'Ennek a szokásnak még nincs teljes, rögzítésekkel lefedett hete: „{habit}”, ezért nem vizsgáltam a kapcsolatát a hangulattal.',
  'analysis.habit.label': 'kapcsolat: „{habit}” szokás és {metric}',
  'analysis.habit.groupA': 'Napok, amikor a szokás teljesült: „{habit}”',
  'analysis.habit.groupB': 'Napok, amikor a szokás nem teljesült: „{habit}”',
  'analysis.habit.condition': 'azokon a napokon, amikor teljesítetted ezt a szokást: „{habit}”',
  'analysis.habit.conditionPast': 'teljesítetted ezt a szokást: „{habit}”',
  'analysis.habit.title':
    '„{habit}” szokás: {gender, select, q {{direction, select, higher {jobb {metric}} other {rosszabb {metric}}}} d {{direction, select, higher {hosszabb {metric}} other {rövidebb {metric}}}} other {{direction, select, higher {magasabb {metric}} other {alacsonyabb {metric}}}}}',
  'analysis.habit.corrTitle': 'Lehetséges kapcsolat: „{habit}” szokás és {metric}',
  'analysis.habit.weeklyCondition': 'azokon a heteken, amikor elérted a heti célt ennél a szokásnál: „{habit}”',
  'analysis.habit.weeklyTarget': 'hetente {target} {unit}',
  'analysis.habit.targetValue': '{target} {unit}',
  'analysis.habit.weeklyExplainChecked':
    '{weeks, plural, one {# teljes hetet} other {# teljes hetet}} vizsgáltam meg ({days, plural, one {# nap} other {# nap}} rögzített adattal, mutató: {metric}).',
  'analysis.habit.weeklyExplainMet': '{count, plural, one {# héten} other {# héten}} elérted a szokás célját ({target}).',
  'analysis.habit.weeklyExplainMeans':
    'Ezeknek a heteknek a napjain {metricDefined} {gender, select, other {átlagosan {meanA} volt}}, a cél alatti {count, plural, one {# hét} other {# hét}} napjain pedig {meanB}.',
  'analysis.habit.groupAWeeks': 'Napok a célt teljesítő hetekben ({count, plural, one {# hét} other {# hét}})',
  'analysis.habit.groupBWeeks': 'Napok a cél alatti hetekben ({count, plural, one {# hét} other {# hét}})',

  // Weekday differences -----------------------------------------------------------------
  'analysis.weekday.label': 'a hét napjai közötti különbségek',
  'analysis.weekday.text':
    'Úgy tűnik, az adataid alapján {onWeekday} {metricDefined} {gender, select, q {{direction, select, higher {átlagosan jobb volt} other {átlagosan rosszabb volt}}} d {{direction, select, higher {átlagosan hosszabb volt} other {átlagosan rövidebb volt}}} other {{direction, select, higher {átlagosan magasabb volt} other {átlagosan alacsonyabb volt}}}}, mint a hét többi napján ({meanA} vs. {meanB}).',
  'analysis.weekday.explainChecked':
    '{count, plural, one {# napot} other {# napot}} vizsgáltam meg rögzített adattal (mutató: {metric}); ezek közül {countA} esett ezekre a napokra: {weekdays}.',
  'analysis.weekday.explainMeans':
    'Átlagosan {metricDefined} {onWeekday} {gender, select, other {{meanA} volt}}, a többi napon {meanB}.',
  'analysis.weekday.title':
    'A hét napjai – {weekdays}: {gender, select, q {{direction, select, higher {jobb {metric}} other {rosszabb {metric}}}} d {{direction, select, higher {hosszabb {metric}} other {rövidebb {metric}}}} other {{direction, select, higher {magasabb {metric}} other {alacsonyabb {metric}}}}}',
  'analysis.weekday.groupB': 'A hét többi napja',
  'analysis.weekday.tableValue': '{mean} ({count, plural, one {# nap} other {# nap}})',
  'analysis.weekday.nothing':
    'Megvizsgáltam a hét napjai közötti különbségeket {count, plural, one {# nap} other {# nap}} adatai alapján, és nem találtam figyelemre méltó különbséget.',

  // Time of day -------------------------------------------------------------------------
  'analysis.timeOfDay.label': 'az írás időpontja és a hangulat közötti kapcsolat',
  'analysis.timeOfDay.morning.label': 'Reggel',
  'analysis.timeOfDay.morning.phrase': 'reggel',
  'analysis.timeOfDay.late_morning.label': 'Délelőtt',
  'analysis.timeOfDay.late_morning.phrase': 'délelőtt',
  'analysis.timeOfDay.afternoon.label': 'Délután',
  'analysis.timeOfDay.afternoon.phrase': 'délután',
  'analysis.timeOfDay.evening.label': 'Este',
  'analysis.timeOfDay.evening.phrase': 'este',
  'analysis.timeOfDay.night.label': 'Éjszaka',
  'analysis.timeOfDay.night.phrase': 'éjszaka',
  'analysis.timeOfDay.tableKey': '{label} ({hours})',
  'analysis.timeOfDay.tableValue': 'átlag: {mean}, {count, plural, one {# rögzítés} other {# rögzítés}}',
  'analysis.timeOfDay.tableRow': '{key}: {value}',
  'analysis.timeOfDay.nothing':
    'Megvizsgáltam ezt: {label}, {count, plural, one {# rögzítés} other {# rögzítés}} alapján, és nem találtam az átlagból kiemelkedő idősávot.',
  'analysis.timeOfDay.text':
    'Úgy tűnik, az adataid alapján a hangulatod {phrase} ({hours}) volt a legjobb: átlagosan {mean}, míg az összes rögzítés átlaga {overall}.',
  'analysis.timeOfDay.explainChecked':
    '{count, plural, one {# hangulatértékelést} other {# hangulatértékelést}} vizsgáltam meg {days, plural, one {# napról} other {# napról}}, a bejegyzés írásának időpontja szerint.',
  'analysis.timeOfDay.explainTable': '{table}. Teljes átlag: {overall}.',
  'analysis.timeOfDay.explainDiff': 'A legjobb idősáv és a teljes átlag különbsége: {diff} pont. A mintázat erőssége: {strength}.',
  'analysis.timeOfDay.title': 'Jobb hangulat {phrase}',
  'analysis.timeOfDay.groupA': 'Rögzítések {phrase} ({hours})',
  'analysis.timeOfDay.groupB': 'Egyéb rögzítések',

  // Trends ------------------------------------------------------------------------------
  'analysis.trends.label': 'a hangulat, a stressz és az alvás trendjei',
  'analysis.trends.text':
    'Úgy tűnik, az adataid alapján {metricDefined} {horizon, select, period {az időszak során} monthly {az elmúlt hónapban} other {az elmúlt két hétben}} {gender, select, other {{direction, select, up {emelkedő tendenciát mutat} other {csökkenő tendenciát mutat}}}}: a mozgóátlag trendvonala {direction, select, up {{fromValue} értékről {toValue} értékre emelkedett} other {{fromValue} értékről {toValue} értékre csökkent}}.',
  'analysis.trends.explainChecked':
    '{count, plural, one {# napot} other {# napot}} vizsgáltam meg rögzített adattal (mutató: {metric}) {horizon, select, period {az időszak {len} napjából} other {a legutóbbi {len} napból}} ({from}–{to}).',
  'analysis.trends.explainFit':
    '{window} napos mozgóátlagot számoltam, és trendvonalat (lineáris regressziót) illesztettem rá: {direction, select, up {emelkedő meredekség} other {csökkenő meredekség}}, naponta {unit, select, hours {{slope} óra} other {{slope} pont}}, vagyis az ablak egészén nagyjából {unit, select, hours {{change} óra} other {{change} pont}} változás (a trendvonal mentén {fromValue} értékről {toValue} értékre). A trend erőssége: {strength}.',
  'analysis.trends.title':
    '{direction, select, up {Emelkedő trend} other {Csökkenő trend}}: {metric, select, mood {a hangulatod} energy {az energiaszinted} stress {a stresszszinted} sleepHours {az alvásidőd} sleepQuality {az alvásod minősége} exerciseMinutes {a mozgással töltött időd} other {a bejegyzések száma}} {horizon, select, period {az időszak során} monthly {az elmúlt hónapban} other {az elmúlt két hétben}}',
  'analysis.trends.groupA': 'Az ablak eleje (trendvonal)',
  'analysis.trends.groupB': 'Az ablak vége (trendvonal)',
  'analysis.trends.slopeValue': '{unit, select, hours {{slope} óra} other {{slope} pont}}',
  'analysis.trends.nothingSince':
    'Megvizsgáltam a hangulat, a stressz és az alvás trendjeit ettől a naptól kezdve: {from}, és nem találtam figyelemre méltó trendet.',
  'analysis.trends.nothingAll':
    'Megvizsgáltam a hangulat, a stressz és az alvás trendjeit a teljes időszakban, és nem találtam figyelemre méltó trendet.',

  // Month comparison --------------------------------------------------------------------
  'analysis.periodCompare.label': 'az aktuális és az előző hónap összehasonlítása',
  'analysis.periodCompare.text':
    'Úgy tűnik, az adataid alapján {cur} hónapban {metricDefined} {gender, select, q {{direction, select, higher {átlagosan jobb volt} other {átlagosan rosszabb volt}}} d {{direction, select, higher {átlagosan hosszabb volt} other {átlagosan rövidebb volt}}} other {{direction, select, higher {átlagosan magasabb volt} other {átlagosan alacsonyabb volt}}}}, mint {prev} hónapban ({meanA} vs. {meanB}).',
  'analysis.periodCompare.explain':
    'Összehasonlítottam a rögzített adattal rendelkező napokat (mutató: {metric}) {cur} hónapban ({countA, plural, one {# nap} other {# nap}}, a mai napig) és {prev} hónapban ({countB, plural, one {# nap} other {# nap}}). Átlag {cur} hónapban: {meanA}; {prev} hónapban: {meanB}. Különbség: {unit, select, hours {{diff} óra} other {{diff} pont}}. A különbség erőssége: {strength}.',
  'analysis.periodCompare.title':
    'Havi összehasonlítás: {cur} hónapban {gender, select, q {{direction, select, higher {jobb {metric}} other {rosszabb {metric}}}} d {{direction, select, higher {hosszabb {metric}} other {rövidebb {metric}}}} other {{direction, select, higher {magasabb {metric}} other {alacsonyabb {metric}}}}}, mint {prev} hónapban',
  'analysis.periodCompare.entriesText':
    'Úgy tűnik, {cur} hónap első {window} napjában {direction, select, more {többet írtál} other {kevesebbet írtál}} ({countA, plural, one {# bejegyzés} other {# bejegyzés}}), mint {prev} hónap első {window} napjában ({countB, plural, one {# bejegyzés} other {# bejegyzés}}).',
  'analysis.periodCompare.entriesExplain':
    'Az azonos hosszúságú időszakok összehasonlításához minden hónap első {window} napjának bejegyzéseit számoltam meg: {cur} – {countA, plural, one {# bejegyzés} other {# bejegyzés}}, {prev} – {countB, plural, one {# bejegyzés} other {# bejegyzés}}. Különbség: {diff, plural, one {# bejegyzés} other {# bejegyzés}} ({percent}). A különbség erőssége: {strength}.',
  'analysis.periodCompare.entriesTitle':
    '{direction, select, more {Több bejegyzés} other {Kevesebb bejegyzés}} {cur} hónapban, mint {prev} hónapban',
  'analysis.periodCompare.monthWindow': '{month} (első {window} nap)',
  'analysis.periodCompare.insufficientWhat': '{cur} és {prev} hónap összehasonlítása',
  'analysis.periodCompare.nothing':
    'Összehasonlítottam {cur} és {prev} hónapot, és nem találtam figyelemre méltó különbséget a hangulatban, a stresszben, az alvásban vagy a bejegyzések számában.',

  // Habit trend (improved / declined) -----------------------------------------------------
  'analysis.habitsTrend.label': 'javuló vagy romló szokások',
  'analysis.habitsTrend.whether': 'hogy javult-e vagy romlott ez a szokás: „{habit}”',
  'analysis.habitsTrend.textDaily':
    'Úgy tűnik, {direction, select, improved {javult ez a szokás} other {romlott ez a szokás}}: „{habit}”. Az elmúlt két hétben {window} napból {recent} napon teljesítetted, az azt megelőző két hétben pedig {window} napból {previous} napon.',
  'analysis.habitsTrend.textWeekly':
    'Úgy tűnik, {direction, select, improved {javult ez a szokás} other {romlott ez a szokás}}: „{habit}”. Az elmúlt két hétben {recent} {unit} volt a rögzített mennyiség, az azt megelőző két hétben {previous} (cél: hetente {target} {unit}).',
  'analysis.habitsTrend.explain':
    'Összehasonlítottam a szokás teljesítési arányát az elmúlt két hétben ({recentFrom}–{recentTo}) és az azt megelőző két hétben ({previousFrom}–{previousTo}): {recentRate} vs. {previousRate}. Különbség: {diff} százalékpont. A változás erőssége: {strength}.',
  'analysis.habitsTrend.title':
    '{direction, select, improved {Javult ez a szokás az elmúlt két hétben} other {Romlott ez a szokás az elmúlt két hétben}}: „{habit}”',
  'analysis.habitsTrend.metric': 'Teljesítési arány – {habit}',
  'analysis.habitsTrend.groupA': 'Az elmúlt két hét',
  'analysis.habitsTrend.groupB': 'Az azt megelőző két hét',

  // Best / hardest days ------------------------------------------------------------------
  'analysis.bestWorst.label': 'a legjobb és a legnehezebb napok',
  'analysis.bestWorst.describedDay': '{day} („{title}”)',
  'analysis.bestWorst.noTitle': 'Cím nélkül',
  'analysis.bestWorst.extraValue': '{titles} – pontszám: {score}',
  'analysis.bestWorst.text':
    '{kind, select, best {Az időszak legjobb napjai} other {Az időszak legnehezebb napjai}} a hangulat, az energia és a stressz összesített pontszáma alapján: {days}.',
  'analysis.bestWorst.explainScore':
    '{count, plural, one {# nap} other {# nap}} mindegyikére összesített pontszámot számoltam: a hangulat, az energiaszint és a (11 mínusz stresszszint) átlagát az aznap rögzített értékekből.',
  'analysis.bestWorst.explainMeans':
    'Az időszak átlagos pontszáma: {overall}. {kind, select, best {{count, plural, one {A legjobb nap pontszáma} =3 {A három legjobb nap átlagos pontszáma} other {A legjobb napok átlagos pontszáma}}} other {{count, plural, one {A legnehezebb nap pontszáma} =3 {A három legnehezebb nap átlagos pontszáma} other {A legnehezebb napok átlagos pontszáma}}}}: {mean}.',
  'analysis.bestWorst.explainDiff': 'Eltérés az átlagtól: {diff} pont. A különbség erőssége: {strength}.',
  'analysis.bestWorst.title': '{kind, select, best {Az időszak legjobb napjai} other {Az időszak legnehezebb napjai}}',
  'analysis.bestWorst.metric': 'Összesített pontszám (hangulat + energia + fordított stressz)',
  'analysis.bestWorst.groupA': '{kind, select, best {A legjobb napok} other {A legnehezebb napok}}',
  'analysis.bestWorst.nothing':
    'Megvizsgáltam ezt: {label}, {count, plural, one {# nap} other {# nap}} adatai alapján; a pontszámok hasonlóak voltak, egyik nap sem emelkedett ki.',

  // Streaks -------------------------------------------------------------------------------
  'analysis.streaks.label': 'írási és szokássorozatok',
  'analysis.streaks.entriesTitle': '{count, plural, one {# napos írási sorozat} other {# napos írási sorozat}}',
  'analysis.streaks.entriesText':
    'Szép munka! {count, plural, one {# napon} other {# napon}} át egymás után írtál a naplódba ({from}–{to}).',
  'analysis.streaks.entriesExplain':
    'Megszámoltam az egymást követő napokat, amelyeken legalább egy bejegyzés született, a mai vagy a tegnapi napig. Jelenlegi sorozat: {count, plural, one {# nap} other {# nap}} ({from} – {to}). A leghosszabb sorozat az időszakban: {best, plural, one {# nap} other {# nap}}.',
  'analysis.streaks.entriesMetric': 'Írással töltött napok',
  'analysis.streaks.currentDays': 'A jelenlegi sorozat napjai',
  'analysis.streaks.daysWithEntry': 'Bejegyzéses napok az időszakban',
  'analysis.streaks.habitTitle': '{count, plural, one {# napos sorozat} other {# napos sorozat}}: „{habit}”',
  'analysis.streaks.habitText':
    '{count, plural, one {# napon} other {# napon}} át egymás után teljesítetted ezt a szokást: „{habit}” ({from}–{to}).',
  'analysis.streaks.habitExplain':
    'Megszámoltam az egymást követő napokat, amelyeken teljesítettként jelölted ezt a szokást: „{habit}”, a mai vagy a tegnapi napig. Jelenlegi sorozat: {count, plural, one {# nap} other {# nap}}. A leghosszabb sorozat az időszakban: {best, plural, one {# nap} other {# nap}}.',
  'analysis.streaks.habitMetric': 'A szokás teljesítése: {habit}',
  'analysis.streaks.daysCompleted': 'Napok, amikor a szokás teljesült az időszakban',
  'analysis.streaks.weeklyTitle': '{count, plural, one {# hetes sorozat} other {# hetes sorozat}}: „{habit}”',
  'analysis.streaks.weeklyText':
    '{count, plural, one {# héten} other {# héten}} át egymás után elérted ennek a szokásnak a célját: „{habit}” ({from}–{to}).',
  'analysis.streaks.weeklyExplain':
    'Hetente összeadtam a szokásnál rögzített mennyiséget („{habit}”), és összevetettem a heti céllal ({target}). A célt teljesítő hetek jelenlegi sorozata: {count, plural, one {# hét} other {# hét}}.',
  'analysis.streaks.weeklyMetric': 'Teljesített heti cél – {habit}',
  'analysis.streaks.currentWeeks': 'A jelenlegi sorozat hetei',
  'analysis.streaks.weeksWithLogs': 'Rögzítéses hetek az időszakban',
  'analysis.streaks.none':
    'Nem találtam aktív sorozatot (legalább {entryMin} napos írási sorozatot, vagy legalább {habitMin} napos vagy hetes szokássorozatot).',

  // Anomalies -----------------------------------------------------------------------------
  'analysis.anomalies.label': 'szokatlan napok a hangulatban vagy a stresszben',
  'analysis.anomalies.textOne':
    'Úgy tűnik, ezen a napon – {day} – {metricDefined} {gender, select, q {{side, select, high {szokatlanul jó volt} other {szokatlanul rossz volt}}} d {{side, select, high {szokatlanul hosszú volt} other {szokatlanul rövid volt}}} other {{side, select, high {szokatlanul magas volt} other {szokatlanul alacsony volt}}}} az időszak többi részéhez képest ({value}, miközben az átlag {mean}).',
  'analysis.anomalies.textMany':
    'Úgy tűnik, {count, plural, one {# napon} other {# napon}} {metricDefined} {gender, select, q {{side, select, high {szokatlanul jó volt} other {szokatlanul rossz volt}}} d {{side, select, high {szokatlanul hosszú volt} other {szokatlanul rövid volt}}} other {{side, select, high {szokatlanul magas volt} other {szokatlanul alacsony volt}}}} az időszak többi részéhez képest: {days}; az időszak átlaga: {mean}.',
  'analysis.anomalies.textManyMore':
    'Úgy tűnik, {count, plural, one {# napon} other {# napon}} {metricDefined} {gender, select, q {{side, select, high {szokatlanul jó volt} other {szokatlanul rossz volt}}} d {{side, select, high {szokatlanul hosszú volt} other {szokatlanul rövid volt}}} other {{side, select, high {szokatlanul magas volt} other {szokatlanul alacsony volt}}}} az időszak többi részéhez képest: {days} és még további napokon; az időszak átlaga: {mean}.',
  'analysis.anomalies.dayItem': '{day} ({value})',
  'analysis.anomalies.detail': '{date}: {value} ({z} szórásnyival {side, select, above {az átlag felett} other {az átlag alatt}})',
  'analysis.anomalies.explain':
    '{count, plural, one {# napot} other {# napot}} vizsgáltam meg rögzített adattal (mutató: {metric}). Átlag: {mean}, szórás: {sd}. Egy nap akkor számít szokatlannak, ha az értéke legalább {z} szórásnyira tér el az átlagtól. {details}. Az eltérés erőssége: {strength}.',
  'analysis.anomalies.title':
    '{count, plural, one {Szokatlan nap} other {Szokatlan napok}}: {gender, select, q {{side, select, high {szokatlanul jó {metric}} other {szokatlanul rossz {metric}}}} d {{side, select, high {szokatlanul hosszú {metric}} other {szokatlanul rövid {metric}}}} other {{side, select, high {szokatlanul magas {metric}} other {szokatlanul alacsony {metric}}}}}',
  'analysis.anomalies.groupA': 'Szokatlan napok',
  'analysis.anomalies.zValue': '{value} (z: {z})',
  'analysis.anomalies.nothing':
    'Megvizsgáltam a szokatlan napokat {count, plural, one {# nap} other {# nap}} adatai alapján, és egyetlen olyan napot sem találtam, amely legalább {z} szórásnyira eltérne az átlagtól.',

  // Emotion patterns ----------------------------------------------------------------------
  'analysis.emotion.label': 'érzelmi mintázatok napok, emberek és helyek szerint',
  'analysis.emotion.metric': 'Érzelem: {emotion}',
  'analysis.emotion.groupA': 'Napok ezzel az érzelemmel: „{emotion}”',
  'analysis.emotion.weekdayTitle': '„{emotion}”: főként {onWeekday} jelenik meg',
  'analysis.emotion.weekdayText':
    'Úgy tűnik, az adataid alapján ez az érzelem – „{emotion}” – főként {onWeekday} jelent meg ({total} alkalomból {top}).',
  'analysis.emotion.weekdayExplain':
    '{count, plural, one {# napot} other {# napot}} vizsgáltam meg. Ez az érzelem – „{emotion}” – {total, plural, one {# napon} other {# napon}} szerepelt; ezek közül {top} nap esett ezekre a napokra: {weekdays} ({share}), miközben ezeknek a napoknak ({weekdays}) az aránya az összes vizsgált nap között {baseline}. A mintázat erőssége: {strength}.',
  'analysis.emotion.groupBWeekday': 'Ezek közül: {weekdays}',
  'analysis.emotion.weekdayShareKey': 'Ezen napok aránya az összes nap között: {weekdays}',
  'analysis.emotion.personTitle': '„{emotion}” és {name}',
  'analysis.emotion.placeTitle': '„{emotion}” és „{place}”',
  'analysis.emotion.personText':
    'Úgy tűnik, az adataid alapján ez az érzelem – „{emotion}” – gyakran megjelent azokon a napokon, amikor ez a személy is szerepelt: {name} ({total} alkalomból {with}).',
  'analysis.emotion.placeText':
    'Úgy tűnik, az adataid alapján ez az érzelem – „{emotion}” – gyakran megjelent azokon a napokon, amikor ez a helyszín szerepelt: „{place}” ({total} alkalomból {with}).',
  'analysis.emotion.personExplain':
    '{count, plural, one {# napot} other {# napot}} vizsgáltam meg. Ez az érzelem – „{emotion}” – {total} napon szerepelt; ezek közül {with} napon ({share}) a bejegyzésben ez a személy is megjelent: {name}. Összesen {count} napból {baselineCount} napon szerepel ({baseline}). A mintázat erőssége: {strength}.',
  'analysis.emotion.placeExplain':
    '{count, plural, one {# napot} other {# napot}} vizsgáltam meg. Ez az érzelem – „{emotion}” – {total} napon szerepelt; ezek közül {with} napon ({share}) a bejegyzésben ez a helyszín is megjelent: „{place}”. Ez a helyszín összesen {count} napból {baselineCount} napon szerepel ({baseline}). A mintázat erőssége: {strength}.',
  'analysis.emotion.groupBPerson': 'Ezek közül ezzel a személlyel: {name}',
  'analysis.emotion.groupBPlace': 'Ezek közül ezen a helyszínen: „{place}”',
  'analysis.emotion.personShareKey': 'Ennek a személynek az aránya az összes nap között: {name}',
  'analysis.emotion.placeShareKey': 'Ennek a helyszínnek az aránya az összes nap között: „{place}”',
  'analysis.emotion.nothing':
    '{count, plural, one {# érzelmet vizsgáltam meg, amely legalább {min} alkalommal ismétlődött} other {# érzelmet vizsgáltam meg, amelyek legalább {min} alkalommal ismétlődtek}}, és nem találtam figyelemre méltó összpontosulást bizonyos napokra, emberekre vagy helyekre.',
};
export default messages;
