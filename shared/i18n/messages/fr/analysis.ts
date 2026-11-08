/**
 * fr - analysis messages (server-side insight templates, notes and labels). Keys are prefixed
 * 'analysis.'; see shared/i18n/index.ts for the template syntax and the English file for the
 * conventions.
 *
 * Notes for French:
 *  - Hedged and non-causal throughout: "Dans vos données, il semble que...", "il pourrait y
 *    avoir un lien...". "Il semble que" takes the subjunctive (ait été, soit apparue).
 *  - Gender: 'analysis.metric.<m>.gender' is 'f' (humeur, qualité de sommeil) or 'm'; the
 *    templates add an `f {...}` branch for the adjectives that agree (élevée, basse, moyenne).
 *  - The metric nouns are singular ("temps de sommeil", "nombre d'entrées") so that
 *    "votre {metric}" is always grammatical, also in templates that carry no {gender}.
 *  - Months are introduced with "en" ("en août", "en octobre") to avoid de/d' elision.
 */
const messages: Record<string, string> = {
  // Engine / provider -----------------------------------------------------------------
  'analysis.engine.providerFailed': 'L’analyse des tendances n’a pas abouti (erreur interne). Veuillez réessayer plus tard.',
  'analysis.engine.detectorFailed': 'La vérification « {label} » n’a pas abouti (erreur interne) ; les autres observations ne sont pas concernées.',

  // Strength --------------------------------------------------------------------------
  'analysis.strength.weak': 'faible',
  'analysis.strength.moderate': 'modérée',
  'analysis.strength.strong': 'forte',

  // Metrics: label (short, standalone), defined (subject inside a sentence), gender -----
  'analysis.metric.mood.label': 'humeur',
  'analysis.metric.mood.defined': 'humeur',
  'analysis.metric.mood.gender': 'f',
  'analysis.metric.energy.label': 'niveau d’énergie',
  'analysis.metric.energy.defined': 'niveau d’énergie',
  'analysis.metric.energy.gender': 'm',
  'analysis.metric.stress.label': 'niveau de stress',
  'analysis.metric.stress.defined': 'niveau de stress',
  'analysis.metric.stress.gender': 'm',
  'analysis.metric.sleepHours.label': 'temps de sommeil',
  'analysis.metric.sleepHours.defined': 'temps de sommeil',
  'analysis.metric.sleepHours.gender': 'm',
  'analysis.metric.sleepQuality.label': 'qualité de sommeil',
  'analysis.metric.sleepQuality.defined': 'qualité de sommeil',
  'analysis.metric.sleepQuality.gender': 'f',
  'analysis.metric.exerciseMinutes.label': 'temps d’activité physique',
  'analysis.metric.exerciseMinutes.defined': 'temps d’activité physique',
  'analysis.metric.exerciseMinutes.gender': 'm',
  'analysis.metric.entries.label': 'nombre d’entrées',
  'analysis.metric.entries.defined': 'nombre d’entrées',
  'analysis.metric.entries.gender': 'm',

  // Counts and dates ------------------------------------------------------------------
  'analysis.count.days': '{count, plural, one {# jour} other {# jours}}',
  'analysis.count.weeks': '{count, plural, one {# semaine} other {# semaines}}',
  'analysis.date.dayWithDate': '{weekday} {date}',

  // Weekdays (index 0 = Sunday) --------------------------------------------------------
  'analysis.weekday.plural.0': 'dimanches',
  'analysis.weekday.plural.1': 'lundis',
  'analysis.weekday.plural.2': 'mardis',
  'analysis.weekday.plural.3': 'mercredis',
  'analysis.weekday.plural.4': 'jeudis',
  'analysis.weekday.plural.5': 'vendredis',
  'analysis.weekday.plural.6': 'samedis',
  'analysis.weekday.on.0': 'le dimanche',
  'analysis.weekday.on.1': 'le lundi',
  'analysis.weekday.on.2': 'le mardi',
  'analysis.weekday.on.3': 'le mercredi',
  'analysis.weekday.on.4': 'le jeudi',
  'analysis.weekday.on.5': 'le vendredi',
  'analysis.weekday.on.6': 'le samedi',

  // Notes shared by the detectors -------------------------------------------------------
  'analysis.note.insufficient': 'Il n’y a pas encore assez de données pour examiner {what} (il faut au moins {required} ; actuellement : {have}).',
  'analysis.note.insufficientWhether': 'Il n’y a pas encore assez de données pour vérifier {what} (il faut au moins {required} ; actuellement : {have}).',
  'analysis.note.nothingNotable': 'J’ai examiné {what} sur {count, plural, one {# jour} other {# jours}} et je n’ai trouvé aucune différence notable.',

  // Requirement / availability phrases used inside the notes above ----------------------
  'analysis.req.daysBothValues': '{count, plural, one {# jour avec les deux valeurs} other {# jours avec les deux valeurs}}',
  'analysis.req.daysPerGroup': '{count, plural, one {# jour dans chaque groupe} other {# jours dans chaque groupe}}',
  'analysis.req.daysWithReport': '{count, plural, one {# jour avec une valeur renseignée} other {# jours avec une valeur renseignée}}',
  'analysis.req.daysWithRatings': '{count, plural, one {# jour avec des notes} other {# jours avec des notes}}',
  'analysis.req.daysPerMonth': '{count, plural, one {# jour renseigné chaque mois} other {# jours renseignés chaque mois}}',
  'analysis.req.recentDays': '{count, plural, one {# jour renseigné ces deux dernières semaines} other {# jours renseignés ces deux dernières semaines}}',
  'analysis.req.fullWeeks': '{count, plural, one {# semaine complète renseignée} other {# semaines complètes renseignées}}',
  'analysis.req.weeksOfLogs': '{count, plural, one {# semaine de suivi} other {# semaines de suivi}}',
  'analysis.req.weekPerGroup': 'une semaine dans chaque groupe et {count, plural, one {# jour renseigné} other {# jours renseignés}} dans chaque groupe',
  'analysis.req.moodReports': '{count, plural, one {# valeur d’humeur} other {# valeurs d’humeur}}',
  'analysis.req.reportsInWindow': '{count, plural, one {# valeur dans une même tranche horaire} other {# valeurs dans une même tranche horaire}}',
  'analysis.req.emotionRepeated': 'une émotion notée sur {count, plural, one {# jour} other {# jours}}',
  'analysis.have.twoGroups': '{groupA} : {countA, plural, one {# jour} other {# jours}} ; {groupB} : {countB, plural, one {# jour} other {# jours}}',
  'analysis.have.weeksTwoGroups':
    'semaines avec objectif atteint : {metWeeks, plural, one {# semaine} other {# semaines}} ({metDays, plural, one {# jour} other {# jours}}) ; semaines sous l’objectif : {belowWeeks, plural, one {# semaine} other {# semaines}} ({belowDays, plural, one {# jour} other {# jours}})',
  'analysis.have.twoMonths': '{countA, plural, one {# jour} other {# jours}} en {cur} et {countB, plural, one {# jour} other {# jours}} en {prev}',
  'analysis.have.noData': 'aucune donnée',
  'analysis.have.noSuchEmotion': 'aucune pour le moment',
  'analysis.have.fewerInEveryWindow': 'moins que cela dans chaque tranche horaire',

  // Sentences shared by the group-comparison detectors ----------------------------------
  'analysis.relation.text':
    'Dans vos données, il semble que {condition}, votre {metricDefined} ait été en moyenne {gender, select, f {{direction, select, higher {plus élevée} other {plus basse}}} other {{direction, select, higher {plus élevé} other {plus bas}}}} ({meanA} contre {meanB}).',
  'analysis.correlation.text':
    'Dans vos données, il pourrait y avoir un lien entre votre {x} et votre {y} : {xGender, select, f {quand votre {x} était plus élevée} other {quand votre {x} était plus élevé}}, {yGender, select, f {votre {y} {direction, select, higher {avait tendance à être plus élevée} other {avait tendance à être plus basse}}} other {votre {y} {direction, select, higher {avait tendance à être plus élevé} other {avait tendance à être plus bas}}}} (corrélation {r}).',
  'analysis.explain.checkedDays': 'J’ai examiné {count, plural, one {# jour} other {# jours}}.',
  'analysis.explain.onDaysCondition': 'Parmi eux, {count, plural, one {# jour} other {# jours}} où vous avez {conditionPast}.',
  'analysis.explain.groupMeans':
    'Ces jours-là, {gender, select, f {votre {metricDefined} moyenne était de {meanA}} other {votre {metricDefined} moyen était de {meanA}}}, contre {meanB} les autres jours.',
  'analysis.explain.correlation': 'Corrélation : {r}.',
  'analysis.explain.correlationBetween': 'Corrélation ({predictor} / {outcome}) : {r}.',
  'analysis.explain.diffAndStrength': 'Différence entre les moyennes : {diff} points. Force de la tendance : {strength}.',
  'analysis.explain.diffStrength': 'Différence : {diff} points. Force de la tendance : {strength}.',
  'analysis.split.corrExplainChecked': 'J’ai examiné {count, plural, one {# jour} other {# jours}} pour lesquels votre {x} et votre {y} étaient tous deux renseignés.',
  'analysis.split.corrExplainPearson': 'Corrélation de Pearson : {r} (force : {strength}).',
  'analysis.split.corrExplainGroups':
    'Il n’y avait pas assez de jours dans chaque groupe pour comparer les moyennes ({groupA} : {countA, plural, one {# jour} other {# jours}} ; {groupB} : {countB, plural, one {# jour} other {# jours}} ; il en faut au moins {min} par groupe).',

  // Evidence table keys ---------------------------------------------------------------
  'analysis.extra.predictor': 'Prédicteur',
  'analysis.extra.strength': 'Force',
  'analysis.extra.meanDiff': 'Différence des moyennes (A moins B)',
  'analysis.extra.cohenD': 'Taille d’effet (d de Cohen)',
  'analysis.extra.weeksChecked': 'Semaines examinées',
  'analysis.extra.weeklyTarget': 'Objectif hebdomadaire',
  'analysis.extra.target': 'Objectif',
  'analysis.extra.frequency': 'Fréquence',
  'analysis.extra.periodMean': 'Moyenne de la période',
  'analysis.extra.overallMean': 'Moyenne globale',
  'analysis.extra.stddev': 'Écart-type',
  'analysis.extra.slopePerDay': 'Pente par jour',
  'analysis.extra.daysInWindow': 'Jours dans la fenêtre',
  'analysis.extra.movingWindow': 'Fenêtre de la moyenne mobile',
  'analysis.extra.relativeChange': 'Variation relative',
  'analysis.extra.longestStreak': 'Plus longue série de la période',
  'analysis.extra.shareOfEmotionDays': 'Part des jours de l’émotion',
  'analysis.frequency.daily': 'quotidienne',
  'analysis.frequency.weekly': 'hebdomadaire',
  'analysis.groupB.otherDays': 'Autres jours',

  // Sleep detectors -------------------------------------------------------------------
  'analysis.sleep.groupA': 'Jours avec moins de {hours} heures de sommeil',
  'analysis.sleep.groupB': 'Jours avec {hours} heures de sommeil ou plus',
  'analysis.sleep.condition': 'les jours où vous avez dormi moins de {hours} heures',
  'analysis.sleep.conditionPast': 'dormi moins de {hours} heures',
  'analysis.sleepMood.label': 'le lien entre le sommeil et l’humeur',
  'analysis.sleepMood.title': '{direction, select, lower {Sommeil court et humeur plus basse} other {Sommeil court et humeur plus élevée}}',
  'analysis.sleepMood.corrTitle': 'Lien possible entre les heures de sommeil et l’humeur',
  'analysis.sleepEnergy.label': 'le lien entre le sommeil et le niveau d’énergie',
  'analysis.sleepEnergy.title': '{direction, select, lower {Sommeil court et énergie plus basse} other {Sommeil court et énergie plus élevée}}',
  'analysis.sleepEnergy.corrTitle': 'Lien possible entre les heures de sommeil et le niveau d’énergie',

  // Exercise detectors ----------------------------------------------------------------
  'analysis.exercise.groupA': 'Jours avec activité physique',
  'analysis.exercise.groupB': 'Jours sans activité physique',
  'analysis.exercise.condition': 'les jours où vous avez fait de l’activité physique',
  'analysis.exercise.conditionPast': 'fait de l’activité physique',
  'analysis.exerciseMood.label': 'le lien entre l’activité physique et l’humeur',
  'analysis.exerciseMood.title': '{direction, select, higher {Activité physique et humeur plus élevée} other {Activité physique et humeur plus basse}}',
  'analysis.exerciseMood.corrTitle': 'Lien possible entre les minutes d’activité physique et l’humeur',
  'analysis.exerciseEnergy.label': 'le lien entre l’activité physique et le niveau d’énergie',
  'analysis.exerciseEnergy.title': '{direction, select, higher {Activité physique et énergie plus élevée} other {Activité physique et énergie plus basse}}',
  'analysis.exerciseEnergy.corrTitle': 'Lien possible entre les minutes d’activité physique et le niveau d’énergie',

  // Habit - mood / energy / stress ------------------------------------------------------
  'analysis.habit.detectorLabel': 'le lien entre les habitudes et l’humeur',
  'analysis.habit.noHabits': 'Il n’y a aucune habitude active ; je n’ai donc pas recherché de lien entre les habitudes et l’humeur.',
  'analysis.habit.noLogs': 'L’habitude « {habit} » n’a pas encore de suivi sur cette période ; je n’ai donc pas recherché de lien entre elle et l’humeur.',
  'analysis.habit.noFullWeeks': 'L’habitude « {habit} » n’a pas encore de semaine complète de suivi ; je n’ai donc pas recherché de lien entre elle et l’humeur.',
  'analysis.habit.label': 'le lien entre l’habitude « {habit} » et votre {metric}',
  'analysis.habit.groupA': 'Jours où l’habitude « {habit} » a été accomplie',
  'analysis.habit.groupB': 'Jours où l’habitude « {habit} » n’a pas été accomplie',
  'analysis.habit.condition': 'les jours où vous avez accompli l’habitude « {habit} »',
  'analysis.habit.conditionPast': 'accompli l’habitude « {habit} »',
  'analysis.habit.title':
    'Habitude « {habit} » et {gender, select, f {{direction, select, higher {{metric} plus élevée} other {{metric} plus basse}}} other {{direction, select, higher {{metric} plus élevé} other {{metric} plus bas}}}}',
  'analysis.habit.corrTitle': 'Lien possible entre l’habitude « {habit} » et votre {metric}',
  'analysis.habit.weeklyCondition': 'les semaines où vous avez atteint l’objectif de l’habitude « {habit} »',
  'analysis.habit.weeklyTarget': '{target} {unit} par semaine',
  'analysis.habit.targetValue': '{target} {unit}',
  'analysis.habit.weeklyExplainChecked':
    'J’ai examiné {weeks, plural, one {# semaine complète} other {# semaines complètes}} ({days, plural, one {# jour} other {# jours}} avec une valeur renseignée pour votre {metric}).',
  'analysis.habit.weeklyExplainMet': 'Vous avez atteint l’objectif de l’habitude ({target}) pendant {count, plural, one {# semaine} other {# semaines}}.',
  'analysis.habit.weeklyExplainMeans':
    '{gender, select, f {Votre {metricDefined} moyenne pendant ces semaines était de {meanA}} other {Votre {metricDefined} moyen pendant ces semaines était de {meanA}}}, contre {meanB} pendant {count, plural, one {la semaine restée sous l’objectif} other {les # semaines restées sous l’objectif}}.',
  'analysis.habit.groupAWeeks': 'Jours des semaines avec objectif atteint ({count, plural, one {# semaine} other {# semaines}})',
  'analysis.habit.groupBWeeks': 'Jours des semaines sous l’objectif ({count, plural, one {# semaine} other {# semaines}})',

  // Weekday differences -----------------------------------------------------------------
  'analysis.weekday.label': 'les différences entre les jours de la semaine',
  'analysis.weekday.text':
    'Dans vos données, il semble que {onWeekday}, votre {metricDefined} ait été en moyenne {gender, select, f {{direction, select, higher {plus élevée} other {plus basse}}} other {{direction, select, higher {plus élevé} other {plus bas}}}} que les autres jours de la semaine ({meanA} contre {meanB}).',
  'analysis.weekday.explainChecked': 'J’ai examiné {count, plural, one {# jour} other {# jours}} avec une valeur renseignée pour votre {metric}, dont {countA} correspondant à des {weekdays}.',
  'analysis.weekday.explainMeans':
    '{gender, select, f {Votre {metricDefined} moyenne {onWeekday} était de {meanA}} other {Votre {metricDefined} moyen {onWeekday} était de {meanA}}}, contre {meanB} les autres jours.',
  'analysis.weekday.title':
    'Les {weekdays} : {gender, select, f {{direction, select, higher {{metric} plus élevée} other {{metric} plus basse}}} other {{direction, select, higher {{metric} plus élevé} other {{metric} plus bas}}}}',
  'analysis.weekday.groupB': 'Autres jours de la semaine',
  'analysis.weekday.tableValue': '{mean} ({count, plural, one {# jour} other {# jours}})',
  'analysis.weekday.nothing': 'J’ai recherché des différences entre les jours de la semaine sur {count, plural, one {# jour} other {# jours}} et je n’ai trouvé aucune différence notable.',

  // Time of day -------------------------------------------------------------------------
  'analysis.timeOfDay.label': 'le lien entre le moment de l’écriture et l’humeur',
  'analysis.timeOfDay.morning.label': 'Matin',
  'analysis.timeOfDay.morning.phrase': 'le matin',
  'analysis.timeOfDay.late_morning.label': 'Fin de matinée',
  'analysis.timeOfDay.late_morning.phrase': 'en fin de matinée',
  'analysis.timeOfDay.afternoon.label': 'Après-midi',
  'analysis.timeOfDay.afternoon.phrase': 'l’après-midi',
  'analysis.timeOfDay.evening.label': 'Soir',
  'analysis.timeOfDay.evening.phrase': 'le soir',
  'analysis.timeOfDay.night.label': 'Nuit',
  'analysis.timeOfDay.night.phrase': 'la nuit',
  'analysis.timeOfDay.tableKey': '{label} ({hours})',
  'analysis.timeOfDay.tableValue': 'moyenne {mean}, {count, plural, one {# valeur} other {# valeurs}}',
  'analysis.timeOfDay.tableRow': '{key} : {value}',
  'analysis.timeOfDay.nothing': 'J’ai examiné {label} sur {count, plural, one {# valeur} other {# valeurs}} et je n’ai trouvé aucune tranche horaire nettement au-dessus de la moyenne.',
  'analysis.timeOfDay.text':
    'Dans vos données, il semble que l’humeur notée {phrase} ({hours}) ait été la plus élevée : {mean} en moyenne, contre {overall} sur l’ensemble des valeurs.',
  'analysis.timeOfDay.explainChecked':
    'J’ai examiné {count, plural, one {# valeur d’humeur issue} other {# valeurs d’humeur issues}} de {days, plural, one {# jour} other {# jours}}, selon l’heure à laquelle l’entrée a été écrite.',
  'analysis.timeOfDay.explainTable': '{table}. Moyenne globale : {overall}.',
  'analysis.timeOfDay.explainDiff': 'Différence entre la tranche horaire la plus élevée et la moyenne globale : {diff} points. Force de la tendance : {strength}.',
  'analysis.timeOfDay.title': 'Humeur plus élevée {phrase}',
  'analysis.timeOfDay.groupA': 'Valeurs notées {phrase} ({hours})',
  'analysis.timeOfDay.groupB': 'Autres valeurs',

  // Trends ------------------------------------------------------------------------------
  'analysis.trends.label': 'les tendances de l’humeur, du stress et du sommeil',
  'analysis.trends.text':
    'Dans vos données, votre {metricDefined} {gender, select, other {semble suivre une tendance {direction, select, up {à la hausse} other {à la baisse}}}} {horizon, select, period {sur la période} monthly {au cours du dernier mois} other {au cours des deux dernières semaines}} : la droite de tendance de la moyenne mobile {direction, select, up {est passée de} other {est descendue de}} {fromValue} à {toValue}.',
  'analysis.trends.explainChecked':
    'J’ai examiné {count, plural, one {# jour} other {# jours}} avec une valeur renseignée pour votre {metric}, sur les {len} {horizon, select, period {jours de la période} other {jours les plus récents}} ({from}-{to}).',
  'analysis.trends.explainFit':
    'J’ai calculé une moyenne mobile sur {window} jours et une droite de tendance (régression linéaire) : {direction, select, up {une pente ascendante} other {une pente descendante}} de {unit, select, hours {{slope} h} other {{slope} point}} par jour, soit une variation d’environ {unit, select, hours {{change} h} other {{change} points}} sur la fenêtre (de {fromValue} à {toValue} le long de la droite de tendance). Force de la tendance : {strength}.',
  'analysis.trends.title':
    '{direction, select, up {Tendance à la hausse} other {Tendance à la baisse}} pour {metric, select, mood {votre humeur} energy {votre niveau d’énergie} stress {votre niveau de stress} sleepHours {votre temps de sommeil} sleepQuality {votre qualité de sommeil} exerciseMinutes {votre temps d’activité physique} other {le nombre d’entrées}} {horizon, select, period {sur la période} monthly {au cours du dernier mois} other {au cours des deux dernières semaines}}',
  'analysis.trends.groupA': 'Début de la fenêtre (droite de tendance)',
  'analysis.trends.groupB': 'Fin de la fenêtre (droite de tendance)',
  'analysis.trends.slopeValue': '{unit, select, hours {{slope} h} other {{slope} point}}',
  'analysis.trends.nothingSince': 'J’ai recherché des tendances dans l’humeur, le stress et le sommeil depuis le {from} et je n’en ai trouvé aucune de notable.',
  'analysis.trends.nothingAll': 'J’ai recherché des tendances dans l’humeur, le stress et le sommeil sur toute la période et je n’en ai trouvé aucune de notable.',

  // Month comparison --------------------------------------------------------------------
  'analysis.periodCompare.label': 'la comparaison entre le mois en cours et le mois précédent',
  'analysis.periodCompare.text':
    'Dans vos données, il semble que votre {metricDefined} ait été en moyenne {gender, select, f {{direction, select, higher {plus élevée} other {plus basse}}} other {{direction, select, higher {plus élevé} other {plus bas}}}} en {cur} qu’en {prev} ({meanA} contre {meanB}).',
  'analysis.periodCompare.explain':
    'J’ai comparé les jours avec une valeur renseignée pour votre {metric} en {cur} ({countA, plural, one {# jour} other {# jours}}, jusqu’à aujourd’hui) avec ceux de {prev} ({countB, plural, one {# jour} other {# jours}}). Moyenne en {cur} : {meanA} ; en {prev} : {meanB}. Différence : {unit, select, hours {{diff} h} other {{diff} points}}. Ampleur de la différence : {strength}.',
  'analysis.periodCompare.title':
    'En {cur} : {gender, select, f {{direction, select, higher {{metric} plus élevée} other {{metric} plus basse}}} other {{direction, select, higher {{metric} plus élevé} other {{metric} plus bas}}}} qu’en {prev}',
  'analysis.periodCompare.entriesText':
    'Il semble que vous ayez {direction, select, more {écrit davantage} other {écrit moins}} en {cur} ({countA, plural, one {# entrée} other {# entrées}}) qu’en {prev} ({countB, plural, one {# entrée} other {# entrées}}), en comparant les {window} premiers jours de chaque mois.',
  'analysis.periodCompare.entriesExplain':
    'J’ai compté les entrées des {window} premiers jours de chaque mois, pour comparer des périodes de même durée : {cur} - {countA, plural, one {# entrée} other {# entrées}}, {prev} - {countB, plural, one {# entrée} other {# entrées}}. Différence : {diff, plural, one {# entrée} other {# entrées}} ({percent}). Ampleur de la différence : {strength}.',
  'analysis.periodCompare.entriesTitle': '{direction, select, more {Plus d’entrées} other {Moins d’entrées}} en {cur} qu’en {prev}',
  'analysis.periodCompare.monthWindow': '{month} ({window} premiers jours)',
  'analysis.periodCompare.insufficientWhat': 'la comparaison entre {cur} et {prev}',
  'analysis.periodCompare.nothing': 'J’ai comparé {cur} et {prev} et je n’ai trouvé aucune différence notable d’humeur, de stress, de sommeil ou de nombre d’entrées.',

  // Habit trend (improved / declined) -----------------------------------------------------
  'analysis.habitsTrend.label': 'les habitudes qui se sont améliorées ou qui ont reculé',
  'analysis.habitsTrend.whether': 'si l’habitude « {habit} » s’est améliorée ou a reculé',
  'analysis.habitsTrend.textDaily':
    'Il semble que l’habitude « {habit} » {direction, select, improved {se soit améliorée} other {ait reculé}} : ces deux dernières semaines, vous l’avez accomplie {recent} fois sur {window} jours, contre {previous} fois sur {window} les deux semaines précédentes.',
  'analysis.habitsTrend.textWeekly':
    'Il semble que l’habitude « {habit} » {direction, select, improved {se soit améliorée} other {ait reculé}} : ces deux dernières semaines, vous avez enregistré {recent} {unit}, contre {previous} les deux semaines précédentes (objectif : {target} {unit} par semaine).',
  'analysis.habitsTrend.explain':
    'J’ai comparé le taux de réalisation de l’habitude sur les deux dernières semaines ({recentFrom}-{recentTo}) avec celui des deux semaines précédentes ({previousFrom}-{previousTo}) : {recentRate} contre {previousRate}. Différence : {diff} points de pourcentage. Ampleur du changement : {strength}.',
  'analysis.habitsTrend.title': 'L’habitude « {habit} » {direction, select, improved {s’est améliorée} other {a reculé}} ces deux dernières semaines',
  'analysis.habitsTrend.metric': 'Taux de réalisation - {habit}',
  'analysis.habitsTrend.groupA': 'Deux dernières semaines',
  'analysis.habitsTrend.groupB': 'Deux semaines précédentes',

  // Best / hardest days ------------------------------------------------------------------
  'analysis.bestWorst.label': 'les meilleurs jours et les jours les plus difficiles',
  'analysis.bestWorst.describedDay': '{day} (« {title} »)',
  'analysis.bestWorst.noTitle': 'Sans titre',
  'analysis.bestWorst.extraValue': '{titles} - score {score}',
  'analysis.bestWorst.text':
    '{kind, select, best {Les meilleurs jours} other {Les jours les plus difficiles}} de la période, selon un score combinant humeur, énergie et stress : {days}.',
  'analysis.bestWorst.explainScore':
    '{count, plural, one {Pour ce jour} other {Pour chacun des # jours}}, j’ai calculé un score combiné : la moyenne de l’humeur, du niveau d’énergie et de (11 moins le niveau de stress), à partir des valeurs notées ce jour-là.',
  'analysis.bestWorst.explainMeans':
    'Score moyen de la période : {overall}. {kind, select, best {{count, plural, one {Le meilleur jour a obtenu} =3 {Les trois meilleurs jours ont obtenu} other {Les meilleurs jours ont obtenu}}} other {{count, plural, one {Le jour le plus difficile a obtenu} =3 {Les trois jours les plus difficiles ont obtenu} other {Les jours les plus difficiles ont obtenu}}}} {mean} en moyenne.',
  'analysis.bestWorst.explainDiff': 'Écart par rapport à la moyenne : {diff} points. Ampleur de l’écart : {strength}.',
  'analysis.bestWorst.title': '{kind, select, best {Les meilleurs jours de la période} other {Les jours les plus difficiles de la période}}',
  'analysis.bestWorst.metric': 'Score combiné (humeur + énergie + stress inversé)',
  'analysis.bestWorst.groupA': '{kind, select, best {Les meilleurs jours} other {Les jours les plus difficiles}}',
  'analysis.bestWorst.nothing': 'J’ai examiné {label} sur {count, plural, one {# jour} other {# jours}} ; les scores étaient proches et aucun jour ne se distinguait particulièrement.',

  // Streaks -------------------------------------------------------------------------------
  'analysis.streaks.label': 'les séries d’écriture et d’habitudes',
  'analysis.streaks.entriesTitle': 'Série d’écriture de {count, plural, one {# jour} other {# jours}}',
  'analysis.streaks.entriesText': 'Bravo ! Vous avez écrit dans votre journal {count, plural, one {# jour} other {# jours}} d’affilée ({from}-{to}).',
  'analysis.streaks.entriesExplain':
    'J’ai compté les jours consécutifs avec au moins une entrée, jusqu’à aujourd’hui ou hier. Série en cours : {count, plural, one {# jour} other {# jours}}, du {from} au {to}. Plus longue série de la période : {best, plural, one {# jour} other {# jours}}.',
  'analysis.streaks.entriesMetric': 'Jours d’écriture',
  'analysis.streaks.currentDays': 'Jours de la série en cours',
  'analysis.streaks.daysWithEntry': 'Jours avec une entrée sur la période',
  'analysis.streaks.habitTitle': 'Série de {count, plural, one {# jour} other {# jours}} pour l’habitude « {habit} »',
  'analysis.streaks.habitText': 'Vous avez accompli l’habitude « {habit} » {count, plural, one {# jour} other {# jours}} d’affilée ({from}-{to}).',
  'analysis.streaks.habitExplain':
    'J’ai compté les jours consécutifs où l’habitude « {habit} » a été marquée comme accomplie, jusqu’à aujourd’hui ou hier. Série en cours : {count, plural, one {# jour} other {# jours}}. Plus longue série de la période : {best, plural, one {# jour} other {# jours}}.',
  'analysis.streaks.habitMetric': 'Réalisation de l’habitude {habit}',
  'analysis.streaks.daysCompleted': 'Jours où l’habitude a été accomplie sur la période',
  'analysis.streaks.weeklyTitle': 'Série de {count, plural, one {# semaine} other {# semaines}} pour l’habitude « {habit} »',
  'analysis.streaks.weeklyText': 'Vous avez atteint l’objectif de l’habitude « {habit} » {count, plural, one {# semaine} other {# semaines}} d’affilée ({from}-{to}).',
  'analysis.streaks.weeklyExplain':
    'J’ai additionné chaque semaine la quantité enregistrée pour l’habitude « {habit} » et je l’ai comparée à l’objectif hebdomadaire ({target}). Série en cours de semaines avec objectif atteint : {count, plural, one {# semaine} other {# semaines}}.',
  'analysis.streaks.weeklyMetric': 'Objectif hebdomadaire atteint - {habit}',
  'analysis.streaks.currentWeeks': 'Semaines de la série en cours',
  'analysis.streaks.weeksWithLogs': 'Semaines avec suivi sur la période',
  'analysis.streaks.none':
    'Aucune série en cours n’a été trouvée (une série d’écriture de {entryMin} jours ou plus, ou une série d’habitude de {habitMin} jours ou semaines ou plus).',

  // Anomalies -----------------------------------------------------------------------------
  'analysis.anomalies.label': 'les jours inhabituels en matière d’humeur ou de stress',
  'analysis.anomalies.textOne':
    'Il semble que le {day}, votre {metricDefined} ait été {gender, select, f {{side, select, high {inhabituellement élevée} other {inhabituellement basse}}} other {{side, select, high {inhabituellement élevé} other {inhabituellement bas}}}} par rapport au reste de la période ({value}, contre une moyenne de {mean}).',
  'analysis.anomalies.textMany':
    'Il semble que, sur {count, plural, one {# jour} other {# jours}}, votre {metricDefined} ait été {gender, select, f {{side, select, high {inhabituellement élevée} other {inhabituellement basse}}} other {{side, select, high {inhabituellement élevé} other {inhabituellement bas}}}} par rapport au reste de la période : {days} ; moyenne de la période : {mean}.',
  'analysis.anomalies.textManyMore':
    'Il semble que, sur {count, plural, one {# jour} other {# jours}}, votre {metricDefined} ait été {gender, select, f {{side, select, high {inhabituellement élevée} other {inhabituellement basse}}} other {{side, select, high {inhabituellement élevé} other {inhabituellement bas}}}} par rapport au reste de la période : {days}, entre autres ; moyenne de la période : {mean}.',
  'analysis.anomalies.dayItem': '{day} ({value})',
  'analysis.anomalies.detail': '{date} : {value} ({z} écarts-types {side, select, above {au-dessus de la moyenne} other {en dessous de la moyenne}})',
  'analysis.anomalies.explain':
    'J’ai examiné {count, plural, one {# jour} other {# jours}} avec une valeur renseignée pour votre {metric}. Moyenne : {mean}, écart-type : {sd}. Un jour est considéré comme inhabituel lorsque sa valeur s’écarte de la moyenne d’au moins {z} écarts-types. {details}. Ampleur de l’écart : {strength}.',
  'analysis.anomalies.title':
    '{count, plural, one {Un jour avec} other {Des jours avec}} {gender, select, f {{side, select, high {une {metric} inhabituellement élevée} other {une {metric} inhabituellement basse}}} other {{side, select, high {un {metric} inhabituellement élevé} other {un {metric} inhabituellement bas}}}}',
  'analysis.anomalies.groupA': 'Jours inhabituels',
  'analysis.anomalies.zValue': '{value} (z {z})',
  'analysis.anomalies.nothing':
    'J’ai recherché des jours inhabituels sur {count, plural, one {# jour} other {# jours}} et je n’ai trouvé aucun jour qui s’écarte de la moyenne d’au moins {z} écarts-types.',

  // Emotion patterns ----------------------------------------------------------------------
  'analysis.emotion.label': 'les tendances des émotions selon les jours, les personnes et les lieux',
  'analysis.emotion.metric': 'L’émotion « {emotion} »',
  'analysis.emotion.groupA': 'Jours avec l’émotion « {emotion} »',
  'analysis.emotion.weekdayTitle': 'L’émotion « {emotion} » apparaît surtout {onWeekday}',
  'analysis.emotion.weekdayText': 'Dans vos données, il semble que l’émotion « {emotion} » soit apparue surtout {onWeekday} ({top} fois sur {total}).',
  'analysis.emotion.weekdayExplain':
    'J’ai examiné {count, plural, one {# jour} other {# jours}}. L’émotion « {emotion} » a été notée sur {total, plural, one {# jour} other {# jours}}, dont {top} correspondant à des {weekdays} ({share}), alors que les {weekdays} représentent {baseline} de l’ensemble des jours examinés. Force de la tendance : {strength}.',
  'analysis.emotion.groupBWeekday': 'Parmi eux, les {weekdays}',
  'analysis.emotion.weekdayShareKey': 'Part des {weekdays} parmi tous les jours',
  'analysis.emotion.personTitle': 'L’émotion « {emotion} » et {name}',
  'analysis.emotion.placeTitle': 'L’émotion « {emotion} » et « {place} »',
  'analysis.emotion.personText':
    'Dans vos données, il semble que l’émotion « {emotion} » soit souvent apparue les jours où vous avez vu {name} ({with} fois sur {total}).',
  'analysis.emotion.placeText':
    'Dans vos données, il semble que l’émotion « {emotion} » soit souvent apparue les jours où le lieu était « {place} » ({with} fois sur {total}).',
  'analysis.emotion.personExplain':
    'J’ai examiné {count, plural, one {# jour} other {# jours}}. L’émotion « {emotion} » a été notée sur {total} jours ; sur {with} d’entre eux ({share}), {name} apparaissait aussi dans l’entrée. {name} apparaît sur {baselineCount} des {count} jours au total ({baseline}). Force de la tendance : {strength}.',
  'analysis.emotion.placeExplain':
    'J’ai examiné {count, plural, one {# jour} other {# jours}}. L’émotion « {emotion} » a été notée sur {total} jours ; sur {with} d’entre eux ({share}), le lieu « {place} » apparaissait aussi dans l’entrée. Le lieu « {place} » apparaît sur {baselineCount} des {count} jours au total ({baseline}). Force de la tendance : {strength}.',
  'analysis.emotion.groupBPerson': 'Parmi eux, avec {name}',
  'analysis.emotion.groupBPlace': 'Parmi eux, à « {place} »',
  'analysis.emotion.personShareKey': 'Part des jours avec {name} parmi tous les jours',
  'analysis.emotion.placeShareKey': 'Part du lieu « {place} » parmi tous les jours',
  'analysis.emotion.nothing':
    'J’ai examiné {count, plural, one {# émotion revenue} other {# émotions revenues}} au moins {min} fois et je n’ai trouvé aucune concentration notable sur certains jours, certaines personnes ou certains lieux.',
};
export default messages;
