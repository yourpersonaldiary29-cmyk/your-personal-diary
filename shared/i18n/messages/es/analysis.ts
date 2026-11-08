/**
 * es - analysis messages (server-side insight templates, notes and labels). English
 * (../en/analysis.ts) is the reference. Keys are prefixed 'analysis.'; see
 * shared/i18n/index.ts for the template syntax.
 *
 * Spanish conventions:
 *  - Sentences are hedged ("Parece que, en tus datos...", "puede haber una relación") and
 *    never causal: no "causa", "provoca", "hace que", "debido a", "por culpa de".
 *  - `gender` (analysis.metric.<metric>.gender) describes the *defined* form:
 *    'm' (el estado de ánimo, el número de horas de sueño...) or 'f' (la calidad del sueño).
 *    sleepHours uses the extra code 'hours': its defined form is masculine ("número de horas
 *    de sueño", handled by the `other` branches) but its short label "horas de sueño" is a
 *    feminine plural, which the label-based titles handle with an `hours {...}` branch.
 *  - Strength words (débil / moderada / fuerte) agree with "fuerza" / "intensidad".
 *  - Branch bodies are never one bare word (see the English file header).
 */
const messages: Record<string, string> = {
  // Engine / provider -----------------------------------------------------------------
  'analysis.engine.providerFailed': 'El análisis de patrones no se ha completado (error interno). Vuelve a intentarlo más tarde.',
  'analysis.engine.detectorFailed': 'La comprobación «{label}» no se ha completado (error interno); las demás observaciones no se ven afectadas.',

  // Strength --------------------------------------------------------------------------
  'analysis.strength.weak': 'débil',
  'analysis.strength.moderate': 'moderada',
  'analysis.strength.strong': 'fuerte',

  // Metrics: label (short, standalone), defined (subject inside a sentence), gender -----
  'analysis.metric.mood.label': 'estado de ánimo',
  'analysis.metric.mood.defined': 'estado de ánimo',
  'analysis.metric.mood.gender': 'm',
  'analysis.metric.energy.label': 'nivel de energía',
  'analysis.metric.energy.defined': 'nivel de energía',
  'analysis.metric.energy.gender': 'm',
  'analysis.metric.stress.label': 'nivel de estrés',
  'analysis.metric.stress.defined': 'nivel de estrés',
  'analysis.metric.stress.gender': 'm',
  'analysis.metric.sleepHours.label': 'horas de sueño',
  'analysis.metric.sleepHours.defined': 'número de horas de sueño',
  'analysis.metric.sleepHours.gender': 'hours',
  'analysis.metric.sleepQuality.label': 'calidad del sueño',
  'analysis.metric.sleepQuality.defined': 'calidad del sueño',
  'analysis.metric.sleepQuality.gender': 'f',
  'analysis.metric.exerciseMinutes.label': 'minutos de ejercicio',
  'analysis.metric.exerciseMinutes.defined': 'número de minutos de ejercicio',
  'analysis.metric.exerciseMinutes.gender': 'm',
  'analysis.metric.entries.label': 'entradas del diario',
  'analysis.metric.entries.defined': 'número de entradas',
  'analysis.metric.entries.gender': 'm',

  // Counts and dates ------------------------------------------------------------------
  'analysis.count.days': '{count, plural, one {# día} other {# días}}',
  'analysis.count.weeks': '{count, plural, one {# semana} other {# semanas}}',
  'analysis.date.dayWithDate': '{weekday}, {date}',

  // Weekdays (index 0 = Sunday) --------------------------------------------------------
  'analysis.weekday.plural.0': 'domingos',
  'analysis.weekday.plural.1': 'lunes',
  'analysis.weekday.plural.2': 'martes',
  'analysis.weekday.plural.3': 'miércoles',
  'analysis.weekday.plural.4': 'jueves',
  'analysis.weekday.plural.5': 'viernes',
  'analysis.weekday.plural.6': 'sábados',
  'analysis.weekday.on.0': 'los domingos',
  'analysis.weekday.on.1': 'los lunes',
  'analysis.weekday.on.2': 'los martes',
  'analysis.weekday.on.3': 'los miércoles',
  'analysis.weekday.on.4': 'los jueves',
  'analysis.weekday.on.5': 'los viernes',
  'analysis.weekday.on.6': 'los sábados',

  // Notes shared by the detectors -------------------------------------------------------
  'analysis.note.insufficient': 'No hay datos suficientes para comprobar {what} (se necesitan al menos {required}; por ahora: {have}).',
  'analysis.note.insufficientWhether': 'No hay datos suficientes para comprobar {what} (se necesitan al menos {required}; por ahora: {have}).',
  'analysis.note.nothingNotable':
    'He comprobado {what} a lo largo de {count, plural, one {# día} other {# días}} y no he encontrado ninguna diferencia destacable.',

  // Requirement / availability phrases used inside the notes above ----------------------
  'analysis.req.daysBothValues': '{count, plural, one {# día con ambos valores} other {# días con ambos valores}}',
  'analysis.req.daysPerGroup': '{count, plural, one {# día en cada grupo} other {# días en cada grupo}}',
  'analysis.req.daysWithReport': '{count, plural, one {# día con registro} other {# días con registro}}',
  'analysis.req.daysWithRatings': '{count, plural, one {# día con valoraciones} other {# días con valoraciones}}',
  'analysis.req.daysPerMonth': '{count, plural, one {# día con registro en cada mes} other {# días con registro en cada mes}}',
  'analysis.req.recentDays':
    '{count, plural, one {# día con registro en las dos últimas semanas} other {# días con registro en las dos últimas semanas}}',
  'analysis.req.fullWeeks': '{count, plural, one {# semana completa con registros} other {# semanas completas con registros}}',
  'analysis.req.weeksOfLogs': '{count, plural, one {# semana de registros} other {# semanas de registros}}',
  'analysis.req.weekPerGroup': 'una semana en cada grupo y {count, plural, one {# día} other {# días}} con registro en cada grupo',
  'analysis.req.moodReports': '{count, plural, one {# registro del estado de ánimo} other {# registros del estado de ánimo}}',
  'analysis.req.reportsInWindow':
    '{count, plural, one {# registro en una misma franja horaria} other {# registros en una misma franja horaria}}',
  'analysis.req.emotionRepeated': 'una emoción registrada en {count, plural, one {# día} other {# días}}',
  'analysis.have.twoGroups': '{groupA}: {countA, plural, one {# día} other {# días}}; {groupB}: {countB, plural, one {# día} other {# días}}',
  'analysis.have.weeksTwoGroups':
    'semanas con el objetivo cumplido: {metWeeks, plural, one {# semana} other {# semanas}} ({metDays, plural, one {# día} other {# días}}); semanas por debajo del objetivo: {belowWeeks, plural, one {# semana} other {# semanas}} ({belowDays, plural, one {# día} other {# días}})',
  'analysis.have.twoMonths': '{countA, plural, one {# día} other {# días}} en {cur} y {countB, plural, one {# día} other {# días}} en {prev}',
  'analysis.have.noData': 'ningún dato',
  'analysis.have.noSuchEmotion': 'ninguna todavía',
  'analysis.have.fewerInEveryWindow': 'menos en todas las franjas horarias',

  // Sentences shared by the group-comparison detectors ----------------------------------
  'analysis.relation.text':
    'Parece que, en tus datos, {condition} tu {metricDefined} {gender, select, f {fue, de media, {direction, select, higher {más alta} other {más baja}}} other {fue, de media, {direction, select, higher {más alto} other {más bajo}}}} ({meanA} frente a {meanB}).',
  'analysis.correlation.text':
    'Parece que en tus datos puede haber una relación entre {xGender, select, f {la {x}} other {el {x}}} y {yGender, select, f {la {y}} other {el {y}}}: cuando tu {x} era {xGender, select, f {más alta} other {más alto}}, tu {y} {yGender, select, f {{direction, select, higher {solía ser más alta} other {solía ser más baja}}} other {{direction, select, higher {solía ser más alto} other {solía ser más bajo}}}} (correlación {r}).',
  'analysis.explain.checkedDays': 'He analizado {count, plural, one {# día} other {# días}}.',
  'analysis.explain.onDaysCondition': '{count, plural, one {En # día} other {En # días}} {conditionPast}.',
  'analysis.explain.groupMeans':
    '{gender, select, other {La media de tu {metricDefined} esos días fue de {meanA}}}, frente a {meanB} el resto de los días.',
  'analysis.explain.correlation': 'Correlación: {r}.',
  'analysis.explain.correlationBetween': 'Correlación ({predictor} frente a {outcome}): {r}.',
  'analysis.explain.diffAndStrength': 'Diferencia entre las medias: {diff} puntos. Fuerza del patrón: {strength}.',
  'analysis.explain.diffStrength': 'Diferencia: {diff} puntos. Fuerza del patrón: {strength}.',
  'analysis.split.corrExplainChecked':
    'He analizado {count, plural, one {# día} other {# días}} en los que se registraron tanto {x} como {y}.',
  'analysis.split.corrExplainPearson': 'Correlación de Pearson: {r} (intensidad: {strength}).',
  'analysis.split.corrExplainGroups':
    'No había días suficientes en cada grupo para comparar las medias ({groupA}: {countA, plural, one {# día} other {# días}}; {groupB}: {countB, plural, one {# día} other {# días}}; se necesitan al menos {min} en cada grupo).',

  // Evidence table keys ---------------------------------------------------------------
  'analysis.extra.predictor': 'Predictor',
  'analysis.extra.strength': 'Fuerza',
  'analysis.extra.meanDiff': 'Diferencia de medias (A menos B)',
  'analysis.extra.cohenD': 'Tamaño del efecto (d de Cohen)',
  'analysis.extra.weeksChecked': 'Semanas analizadas',
  'analysis.extra.weeklyTarget': 'Objetivo semanal',
  'analysis.extra.target': 'Objetivo',
  'analysis.extra.frequency': 'Frecuencia',
  'analysis.extra.periodMean': 'Media del periodo',
  'analysis.extra.overallMean': 'Media general',
  'analysis.extra.stddev': 'Desviación típica',
  'analysis.extra.slopePerDay': 'Pendiente por día',
  'analysis.extra.daysInWindow': 'Días en la ventana',
  'analysis.extra.movingWindow': 'Ventana de la media móvil',
  'analysis.extra.relativeChange': 'Cambio relativo',
  'analysis.extra.longestStreak': 'Racha más larga del periodo',
  'analysis.extra.shareOfEmotionDays': 'Proporción de los días con la emoción',
  'analysis.frequency.daily': 'diaria',
  'analysis.frequency.weekly': 'semanal',
  'analysis.groupB.otherDays': 'Otros días',

  // Sleep detectors -------------------------------------------------------------------
  'analysis.sleep.groupA': 'Días con menos de {hours} horas de sueño',
  'analysis.sleep.groupB': 'Días con {hours} horas de sueño o más',
  'analysis.sleep.condition': 'los días en que dormiste menos de {hours} horas',
  'analysis.sleep.conditionPast': 'dormiste menos de {hours} horas',
  'analysis.sleepMood.label': 'la relación entre el sueño y el estado de ánimo',
  'analysis.sleepMood.title':
    '{direction, select, lower {Dormir poco y un estado de ánimo más bajo} other {Dormir poco y un estado de ánimo más alto}}',
  'analysis.sleepMood.corrTitle': 'Posible relación entre las horas de sueño y el estado de ánimo',
  'analysis.sleepEnergy.label': 'la relación entre el sueño y el nivel de energía',
  'analysis.sleepEnergy.title': '{direction, select, lower {Dormir poco y menos energía} other {Dormir poco y más energía}}',
  'analysis.sleepEnergy.corrTitle': 'Posible relación entre las horas de sueño y el nivel de energía',

  // Exercise detectors ----------------------------------------------------------------
  'analysis.exercise.groupA': 'Días con actividad física',
  'analysis.exercise.groupB': 'Días sin actividad física',
  'analysis.exercise.condition': 'los días en que hiciste ejercicio',
  'analysis.exercise.conditionPast': 'hiciste ejercicio',
  'analysis.exerciseMood.label': 'la relación entre la actividad física y el estado de ánimo',
  'analysis.exerciseMood.title':
    '{direction, select, higher {Actividad física y un estado de ánimo más alto} other {Actividad física y un estado de ánimo más bajo}}',
  'analysis.exerciseMood.corrTitle': 'Posible relación entre los minutos de ejercicio y el estado de ánimo',
  'analysis.exerciseEnergy.label': 'la relación entre la actividad física y el nivel de energía',
  'analysis.exerciseEnergy.title': '{direction, select, higher {Actividad física y más energía} other {Actividad física y menos energía}}',
  'analysis.exerciseEnergy.corrTitle': 'Posible relación entre los minutos de ejercicio y el nivel de energía',

  // Habit - mood / energy / stress ------------------------------------------------------
  'analysis.habit.detectorLabel': 'la relación entre los hábitos y el estado de ánimo',
  'analysis.habit.noHabits': 'No hay hábitos activos, así que no he comprobado si hay relación entre los hábitos y el estado de ánimo.',
  'analysis.habit.noLogs':
    'El hábito «{habit}» todavía no tiene registros en este periodo, así que no he comprobado si hay relación entre él y el estado de ánimo.',
  'analysis.habit.noFullWeeks':
    'El hábito «{habit}» todavía no tiene semanas completas con registros, así que no he comprobado si hay relación entre él y el estado de ánimo.',
  'analysis.habit.label': 'la relación entre el hábito «{habit}» y el {metric}',
  'analysis.habit.groupA': 'Días en los que se completó el hábito «{habit}»',
  'analysis.habit.groupB': 'Días en los que no se completó el hábito «{habit}»',
  'analysis.habit.condition': 'los días en que completaste el hábito «{habit}»',
  'analysis.habit.conditionPast': 'completaste el hábito «{habit}»',
  'analysis.habit.title':
    'El hábito «{habit}» y {gender, select, f {{direction, select, higher {una {metric} más alta} other {una {metric} más baja}}} hours {{direction, select, higher {más {metric}} other {menos {metric}}}} other {{direction, select, higher {un {metric} más alto} other {un {metric} más bajo}}}}',
  'analysis.habit.corrTitle': 'Posible relación entre el hábito «{habit}» y el {metric}',
  'analysis.habit.weeklyCondition': 'las semanas en que cumpliste el objetivo del hábito «{habit}»',
  'analysis.habit.weeklyTarget': '{target} {unit} por semana',
  'analysis.habit.targetValue': '{target} {unit}',
  'analysis.habit.weeklyExplainChecked':
    'He analizado {weeks, plural, one {# semana completa} other {# semanas completas}} ({days, plural, one {# día} other {# días}} con registro de {metric}).',
  'analysis.habit.weeklyExplainMet': '{count, plural, one {En # semana} other {En # semanas}} cumpliste el objetivo del hábito ({target}).',
  'analysis.habit.weeklyExplainMeans':
    '{gender, select, other {La media de tu {metricDefined} en los días de esas semanas fue de {meanA}}}, frente a {meanB} en los días de {count, plural, one {la semana} other {las # semanas}} por debajo del objetivo.',
  'analysis.habit.groupAWeeks': 'Días de semanas con el objetivo cumplido ({count, plural, one {# semana} other {# semanas}})',
  'analysis.habit.groupBWeeks': 'Días de semanas por debajo del objetivo ({count, plural, one {# semana} other {# semanas}})',

  // Weekday differences -----------------------------------------------------------------
  'analysis.weekday.label': 'las diferencias entre los días de la semana',
  'analysis.weekday.text':
    'Parece que, en tus datos, {onWeekday} tu {metricDefined} {gender, select, f {fue, de media, {direction, select, higher {más alta} other {más baja}}} other {fue, de media, {direction, select, higher {más alto} other {más bajo}}}} que el resto de los días de la semana ({meanA} frente a {meanB}).',
  'analysis.weekday.explainChecked':
    'He analizado {count, plural, one {# día} other {# días}} con registro de {metric}; {countA} de ellos, {weekdays}.',
  'analysis.weekday.explainMeans':
    '{gender, select, other {La media de tu {metricDefined} {onWeekday} fue de {meanA}}}, frente a {meanB} el resto de los días.',
  'analysis.weekday.title':
    'Los {weekdays}: {gender, select, f {{direction, select, higher {{metric} más alta} other {{metric} más baja}}} hours {{direction, select, higher {más {metric}} other {menos {metric}}}} other {{direction, select, higher {{metric} más alto} other {{metric} más bajo}}}}',
  'analysis.weekday.groupB': 'Otros días de la semana',
  'analysis.weekday.tableValue': '{mean} ({count, plural, one {# día} other {# días}})',
  'analysis.weekday.nothing':
    'He buscado diferencias entre los días de la semana a lo largo de {count, plural, one {# día} other {# días}} y no he encontrado ninguna diferencia destacable.',

  // Time of day -------------------------------------------------------------------------
  'analysis.timeOfDay.label': 'la relación entre la hora a la que escribes y el estado de ánimo',
  'analysis.timeOfDay.morning.label': 'Mañana',
  'analysis.timeOfDay.morning.phrase': 'por la mañana',
  'analysis.timeOfDay.late_morning.label': 'Media mañana',
  'analysis.timeOfDay.late_morning.phrase': 'a media mañana',
  'analysis.timeOfDay.afternoon.label': 'Tarde',
  'analysis.timeOfDay.afternoon.phrase': 'por la tarde',
  'analysis.timeOfDay.evening.label': 'Final de la tarde',
  'analysis.timeOfDay.evening.phrase': 'al final de la tarde',
  'analysis.timeOfDay.night.label': 'Noche',
  'analysis.timeOfDay.night.phrase': 'por la noche',
  'analysis.timeOfDay.tableKey': '{label} ({hours})',
  'analysis.timeOfDay.tableValue': 'media {mean}, {count, plural, one {# registro} other {# registros}}',
  'analysis.timeOfDay.tableRow': '{key}: {value}',
  'analysis.timeOfDay.nothing':
    'He analizado {label} en {count, plural, one {# registro} other {# registros}} y no he encontrado ninguna franja horaria que destaque por encima de la media.',
  'analysis.timeOfDay.text':
    'Parece que, en tus datos, el estado de ánimo que registraste {phrase} ({hours}) fue el más alto: {mean} de media, frente a {overall} en el conjunto de los registros.',
  'analysis.timeOfDay.explainChecked':
    'He analizado {count, plural, one {# registro del estado de ánimo} other {# registros del estado de ánimo}} de {days, plural, one {# día} other {# días}}, según la hora en que se escribió la entrada.',
  'analysis.timeOfDay.explainTable': '{table}. Media general: {overall}.',
  'analysis.timeOfDay.explainDiff':
    'Diferencia entre la franja horaria más alta y la media general: {diff} puntos. Fuerza del patrón: {strength}.',
  'analysis.timeOfDay.title': 'Estado de ánimo más alto {phrase}',
  'analysis.timeOfDay.groupA': 'Registros {phrase} ({hours})',
  'analysis.timeOfDay.groupB': 'Otros registros',

  // Trends ------------------------------------------------------------------------------
  'analysis.trends.label': 'las tendencias del estado de ánimo, el estrés y el sueño',
  'analysis.trends.text':
    'Parece que, en tus datos, tu {metricDefined} {gender, select, other {muestra una tendencia {direction, select, up {al alza} other {a la baja}}}} {horizon, select, period {a lo largo del periodo} monthly {en el último mes} other {en las dos últimas semanas}}: la línea de tendencia de la media móvil {direction, select, up {subió de} other {bajó de}} {fromValue} a {toValue}.',
  'analysis.trends.explainChecked':
    'He analizado {count, plural, one {# día} other {# días}} con registro de {metric} de los {len} {horizon, select, period {días del periodo} other {días más recientes}} ({from}-{to}).',
  'analysis.trends.explainFit':
    'He calculado una media móvil de {window} días y una línea de tendencia (regresión lineal) sobre ella: {direction, select, up {una pendiente ascendente} other {una pendiente descendente}} de {unit, select, hours {{slope} horas} other {{slope} puntos}} al día, es decir, un cambio de {unit, select, hours {unas {change} horas} other {unos {change} puntos}} a lo largo de la ventana (de {fromValue} a {toValue} según la línea de tendencia). Fuerza de la tendencia: {strength}.',
  'analysis.trends.title':
    '{direction, select, up {Tendencia al alza} other {Tendencia a la baja}} {metric, select, mood {de tu estado de ánimo} energy {de tu nivel de energía} stress {de tu nivel de estrés} sleepHours {de tus horas de sueño} sleepQuality {de la calidad de tu sueño} exerciseMinutes {de tus minutos de ejercicio} other {del número de entradas}} {horizon, select, period {a lo largo del periodo} monthly {en el último mes} other {en las dos últimas semanas}}',
  'analysis.trends.groupA': 'Inicio de la ventana (línea de tendencia)',
  'analysis.trends.groupB': 'Final de la ventana (línea de tendencia)',
  'analysis.trends.slopeValue': '{unit, select, hours {{slope} horas} other {{slope} puntos}}',
  'analysis.trends.nothingSince':
    'He buscado tendencias en el estado de ánimo, el estrés y el sueño desde el {from} y no he encontrado ninguna tendencia destacable.',
  'analysis.trends.nothingAll':
    'He buscado tendencias en el estado de ánimo, el estrés y el sueño en todo el periodo y no he encontrado ninguna tendencia destacable.',

  // Month comparison --------------------------------------------------------------------
  'analysis.periodCompare.label': 'la comparación entre el mes actual y el anterior',
  'analysis.periodCompare.text':
    'Parece que, en tus datos, tu {metricDefined} en {cur} {gender, select, f {fue, de media, {direction, select, higher {más alta} other {más baja}}} other {fue, de media, {direction, select, higher {más alto} other {más bajo}}}} que en {prev} ({meanA} frente a {meanB}).',
  'analysis.periodCompare.explain':
    'He comparado los días con registro de {metric} de {cur} ({countA, plural, one {# día} other {# días}}, hasta hoy) con los días de {prev} ({countB, plural, one {# día} other {# días}}). Media en {cur}: {meanA}; en {prev}: {meanB}. Diferencia: {unit, select, hours {{diff} horas} other {{diff} puntos}}. Intensidad de la diferencia: {strength}.',
  'analysis.periodCompare.title':
    'En {cur}: {gender, select, f {{direction, select, higher {{metric} más alta} other {{metric} más baja}}} hours {{direction, select, higher {más {metric}} other {menos {metric}}}} other {{direction, select, higher {{metric} más alto} other {{metric} más bajo}}}} que en {prev}',
  'analysis.periodCompare.entriesText':
    'Parece que {direction, select, more {escribiste más} other {escribiste menos}} en los primeros {window} días de {cur} ({countA, plural, one {# entrada} other {# entradas}}) que en los primeros {window} días de {prev} ({countB, plural, one {# entrada} other {# entradas}}).',
  'analysis.periodCompare.entriesExplain':
    'He contado las entradas de los primeros {window} días de cada mes, para comparar periodos de la misma duración: {cur}, {countA, plural, one {# entrada} other {# entradas}}; {prev}, {countB, plural, one {# entrada} other {# entradas}}. Diferencia: {diff, plural, one {# entrada} other {# entradas}} ({percent}). Intensidad de la diferencia: {strength}.',
  'analysis.periodCompare.entriesTitle': '{direction, select, more {Más entradas} other {Menos entradas}} en {cur} que en {prev}',
  'analysis.periodCompare.monthWindow': '{month} (primeros {window} días)',
  'analysis.periodCompare.insufficientWhat': 'la comparación entre {cur} y {prev}',
  'analysis.periodCompare.nothing':
    'He comparado {cur} con {prev} y no he encontrado ninguna diferencia destacable en el estado de ánimo, el estrés, el sueño ni el número de entradas.',

  // Habit trend (improved / declined) -----------------------------------------------------
  'analysis.habitsTrend.label': 'los hábitos que han mejorado o empeorado',
  'analysis.habitsTrend.whether': 'si el hábito «{habit}» ha mejorado o empeorado',
  'analysis.habitsTrend.textDaily':
    'Parece que el hábito «{habit}» {direction, select, improved {ha mejorado} other {ha empeorado}}: en las dos últimas semanas lo completaste {recent} de {window} días, frente a {previous} de {window} en las dos semanas anteriores.',
  'analysis.habitsTrend.textWeekly':
    'Parece que el hábito «{habit}» {direction, select, improved {ha mejorado} other {ha empeorado}}: en las dos últimas semanas registraste {recent} {unit}, frente a {previous} en las dos semanas anteriores (objetivo: {target} {unit} por semana).',
  'analysis.habitsTrend.explain':
    'He comparado el porcentaje de cumplimiento del hábito en las dos últimas semanas ({recentFrom}-{recentTo}) con el de las dos semanas anteriores ({previousFrom}-{previousTo}): {recentRate} frente a {previousRate}. Diferencia: {diff} puntos porcentuales. Intensidad del cambio: {strength}.',
  'analysis.habitsTrend.title':
    'El hábito «{habit}» {direction, select, improved {ha mejorado} other {ha empeorado}} en las dos últimas semanas',
  'analysis.habitsTrend.metric': 'Porcentaje de cumplimiento: {habit}',
  'analysis.habitsTrend.groupA': 'Dos últimas semanas',
  'analysis.habitsTrend.groupB': 'Dos semanas anteriores',

  // Best / hardest days ------------------------------------------------------------------
  'analysis.bestWorst.label': 'los mejores días y los más difíciles',
  'analysis.bestWorst.describedDay': '{day} («{title}»)',
  'analysis.bestWorst.noTitle': 'Sin título',
  'analysis.bestWorst.extraValue': '{titles}: puntuación {score}',
  'analysis.bestWorst.text':
    '{kind, select, best {Los mejores días} other {Los días más difíciles}} del periodo, según una puntuación combinada de estado de ánimo, energía y estrés: {days}.',
  'analysis.bestWorst.explainScore':
    '{count, plural, one {Para el único día analizado} other {Para cada uno de los # días}} he calculado una puntuación combinada: la media del estado de ánimo, el nivel de energía y (11 menos el nivel de estrés), a partir de los valores registrados ese día.',
  'analysis.bestWorst.explainMeans':
    'La puntuación media del periodo: {overall}. {kind, select, best {{count, plural, one {El mejor día obtuvo} =3 {Los tres mejores días obtuvieron} other {Los mejores días obtuvieron}}} other {{count, plural, one {El día más difícil obtuvo} =3 {Los tres días más difíciles obtuvieron} other {Los días más difíciles obtuvieron}}}} una media de {mean}.',
  'analysis.bestWorst.explainDiff': 'Diferencia respecto a la media: {diff} puntos. Intensidad de la diferencia: {strength}.',
  'analysis.bestWorst.title': '{kind, select, best {Los mejores días del periodo} other {Los días más difíciles del periodo}}',
  'analysis.bestWorst.metric': 'Puntuación combinada (estado de ánimo + energía + estrés invertido)',
  'analysis.bestWorst.groupA': '{kind, select, best {Los mejores días} other {Los días más difíciles}}',
  'analysis.bestWorst.nothing':
    'He analizado {label} a lo largo de {count, plural, one {# día} other {# días}}; las puntuaciones fueron parecidas y ningún día destacó en particular.',

  // Streaks -------------------------------------------------------------------------------
  'analysis.streaks.label': 'las rachas de escritura y de hábitos',
  'analysis.streaks.entriesTitle': 'Racha de escritura de {count, plural, one {# día} other {# días}}',
  'analysis.streaks.entriesText':
    '¡Muy bien! Has escrito en tu diario {count, plural, one {# día seguido} other {# días seguidos}} ({from}-{to}).',
  'analysis.streaks.entriesExplain':
    'He contado los días consecutivos con al menos una entrada, hasta hoy o ayer. Racha actual: {count, plural, one {# día} other {# días}}, del {from} al {to}. Racha más larga del periodo: {best, plural, one {# día} other {# días}}.',
  'analysis.streaks.entriesMetric': 'Días con escritura',
  'analysis.streaks.currentDays': 'Días de la racha actual',
  'analysis.streaks.daysWithEntry': 'Días con alguna entrada en el periodo',
  'analysis.streaks.habitTitle': 'Racha de {count, plural, one {# día} other {# días}} del hábito «{habit}»',
  'analysis.streaks.habitText':
    'Has completado el hábito «{habit}» {count, plural, one {# día seguido} other {# días seguidos}} ({from}-{to}).',
  'analysis.streaks.habitExplain':
    'He contado los días consecutivos en los que el hábito «{habit}» se marcó como completado, hasta hoy o ayer. Racha actual: {count, plural, one {# día} other {# días}}. Racha más larga del periodo: {best, plural, one {# día} other {# días}}.',
  'analysis.streaks.habitMetric': 'Cumplimiento del hábito {habit}',
  'analysis.streaks.daysCompleted': 'Días en los que se completó el hábito en el periodo',
  'analysis.streaks.weeklyTitle': 'Racha de {count, plural, one {# semana} other {# semanas}} del hábito «{habit}»',
  'analysis.streaks.weeklyText':
    'Has cumplido el objetivo del hábito «{habit}» {count, plural, one {# semana seguida} other {# semanas seguidas}} ({from}-{to}).',
  'analysis.streaks.weeklyExplain':
    'He sumado la cantidad registrada del hábito «{habit}» en cada semana y la he comparado con el objetivo semanal ({target}). Racha actual de semanas con el objetivo cumplido: {count, plural, one {# semana} other {# semanas}}.',
  'analysis.streaks.weeklyMetric': 'Objetivo semanal cumplido: {habit}',
  'analysis.streaks.currentWeeks': 'Semanas de la racha actual',
  'analysis.streaks.weeksWithLogs': 'Semanas con registros en el periodo',
  'analysis.streaks.none':
    'No se han encontrado rachas activas (una racha de escritura de {entryMin} días o más, o una racha de un hábito de {habitMin} días o semanas o más).',

  // Anomalies -----------------------------------------------------------------------------
  'analysis.anomalies.label': 'los días inusuales en el estado de ánimo o el estrés',
  'analysis.anomalies.textOne':
    'Parece que el {day}, tu {metricDefined} {gender, select, f {fue {side, select, high {inusualmente alta} other {inusualmente baja}}} other {fue {side, select, high {inusualmente alto} other {inusualmente bajo}}}} en comparación con el resto del periodo ({value}, frente a una media de {mean}).',
  'analysis.anomalies.textMany':
    'Parece que en {count, plural, one {# día} other {# días}} tu {metricDefined} {gender, select, f {fue {side, select, high {inusualmente alta} other {inusualmente baja}}} other {fue {side, select, high {inusualmente alto} other {inusualmente bajo}}}} en comparación con el resto del periodo: {days}; la media del periodo: {mean}.',
  'analysis.anomalies.textManyMore':
    'Parece que en {count, plural, one {# día} other {# días}} tu {metricDefined} {gender, select, f {fue {side, select, high {inusualmente alta} other {inusualmente baja}}} other {fue {side, select, high {inusualmente alto} other {inusualmente bajo}}}} en comparación con el resto del periodo: {days} y otros más; la media del periodo: {mean}.',
  'analysis.anomalies.dayItem': '{day} ({value})',
  'analysis.anomalies.detail':
    '{date}: {value} ({z} desviaciones típicas {side, select, above {por encima de la media} other {por debajo de la media}})',
  'analysis.anomalies.explain':
    'He analizado {count, plural, one {# día} other {# días}} con registro de {metric}. Media: {mean}; desviación típica: {sd}. Un día se considera inusual cuando su valor se aleja de la media {z} desviaciones típicas o más. {details}. Intensidad de la desviación: {strength}.',
  'analysis.anomalies.title':
    '{count, plural, one {Un día con} other {Días con}} {gender, select, f {{side, select, high {{metric} inusualmente alta} other {{metric} inusualmente baja}}} hours {{side, select, high {{metric} inusualmente altas} other {{metric} inusualmente bajas}}} other {{side, select, high {{metric} inusualmente alto} other {{metric} inusualmente bajo}}}}',
  'analysis.anomalies.groupA': 'Días inusuales',
  'analysis.anomalies.zValue': '{value} (z {z})',
  'analysis.anomalies.nothing':
    'He buscado días inusuales a lo largo de {count, plural, one {# día} other {# días}} y no he encontrado ninguno que se aleje de la media {z} desviaciones típicas o más.',

  // Emotion patterns ----------------------------------------------------------------------
  'analysis.emotion.label': 'los patrones de emociones según los días, las personas y los lugares',
  'analysis.emotion.metric': 'La emoción {emotion}',
  'analysis.emotion.groupA': 'Días con la emoción «{emotion}»',
  'analysis.emotion.weekdayTitle': 'La emoción «{emotion}» aparece sobre todo {onWeekday}',
  'analysis.emotion.weekdayText':
    'Parece que, en tus datos, la emoción «{emotion}» apareció sobre todo {onWeekday} ({top} de {total} veces).',
  'analysis.emotion.weekdayExplain':
    'He analizado {count, plural, one {# día} other {# días}}. La emoción «{emotion}» se registró en {total, plural, one {# día} other {# días}}; {top} de ellos fueron {weekdays} ({share}), mientras que los {weekdays} suponen el {baseline} de todos los días analizados. Fuerza del patrón: {strength}.',
  'analysis.emotion.groupBWeekday': 'De ellos, {weekdays}',
  'analysis.emotion.weekdayShareKey': 'Proporción de {weekdays} entre todos los días',
  'analysis.emotion.personTitle': 'La emoción «{emotion}» y {name}',
  'analysis.emotion.placeTitle': 'La emoción «{emotion}» y «{place}»',
  'analysis.emotion.personText':
    'Parece que, en tus datos, la emoción «{emotion}» apareció a menudo los días en que viste a {name} ({with} de {total} veces).',
  'analysis.emotion.placeText':
    'Parece que, en tus datos, la emoción «{emotion}» apareció a menudo los días en que el lugar fue «{place}» ({with} de {total} veces).',
  'analysis.emotion.personExplain':
    'He analizado {count, plural, one {# día} other {# días}}. La emoción «{emotion}» se registró en {total} días; en {with} de ellos ({share}) {name} también aparecía en la entrada. {name} aparece en {baselineCount} de los {count} días en total ({baseline}). Fuerza del patrón: {strength}.',
  'analysis.emotion.placeExplain':
    'He analizado {count, plural, one {# día} other {# días}}. La emoción «{emotion}» se registró en {total} días; en {with} de ellos ({share}) el lugar «{place}» también aparecía en la entrada. El lugar «{place}» aparece en {baselineCount} de los {count} días en total ({baseline}). Fuerza del patrón: {strength}.',
  'analysis.emotion.groupBPerson': 'De ellos, con {name}',
  'analysis.emotion.groupBPlace': 'De ellos, en «{place}»',
  'analysis.emotion.personShareKey': 'Proporción de {name} entre todos los días',
  'analysis.emotion.placeShareKey': 'Proporción del lugar «{place}» entre todos los días',
  'analysis.emotion.nothing':
    'He analizado {count, plural, one {# emoción} other {# emociones}} que se repitieron al menos {min} veces y no he encontrado ninguna concentración destacable en días, personas o lugares concretos.',
};
export default messages;
