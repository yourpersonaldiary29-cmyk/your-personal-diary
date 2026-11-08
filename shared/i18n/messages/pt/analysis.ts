/**
 * pt - analysis messages (server-side insight templates, notes and labels). English
 * (../en/analysis.ts) is the reference. Keys are prefixed 'analysis.'; see
 * shared/i18n/index.ts for the template syntax.
 *
 * Portuguese (pt-PT) conventions:
 *  - Sentences are hedged ("Parece que, nos seus dados...", "pode existir uma relação") and
 *    never causal: no "causa", "provoca", "faz com que", "leva a", "devido a".
 *  - `gender` (analysis.metric.<metric>.gender) describes the *defined* form and picks
 *    "o seu" / "a sua" and the adjective endings: 'm' (o humor, o número de horas de sono...)
 *    or 'f' (a qualidade do sono). sleepHours uses the extra code 'hours': its defined form is
 *    masculine ("número de horas de sono", handled by the `other` branches) but its short label
 *    "horas de sono" is a feminine plural, which the label-based titles handle with `hours {...}`.
 *  - Strength words (fraca / moderada / forte) agree with "força" / "intensidade".
 *  - Branch bodies are never one bare word (see the English file header).
 */
const messages: Record<string, string> = {
  // Engine / provider -----------------------------------------------------------------
  'analysis.engine.providerFailed': 'A análise de padrões não foi concluída (erro interno). Tente novamente mais tarde.',
  'analysis.engine.detectorFailed': 'A verificação «{label}» não foi concluída (erro interno); as restantes observações não foram afetadas.',

  // Strength --------------------------------------------------------------------------
  'analysis.strength.weak': 'fraca',
  'analysis.strength.moderate': 'moderada',
  'analysis.strength.strong': 'forte',

  // Metrics: label (short, standalone), defined (subject inside a sentence), gender -----
  'analysis.metric.mood.label': 'humor',
  'analysis.metric.mood.defined': 'humor',
  'analysis.metric.mood.gender': 'm',
  'analysis.metric.energy.label': 'nível de energia',
  'analysis.metric.energy.defined': 'nível de energia',
  'analysis.metric.energy.gender': 'm',
  'analysis.metric.stress.label': 'nível de stress',
  'analysis.metric.stress.defined': 'nível de stress',
  'analysis.metric.stress.gender': 'm',
  'analysis.metric.sleepHours.label': 'horas de sono',
  'analysis.metric.sleepHours.defined': 'número de horas de sono',
  'analysis.metric.sleepHours.gender': 'hours',
  'analysis.metric.sleepQuality.label': 'qualidade do sono',
  'analysis.metric.sleepQuality.defined': 'qualidade do sono',
  'analysis.metric.sleepQuality.gender': 'f',
  'analysis.metric.exerciseMinutes.label': 'minutos de exercício',
  'analysis.metric.exerciseMinutes.defined': 'número de minutos de exercício',
  'analysis.metric.exerciseMinutes.gender': 'm',
  'analysis.metric.entries.label': 'entradas do diário',
  'analysis.metric.entries.defined': 'número de entradas',
  'analysis.metric.entries.gender': 'm',

  // Counts and dates ------------------------------------------------------------------
  'analysis.count.days': '{count, plural, one {# dia} other {# dias}}',
  'analysis.count.weeks': '{count, plural, one {# semana} other {# semanas}}',
  'analysis.date.dayWithDate': '{weekday}, {date}',

  // Weekdays (index 0 = Sunday) --------------------------------------------------------
  'analysis.weekday.plural.0': 'domingos',
  'analysis.weekday.plural.1': 'segundas-feiras',
  'analysis.weekday.plural.2': 'terças-feiras',
  'analysis.weekday.plural.3': 'quartas-feiras',
  'analysis.weekday.plural.4': 'quintas-feiras',
  'analysis.weekday.plural.5': 'sextas-feiras',
  'analysis.weekday.plural.6': 'sábados',
  'analysis.weekday.on.0': 'aos domingos',
  'analysis.weekday.on.1': 'às segundas-feiras',
  'analysis.weekday.on.2': 'às terças-feiras',
  'analysis.weekday.on.3': 'às quartas-feiras',
  'analysis.weekday.on.4': 'às quintas-feiras',
  'analysis.weekday.on.5': 'às sextas-feiras',
  'analysis.weekday.on.6': 'aos sábados',

  // Notes shared by the detectors -------------------------------------------------------
  'analysis.note.insufficient': 'Não há dados suficientes para verificar {what} (são necessários pelo menos {required}; de momento: {have}).',
  'analysis.note.insufficientWhether':
    'Não há dados suficientes para verificar {what} (são necessários pelo menos {required}; de momento: {have}).',
  'analysis.note.nothingNotable':
    'Verifiquei {what} ao longo de {count, plural, one {# dia} other {# dias}} e não encontrei nenhuma diferença digna de nota.',

  // Requirement / availability phrases used inside the notes above ----------------------
  'analysis.req.daysBothValues': '{count, plural, one {# dia com ambos os valores} other {# dias com ambos os valores}}',
  'analysis.req.daysPerGroup': '{count, plural, one {# dia em cada grupo} other {# dias em cada grupo}}',
  'analysis.req.daysWithReport': '{count, plural, one {# dia com registo} other {# dias com registo}}',
  'analysis.req.daysWithRatings': '{count, plural, one {# dia com classificações} other {# dias com classificações}}',
  'analysis.req.daysPerMonth': '{count, plural, one {# dia com registo em cada mês} other {# dias com registo em cada mês}}',
  'analysis.req.recentDays':
    '{count, plural, one {# dia com registo nas últimas duas semanas} other {# dias com registo nas últimas duas semanas}}',
  'analysis.req.fullWeeks': '{count, plural, one {# semana completa com registos} other {# semanas completas com registos}}',
  'analysis.req.weeksOfLogs': '{count, plural, one {# semana de registos} other {# semanas de registos}}',
  'analysis.req.weekPerGroup': 'uma semana em cada grupo e {count, plural, one {# dia} other {# dias}} com registo em cada grupo',
  'analysis.req.moodReports': '{count, plural, one {# registo de humor} other {# registos de humor}}',
  'analysis.req.reportsInWindow':
    '{count, plural, one {# registo num mesmo intervalo horário} other {# registos num mesmo intervalo horário}}',
  'analysis.req.emotionRepeated': 'uma emoção registada em {count, plural, one {# dia} other {# dias}}',
  'analysis.have.twoGroups': '{groupA}: {countA, plural, one {# dia} other {# dias}}; {groupB}: {countB, plural, one {# dia} other {# dias}}',
  'analysis.have.weeksTwoGroups':
    'semanas com o objetivo cumprido: {metWeeks, plural, one {# semana} other {# semanas}} ({metDays, plural, one {# dia} other {# dias}}); semanas abaixo do objetivo: {belowWeeks, plural, one {# semana} other {# semanas}} ({belowDays, plural, one {# dia} other {# dias}})',
  'analysis.have.twoMonths': '{countA, plural, one {# dia} other {# dias}} em {cur} e {countB, plural, one {# dia} other {# dias}} em {prev}',
  'analysis.have.noData': 'nenhum dado',
  'analysis.have.noSuchEmotion': 'nenhuma ainda',
  'analysis.have.fewerInEveryWindow': 'menos em todos os intervalos horários',

  // Sentences shared by the group-comparison detectors ----------------------------------
  'analysis.relation.text':
    'Parece que, nos seus dados, {condition} {gender, select, f {a sua {metricDefined} foi, em média, {direction, select, higher {mais alta} other {mais baixa}}} other {o seu {metricDefined} foi, em média, {direction, select, higher {mais alto} other {mais baixo}}}} ({meanA} face a {meanB}).',
  'analysis.correlation.text':
    'Parece que, nos seus dados, pode existir uma relação entre {xGender, select, f {a {x}} other {o {x}}} e {yGender, select, f {a {y}} other {o {y}}}: quando {xGender, select, f {a sua {x} era mais alta} other {o seu {x} era mais alto}}, {yGender, select, f {a sua {y} {direction, select, higher {tendia a ser mais alta} other {tendia a ser mais baixa}}} other {o seu {y} {direction, select, higher {tendia a ser mais alto} other {tendia a ser mais baixo}}}} (correlação {r}).',
  'analysis.explain.checkedDays': 'Analisei {count, plural, one {# dia} other {# dias}}.',
  'analysis.explain.onDaysCondition': '{count, plural, one {Em # dia} other {Em # dias}} {conditionPast}.',
  'analysis.explain.groupMeans':
    '{gender, select, f {A média da sua {metricDefined} nesses dias foi de {meanA}} other {A média do seu {metricDefined} nesses dias foi de {meanA}}}, face a {meanB} nos restantes dias.',
  'analysis.explain.correlation': 'Correlação: {r}.',
  'analysis.explain.correlationBetween': 'Correlação ({predictor} face a {outcome}): {r}.',
  'analysis.explain.diffAndStrength': 'Diferença entre as médias: {diff} pontos. Força do padrão: {strength}.',
  'analysis.explain.diffStrength': 'Diferença: {diff} pontos. Força do padrão: {strength}.',
  'analysis.split.corrExplainChecked':
    'Analisei {count, plural, one {# dia} other {# dias}} em que foram registados tanto {x} como {y}.',
  'analysis.split.corrExplainPearson': 'Correlação de Pearson: {r} (intensidade: {strength}).',
  'analysis.split.corrExplainGroups':
    'Não havia dias suficientes em cada grupo para comparar as médias ({groupA}: {countA, plural, one {# dia} other {# dias}}; {groupB}: {countB, plural, one {# dia} other {# dias}}; são necessários pelo menos {min} em cada grupo).',

  // Evidence table keys ---------------------------------------------------------------
  'analysis.extra.predictor': 'Preditor',
  'analysis.extra.strength': 'Força',
  'analysis.extra.meanDiff': 'Diferença de médias (A menos B)',
  'analysis.extra.cohenD': 'Tamanho do efeito (d de Cohen)',
  'analysis.extra.weeksChecked': 'Semanas analisadas',
  'analysis.extra.weeklyTarget': 'Objetivo semanal',
  'analysis.extra.target': 'Objetivo',
  'analysis.extra.frequency': 'Frequência',
  'analysis.extra.periodMean': 'Média do período',
  'analysis.extra.overallMean': 'Média global',
  'analysis.extra.stddev': 'Desvio-padrão',
  'analysis.extra.slopePerDay': 'Declive por dia',
  'analysis.extra.daysInWindow': 'Dias na janela',
  'analysis.extra.movingWindow': 'Janela da média móvel',
  'analysis.extra.relativeChange': 'Variação relativa',
  'analysis.extra.longestStreak': 'Sequência mais longa do período',
  'analysis.extra.shareOfEmotionDays': 'Proporção dos dias com a emoção',
  'analysis.frequency.daily': 'diária',
  'analysis.frequency.weekly': 'semanal',
  'analysis.groupB.otherDays': 'Outros dias',

  // Sleep detectors -------------------------------------------------------------------
  'analysis.sleep.groupA': 'Dias com menos de {hours} horas de sono',
  'analysis.sleep.groupB': 'Dias com {hours} horas de sono ou mais',
  'analysis.sleep.condition': 'nos dias em que dormiu menos de {hours} horas',
  'analysis.sleep.conditionPast': 'dormiu menos de {hours} horas',
  'analysis.sleepMood.label': 'a relação entre o sono e o humor',
  'analysis.sleepMood.title': '{direction, select, lower {Dormir pouco e um humor mais baixo} other {Dormir pouco e um humor mais alto}}',
  'analysis.sleepMood.corrTitle': 'Possível relação entre as horas de sono e o humor',
  'analysis.sleepEnergy.label': 'a relação entre o sono e o nível de energia',
  'analysis.sleepEnergy.title': '{direction, select, lower {Dormir pouco e menos energia} other {Dormir pouco e mais energia}}',
  'analysis.sleepEnergy.corrTitle': 'Possível relação entre as horas de sono e o nível de energia',

  // Exercise detectors ----------------------------------------------------------------
  'analysis.exercise.groupA': 'Dias com atividade física',
  'analysis.exercise.groupB': 'Dias sem atividade física',
  'analysis.exercise.condition': 'nos dias em que fez exercício',
  'analysis.exercise.conditionPast': 'fez exercício',
  'analysis.exerciseMood.label': 'a relação entre a atividade física e o humor',
  'analysis.exerciseMood.title':
    '{direction, select, higher {Atividade física e um humor mais alto} other {Atividade física e um humor mais baixo}}',
  'analysis.exerciseMood.corrTitle': 'Possível relação entre os minutos de exercício e o humor',
  'analysis.exerciseEnergy.label': 'a relação entre a atividade física e o nível de energia',
  'analysis.exerciseEnergy.title': '{direction, select, higher {Atividade física e mais energia} other {Atividade física e menos energia}}',
  'analysis.exerciseEnergy.corrTitle': 'Possível relação entre os minutos de exercício e o nível de energia',

  // Habit - mood / energy / stress ------------------------------------------------------
  'analysis.habit.detectorLabel': 'a relação entre os hábitos e o humor',
  'analysis.habit.noHabits': 'Não há hábitos ativos, pelo que não verifiquei se existe relação entre os hábitos e o humor.',
  'analysis.habit.noLogs':
    'O hábito «{habit}» ainda não tem registos neste período, pelo que não verifiquei se existe relação entre ele e o humor.',
  'analysis.habit.noFullWeeks':
    'O hábito «{habit}» ainda não tem semanas completas com registos, pelo que não verifiquei se existe relação entre ele e o humor.',
  'analysis.habit.label': 'a relação entre o hábito «{habit}» e o {metric}',
  'analysis.habit.groupA': 'Dias em que o hábito «{habit}» foi concluído',
  'analysis.habit.groupB': 'Dias em que o hábito «{habit}» não foi concluído',
  'analysis.habit.condition': 'nos dias em que concluiu o hábito «{habit}»',
  'analysis.habit.conditionPast': 'concluiu o hábito «{habit}»',
  'analysis.habit.title':
    'O hábito «{habit}» e {gender, select, f {{direction, select, higher {uma {metric} mais alta} other {uma {metric} mais baixa}}} hours {{direction, select, higher {mais {metric}} other {menos {metric}}}} other {{direction, select, higher {um {metric} mais alto} other {um {metric} mais baixo}}}}',
  'analysis.habit.corrTitle': 'Possível relação entre o hábito «{habit}» e o {metric}',
  'analysis.habit.weeklyCondition': 'nas semanas em que cumpriu o objetivo do hábito «{habit}»',
  'analysis.habit.weeklyTarget': '{target} {unit} por semana',
  'analysis.habit.targetValue': '{target} {unit}',
  'analysis.habit.weeklyExplainChecked':
    'Analisei {weeks, plural, one {# semana completa} other {# semanas completas}} ({days, plural, one {# dia} other {# dias}} com registo de {metric}).',
  'analysis.habit.weeklyExplainMet': '{count, plural, one {Em # semana} other {Em # semanas}} cumpriu o objetivo do hábito ({target}).',
  'analysis.habit.weeklyExplainMeans':
    '{gender, select, f {A média da sua {metricDefined} nos dias dessas semanas foi de {meanA}} other {A média do seu {metricDefined} nos dias dessas semanas foi de {meanA}}}, face a {meanB} nos dias {count, plural, one {da semana} other {das # semanas}} abaixo do objetivo.',
  'analysis.habit.groupAWeeks': 'Dias de semanas com o objetivo cumprido ({count, plural, one {# semana} other {# semanas}})',
  'analysis.habit.groupBWeeks': 'Dias de semanas abaixo do objetivo ({count, plural, one {# semana} other {# semanas}})',

  // Weekday differences -----------------------------------------------------------------
  'analysis.weekday.label': 'as diferenças entre os dias da semana',
  'analysis.weekday.text':
    'Parece que, nos seus dados, {onWeekday} {gender, select, f {a sua {metricDefined} foi, em média, {direction, select, higher {mais alta} other {mais baixa}}} other {o seu {metricDefined} foi, em média, {direction, select, higher {mais alto} other {mais baixo}}}} do que nos outros dias da semana ({meanA} face a {meanB}).',
  'analysis.weekday.explainChecked':
    'Analisei {count, plural, one {# dia} other {# dias}} com registo de {metric}; {countA} deles foram {weekdays}.',
  'analysis.weekday.explainMeans':
    '{gender, select, f {A média da sua {metricDefined} {onWeekday} foi de {meanA}} other {A média do seu {metricDefined} {onWeekday} foi de {meanA}}}, face a {meanB} nos outros dias.',
  'analysis.weekday.title':
    'Padrão semanal ({weekdays}): {gender, select, f {{direction, select, higher {{metric} mais alta} other {{metric} mais baixa}}} hours {{direction, select, higher {mais {metric}} other {menos {metric}}}} other {{direction, select, higher {{metric} mais alto} other {{metric} mais baixo}}}}',
  'analysis.weekday.groupB': 'Outros dias da semana',
  'analysis.weekday.tableValue': '{mean} ({count, plural, one {# dia} other {# dias}})',
  'analysis.weekday.nothing':
    'Procurei diferenças entre os dias da semana ao longo de {count, plural, one {# dia} other {# dias}} e não encontrei nenhuma diferença digna de nota.',

  // Time of day -------------------------------------------------------------------------
  'analysis.timeOfDay.label': 'a relação entre a hora a que escreve e o humor',
  'analysis.timeOfDay.morning.label': 'Manhã',
  'analysis.timeOfDay.morning.phrase': 'de manhã',
  'analysis.timeOfDay.late_morning.label': 'Final da manhã',
  'analysis.timeOfDay.late_morning.phrase': 'ao final da manhã',
  'analysis.timeOfDay.afternoon.label': 'Tarde',
  'analysis.timeOfDay.afternoon.phrase': 'à tarde',
  'analysis.timeOfDay.evening.label': 'Fim de tarde',
  'analysis.timeOfDay.evening.phrase': 'ao fim da tarde',
  'analysis.timeOfDay.night.label': 'Noite',
  'analysis.timeOfDay.night.phrase': 'à noite',
  'analysis.timeOfDay.tableKey': '{label} ({hours})',
  'analysis.timeOfDay.tableValue': 'média {mean}, {count, plural, one {# registo} other {# registos}}',
  'analysis.timeOfDay.tableRow': '{key}: {value}',
  'analysis.timeOfDay.nothing':
    'Analisei {label} em {count, plural, one {# registo} other {# registos}} e não encontrei nenhum intervalo horário que se destaque acima da média.',
  'analysis.timeOfDay.text':
    'Parece que, nos seus dados, o humor que registou {phrase} ({hours}) foi o mais alto: {mean} em média, face a {overall} no conjunto dos registos.',
  'analysis.timeOfDay.explainChecked':
    'Analisei {count, plural, one {# registo de humor} other {# registos de humor}} de {days, plural, one {# dia} other {# dias}}, de acordo com a hora a que a entrada foi escrita.',
  'analysis.timeOfDay.explainTable': '{table}. Média global: {overall}.',
  'analysis.timeOfDay.explainDiff':
    'Diferença entre o intervalo horário mais alto e a média global: {diff} pontos. Força do padrão: {strength}.',
  'analysis.timeOfDay.title': 'Humor mais alto {phrase}',
  'analysis.timeOfDay.groupA': 'Registos {phrase} ({hours})',
  'analysis.timeOfDay.groupB': 'Outros registos',

  // Trends ------------------------------------------------------------------------------
  'analysis.trends.label': 'as tendências do humor, do stress e do sono',
  'analysis.trends.text':
    'Parece que, nos seus dados, {gender, select, f {a sua {metricDefined} está numa tendência {direction, select, up {de subida} other {de descida}}} other {o seu {metricDefined} está numa tendência {direction, select, up {de subida} other {de descida}}}} {horizon, select, period {ao longo do período} monthly {no último mês} other {nas últimas duas semanas}}: a linha de tendência da média móvel {direction, select, up {subiu de} other {desceu de}} {fromValue} para {toValue}.',
  'analysis.trends.explainChecked':
    'Analisei {count, plural, one {# dia} other {# dias}} com registo de {metric} dos {len} {horizon, select, period {dias do período} other {dias mais recentes}} ({from}-{to}).',
  'analysis.trends.explainFit':
    'Calculei uma média móvel de {window} dias e uma linha de tendência (regressão linear) sobre ela: {direction, select, up {um declive ascendente} other {um declive descendente}} de {unit, select, hours {{slope} horas} other {{slope} pontos}} por dia, ou seja, uma variação de cerca de {unit, select, hours {{change} horas} other {{change} pontos}} ao longo da janela (de {fromValue} para {toValue} segundo a linha de tendência). Força da tendência: {strength}.',
  'analysis.trends.title':
    '{direction, select, up {Tendência de subida} other {Tendência de descida}} {metric, select, mood {do seu humor} energy {do seu nível de energia} stress {do seu nível de stress} sleepHours {das suas horas de sono} sleepQuality {da qualidade do seu sono} exerciseMinutes {dos seus minutos de exercício} other {do número de entradas}} {horizon, select, period {ao longo do período} monthly {no último mês} other {nas últimas duas semanas}}',
  'analysis.trends.groupA': 'Início da janela (linha de tendência)',
  'analysis.trends.groupB': 'Fim da janela (linha de tendência)',
  'analysis.trends.slopeValue': '{unit, select, hours {{slope} horas} other {{slope} pontos}}',
  'analysis.trends.nothingSince':
    'Procurei tendências no humor, no stress e no sono desde {from} e não encontrei nenhuma tendência digna de nota.',
  'analysis.trends.nothingAll':
    'Procurei tendências no humor, no stress e no sono em todo o período e não encontrei nenhuma tendência digna de nota.',

  // Month comparison --------------------------------------------------------------------
  'analysis.periodCompare.label': 'a comparação entre o mês atual e o mês anterior',
  'analysis.periodCompare.text':
    'Parece que, nos seus dados, {gender, select, f {a sua {metricDefined} em {cur} foi, em média, {direction, select, higher {mais alta} other {mais baixa}}} other {o seu {metricDefined} em {cur} foi, em média, {direction, select, higher {mais alto} other {mais baixo}}}} do que em {prev} ({meanA} face a {meanB}).',
  'analysis.periodCompare.explain':
    'Comparei os dias com registo de {metric} em {cur} ({countA, plural, one {# dia} other {# dias}}, até hoje) com os dias de {prev} ({countB, plural, one {# dia} other {# dias}}). Média em {cur}: {meanA}; em {prev}: {meanB}. Diferença: {unit, select, hours {{diff} horas} other {{diff} pontos}}. Intensidade da diferença: {strength}.',
  'analysis.periodCompare.title':
    'Em {cur}: {gender, select, f {{direction, select, higher {{metric} mais alta} other {{metric} mais baixa}}} hours {{direction, select, higher {mais {metric}} other {menos {metric}}}} other {{direction, select, higher {{metric} mais alto} other {{metric} mais baixo}}}} do que em {prev}',
  'analysis.periodCompare.entriesText':
    'Parece que {direction, select, more {escreveu mais} other {escreveu menos}} nos primeiros {window} dias de {cur} ({countA, plural, one {# entrada} other {# entradas}}) do que nos primeiros {window} dias de {prev} ({countB, plural, one {# entrada} other {# entradas}}).',
  'analysis.periodCompare.entriesExplain':
    'Contei as entradas dos primeiros {window} dias de cada mês, para comparar períodos com a mesma duração: {cur}, {countA, plural, one {# entrada} other {# entradas}}; {prev}, {countB, plural, one {# entrada} other {# entradas}}. Diferença: {diff, plural, one {# entrada} other {# entradas}} ({percent}). Intensidade da diferença: {strength}.',
  'analysis.periodCompare.entriesTitle': '{direction, select, more {Mais entradas} other {Menos entradas}} em {cur} do que em {prev}',
  'analysis.periodCompare.monthWindow': '{month} (primeiros {window} dias)',
  'analysis.periodCompare.insufficientWhat': 'a comparação entre {cur} e {prev}',
  'analysis.periodCompare.nothing':
    'Comparei {cur} com {prev} e não encontrei nenhuma diferença digna de nota no humor, no stress, no sono nem no número de entradas.',

  // Habit trend (improved / declined) -----------------------------------------------------
  'analysis.habitsTrend.label': 'os hábitos que melhoraram ou pioraram',
  'analysis.habitsTrend.whether': 'se o hábito «{habit}» melhorou ou piorou',
  'analysis.habitsTrend.textDaily':
    'Parece que o hábito «{habit}» {direction, select, improved {tem melhorado} other {tem piorado}}: nas últimas duas semanas concluiu-o em {recent} de {window} dias, face a {previous} de {window} nas duas semanas anteriores.',
  'analysis.habitsTrend.textWeekly':
    'Parece que o hábito «{habit}» {direction, select, improved {tem melhorado} other {tem piorado}}: nas últimas duas semanas registou {recent} {unit}, face a {previous} nas duas semanas anteriores (objetivo: {target} {unit} por semana).',
  'analysis.habitsTrend.explain':
    'Comparei a taxa de cumprimento do hábito nas últimas duas semanas ({recentFrom}-{recentTo}) com a das duas semanas anteriores ({previousFrom}-{previousTo}): {recentRate} face a {previousRate}. Diferença: {diff} pontos percentuais. Intensidade da mudança: {strength}.',
  'analysis.habitsTrend.title':
    'O hábito «{habit}» {direction, select, improved {tem melhorado} other {tem piorado}} nas últimas duas semanas',
  'analysis.habitsTrend.metric': 'Taxa de cumprimento: {habit}',
  'analysis.habitsTrend.groupA': 'Últimas duas semanas',
  'analysis.habitsTrend.groupB': 'Duas semanas anteriores',

  // Best / hardest days ------------------------------------------------------------------
  'analysis.bestWorst.label': 'os melhores dias e os mais difíceis',
  'analysis.bestWorst.describedDay': '{day} («{title}»)',
  'analysis.bestWorst.noTitle': 'Sem título',
  'analysis.bestWorst.extraValue': '{titles}: pontuação {score}',
  'analysis.bestWorst.text':
    '{kind, select, best {Os melhores dias} other {Os dias mais difíceis}} do período, segundo uma pontuação combinada de humor, energia e stress: {days}.',
  'analysis.bestWorst.explainScore':
    '{count, plural, one {Para o único dia analisado} other {Para cada um dos # dias}} calculei uma pontuação combinada: a média do humor, do nível de energia e de (11 menos o nível de stress), a partir dos valores registados nesse dia.',
  'analysis.bestWorst.explainMeans':
    'A pontuação média do período: {overall}. {kind, select, best {{count, plural, one {O melhor dia obteve} =3 {Os três melhores dias obtiveram} other {Os melhores dias obtiveram}}} other {{count, plural, one {O dia mais difícil obteve} =3 {Os três dias mais difíceis obtiveram} other {Os dias mais difíceis obtiveram}}}} uma média de {mean}.',
  'analysis.bestWorst.explainDiff': 'Diferença em relação à média: {diff} pontos. Intensidade da diferença: {strength}.',
  'analysis.bestWorst.title': '{kind, select, best {Os melhores dias do período} other {Os dias mais difíceis do período}}',
  'analysis.bestWorst.metric': 'Pontuação combinada (humor + energia + stress invertido)',
  'analysis.bestWorst.groupA': '{kind, select, best {Os melhores dias} other {Os dias mais difíceis}}',
  'analysis.bestWorst.nothing':
    'Analisei {label} ao longo de {count, plural, one {# dia} other {# dias}}; as pontuações foram semelhantes e nenhum dia se destacou em particular.',

  // Streaks -------------------------------------------------------------------------------
  'analysis.streaks.label': 'as sequências de escrita e de hábitos',
  'analysis.streaks.entriesTitle': 'Sequência de escrita de {count, plural, one {# dia} other {# dias}}',
  'analysis.streaks.entriesText':
    'Muito bem! Escreveu no seu diário {count, plural, one {# dia seguido} other {# dias seguidos}} ({from}-{to}).',
  'analysis.streaks.entriesExplain':
    'Contei os dias consecutivos com pelo menos uma entrada, até hoje ou ontem. Sequência atual: {count, plural, one {# dia} other {# dias}}, de {from} a {to}. Sequência mais longa do período: {best, plural, one {# dia} other {# dias}}.',
  'analysis.streaks.entriesMetric': 'Dias com escrita',
  'analysis.streaks.currentDays': 'Dias da sequência atual',
  'analysis.streaks.daysWithEntry': 'Dias com pelo menos uma entrada no período',
  'analysis.streaks.habitTitle': 'Sequência de {count, plural, one {# dia} other {# dias}} do hábito «{habit}»',
  'analysis.streaks.habitText':
    'Concluiu o hábito «{habit}» {count, plural, one {# dia seguido} other {# dias seguidos}} ({from}-{to}).',
  'analysis.streaks.habitExplain':
    'Contei os dias consecutivos em que o hábito «{habit}» foi marcado como concluído, até hoje ou ontem. Sequência atual: {count, plural, one {# dia} other {# dias}}. Sequência mais longa do período: {best, plural, one {# dia} other {# dias}}.',
  'analysis.streaks.habitMetric': 'Cumprimento do hábito {habit}',
  'analysis.streaks.daysCompleted': 'Dias em que o hábito foi concluído no período',
  'analysis.streaks.weeklyTitle': 'Sequência de {count, plural, one {# semana} other {# semanas}} do hábito «{habit}»',
  'analysis.streaks.weeklyText':
    'Cumpriu o objetivo do hábito «{habit}» {count, plural, one {# semana seguida} other {# semanas seguidas}} ({from}-{to}).',
  'analysis.streaks.weeklyExplain':
    'Somei a quantidade registada do hábito «{habit}» em cada semana e comparei-a com o objetivo semanal ({target}). Sequência atual de semanas com o objetivo cumprido: {count, plural, one {# semana} other {# semanas}}.',
  'analysis.streaks.weeklyMetric': 'Objetivo semanal cumprido: {habit}',
  'analysis.streaks.currentWeeks': 'Semanas da sequência atual',
  'analysis.streaks.weeksWithLogs': 'Semanas com registos no período',
  'analysis.streaks.none':
    'Não foram encontradas sequências ativas (uma sequência de escrita de {entryMin} dias ou mais, ou uma sequência de um hábito de {habitMin} dias ou semanas ou mais).',

  // Anomalies -----------------------------------------------------------------------------
  'analysis.anomalies.label': 'os dias invulgares no humor ou no stress',
  'analysis.anomalies.textOne':
    'Parece que, no dia {day}, {gender, select, f {a sua {metricDefined} foi {side, select, high {invulgarmente alta} other {invulgarmente baixa}}} other {o seu {metricDefined} foi {side, select, high {invulgarmente alto} other {invulgarmente baixo}}}} em comparação com o resto do período ({value}, face a uma média de {mean}).',
  'analysis.anomalies.textMany':
    'Parece que, em {count, plural, one {# dia} other {# dias}}, {gender, select, f {a sua {metricDefined} foi {side, select, high {invulgarmente alta} other {invulgarmente baixa}}} other {o seu {metricDefined} foi {side, select, high {invulgarmente alto} other {invulgarmente baixo}}}} em comparação com o resto do período: {days}; a média do período: {mean}.',
  'analysis.anomalies.textManyMore':
    'Parece que, em {count, plural, one {# dia} other {# dias}}, {gender, select, f {a sua {metricDefined} foi {side, select, high {invulgarmente alta} other {invulgarmente baixa}}} other {o seu {metricDefined} foi {side, select, high {invulgarmente alto} other {invulgarmente baixo}}}} em comparação com o resto do período: {days} e outros; a média do período: {mean}.',
  'analysis.anomalies.dayItem': '{day} ({value})',
  'analysis.anomalies.detail': '{date}: {value} ({z} desvios-padrão {side, select, above {acima da média} other {abaixo da média}})',
  'analysis.anomalies.explain':
    'Analisei {count, plural, one {# dia} other {# dias}} com registo de {metric}. Média: {mean}; desvio-padrão: {sd}. Um dia é considerado invulgar quando o seu valor se afasta da média {z} desvios-padrão ou mais. {details}. Intensidade do desvio: {strength}.',
  'analysis.anomalies.title':
    '{count, plural, one {Um dia com} other {Dias com}} {gender, select, f {{side, select, high {{metric} invulgarmente alta} other {{metric} invulgarmente baixa}}} hours {{side, select, high {{metric} invulgarmente altas} other {{metric} invulgarmente baixas}}} other {{side, select, high {{metric} invulgarmente alto} other {{metric} invulgarmente baixo}}}}',
  'analysis.anomalies.groupA': 'Dias invulgares',
  'analysis.anomalies.zValue': '{value} (z {z})',
  'analysis.anomalies.nothing':
    'Procurei dias invulgares ao longo de {count, plural, one {# dia} other {# dias}} e não encontrei nenhum que se afaste da média {z} desvios-padrão ou mais.',

  // Emotion patterns ----------------------------------------------------------------------
  'analysis.emotion.label': 'os padrões de emoções por dias, pessoas e locais',
  'analysis.emotion.metric': 'A emoção {emotion}',
  'analysis.emotion.groupA': 'Dias com a emoção «{emotion}»',
  'analysis.emotion.weekdayTitle': 'A emoção «{emotion}» aparece sobretudo {onWeekday}',
  'analysis.emotion.weekdayText':
    'Parece que, nos seus dados, a emoção «{emotion}» apareceu sobretudo {onWeekday} ({top} de {total} vezes).',
  'analysis.emotion.weekdayExplain':
    'Analisei {count, plural, one {# dia} other {# dias}}. A emoção «{emotion}» foi registada em {total, plural, one {# dia} other {# dias}}; {top} deles foram {weekdays} ({share}), enquanto {weekdays} representam {baseline} de todos os dias analisados. Força do padrão: {strength}.',
  'analysis.emotion.groupBWeekday': 'Destes, {weekdays}',
  'analysis.emotion.weekdayShareKey': 'Proporção de {weekdays} em todos os dias',
  'analysis.emotion.personTitle': 'A emoção «{emotion}» e {name}',
  'analysis.emotion.placeTitle': 'A emoção «{emotion}» e «{place}»',
  'analysis.emotion.personText':
    'Parece que, nos seus dados, a emoção «{emotion}» apareceu muitas vezes nos dias em que esteve com {name} ({with} de {total} vezes).',
  'analysis.emotion.placeText':
    'Parece que, nos seus dados, a emoção «{emotion}» apareceu muitas vezes nos dias em que o local foi «{place}» ({with} de {total} vezes).',
  'analysis.emotion.personExplain':
    'Analisei {count, plural, one {# dia} other {# dias}}. A emoção «{emotion}» foi registada em {total} dias; em {with} deles ({share}), {name} também aparecia na entrada. {name} aparece em {baselineCount} dos {count} dias no total ({baseline}). Força do padrão: {strength}.',
  'analysis.emotion.placeExplain':
    'Analisei {count, plural, one {# dia} other {# dias}}. A emoção «{emotion}» foi registada em {total} dias; em {with} deles ({share}), o local «{place}» também aparecia na entrada. O local «{place}» aparece em {baselineCount} dos {count} dias no total ({baseline}). Força do padrão: {strength}.',
  'analysis.emotion.groupBPerson': 'Destes, com {name}',
  'analysis.emotion.groupBPlace': 'Destes, em «{place}»',
  'analysis.emotion.personShareKey': 'Proporção de {name} em todos os dias',
  'analysis.emotion.placeShareKey': 'Proporção do local «{place}» em todos os dias',
  'analysis.emotion.nothing':
    'Analisei {count, plural, one {# emoção} other {# emoções}} que se repetiram pelo menos {min} vezes e não encontrei nenhuma concentração digna de nota em dias, pessoas ou locais específicos.',
};
export default messages;
