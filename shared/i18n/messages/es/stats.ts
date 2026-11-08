/** es - stats messages. Keys are prefixed 'stats.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Statistics page (src/pages/StatsPage.tsx) ----------------------------------------
  'stats.title': 'Estadísticas',
  'stats.period': 'Periodo',
  'stats.movingAvg': 'Media móvil (7 días)',
  'stats.overTime': '{label} a lo largo del tiempo',
  'stats.weekday.section': 'Por día de la semana',
  'stats.weekday.chart': 'Medias por día de la semana',
  'stats.weekday.axis': 'Día de la semana',
  'stats.habits.section': 'Hábitos',
  'stats.habits.chart': '{name}: valores diarios',
  'stats.habits.empty': 'No hay hábitos con registros en este periodo.',
  // {frequency} is 'daily' | 'weekly'; {current}/{best} are formatted streaks ("5 days").
  'stats.habits.summary':
    'Cumplimiento: {percent} ({completed} de {frequency, select, weekly {{total, plural, one {# semana} other {# semanas}}} other {{total, plural, one {# día} other {# días}}}}), racha actual: {current}, mejor racha: {best}',
  'stats.empty.title': 'Todavía no hay datos para este periodo',
  'stats.empty.text': 'Escribe entradas y registra hábitos para ver aquí gráficos y tendencias.',
  'stats.newEntry': 'Nueva entrada',
  'stats.noValues': 'No hay datos en este periodo.',
  'stats.overview': '{entries, plural, one {# entrada} other {# entradas}} en {days, plural, one {# día} other {# días}} ({from} – {to})',

  // Series summary under every chart -------------------------------------------------
  'stats.summary.base': 'Media: {mean} ({sample}, mínimo {min}, máximo {max}).',
  'stats.summary.sampleDays': '{count, plural, one {# día} other {# días}}',
  'stats.summary.sampleValues': '{count, plural, one {# valor} other {# valores}}',
  'stats.summary.noChange': 'Sin cambios respecto al periodo anterior ({previous}).',
  'stats.summary.change': 'Frente a {previous} en el periodo anterior ({diff}).',
  'stats.summary.sentences': '{summary} {comparison}',
  'stats.summary.entriesPerDay': 'entradas al día',

  // Metric titles (chart sections; also the home page tiles) -------------------------
  'stats.metric.mood': 'Estado de ánimo',
  'stats.metric.energy': 'Nivel de energía',
  'stats.metric.stress': 'Nivel de estrés',
  'stats.metric.sleepHours': 'Horas de sueño',
  'stats.metric.sleepQuality': 'Calidad del sueño',
  'stats.metric.exerciseMinutes': 'Ejercicio',
  'stats.metric.entriesPerDay': 'Entradas del diario',

  // Periods (pickers on the statistics and insights pages) ---------------------------
  'stats.period.7d': '7 días',
  'stats.period.30d': '30 días',
  'stats.period.3m': '3 meses',
  'stats.period.6m': '6 meses',
  'stats.period.1y': '1 año',
  'stats.period.all': 'Todo el periodo',
  'stats.period.in':
    '{period, select, 7d {en los últimos 7 días} 30d {en los últimos 30 días} 3m {en los últimos 3 meses} 6m {en los últimos 6 meses} 1y {en el último año} all {en todo el periodo} other {en el periodo}}',

  // Charts (src/components/charts/chart-utils.ts) ------------------------------------
  'stats.chart.noData': 'No hay datos que mostrar',
  'stats.chart.xAxisDate': 'Fecha',
  'stats.chart.valueWithUnit': '{value} {unit}',
  // Tooltip of one bar / marker: series label, x label (a date or a weekday), value with unit.
  'stats.chart.pointTooltip': '{label}, {x}: {value}',
  'stats.chart.summary': '{label}: {count, plural, one {# valor} other {# valores}}, mínimo {min}, máximo {max}, media {mean}.',
  'stats.chart.summaryEmpty': '{label}: sin datos.',
  'stats.chart.range': '{count, plural, one {Un punto temporal: {from}.} other {# puntos temporales, del {from} al {to}.}}',
};
export default messages;
