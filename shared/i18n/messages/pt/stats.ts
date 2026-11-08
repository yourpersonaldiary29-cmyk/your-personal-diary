/** pt - stats messages. Keys are prefixed 'stats.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Statistics page (src/pages/StatsPage.tsx) ----------------------------------------
  'stats.title': 'Estatísticas',
  'stats.period': 'Período',
  'stats.movingAvg': 'Média móvel (7 dias)',
  'stats.overTime': '{label} ao longo do tempo',
  'stats.weekday.section': 'Por dia da semana',
  'stats.weekday.chart': 'Médias por dia da semana',
  'stats.weekday.axis': 'Dia da semana',
  'stats.habits.section': 'Hábitos',
  'stats.habits.chart': '{name}: valores diários',
  'stats.habits.empty': 'Não há hábitos com registos neste período.',
  // {frequency} is 'daily' | 'weekly'; {current}/{best} are formatted streaks ("5 days").
  'stats.habits.summary':
    'Cumprimento: {percent} ({completed} de {frequency, select, weekly {{total, plural, one {# semana} other {# semanas}}} other {{total, plural, one {# dia} other {# dias}}}}), sequência atual: {current}, melhor sequência: {best}',
  'stats.empty.title': 'Ainda não há dados para este período',
  'stats.empty.text': 'Escreva entradas e registe hábitos para ver aqui gráficos e tendências.',
  'stats.newEntry': 'Nova entrada',
  'stats.noValues': 'Não há dados neste período.',
  'stats.overview': '{entries, plural, one {# entrada} other {# entradas}} em {days, plural, one {# dia} other {# dias}} ({from} – {to})',

  // Series summary under every chart -------------------------------------------------
  'stats.summary.base': 'Média: {mean} ({sample}, mínimo {min}, máximo {max}).',
  'stats.summary.sampleDays': '{count, plural, one {# dia} other {# dias}}',
  'stats.summary.sampleValues': '{count, plural, one {# valor} other {# valores}}',
  'stats.summary.noChange': 'Sem alterações face ao período anterior ({previous}).',
  'stats.summary.change': 'Em comparação com {previous} no período anterior ({diff}).',
  'stats.summary.sentences': '{summary} {comparison}',
  'stats.summary.entriesPerDay': 'entradas por dia',

  // Metric titles (chart sections; also the home page tiles) -------------------------
  'stats.metric.mood': 'Humor',
  'stats.metric.energy': 'Nível de energia',
  'stats.metric.stress': 'Nível de stress',
  'stats.metric.sleepHours': 'Horas de sono',
  'stats.metric.sleepQuality': 'Qualidade do sono',
  'stats.metric.exerciseMinutes': 'Exercício',
  'stats.metric.entriesPerDay': 'Entradas do diário',

  // Periods (pickers on the statistics and insights pages) ---------------------------
  'stats.period.7d': '7 dias',
  'stats.period.30d': '30 dias',
  'stats.period.3m': '3 meses',
  'stats.period.6m': '6 meses',
  'stats.period.1y': '1 ano',
  'stats.period.all': 'Todo o período',
  'stats.period.in':
    '{period, select, 7d {nos últimos 7 dias} 30d {nos últimos 30 dias} 3m {nos últimos 3 meses} 6m {nos últimos 6 meses} 1y {no último ano} all {em todo o período} other {no período}}',

  // Charts (src/components/charts/chart-utils.ts) ------------------------------------
  'stats.chart.noData': 'Não há dados para apresentar',
  'stats.chart.xAxisDate': 'Data',
  'stats.chart.valueWithUnit': '{value} {unit}',
  // Tooltip of one bar / marker: series label, x label (a date or a weekday), value with unit.
  'stats.chart.pointTooltip': '{label}, {x}: {value}',
  'stats.chart.summary': '{label}: {count, plural, one {# valor} other {# valores}}, mínimo {min}, máximo {max}, média {mean}.',
  'stats.chart.summaryEmpty': '{label}: sem dados.',
  'stats.chart.range': '{count, plural, one {Um ponto temporal: {from}.} other {# pontos temporais, de {from} a {to}.}}',
};
export default messages;
