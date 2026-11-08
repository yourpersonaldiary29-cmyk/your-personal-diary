/**
 * de - analysis messages (server-side insight templates, notes and labels). Keys are prefixed
 * 'analysis.'; see shared/i18n/index.ts for the template syntax and the English file for the
 * conventions.
 *
 * German notes:
 *  - Every sentence is hedged ("Es sieht so aus, als ...", "könnte ... geben") and never causal.
 *  - `gender` classes: 'f' (Stimmung, Schlafqualität -> "deine ... höher"), 'n' (Energielevel,
 *    Stresslevel -> "dein ... höher") and 'fd' for the feminine duration nouns (Schlafdauer,
 *    Sportdauer -> "deine ... länger / kürzer"). The possessive is chosen in the templates, so
 *    `metricDefined` is used only in the nominative.
 *  - Labels ('*.label' of the detectors) are accusative noun phrases, because they are embedded
 *    as the object of "prüfen" ("Ich habe den Zusammenhang zwischen Schlaf und Stimmung geprüft").
 */
const messages: Record<string, string> = {
  // Engine / provider -----------------------------------------------------------------
  'analysis.engine.providerFailed': 'Die Musteranalyse wurde nicht abgeschlossen (interner Fehler). Bitte versuche es später erneut.',
  'analysis.engine.detectorFailed': 'Die Prüfung „{label}“ wurde nicht abgeschlossen (interner Fehler); die übrigen Erkenntnisse sind davon nicht betroffen.',

  // Strength --------------------------------------------------------------------------
  'analysis.strength.weak': 'schwach',
  'analysis.strength.moderate': 'mittel',
  'analysis.strength.strong': 'stark',

  // Metrics: label (short, standalone), defined (subject inside a sentence), gender -----
  'analysis.metric.mood.label': 'Stimmung',
  'analysis.metric.mood.defined': 'Stimmung',
  'analysis.metric.mood.gender': 'f',
  'analysis.metric.energy.label': 'Energielevel',
  'analysis.metric.energy.defined': 'Energielevel',
  'analysis.metric.energy.gender': 'n',
  'analysis.metric.stress.label': 'Stresslevel',
  'analysis.metric.stress.defined': 'Stresslevel',
  'analysis.metric.stress.gender': 'n',
  'analysis.metric.sleepHours.label': 'Schlafdauer',
  'analysis.metric.sleepHours.defined': 'Schlafdauer',
  'analysis.metric.sleepHours.gender': 'fd',
  'analysis.metric.sleepQuality.label': 'Schlafqualität',
  'analysis.metric.sleepQuality.defined': 'Schlafqualität',
  'analysis.metric.sleepQuality.gender': 'f',
  'analysis.metric.exerciseMinutes.label': 'Sportdauer',
  'analysis.metric.exerciseMinutes.defined': 'Sportdauer',
  'analysis.metric.exerciseMinutes.gender': 'fd',
  'analysis.metric.entries.label': 'Tagebucheinträge',
  'analysis.metric.entries.defined': 'Anzahl der Einträge',
  'analysis.metric.entries.gender': 'f',

  // Counts and dates ------------------------------------------------------------------
  'analysis.count.days': '{count, plural, one {# Tag} other {# Tage}}',
  'analysis.count.weeks': '{count, plural, one {# Woche} other {# Wochen}}',
  'analysis.date.dayWithDate': '{weekday}, {date}',

  // Weekdays (index 0 = Sunday) --------------------------------------------------------
  'analysis.weekday.plural.0': 'Sonntage',
  'analysis.weekday.plural.1': 'Montage',
  'analysis.weekday.plural.2': 'Dienstage',
  'analysis.weekday.plural.3': 'Mittwoche',
  'analysis.weekday.plural.4': 'Donnerstage',
  'analysis.weekday.plural.5': 'Freitage',
  'analysis.weekday.plural.6': 'Samstage',
  'analysis.weekday.on.0': 'sonntags',
  'analysis.weekday.on.1': 'montags',
  'analysis.weekday.on.2': 'dienstags',
  'analysis.weekday.on.3': 'mittwochs',
  'analysis.weekday.on.4': 'donnerstags',
  'analysis.weekday.on.5': 'freitags',
  'analysis.weekday.on.6': 'samstags',

  // Notes shared by the detectors -------------------------------------------------------
  'analysis.note.insufficient': 'Es gibt noch nicht genug Daten, um {what} zu prüfen (nötig sind mindestens {required}; vorhanden: {have}).',
  'analysis.note.insufficientWhether': 'Es gibt noch nicht genug Daten, um zu prüfen, {what} (nötig sind mindestens {required}; vorhanden: {have}).',
  'analysis.note.nothingNotable': 'Ich habe {what} über {count, plural, one {# Tag} other {# Tage}} geprüft und keinen nennenswerten Unterschied gefunden.',

  // Requirement / availability phrases used inside the notes above ----------------------
  'analysis.req.daysBothValues': '{count, plural, one {# Tag mit beiden Werten} other {# Tage mit beiden Werten}}',
  'analysis.req.daysPerGroup': '{count, plural, one {# Tag in jeder Gruppe} other {# Tage in jeder Gruppe}}',
  'analysis.req.daysWithReport': '{count, plural, one {# Tag mit einer Angabe} other {# Tage mit Angaben}}',
  'analysis.req.daysWithRatings': '{count, plural, one {# Tag mit Bewertungen} other {# Tage mit Bewertungen}}',
  'analysis.req.daysPerMonth': '{count, plural, one {# Tag mit Angaben in jedem Monat} other {# Tage mit Angaben in jedem Monat}}',
  'analysis.req.recentDays': '{count, plural, one {# Tag mit Angaben in den letzten zwei Wochen} other {# Tage mit Angaben in den letzten zwei Wochen}}',
  'analysis.req.fullWeeks': '{count, plural, one {# volle Woche mit Angaben} other {# volle Wochen mit Angaben}}',
  'analysis.req.weeksOfLogs': '{count, plural, one {# Woche mit erfassten Werten} other {# Wochen mit erfassten Werten}}',
  'analysis.req.weekPerGroup': 'eine Woche in jeder Gruppe und {count, plural, one {# Tag} other {# Tage}} mit Angaben in jeder Gruppe',
  'analysis.req.moodReports': '{count, plural, one {# Stimmungsangabe} other {# Stimmungsangaben}}',
  'analysis.req.reportsInWindow': '{count, plural, one {# Angabe in einem einzelnen Zeitfenster} other {# Angaben in einem einzelnen Zeitfenster}}',
  'analysis.req.emotionRepeated': 'ein Gefühl, das an {count, plural, one {# Tag} other {# Tagen}} angegeben wurde',
  'analysis.have.twoGroups': '{groupA}: {countA, plural, one {# Tag} other {# Tage}}; {groupB}: {countB, plural, one {# Tag} other {# Tage}}',
  'analysis.have.weeksTwoGroups':
    'Wochen mit erreichtem Ziel: {metWeeks, plural, one {# Woche} other {# Wochen}} ({metDays, plural, one {# Tag} other {# Tage}}); Wochen unter dem Ziel: {belowWeeks, plural, one {# Woche} other {# Wochen}} ({belowDays, plural, one {# Tag} other {# Tage}})',
  'analysis.have.twoMonths': '{countA, plural, one {# Tag} other {# Tage}} im {cur} und {countB, plural, one {# Tag} other {# Tage}} im {prev}',
  'analysis.have.noData': 'keine Daten',
  'analysis.have.noSuchEmotion': 'noch keines',
  'analysis.have.fewerInEveryWindow': 'in jedem Zeitfenster weniger',

  // Sentences shared by the group-comparison detectors ----------------------------------
  'analysis.relation.text':
    'In deinen Daten sieht es so aus, als wäre {condition}, {gender, select, f {deine {metricDefined} im Schnitt {direction, select, higher {höher gewesen} other {niedriger gewesen}}} fd {deine {metricDefined} im Schnitt {direction, select, higher {länger gewesen} other {kürzer gewesen}}} other {dein {metricDefined} im Schnitt {direction, select, higher {höher gewesen} other {niedriger gewesen}}}} ({meanA} gegenüber {meanB}).',
  'analysis.correlation.text':
    'Es sieht so aus, als gäbe es in deinen Daten möglicherweise einen Zusammenhang zwischen {x} und {y}: {xGender, select, f {Wenn deine {x} höher war} fd {Wenn deine {x} länger war} other {Wenn dein {x} höher war}}, {yGender, select, f {war deine {y} {direction, select, higher {tendenziell höher} other {tendenziell niedriger}}} fd {war deine {y} {direction, select, higher {tendenziell länger} other {tendenziell kürzer}}} other {war dein {y} {direction, select, higher {tendenziell höher} other {tendenziell niedriger}}}} (Korrelation {r}).',
  'analysis.explain.checkedDays': 'Ich habe {count, plural, one {# Tag} other {# Tage}} geprüft.',
  'analysis.explain.onDaysCondition': 'An {count, plural, one {# Tag} other {# Tagen}} hast du {conditionPast}.',
  'analysis.explain.groupMeans':
    'An diesen Tagen lag {gender, select, f {deine {metricDefined}} fd {deine {metricDefined}} other {dein {metricDefined}}} im Schnitt bei {meanA}, an den übrigen Tagen bei {meanB}.',
  'analysis.explain.correlation': 'Korrelation: {r}.',
  'analysis.explain.correlationBetween': 'Korrelation zwischen {predictor} und {outcome}: {r}.',
  'analysis.explain.diffAndStrength': 'Unterschied zwischen den Durchschnittswerten: {diff} Punkte. Stärke des Musters: {strength}.',
  'analysis.explain.diffStrength': 'Unterschied: {diff} Punkte. Stärke des Musters: {strength}.',
  'analysis.split.corrExplainChecked':
    '{count, plural, one {Ich habe # Tag geprüft, an dem sowohl {x} als auch {y} angegeben wurden.} other {Ich habe # Tage geprüft, an denen sowohl {x} als auch {y} angegeben wurden.}}',
  'analysis.split.corrExplainPearson': 'Pearson-Korrelation: {r} (Stärke: {strength}).',
  'analysis.split.corrExplainGroups':
    'Es gab nicht genug Tage in jeder Gruppe, um die Durchschnittswerte zu vergleichen ({groupA}: {countA, plural, one {# Tag} other {# Tage}}; {groupB}: {countB, plural, one {# Tag} other {# Tage}}; nötig sind mindestens {min} pro Gruppe).',

  // Evidence table keys ---------------------------------------------------------------
  'analysis.extra.predictor': 'Prädiktor',
  'analysis.extra.strength': 'Stärke',
  'analysis.extra.meanDiff': 'Differenz der Durchschnittswerte (A minus B)',
  'analysis.extra.cohenD': 'Effektstärke (Cohens d)',
  'analysis.extra.weeksChecked': 'Geprüfte Wochen',
  'analysis.extra.weeklyTarget': 'Wochenziel',
  'analysis.extra.target': 'Ziel',
  'analysis.extra.frequency': 'Häufigkeit',
  'analysis.extra.periodMean': 'Durchschnitt im Zeitraum',
  'analysis.extra.overallMean': 'Gesamtdurchschnitt',
  'analysis.extra.stddev': 'Standardabweichung',
  'analysis.extra.slopePerDay': 'Steigung pro Tag',
  'analysis.extra.daysInWindow': 'Tage im Zeitfenster',
  'analysis.extra.movingWindow': 'Fenster des gleitenden Durchschnitts',
  'analysis.extra.relativeChange': 'Relative Veränderung',
  'analysis.extra.longestStreak': 'Längste Serie im Zeitraum',
  'analysis.extra.shareOfEmotionDays': 'Anteil an den Tagen mit diesem Gefühl',
  'analysis.frequency.daily': 'täglich',
  'analysis.frequency.weekly': 'wöchentlich',
  'analysis.groupB.otherDays': 'Übrige Tage',

  // Sleep detectors -------------------------------------------------------------------
  'analysis.sleep.groupA': 'Tage mit weniger als {hours} Stunden Schlaf',
  'analysis.sleep.groupB': 'Tage mit {hours} oder mehr Stunden Schlaf',
  'analysis.sleep.condition': 'an Tagen, an denen du weniger als {hours} Stunden geschlafen hast',
  'analysis.sleep.conditionPast': 'weniger als {hours} Stunden geschlafen',
  'analysis.sleepMood.label': 'den Zusammenhang zwischen Schlaf und Stimmung',
  'analysis.sleepMood.title': '{direction, select, lower {Kurzer Schlaf und niedrigere Stimmung} other {Kurzer Schlaf und höhere Stimmung}}',
  'analysis.sleepMood.corrTitle': 'Möglicher Zusammenhang zwischen Schlafdauer und Stimmung',
  'analysis.sleepEnergy.label': 'den Zusammenhang zwischen Schlaf und Energielevel',
  'analysis.sleepEnergy.title': '{direction, select, lower {Kurzer Schlaf und niedrigeres Energielevel} other {Kurzer Schlaf und höheres Energielevel}}',
  'analysis.sleepEnergy.corrTitle': 'Möglicher Zusammenhang zwischen Schlafdauer und Energielevel',

  // Exercise detectors ----------------------------------------------------------------
  'analysis.exercise.groupA': 'Tage mit körperlicher Aktivität',
  'analysis.exercise.groupB': 'Tage ohne körperliche Aktivität',
  'analysis.exercise.condition': 'an Tagen, an denen du Sport gemacht hast',
  'analysis.exercise.conditionPast': 'Sport gemacht',
  'analysis.exerciseMood.label': 'den Zusammenhang zwischen körperlicher Aktivität und Stimmung',
  'analysis.exerciseMood.title': '{direction, select, higher {Körperliche Aktivität und höhere Stimmung} other {Körperliche Aktivität und niedrigere Stimmung}}',
  'analysis.exerciseMood.corrTitle': 'Möglicher Zusammenhang zwischen Sportdauer und Stimmung',
  'analysis.exerciseEnergy.label': 'den Zusammenhang zwischen körperlicher Aktivität und Energielevel',
  'analysis.exerciseEnergy.title': '{direction, select, higher {Körperliche Aktivität und höheres Energielevel} other {Körperliche Aktivität und niedrigeres Energielevel}}',
  'analysis.exerciseEnergy.corrTitle': 'Möglicher Zusammenhang zwischen Sportdauer und Energielevel',

  // Habit - mood / energy / stress ------------------------------------------------------
  'analysis.habit.detectorLabel': 'den Zusammenhang zwischen Gewohnheiten und Stimmung',
  'analysis.habit.noHabits': 'Es gibt keine aktiven Gewohnheiten, daher habe ich keinen Zusammenhang zwischen Gewohnheiten und Stimmung geprüft.',
  'analysis.habit.noLogs': 'Für die Gewohnheit „{habit}“ gibt es in diesem Zeitraum noch keine erfassten Werte, daher habe ich keinen Zusammenhang mit der Stimmung geprüft.',
  'analysis.habit.noFullWeeks': 'Für die Gewohnheit „{habit}“ gibt es noch keine vollen Wochen mit erfassten Werten, daher habe ich keinen Zusammenhang mit der Stimmung geprüft.',
  'analysis.habit.label': 'den Zusammenhang zwischen der Gewohnheit „{habit}“ und {metric}',
  'analysis.habit.groupA': 'Tage, an denen die Gewohnheit „{habit}“ erledigt wurde',
  'analysis.habit.groupB': 'Tage, an denen die Gewohnheit „{habit}“ nicht erledigt wurde',
  'analysis.habit.condition': 'an Tagen, an denen du die Gewohnheit „{habit}“ erledigt hast',
  'analysis.habit.conditionPast': 'die Gewohnheit „{habit}“ erledigt',
  'analysis.habit.title':
    'Gewohnheit „{habit}“ und {gender, select, f {{direction, select, higher {höhere {metric}} other {niedrigere {metric}}}} fd {{direction, select, higher {längere {metric}} other {kürzere {metric}}}} other {{direction, select, higher {höheres {metric}} other {niedrigeres {metric}}}}}',
  'analysis.habit.corrTitle': 'Möglicher Zusammenhang zwischen der Gewohnheit „{habit}“ und {metric}',
  'analysis.habit.weeklyCondition': 'in Wochen, in denen du das Ziel der Gewohnheit „{habit}“ erreicht hast',
  'analysis.habit.weeklyTarget': '{target} {unit} pro Woche',
  'analysis.habit.targetValue': '{target} {unit}',
  'analysis.habit.weeklyExplainChecked':
    'Ich habe {weeks, plural, one {# volle Woche} other {# volle Wochen}} geprüft ({days, plural, one {# Tag} other {# Tage}} mit einer Angabe für {metric}).',
  'analysis.habit.weeklyExplainMet': 'In {count, plural, one {# Woche} other {# Wochen}} hast du das Ziel der Gewohnheit erreicht ({target}).',
  'analysis.habit.weeklyExplainMeans':
    'An den Tagen dieser Wochen lag {gender, select, f {deine {metricDefined}} fd {deine {metricDefined}} other {dein {metricDefined}}} im Schnitt bei {meanA}, an den Tagen der {count, plural, one {# Woche} other {# Wochen}} unter dem Ziel bei {meanB}.',
  'analysis.habit.groupAWeeks': 'Tage in Wochen mit erreichtem Ziel ({count, plural, one {# Woche} other {# Wochen}})',
  'analysis.habit.groupBWeeks': 'Tage in Wochen unter dem Ziel ({count, plural, one {# Woche} other {# Wochen}})',

  // Weekday differences -----------------------------------------------------------------
  'analysis.weekday.label': 'die Unterschiede zwischen den Wochentagen',
  'analysis.weekday.text':
    'In deinen Daten sieht es so aus, als wäre {onWeekday} {gender, select, f {deine {metricDefined} im Schnitt {direction, select, higher {höher gewesen} other {niedriger gewesen}}} fd {deine {metricDefined} im Schnitt {direction, select, higher {länger gewesen} other {kürzer gewesen}}} other {dein {metricDefined} im Schnitt {direction, select, higher {höher gewesen} other {niedriger gewesen}}}} als an den übrigen Wochentagen ({meanA} gegenüber {meanB}).',
  'analysis.weekday.explainChecked': 'Ich habe {count, plural, one {# Tag} other {# Tage}} mit einer Angabe für {metric} geprüft, davon {countA} {weekdays}.',
  'analysis.weekday.explainMeans':
    'Im Schnitt lag {gender, select, f {deine {metricDefined}} fd {deine {metricDefined}} other {dein {metricDefined}}} {onWeekday} bei {meanA}, an den übrigen Tagen bei {meanB}.',
  'analysis.weekday.title':
    '{weekdays}: {gender, select, f {{direction, select, higher {höhere {metric}} other {niedrigere {metric}}}} fd {{direction, select, higher {längere {metric}} other {kürzere {metric}}}} other {{direction, select, higher {höheres {metric}} other {niedrigeres {metric}}}}}',
  'analysis.weekday.groupB': 'Übrige Wochentage',
  'analysis.weekday.tableValue': '{mean} ({count, plural, one {# Tag} other {# Tage}})',
  'analysis.weekday.nothing': 'Ich habe über {count, plural, one {# Tag} other {# Tage}} nach Unterschieden zwischen den Wochentagen gesucht und keinen nennenswerten Unterschied gefunden.',

  // Time of day -------------------------------------------------------------------------
  'analysis.timeOfDay.label': 'den Zusammenhang zwischen Schreibzeitpunkt und Stimmung',
  'analysis.timeOfDay.morning.label': 'Morgen',
  'analysis.timeOfDay.morning.phrase': 'am Morgen',
  'analysis.timeOfDay.late_morning.label': 'Vormittag',
  'analysis.timeOfDay.late_morning.phrase': 'am Vormittag',
  'analysis.timeOfDay.afternoon.label': 'Nachmittag',
  'analysis.timeOfDay.afternoon.phrase': 'am Nachmittag',
  'analysis.timeOfDay.evening.label': 'Abend',
  'analysis.timeOfDay.evening.phrase': 'am Abend',
  'analysis.timeOfDay.night.label': 'Nacht',
  'analysis.timeOfDay.night.phrase': 'in der Nacht',
  'analysis.timeOfDay.tableKey': '{label} ({hours})',
  'analysis.timeOfDay.tableValue': 'Durchschnitt {mean}, {count, plural, one {# Angabe} other {# Angaben}}',
  'analysis.timeOfDay.tableRow': '{key}: {value}',
  'analysis.timeOfDay.nothing': 'Ich habe {label} anhand von {count, plural, one {# Angabe} other {# Angaben}} geprüft und kein Zeitfenster gefunden, das über dem Durchschnitt hervorsticht.',
  'analysis.timeOfDay.text':
    'In deinen Daten sieht es so aus, als wäre die Stimmung, die du {phrase} ({hours}) angegeben hast, am höchsten gewesen: im Schnitt {mean}, gegenüber {overall} über alle Angaben.',
  'analysis.timeOfDay.explainChecked':
    'Ich habe {count, plural, one {# Stimmungsangabe} other {# Stimmungsangaben}} von {days, plural, one {# Tag} other {# Tagen}} geprüft, geordnet nach der Uhrzeit, zu der der Eintrag geschrieben wurde.',
  'analysis.timeOfDay.explainTable': '{table}. Gesamtdurchschnitt: {overall}.',
  'analysis.timeOfDay.explainDiff': 'Unterschied zwischen dem höchsten Zeitfenster und dem Gesamtdurchschnitt: {diff} Punkte. Stärke des Musters: {strength}.',
  'analysis.timeOfDay.title': 'Höhere Stimmung {phrase}',
  'analysis.timeOfDay.groupA': 'Angaben {phrase} ({hours})',
  'analysis.timeOfDay.groupB': 'Übrige Angaben',

  // Trends ------------------------------------------------------------------------------
  'analysis.trends.label': 'Trends bei Stimmung, Stress und Schlaf',
  'analysis.trends.text':
    'In deinen Daten sieht es so aus, als ob {gender, select, f {deine {metricDefined}} fd {deine {metricDefined}} other {dein {metricDefined}}} {horizon, select, period {im gesamten Zeitraum} monthly {im letzten Monat} other {in den letzten zwei Wochen}} {direction, select, up {tendenziell steigt} other {tendenziell sinkt}}: Die Trendlinie des gleitenden Durchschnitts {direction, select, up {stieg von} other {fiel von}} {fromValue} auf {toValue}.',
  'analysis.trends.explainChecked':
    'Ich habe {count, plural, one {# Tag} other {# Tage}} mit einer Angabe für {metric} {horizon, select, period {von den {len} Tagen des Zeitraums} other {von den letzten {len} Tagen}} geprüft ({from}–{to}).',
  'analysis.trends.explainFit':
    'Ich habe einen gleitenden Durchschnitt über {window} Tage und durch ihn eine Trendlinie (lineare Regression) berechnet: {direction, select, up {eine positive Steigung} other {eine negative Steigung}} von {unit, select, hours {{slope} Stunden} other {{slope} Punkten}} pro Tag, also eine Veränderung von etwa {unit, select, hours {{change} Stunden} other {{change} Punkten}} über das Zeitfenster (von {fromValue} auf {toValue} entlang der Trendlinie). Stärke des Trends: {strength}.',
  'analysis.trends.title':
    '{direction, select, up {Aufwärtstrend bei} other {Abwärtstrend bei}} {metric, select, mood {deiner Stimmung} energy {deinem Energielevel} stress {deinem Stresslevel} sleepHours {deiner Schlafdauer} sleepQuality {deiner Schlafqualität} exerciseMinutes {deiner Sportdauer} other {der Anzahl der Einträge}} {horizon, select, period {im gesamten Zeitraum} monthly {im letzten Monat} other {in den letzten zwei Wochen}}',
  'analysis.trends.groupA': 'Anfang des Zeitfensters (Trendlinie)',
  'analysis.trends.groupB': 'Ende des Zeitfensters (Trendlinie)',
  'analysis.trends.slopeValue': '{unit, select, hours {{slope} Stunden} other {{slope} Punkte}}',
  'analysis.trends.nothingSince': 'Ich habe seit dem {from} nach Trends bei Stimmung, Stress und Schlaf gesucht und keinen nennenswerten Trend gefunden.',
  'analysis.trends.nothingAll': 'Ich habe im gesamten Zeitraum nach Trends bei Stimmung, Stress und Schlaf gesucht und keinen nennenswerten Trend gefunden.',

  // Month comparison --------------------------------------------------------------------
  'analysis.periodCompare.label': 'den Vergleich zwischen dem aktuellen und dem vorherigen Monat',
  'analysis.periodCompare.text':
    'In deinen Daten sieht es so aus, als wäre {gender, select, f {deine {metricDefined} im {cur} im Schnitt {direction, select, higher {höher gewesen} other {niedriger gewesen}}} fd {deine {metricDefined} im {cur} im Schnitt {direction, select, higher {länger gewesen} other {kürzer gewesen}}} other {dein {metricDefined} im {cur} im Schnitt {direction, select, higher {höher gewesen} other {niedriger gewesen}}}} als im {prev} ({meanA} gegenüber {meanB}).',
  'analysis.periodCompare.explain':
    'Ich habe die Tage mit einer Angabe für {metric} im {cur} ({countA, plural, one {# Tag} other {# Tage}}, bis heute) mit den Tagen im {prev} ({countB, plural, one {# Tag} other {# Tage}}) verglichen. Durchschnitt im {cur}: {meanA}; im {prev}: {meanB}. Unterschied: {unit, select, hours {{diff} Stunden} other {{diff} Punkte}}. Stärke des Unterschieds: {strength}.',
  'analysis.periodCompare.title':
    'Im {cur}: {gender, select, f {{direction, select, higher {höhere {metric}} other {niedrigere {metric}}}} fd {{direction, select, higher {längere {metric}} other {kürzere {metric}}}} other {{direction, select, higher {höheres {metric}} other {niedrigeres {metric}}}}} als im {prev}',
  'analysis.periodCompare.entriesText':
    'Es sieht so aus, als hättest du {window, plural, one {am ersten Tag im {cur}} other {in den ersten # Tagen im {cur}}} {direction, select, more {mehr geschrieben} other {weniger geschrieben}} ({countA, plural, one {# Eintrag} other {# Einträge}}) als {window, plural, one {am ersten Tag im {prev}} other {in den ersten # Tagen im {prev}}} ({countB, plural, one {# Eintrag} other {# Einträge}}).',
  'analysis.periodCompare.entriesExplain':
    'Ich habe die Einträge {window, plural, one {am ersten Tag} other {in den ersten # Tagen}} jedes Monats gezählt, um gleich lange Zeitfenster zu vergleichen: {cur} – {countA, plural, one {# Eintrag} other {# Einträge}}, {prev} – {countB, plural, one {# Eintrag} other {# Einträge}}. Unterschied: {diff, plural, one {# Eintrag} other {# Einträge}} ({percent}). Stärke des Unterschieds: {strength}.',
  'analysis.periodCompare.entriesTitle': '{direction, select, more {Mehr Einträge} other {Weniger Einträge}} im {cur} als im {prev}',
  'analysis.periodCompare.monthWindow': '{month} ({window, plural, one {erster Tag} other {erste # Tage}})',
  'analysis.periodCompare.insufficientWhat': 'den Vergleich zwischen {cur} und {prev}',
  'analysis.periodCompare.nothing': 'Ich habe den {cur} mit dem {prev} verglichen und keinen nennenswerten Unterschied bei Stimmung, Stress, Schlaf oder der Anzahl der Einträge gefunden.',

  // Habit trend (improved / declined) -----------------------------------------------------
  'analysis.habitsTrend.label': 'Gewohnheiten, die sich verbessert oder verschlechtert haben',
  'analysis.habitsTrend.whether': 'ob sich die Gewohnheit „{habit}“ verbessert oder verschlechtert hat',
  'analysis.habitsTrend.textDaily':
    'Es sieht so aus, als {direction, select, improved {hätte sich die Gewohnheit „{habit}“ verbessert} other {hätte sich die Gewohnheit „{habit}“ verschlechtert}}: In den letzten zwei Wochen hast du sie an {recent} von {window} Tagen erledigt, gegenüber {previous} von {window} in den zwei Wochen davor.',
  'analysis.habitsTrend.textWeekly':
    'Es sieht so aus, als {direction, select, improved {hätte sich die Gewohnheit „{habit}“ verbessert} other {hätte sich die Gewohnheit „{habit}“ verschlechtert}}: In den letzten zwei Wochen hast du {recent} {unit} erfasst, gegenüber {previous} in den zwei Wochen davor (Ziel: {target} {unit} pro Woche).',
  'analysis.habitsTrend.explain':
    'Ich habe die Erfüllungsquote der Gewohnheit in den letzten zwei Wochen ({recentFrom}–{recentTo}) mit den zwei Wochen davor ({previousFrom}–{previousTo}) verglichen: {recentRate} gegenüber {previousRate}. Unterschied: {diff} Prozentpunkte. Stärke der Veränderung: {strength}.',
  'analysis.habitsTrend.title':
    '{direction, select, improved {Die Gewohnheit „{habit}“ hat sich in den letzten zwei Wochen verbessert} other {Die Gewohnheit „{habit}“ hat sich in den letzten zwei Wochen verschlechtert}}',
  'analysis.habitsTrend.metric': 'Erfüllungsquote – {habit}',
  'analysis.habitsTrend.groupA': 'Letzte zwei Wochen',
  'analysis.habitsTrend.groupB': 'Vorherige zwei Wochen',

  // Best / hardest days ------------------------------------------------------------------
  'analysis.bestWorst.label': 'die besten und schwierigsten Tage',
  'analysis.bestWorst.describedDay': '{day} („{title}“)',
  'analysis.bestWorst.noTitle': 'Ohne Titel',
  'analysis.bestWorst.extraValue': '{titles} – Wert {score}',
  'analysis.bestWorst.text':
    '{kind, select, best {Die besten Tage} other {Die schwierigsten Tage}} im Zeitraum, nach einem kombinierten Wert aus Stimmung, Energie und Stress: {days}.',
  'analysis.bestWorst.explainScore':
    '{count, plural, one {Für den # Tag habe ich einen kombinierten Wert berechnet} other {Für jeden der # Tage habe ich einen kombinierten Wert berechnet}}: den Durchschnitt aus Stimmung, Energielevel und (11 minus Stresslevel), aus den an diesem Tag angegebenen Werten.',
  'analysis.bestWorst.explainMeans':
    'Der durchschnittliche Wert im Zeitraum: {overall}. {kind, select, best {{count, plural, one {Der beste Tag erreichte} =3 {Die drei besten Tage erreichten} other {Die besten Tage erreichten}}} other {{count, plural, one {Der schwierigste Tag erreichte} =3 {Die drei schwierigsten Tage erreichten} other {Die schwierigsten Tage erreichten}}}} im Schnitt {mean}.',
  'analysis.bestWorst.explainDiff': 'Abstand zum Durchschnitt: {diff} Punkte. Stärke des Unterschieds: {strength}.',
  'analysis.bestWorst.title': '{kind, select, best {Die besten Tage im Zeitraum} other {Die schwierigsten Tage im Zeitraum}}',
  'analysis.bestWorst.metric': 'Kombinierter Wert (Stimmung + Energie + umgekehrter Stress)',
  'analysis.bestWorst.groupA': '{kind, select, best {Die besten Tage} other {Die schwierigsten Tage}}',
  'analysis.bestWorst.nothing': 'Ich habe {label} über {count, plural, one {# Tag} other {# Tage}} geprüft; die Werte waren ähnlich und kein Tag stach besonders hervor.',

  // Streaks -------------------------------------------------------------------------------
  'analysis.streaks.label': 'Schreib- und Gewohnheitsserien',
  'analysis.streaks.entriesTitle': 'Schreibserie von {count, plural, one {# Tag} other {# Tagen}}',
  'analysis.streaks.entriesText': 'Gut gemacht! Du hast {count, plural, one {# Tag} other {# Tage}} in Folge in dein Tagebuch geschrieben ({from}–{to}).',
  'analysis.streaks.entriesExplain':
    'Ich habe die aufeinanderfolgenden Tage mit mindestens einem Eintrag gezählt, bis heute oder gestern. Aktuelle Serie: {count, plural, one {# Tag} other {# Tage}}, vom {from} bis zum {to}. Längste Serie im Zeitraum: {best, plural, one {# Tag} other {# Tage}}.',
  'analysis.streaks.entriesMetric': 'Schreibtage',
  'analysis.streaks.currentDays': 'Tage in der aktuellen Serie',
  'analysis.streaks.daysWithEntry': 'Tage mit einem Eintrag im Zeitraum',
  'analysis.streaks.habitTitle': 'Serie von {count, plural, one {# Tag} other {# Tagen}} bei der Gewohnheit „{habit}“',
  'analysis.streaks.habitText': 'Du hast die Gewohnheit „{habit}“ {count, plural, one {# Tag} other {# Tage}} in Folge erledigt ({from}–{to}).',
  'analysis.streaks.habitExplain':
    'Ich habe die aufeinanderfolgenden Tage gezählt, an denen die Gewohnheit „{habit}“ als erledigt markiert war, bis heute oder gestern. Aktuelle Serie: {count, plural, one {# Tag} other {# Tage}}. Längste Serie im Zeitraum: {best, plural, one {# Tag} other {# Tage}}.',
  'analysis.streaks.habitMetric': 'Erfüllung der Gewohnheit {habit}',
  'analysis.streaks.daysCompleted': 'Tage im Zeitraum, an denen die Gewohnheit erledigt wurde',
  'analysis.streaks.weeklyTitle': 'Serie von {count, plural, one {# Woche} other {# Wochen}} bei der Gewohnheit „{habit}“',
  'analysis.streaks.weeklyText': 'Du hast das Ziel der Gewohnheit „{habit}“ {count, plural, one {# Woche} other {# Wochen}} in Folge erreicht ({from}–{to}).',
  'analysis.streaks.weeklyExplain':
    'Ich habe die für die Gewohnheit „{habit}“ erfasste Menge pro Woche addiert und mit dem Wochenziel ({target}) verglichen. Aktuelle Serie von Wochen mit erreichtem Ziel: {count, plural, one {# Woche} other {# Wochen}}.',
  'analysis.streaks.weeklyMetric': 'Wochenziel erreicht – {habit}',
  'analysis.streaks.currentWeeks': 'Wochen in der aktuellen Serie',
  'analysis.streaks.weeksWithLogs': 'Wochen mit erfassten Werten im Zeitraum',
  'analysis.streaks.none':
    'Es wurden keine aktiven Serien gefunden (eine Schreibserie von {entryMin} Tagen oder mehr oder eine Gewohnheitsserie von {habitMin} Tagen bzw. Wochen oder mehr).',

  // Anomalies -----------------------------------------------------------------------------
  'analysis.anomalies.label': 'ungewöhnliche Tage bei Stimmung oder Stress',
  'analysis.anomalies.textOne':
    'Es sieht so aus, als wäre {gender, select, f {deine {metricDefined} am {day}, verglichen mit dem Rest des Zeitraums, {side, select, high {ungewöhnlich hoch gewesen} other {ungewöhnlich niedrig gewesen}}} fd {deine {metricDefined} am {day}, verglichen mit dem Rest des Zeitraums, {side, select, high {ungewöhnlich lang gewesen} other {ungewöhnlich kurz gewesen}}} other {dein {metricDefined} am {day}, verglichen mit dem Rest des Zeitraums, {side, select, high {ungewöhnlich hoch gewesen} other {ungewöhnlich niedrig gewesen}}}} ({value}, bei einem Durchschnitt von {mean}).',
  'analysis.anomalies.textMany':
    'Es sieht so aus, als wäre an {count, plural, one {# Tag} other {# Tagen}} {gender, select, f {deine {metricDefined} im Vergleich zum Rest des Zeitraums {side, select, high {ungewöhnlich hoch gewesen} other {ungewöhnlich niedrig gewesen}}} fd {deine {metricDefined} im Vergleich zum Rest des Zeitraums {side, select, high {ungewöhnlich lang gewesen} other {ungewöhnlich kurz gewesen}}} other {dein {metricDefined} im Vergleich zum Rest des Zeitraums {side, select, high {ungewöhnlich hoch gewesen} other {ungewöhnlich niedrig gewesen}}}}: {days}; der Durchschnitt im Zeitraum: {mean}.',
  'analysis.anomalies.textManyMore':
    'Es sieht so aus, als wäre an {count, plural, one {# Tag} other {# Tagen}} {gender, select, f {deine {metricDefined} im Vergleich zum Rest des Zeitraums {side, select, high {ungewöhnlich hoch gewesen} other {ungewöhnlich niedrig gewesen}}} fd {deine {metricDefined} im Vergleich zum Rest des Zeitraums {side, select, high {ungewöhnlich lang gewesen} other {ungewöhnlich kurz gewesen}}} other {dein {metricDefined} im Vergleich zum Rest des Zeitraums {side, select, high {ungewöhnlich hoch gewesen} other {ungewöhnlich niedrig gewesen}}}}: {days} und weitere; der Durchschnitt im Zeitraum: {mean}.',
  'analysis.anomalies.dayItem': '{day} ({value})',
  'analysis.anomalies.detail': '{date}: {value} ({z} Standardabweichungen {side, select, above {über dem Durchschnitt} other {unter dem Durchschnitt}})',
  'analysis.anomalies.explain':
    'Ich habe {count, plural, one {# Tag} other {# Tage}} mit einer Angabe für {metric} geprüft. Durchschnitt: {mean}, Standardabweichung: {sd}. Ein Tag gilt als ungewöhnlich, wenn sein Wert um {z} Standardabweichungen oder mehr vom Durchschnitt abweicht. {details}. Stärke der Abweichung: {strength}.',
  'analysis.anomalies.title':
    '{count, plural, one {Ein Tag mit} other {Tage mit}} {gender, select, f {{side, select, high {ungewöhnlich hoher {metric}} other {ungewöhnlich niedriger {metric}}}} fd {{side, select, high {ungewöhnlich langer {metric}} other {ungewöhnlich kurzer {metric}}}} other {{side, select, high {ungewöhnlich hohem {metric}} other {ungewöhnlich niedrigem {metric}}}}}',
  'analysis.anomalies.groupA': 'Ungewöhnliche Tage',
  'analysis.anomalies.zValue': '{value} (z {z})',
  'analysis.anomalies.nothing':
    'Ich habe über {count, plural, one {# Tag} other {# Tage}} nach ungewöhnlichen Tagen gesucht und keinen Tag gefunden, der um {z} Standardabweichungen oder mehr vom Durchschnitt abweicht.',

  // Emotion patterns ----------------------------------------------------------------------
  'analysis.emotion.label': 'Gefühlsmuster nach Tagen, Personen und Orten',
  'analysis.emotion.metric': 'Das Gefühl {emotion}',
  'analysis.emotion.groupA': 'Tage mit dem Gefühl „{emotion}“',
  'analysis.emotion.weekdayTitle': 'Das Gefühl „{emotion}“ tritt vor allem {onWeekday} auf',
  'analysis.emotion.weekdayText': 'In deinen Daten sieht es so aus, als wäre das Gefühl „{emotion}“ vor allem {onWeekday} aufgetreten ({top} von {total} Malen).',
  'analysis.emotion.weekdayExplain':
    'Ich habe {count, plural, one {# Tag} other {# Tage}} geprüft. Das Gefühl „{emotion}“ wurde an {total, plural, one {# Tag} other {# Tagen}} angegeben; {top} davon waren {weekdays} ({share}), während {weekdays} {baseline} aller geprüften Tage ausmachen. Stärke des Musters: {strength}.',
  'analysis.emotion.groupBWeekday': 'Davon {weekdays}',
  'analysis.emotion.weekdayShareKey': 'Anteil der {weekdays} an allen Tagen',
  'analysis.emotion.personTitle': 'Das Gefühl „{emotion}“ und {name}',
  'analysis.emotion.placeTitle': 'Das Gefühl „{emotion}“ und „{place}“',
  'analysis.emotion.personText':
    'In deinen Daten sieht es so aus, als wäre das Gefühl „{emotion}“ oft an Tagen aufgetreten, an denen du {name} getroffen hast ({with} von {total} Malen).',
  'analysis.emotion.placeText':
    'In deinen Daten sieht es so aus, als wäre das Gefühl „{emotion}“ oft an Tagen aufgetreten, an denen als Ort „{place}“ angegeben war ({with} von {total} Malen).',
  'analysis.emotion.personExplain':
    'Ich habe {count, plural, one {# Tag} other {# Tage}} geprüft. Das Gefühl „{emotion}“ wurde an {total} Tagen angegeben; an {with} davon ({share}) kam auch {name} im Eintrag vor. {name} kommt insgesamt an {baselineCount} der {count} Tage vor ({baseline}). Stärke des Musters: {strength}.',
  'analysis.emotion.placeExplain':
    'Ich habe {count, plural, one {# Tag} other {# Tage}} geprüft. Das Gefühl „{emotion}“ wurde an {total} Tagen angegeben; an {with} davon ({share}) stand im Eintrag auch der Ort „{place}“. Der Ort „{place}“ kommt insgesamt an {baselineCount} der {count} Tage vor ({baseline}). Stärke des Musters: {strength}.',
  'analysis.emotion.groupBPerson': 'Davon mit {name}',
  'analysis.emotion.groupBPlace': 'Davon am Ort „{place}“',
  'analysis.emotion.personShareKey': 'Anteil der Tage mit {name} an allen Tagen',
  'analysis.emotion.placeShareKey': 'Anteil des Orts „{place}“ an allen Tagen',
  'analysis.emotion.nothing':
    'Ich habe {count, plural, one {# Gefühl} other {# Gefühle}} geprüft, die mindestens {min}-mal vorkamen, und keine nennenswerte Häufung an bestimmten Tagen, bei bestimmten Personen oder an bestimmten Orten gefunden.',
};
export default messages;
